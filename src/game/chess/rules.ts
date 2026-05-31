// Wall- and freeze-aware chess rules.
//
// We previously wrapped chess.js, but chess.js doesn't know about walls or
// frozen pieces and its internals don't expose enough hooks to teach it.
// Rather than wedge overlays into chess.js, every move-generation /
// check-evaluation decision goes through this module. We own the position,
// the FEN parser, and the rule logic. Stockfish (which still operates on a
// plain FEN with no overlays) is now the only consumer that doesn't see
// walls — see Match.tsx for the "AI move illegal under our rules" fallback.
//
// Rules summary (per docs/design/board.md and docs/design/cards.md):
//   - Walls block all movement: knights cannot land on a walled square;
//     sliding pieces cannot land on or pass through one; pawn pushes /
//     captures cannot enter a wall; the king cannot castle through one.
//   - Walls also act as opaque blockers for attack rays — i.e. a wall
//     between an attacker and a target stops the attacker from defending or
//     checking through it.
//   - Frozen pieces lose all movement, attacks, and defence for the duration
//     of the freeze. A frozen rook does not defend a queen on the same file.
//
// We don't yet model destructible blocks distinctly from permanent walls —
// both behave identically as blockers. The card layer still tracks
// expiration; rule logic only sees "is this square walled right now?".

import type {
  AlgebraicSquare,
  BoardSize,
  EmpowerPattern,
  FileIndex,
  Piece,
  PieceType,
  RankIndex,
  Side,
} from "../types";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export const STANDARD_SIZE: BoardSize = { files: 8, ranks: 8 };

export function squareName(file: FileIndex, rank: RankIndex): AlgebraicSquare {
  // Algebraic ranks have one or two digits ("a1".."h10" — we cap at 8 today,
  // but the helper is robust either way).
  return `${FILES[file]}${rank + 1}`;
}

export function squareCoords(s: AlgebraicSquare): { file: FileIndex; rank: RankIndex } {
  const file = FILES.indexOf(s[0] as (typeof FILES)[number]);
  const rank = Number(s.slice(1)) - 1;
  return { file: file as FileIndex, rank: rank as RankIndex };
}

export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Promotion rank for `side` on a board of `size.ranks` ranks.
 *
 * Optionally consults `overlays.pawnPromotionRanks` for an artifact-driven
 * override (e.g. Promotion Engine = rank 7). The override is a 1-indexed
 * rank for the player side (e.g. 7 → rank-7 promotes). For the opponent
 * side the rank is mirrored (`size.ranks - rank + 1` from rank 1 = the
 * board's own rank-1, etc.) but no current artifact targets the opponent
 * so we keep the override player-only in practice.
 */
export function promotionRank(size: BoardSize, side: Side, overlays?: Overlays): RankIndex {
  const override = overlays?.pawnPromotionRanks?.[side];
  if (typeof override === "number" && override >= 2 && override <= size.ranks) {
    // 1-indexed → RankIndex (0-indexed). For "player" the override is the
    // forward rank a pawn promotes ON, exactly as written. For "opponent"
    // the override is mirrored from the bottom of the board.
    return side === "player"
      ? ((override - 1) as RankIndex)
      : ((size.ranks - override) as RankIndex);
  }
  return side === "player" ? ((size.ranks - 1) as RankIndex) : (0 as RankIndex);
}

/** Pawn double-move source rank ("starting rank") for `side`. */
export function pawnStartRank(size: BoardSize, side: Side): RankIndex {
  return side === "player" ? 1 : size.ranks - 2;
}

/**
 * Whether castling is even possible on this board. We disable castling on
 * boards narrower than 8 files: most small-board piece sets don't have two
 * rooks, and adapting Chess960's "king to g-file / rook to f-file" landing
 * squares to a 6-file board is not worth the complexity. Documented as a
 * deliberate rule difference — see `docs/design/chess-rules.md`.
 */
export function castlingAvailable(size: BoardSize): boolean {
  return size.files === 8;
}

export type CastlingRights = { K: boolean; Q: boolean; k: boolean; q: boolean };

export type Position = {
  /** Square → piece. Empty squares have no entry. */
  pieces: ReadonlyMap<AlgebraicSquare, Piece>;
  /** Side to move. */
  turn: Side;
  castling: CastlingRights;
  /**
   * En-passant target square — i.e. the square *behind* the pawn that just
   * moved two ranks. Null if no double-push was the previous move.
   */
  enPassant: AlgebraicSquare | null;
  halfmove: number;
  fullmove: number;
  /**
   * Board dimensions. Defaults to 8x8 for back-compat. All move generation
   * iterates within these bounds, never the historical hardcoded 8.
   */
  size: BoardSize;
};

/**
 * Card-spawned overlays seen by the rule engine. All fields are optional in
 * the type; rule code reads them via `get*` helpers below that supply empty
 * defaults. This keeps legacy callers (and tests) that only set walls and
 * freezes working unchanged.
 */
export type Overlays = {
  walls: ReadonlySet<AlgebraicSquare>;
  freezes: ReadonlySet<AlgebraicSquare>;
  /** Pieces that may move only if the move is a capture. */
  roots?: ReadonlySet<AlgebraicSquare>;
  /** Pieces that may move but may not capture. */
  disarms?: ReadonlySet<AlgebraicSquare>;
  /** Pieces forced to move (and prefer captures). */
  compels?: ReadonlySet<AlgebraicSquare>;
  /** Player pieces that cannot be captured. */
  shields?: ReadonlySet<AlgebraicSquare>;
  /** Squares where pieces standing on them cannot be captured. */
  sanctuaries?: ReadonlySet<AlgebraicSquare>;
  /**
   * Pieces with one or more additional movement patterns.
   * Multiple Patch cards can stack on the same piece (e.g. Knight Patch +
   * Bishop Patch); the value is the set of granted patterns.
   */
  empowers?: ReadonlyMap<AlgebraicSquare, ReadonlySet<EmpowerPattern>>;
  /**
   * Pawn Storm artifact (player only): pawns may double-push from any rank.
   */
  pawnDoubleFromAnyRank?: ReadonlySet<Side>;
  /**
   * Drill Sergeant artifact (player only): pawns may move 1 square backward
   * (no capture).
   */
  pawnBackwardStep?: ReadonlySet<Side>;
  /**
   * Promotion Engine artifact (player only): override the promotion rank for
   * a side. The number is the 1-indexed rank that triggers promotion (e.g. 7
   * means rank 7 promotes instead of the default rank 8 for player pawns).
   */
  pawnPromotionRanks?: { player?: number; opponent?: number };
  /**
   * Sniper Optics artifact (player only): rooks may capture an enemy piece
   * with up to N walls between attacker and target. Movement to empty
   * squares past a wall is still blocked.
   */
  rookAttackThroughWalls?: { player?: number; opponent?: number };
  /**
   * Mutex Lock zone: squares the opponent may NOT move to. When `pos.turn`
   * is "opponent", any move whose destination is in this set is filtered
   * out by `pseudoLegalMoves`. Player moves are unaffected. Sliding pieces
   * may still pass *through* a forbidden square — only the destination is
   * gated.
   */
  forbiddenForOpponent?: ReadonlySet<AlgebraicSquare>;
  /** Sudo: pawns on these squares generate queen moves instead of pawn moves. */
  sudoSquares?: ReadonlySet<AlgebraicSquare>;
  /** Downgrade: pieces on these squares generate pawn moves instead of their native moves. */
  downgrades?: ReadonlySet<AlgebraicSquare>;
};

const EMPTY_SET: ReadonlySet<AlgebraicSquare> = new Set();
const EMPTY_EMPOWERS: ReadonlyMap<AlgebraicSquare, ReadonlySet<EmpowerPattern>> = new Map();

const roots = (o: Overlays) => o.roots ?? EMPTY_SET;
const disarms = (o: Overlays) => o.disarms ?? EMPTY_SET;
const compels = (o: Overlays) => o.compels ?? EMPTY_SET;
const shields = (o: Overlays) => o.shields ?? EMPTY_SET;
const sanctuaries = (o: Overlays) => o.sanctuaries ?? EMPTY_SET;
const empowers = (o: Overlays) => o.empowers ?? EMPTY_EMPOWERS;

export const NO_OVERLAYS: Overlays = {
  walls: new Set(),
  freezes: new Set(),
};

export type RuleMove = {
  from: AlgebraicSquare;
  to: AlgebraicSquare;
  promotion?: "q" | "r" | "b" | "n";
  /** En-passant capture: square of the captured pawn (differs from `to`). */
  epVictim?: AlgebraicSquare;
  /** Castling side; only set on king's two-square move. */
  castle?: "K" | "Q";
  isCapture: boolean;
  capturedPiece?: Piece;
  isDouble: boolean;
  isPromotion: boolean;
};

// ---- FEN parse / serialize -------------------------------------------------

const PIECE_FROM_FEN: Record<string, Piece> = {
  p: { type: "pawn", side: "opponent" },
  n: { type: "knight", side: "opponent" },
  b: { type: "bishop", side: "opponent" },
  r: { type: "rook", side: "opponent" },
  q: { type: "queen", side: "opponent" },
  k: { type: "king", side: "opponent" },
  P: { type: "pawn", side: "player" },
  N: { type: "knight", side: "player" },
  B: { type: "bishop", side: "player" },
  R: { type: "rook", side: "player" },
  Q: { type: "queen", side: "player" },
  K: { type: "king", side: "player" },
};

function fenCharFor(piece: Piece): string {
  const map = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" } as const;
  const c = map[piece.type];
  return piece.side === "player" ? c.toUpperCase() : c;
}

/**
 * Parse a FEN. Standard 8x8 FEN works as-is. For non-8x8 boards, pass `size`
 * explicitly — the parser then validates the board section against the given
 * dimensions. We don't try to invent a wire-level FEN extension; callers that
 * persist non-8x8 positions store `{ fen, size }` together (see
 * `src/game/chess/positions.ts`).
 */
export function parseFen(fen: string, size: BoardSize = STANDARD_SIZE): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error(`invalid FEN: ${fen}`);
  const [board, turnPart, castlingPart, epPart, halfmovePart = "0", fullmovePart = "1"] = parts;

  const pieces = new Map<AlgebraicSquare, Piece>();
  const ranks = board.split("/");
  if (ranks.length !== size.ranks) {
    throw new Error(`invalid FEN board (expected ${size.ranks} ranks): ${board}`);
  }
  for (let r = 0; r < size.ranks; r++) {
    const row = ranks[r];
    let f = 0;
    let i = 0;
    while (i < row.length) {
      const c = row[i];
      if (/[0-9]/.test(c)) {
        // Multi-digit empty count (so 6x6 / 6x8 boards can use "6" or "10").
        let j = i + 1;
        while (j < row.length && /[0-9]/.test(row[j])) j++;
        f += Number(row.slice(i, j));
        i = j;
        continue;
      }
      if (PIECE_FROM_FEN[c]) {
        const rank = (size.ranks - 1 - r) as RankIndex; // FEN top rank first
        pieces.set(squareName(f as FileIndex, rank), PIECE_FROM_FEN[c]);
        f++;
        i++;
        continue;
      }
      throw new Error(`invalid FEN char: ${c}`);
    }
    if (f !== size.files) throw new Error(`invalid FEN row width: ${row}`);
  }

  const turn: Side = turnPart === "w" ? "player" : "opponent";

  const castling: CastlingRights = {
    K: castlingPart.includes("K"),
    Q: castlingPart.includes("Q"),
    k: castlingPart.includes("k"),
    q: castlingPart.includes("q"),
  };

  const enPassant = epPart === "-" ? null : epPart;
  const halfmove = Number(halfmovePart) || 0;
  const fullmove = Number(fullmovePart) || 1;

  return { pieces, turn, castling, enPassant, halfmove, fullmove, size };
}

export function serializeFen(pos: Position): string {
  const { files, ranks: rankCount } = pos.size;
  const ranks: string[] = [];
  for (let r = rankCount - 1; r >= 0; r--) {
    let row = "";
    let empty = 0;
    for (let f = 0; f < files; f++) {
      const sq = squareName(f as FileIndex, r as RankIndex);
      const p = pos.pieces.get(sq);
      if (!p) {
        empty++;
        continue;
      }
      if (empty) {
        row += String(empty);
        empty = 0;
      }
      row += fenCharFor(p);
    }
    if (empty) row += String(empty);
    ranks.push(row);
  }
  const turn = pos.turn === "player" ? "w" : "b";
  let castling = "";
  if (pos.castling.K) castling += "K";
  if (pos.castling.Q) castling += "Q";
  if (pos.castling.k) castling += "k";
  if (pos.castling.q) castling += "q";
  if (!castling) castling = "-";
  const ep = pos.enPassant ?? "-";
  return `${ranks.join("/")} ${turn} ${castling} ${ep} ${pos.halfmove} ${pos.fullmove}`;
}

// ---- Move geometry ---------------------------------------------------------

const KNIGHT_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];
const ROOK_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const BISHOP_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];
const QUEEN_DIRS: ReadonlyArray<readonly [number, number]> = [...ROOK_DIRS, ...BISHOP_DIRS];
const KING_DIRS = QUEEN_DIRS;

function inBounds(size: BoardSize, file: number, rank: number): boolean {
  return file >= 0 && file < size.files && rank >= 0 && rank < size.ranks;
}
function sqAt(file: number, rank: number): AlgebraicSquare {
  return squareName(file as FileIndex, rank as RankIndex);
}
const opp = (s: Side): Side => (s === "player" ? "opponent" : "player");

/**
 * Squares the piece passes through on its way from `from` to `to`, in order,
 * INCLUDING the destination but excluding the origin. For sliding pieces
 * (bishop / rook / queen) this is every square on the line. For knights and
 * the king it's just the destination. For pawns it includes the intermediate
 * square on a double push.
 *
 * Used by the trap resolver — a sliding piece that crosses a trap square
 * still triggers it even if it doesn't stop there.
 */
export function movePath(
  pieceType: PieceType,
  from: AlgebraicSquare,
  to: AlgebraicSquare,
): AlgebraicSquare[] {
  const a = squareCoords(from);
  const b = squareCoords(to);
  const df = b.file - a.file;
  const dr = b.rank - a.rank;
  if (df === 0 && dr === 0) return [];

  // Knight: jump.
  if (pieceType === "knight") return [to];
  // King: castling moves two squares but visually jumps; passing-through
  // would require the path to be clear (it already is since castling can't
  // happen otherwise). The intermediate square trips a trap too.
  if (pieceType === "king") {
    const steps = Math.max(Math.abs(df), Math.abs(dr));
    const sf = Math.sign(df);
    const sr = Math.sign(dr);
    const out: AlgebraicSquare[] = [];
    for (let i = 1; i <= steps; i++) out.push(sqAt(a.file + sf * i, a.rank + sr * i));
    return out;
  }
  // Pawn: 1 or 2 squares straight, or 1 square diagonal capture.
  if (pieceType === "pawn") {
    const steps = Math.max(Math.abs(df), Math.abs(dr));
    const sf = Math.sign(df);
    const sr = Math.sign(dr);
    const out: AlgebraicSquare[] = [];
    for (let i = 1; i <= steps; i++) out.push(sqAt(a.file + sf * i, a.rank + sr * i));
    return out;
  }
  // Sliding pieces.
  const sf = Math.sign(df);
  const sr = Math.sign(dr);
  const steps = Math.max(Math.abs(df), Math.abs(dr));
  const out: AlgebraicSquare[] = [];
  for (let i = 1; i <= steps; i++) out.push(sqAt(a.file + sf * i, a.rank + sr * i));
  return out;
}

// ---- Attacks ---------------------------------------------------------------

/**
 * True iff `target` is attacked by any piece of `attacker` side, accounting
 * for walls (block sliding rays) and freezes (frozen pieces don't attack).
 *
 * Used both for "is the king in check?" and for "would the king be safe
 * stepping to this square?". Knights still jump over walls — but they
 * cannot LAND on one (that's a destination check, not an attack check).
 */
export function isSquareAttacked(
  pos: Position,
  overlays: Overlays,
  target: AlgebraicSquare,
  attacker: Side,
): boolean {
  const { file: tf, rank: tr } = squareCoords(target);
  const isFrozen = (sq: AlgebraicSquare) => overlays.freezes.has(sq);

  const size = pos.size;
  // Pawn attacks: an attacker pawn diagonally one rank "behind" the target.
  // Player (white) pawns advance +1 rank → they attack squares on their +1 diag.
  // So a player pawn attacking `target` sits at (tf±1, tr-1). Opponent: (tf±1, tr+1).
  const pawnSrcDr = attacker === "player" ? -1 : 1;
  for (const df of [-1, 1]) {
    const sf = tf + df;
    const sr = tr + pawnSrcDr;
    if (!inBounds(size, sf, sr)) continue;
    const sq = sqAt(sf, sr);
    const p = pos.pieces.get(sq);
    if (p && p.side === attacker && p.type === "pawn" && !isFrozen(sq)) return true;
  }

  // Knight attacks
  for (const [df, dr] of KNIGHT_DELTAS) {
    const sf = tf + df;
    const sr = tr + dr;
    if (!inBounds(size, sf, sr)) continue;
    const sq = sqAt(sf, sr);
    const p = pos.pieces.get(sq);
    if (p && p.side === attacker && p.type === "knight" && !isFrozen(sq)) return true;
  }

  // King attacks (one square)
  for (const [df, dr] of KING_DIRS) {
    const sf = tf + df;
    const sr = tr + dr;
    if (!inBounds(size, sf, sr)) continue;
    const sq = sqAt(sf, sr);
    const p = pos.pieces.get(sq);
    if (p && p.side === attacker && p.type === "king" && !isFrozen(sq)) return true;
  }

  // Sliding-piece rays. A wall stops the ray; a piece stops the ray (and
  // contributes if it matches the ray direction and isn't frozen).
  const rookWallSkip = overlays.rookAttackThroughWalls?.[attacker] ?? 0;
  for (const [df, dr] of QUEEN_DIRS) {
    const isDiag = df !== 0 && dr !== 0;
    let sf = tf + df;
    let sr = tr + dr;
    // For rook attack-through-wall: when scanning an orthogonal ray for an
    // attacking rook on `attacker`'s side, allow up to `rookWallSkip` walls
    // to be ignored before the ray terminates on a piece.
    let wallsRemaining = isDiag ? 0 : rookWallSkip;
    while (inBounds(size, sf, sr)) {
      const sq = sqAt(sf, sr);
      if (overlays.walls.has(sq)) {
        if (wallsRemaining > 0) {
          wallsRemaining--;
          sf += df;
          sr += dr;
          continue;
        }
        break;
      }
      const p = pos.pieces.get(sq);
      if (p) {
        if (p.side === attacker && !isFrozen(sq)) {
          if (p.type === "queen") return true;
          if (isDiag && p.type === "bishop") return true;
          if (!isDiag && p.type === "rook") return true;
        }
        break; // any piece (frozen or not) blocks the ray
      }
      sf += df;
      sr += dr;
    }
  }

  return false;
}

export function findKing(pos: Position, side: Side): AlgebraicSquare | null {
  for (const [sq, p] of pos.pieces) {
    if (p.side === side && p.type === "king") return sq;
  }
  return null;
}

export function isInCheck(pos: Position, overlays: Overlays): boolean {
  const k = findKing(pos, pos.turn);
  if (!k) return false;
  return isSquareAttacked(pos, overlays, k, opp(pos.turn));
}

// ---- Pseudo-legal generation ----------------------------------------------

export function pseudoLegalMoves(
  pos: Position,
  overlays: Overlays,
  fromSquare?: AlgebraicSquare,
): RuleMove[] {
  const out: RuleMove[] = [];

  const generate = (sq: AlgebraicSquare, piece: Piece) => {
    if (overlays.freezes.has(sq)) return;
    const moves: RuleMove[] = [];
    addPieceMoves(moves, sq, piece, pos, overlays);

    // Empower: append additional movement pattern(s). A piece can have
    // multiple patterns stacked on it (e.g. via multiple Patch cards).
    const patterns = empowers(overlays).get(sq);
    if (patterns) {
      for (const pattern of patterns) addEmpowerMoves(moves, sq, piece, pos, overlays, pattern);
    }

    // Root: piece may move only to capture an immediately adjacent piece
    //   (one square in any direction — king-step distance).
    // Disarm: piece may move only if the move is NOT a capture.
    // Status restrictions are applied to the piece's moves only — not other pieces.
    const rooted = roots(overlays).has(sq);
    const disarmed = disarms(overlays).has(sq);
    const sanc = sanctuaries(overlays);
    const sh = shields(overlays);
    // Mutex Lock: enemy moves into a forbidden zone are not legal. Applies
    // only when the side to move is the opponent (the zone is player-anchored
    // and player moves are unaffected). Only the destination square is gated;
    // sliding through is fine.
    const forbidden = pos.turn === "opponent" ? overlays.forbiddenForOpponent : undefined;
    for (const m of moves) {
      if (rooted) {
        if (!m.isCapture) continue;
        const a = squareCoords(m.from);
        const b = squareCoords(m.to);
        if (Math.max(Math.abs(a.file - b.file), Math.abs(a.rank - b.rank)) > 1) continue;
      }
      if (disarmed && m.isCapture) continue;
      // Sanctuary: pieces on a Sanctuary square cannot be captured.
      // Shield: shielded pieces cannot be captured.
      // For en passant the victim sits on `epVictim`, not `m.to` (the empty
      // EP target square), so guard the actual victim square.
      if (m.isCapture) {
        const victimSq = m.epVictim ?? m.to;
        if (sanc.has(victimSq) || sh.has(victimSq)) continue;
      }
      if (forbidden && forbidden.has(m.to)) continue;
      out.push(m);
    }
  };

  if (fromSquare) {
    const piece = pos.pieces.get(fromSquare);
    if (!piece || piece.side !== pos.turn) return out;
    generate(fromSquare, piece);
    return out;
  }
  for (const [sq, piece] of pos.pieces) {
    if (piece.side !== pos.turn) continue;
    generate(sq, piece);
  }
  return out;
}

function addPieceMoves(
  out: RuleMove[],
  from: AlgebraicSquare,
  piece: Piece,
  pos: Position,
  overlays: Overlays,
): void {
  // Downgrade: piece generates pawn moves instead of its native moveset.
  if (piece.type !== "king" && overlays.downgrades?.has(from)) {
    addPawnMoves(out, from, piece, pos, overlays);
    return;
  }
  // Sudo: pawn generates queen moves instead of pawn moves.
  if (piece.type === "pawn" && overlays.sudoSquares?.has(from)) {
    addSlideMoves(out, from, piece, pos, overlays, QUEEN_DIRS);
    addRookCaptureThroughWallMoves(out, from, piece, pos, overlays);
    return;
  }
  switch (piece.type) {
    case "pawn":
      addPawnMoves(out, from, piece, pos, overlays);
      break;
    case "knight":
      addJumpMoves(out, from, piece, pos, overlays, KNIGHT_DELTAS);
      break;
    case "bishop":
      addSlideMoves(out, from, piece, pos, overlays, BISHOP_DIRS);
      break;
    case "rook":
      addSlideMoves(out, from, piece, pos, overlays, ROOK_DIRS);
      addRookCaptureThroughWallMoves(out, from, piece, pos, overlays);
      break;
    case "queen":
      addSlideMoves(out, from, piece, pos, overlays, QUEEN_DIRS);
      addRookCaptureThroughWallMoves(out, from, piece, pos, overlays);
      break;
    case "king":
      addKingMoves(out, from, piece, pos, overlays);
      break;
  }
}

/**
 * Sniper Optics: capture-only ray for rooks (and queens, on their rook axes)
 * that allows up to N walls between attacker and target. Movement to empty
 * squares past a wall is still blocked — so only capture moves are emitted on
 * the extended ray, never quiet slides.
 */
function addRookCaptureThroughWallMoves(
  out: RuleMove[],
  from: AlgebraicSquare,
  piece: Piece,
  pos: Position,
  overlays: Overlays,
): void {
  const wallSkip = overlays.rookAttackThroughWalls?.[piece.side] ?? 0;
  if (wallSkip <= 0) return;
  const { file, rank } = squareCoords(from);
  const size = pos.size;
  for (const [df, dr] of ROOK_DIRS) {
    let tf = file + df;
    let tr = rank + dr;
    let wallsCrossed = 0;
    let sawWall = false;
    while (inBounds(size, tf, tr)) {
      const to = sqAt(tf, tr);
      if (overlays.walls.has(to)) {
        if (wallsCrossed >= wallSkip) break;
        wallsCrossed++;
        sawWall = true;
        tf += df;
        tr += dr;
        continue;
      }
      const occ = pos.pieces.get(to);
      if (occ) {
        // Only emit a move on the *extended* ray (after at least one wall).
        // Squares before the first wall are already covered by addSlideMoves.
        if (sawWall && occ.side !== piece.side) {
          out.push({
            from,
            to,
            isCapture: true,
            capturedPiece: occ,
            isDouble: false,
            isPromotion: false,
          });
        }
        break;
      }
      // Empty squares past a wall are not movable to (movement is still
      // wall-blocked); skip without emitting a move and continue scanning.
      tf += df;
      tr += dr;
    }
  }
}

function addJumpMoves(
  out: RuleMove[],
  from: AlgebraicSquare,
  piece: Piece,
  pos: Position,
  overlays: Overlays,
  deltas: ReadonlyArray<readonly [number, number]>,
  allowCaptures: boolean = true,
): void {
  const { file, rank } = squareCoords(from);
  const size = pos.size;
  const promoR = piece.type === "pawn" ? promotionRank(size, piece.side, overlays) : -1;
  for (const [df, dr] of deltas) {
    const tf = file + df;
    const tr = rank + dr;
    if (!inBounds(size, tf, tr)) continue;
    const to = sqAt(tf, tr);
    if (overlays.walls.has(to)) continue;
    const occ = pos.pieces.get(to);
    if (occ && occ.side === piece.side) continue;
    if (occ && !allowCaptures) continue;
    const base = {
      from,
      to,
      isCapture: !!occ,
      capturedPiece: occ,
      isDouble: false,
    };
    if (tr === promoR) {
      for (const promo of ["q", "r", "b", "n"] as const) {
        out.push({ ...base, promotion: promo, isPromotion: true });
      }
    } else {
      out.push({ ...base, isPromotion: false });
    }
  }
}

function addSlideMoves(
  out: RuleMove[],
  from: AlgebraicSquare,
  piece: Piece,
  pos: Position,
  overlays: Overlays,
  dirs: ReadonlyArray<readonly [number, number]>,
  allowCaptures: boolean = true,
): void {
  const { file, rank } = squareCoords(from);
  const size = pos.size;
  const promoR = piece.type === "pawn" ? promotionRank(size, piece.side, overlays) : -1;
  const pushOrPromo = (base: Omit<RuleMove, "isPromotion" | "promotion">, destRank: number) => {
    if (destRank === promoR) {
      for (const promo of ["q", "r", "b", "n"] as const) {
        out.push({ ...base, promotion: promo, isPromotion: true });
      }
    } else {
      out.push({ ...base, isPromotion: false });
    }
  };
  for (const [df, dr] of dirs) {
    let tf = file + df;
    let tr = rank + dr;
    while (inBounds(size, tf, tr)) {
      const to = sqAt(tf, tr);
      if (overlays.walls.has(to)) break;
      const occ = pos.pieces.get(to);
      if (occ) {
        if (occ.side !== piece.side && allowCaptures) {
          pushOrPromo({ from, to, isCapture: true, capturedPiece: occ, isDouble: false }, tr);
        }
        break;
      }
      pushOrPromo({ from, to, isCapture: false, isDouble: false }, tr);
      tf += df;
      tr += dr;
    }
  }
}

function addPawnMoves(
  out: RuleMove[],
  from: AlgebraicSquare,
  piece: Piece,
  pos: Position,
  overlays: Overlays,
): void {
  const { file, rank } = squareCoords(from);
  const size = pos.size;
  const dir = piece.side === "player" ? 1 : -1;
  const startRank = pawnStartRank(size, piece.side);
  const promoR = promotionRank(size, piece.side, overlays);
  const doubleFromAnyRank = overlays.pawnDoubleFromAnyRank?.has(piece.side) ?? false;
  const backwardStep = overlays.pawnBackwardStep?.has(piece.side) ?? false;

  const pushPromo = (m: Omit<RuleMove, "promotion" | "isPromotion">) => {
    for (const promo of ["q", "r", "b", "n"] as const) {
      out.push({ ...m, promotion: promo, isPromotion: true });
    }
  };

  // Forward 1 / 2
  const fr1 = rank + dir;
  if (inBounds(size, file, fr1)) {
    const to1 = sqAt(file, fr1);
    if (!overlays.walls.has(to1) && !pos.pieces.has(to1)) {
      if (fr1 === promoR) {
        pushPromo({ from, to: to1, isCapture: false, isDouble: false });
      } else {
        out.push({ from, to: to1, isCapture: false, isDouble: false, isPromotion: false });
      }
      if (rank === startRank || doubleFromAnyRank) {
        const fr2 = rank + 2 * dir;
        if (inBounds(size, file, fr2)) {
          const to2 = sqAt(file, fr2);
          if (!overlays.walls.has(to2) && !pos.pieces.has(to2)) {
            // Pawn Storm-driven double-pushes don't land en passant (the
            // double-push semantics are tied to the start-rank concept). We
            // still set isDouble so the engine sets the EP target — this is a
            // small over-approximation but matches the natural double-push
            // behaviour and keeps the EP mechanic predictable.
            out.push({ from, to: to2, isCapture: false, isDouble: true, isPromotion: false });
          }
        }
      }
    }
  }

  // Diagonal captures (incl en passant, incl promotion-on-capture)
  for (const df of [-1, 1] as const) {
    const tf = file + df;
    const tr = rank + dir;
    if (!inBounds(size, tf, tr)) continue;
    const to = sqAt(tf, tr);
    if (overlays.walls.has(to)) continue;
    const occ = pos.pieces.get(to);
    if (occ && occ.side !== piece.side) {
      if (tr === promoR) {
        pushPromo({ from, to, isCapture: true, capturedPiece: occ, isDouble: false });
      } else {
        out.push({
          from,
          to,
          isCapture: true,
          capturedPiece: occ,
          isDouble: false,
          isPromotion: false,
        });
      }
    } else if (!occ && pos.enPassant === to) {
      const epVictim = sqAt(tf, rank);
      const victim = pos.pieces.get(epVictim);
      if (victim && victim.type === "pawn" && victim.side !== piece.side) {
        out.push({
          from,
          to,
          isCapture: true,
          capturedPiece: victim,
          isDouble: false,
          isPromotion: false,
          epVictim,
        });
      }
    }
  }

  // Backward step (Drill Sergeant): one square opposite the forward direction,
  // no capture, no promotion. Off-board / walled / occupied squares are blocked.
  if (backwardStep) {
    const br = rank - dir;
    if (inBounds(size, file, br)) {
      const bsq = sqAt(file, br);
      if (!overlays.walls.has(bsq) && !pos.pieces.has(bsq)) {
        out.push({ from, to: bsq, isCapture: false, isDouble: false, isPromotion: false });
      }
    }
  }
}

/**
 * Dispatch the right move-generator for an Empower pattern. We skip patterns
 * the piece already covers natively (a knight already has knight moves; a
 * queen already has rook + bishop slides) so the move list stays
 * duplicate-free.
 *
 * Empower-granted moves are NEVER capturing — pieces only capture using their
 * native moveset. This applies to all empower sources (Patch cards, the
 * pawn-flavored Side Channel / Lateral Movement cards, and the
 * Polished Bishop / Cavalry Doctrine artifacts).
 *
 * Empower-pawn ignores double-pushes and en passant — those are intrinsic to
 * actual pawns. The empowered piece just gets a forward step (no
 * diagonal-forward captures, since empower never captures). Pawns empowered
 * with non-pawn movement patterns (e.g. diagonal-step) still promote on the
 * back rank — promotion is handled by addJumpMoves / addSlideMoves.
 */
function addEmpowerMoves(
  out: RuleMove[],
  from: AlgebraicSquare,
  piece: Piece,
  pos: Position,
  overlays: Overlays,
  pattern: EmpowerPattern,
): void {
  switch (pattern) {
    case "knight":
      if (piece.type === "knight") return;
      addJumpMoves(out, from, piece, pos, overlays, KNIGHT_DELTAS, false);
      return;
    case "bishop":
      if (piece.type === "bishop" || piece.type === "queen") return;
      addSlideMoves(out, from, piece, pos, overlays, BISHOP_DIRS, false);
      return;
    case "rook":
      if (piece.type === "rook" || piece.type === "queen") return;
      addSlideMoves(out, from, piece, pos, overlays, ROOK_DIRS, false);
      return;
    case "queen":
      if (piece.type === "queen") return;
      // Queen movement = bishop slides + rook slides. Skip whichever the
      // piece already has.
      if (piece.type !== "bishop")
        addSlideMoves(out, from, piece, pos, overlays, BISHOP_DIRS, false);
      if (piece.type !== "rook") addSlideMoves(out, from, piece, pos, overlays, ROOK_DIRS, false);
      return;
    case "pawn":
      if (piece.type === "pawn") return;
      addEmpowerPawnMoves(out, from, piece, pos, overlays);
      return;
    case "king-step":
      // King already has the king-step pattern natively. Skip to avoid
      // duplicate move entries.
      if (piece.type === "king") return;
      addJumpMoves(out, from, piece, pos, overlays, KING_DIRS, false);
      return;
    case "diagonal-step":
      // One-square diagonal step in any of the four diagonals. No capture.
      addJumpMoves(out, from, piece, pos, overlays, BISHOP_DIRS, false);
      return;
    case "horizontal-step":
      // One-square horizontal step (left/right). No capture.
      addJumpMoves(out, from, piece, pos, overlays, HORIZONTAL_DELTAS, false);
      return;
  }
}

const HORIZONTAL_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
];

function addEmpowerPawnMoves(
  out: RuleMove[],
  from: AlgebraicSquare,
  piece: Piece,
  pos: Position,
  overlays: Overlays,
): void {
  // Forward step only — empower never captures, so the diagonal-forward
  // capture branch a real pawn has is intentionally omitted here.
  const { file, rank } = squareCoords(from);
  const size = pos.size;
  const dir = piece.side === "player" ? 1 : -1;
  const fr1 = rank + dir;
  if (inBounds(size, file, fr1)) {
    const to = sqAt(file, fr1);
    if (!overlays.walls.has(to) && !pos.pieces.has(to)) {
      out.push({ from, to, isCapture: false, isDouble: false, isPromotion: false });
    }
  }
}

function addKingMoves(
  out: RuleMove[],
  from: AlgebraicSquare,
  piece: Piece,
  pos: Position,
  overlays: Overlays,
): void {
  addJumpMoves(out, from, piece, pos, overlays, KING_DIRS);

  // Castling is only generated on standard 8-file boards. Smaller-board piece
  // sets in Standard mode rarely have two rooks anyway, and the landing-square
  // semantics don't generalize cleanly. Documented in chess-rules.md.
  if (!castlingAvailable(pos.size)) return;

  const them = opp(piece.side);
  const rights = pos.castling;
  const homeRank: 0 | 7 = piece.side === "player" ? 0 : 7;
  const e = sqAt(4, homeRank);
  if (from !== e) return; // king must be on its starting square

  const tryCastle = (
    side: "K" | "Q",
    allowed: boolean,
    rookSquare: AlgebraicSquare,
    between: AlgebraicSquare[],
    pathSquares: AlgebraicSquare[],
    target: AlgebraicSquare,
  ) => {
    if (!allowed) return;
    const rook = pos.pieces.get(rookSquare);
    if (!rook || rook.type !== "rook" || rook.side !== piece.side) return;
    for (const sq of between) {
      if (pos.pieces.has(sq)) return;
      if (overlays.walls.has(sq)) return;
    }
    for (const sq of pathSquares) {
      if (isSquareAttacked(pos, overlays, sq, them)) return;
    }
    out.push({
      from,
      to: target,
      castle: side,
      isCapture: false,
      isDouble: false,
      isPromotion: false,
    });
  };

  if (piece.side === "player") {
    tryCastle(
      "K",
      rights.K,
      "h1",
      [sqAt(5, 0), sqAt(6, 0)],
      [e, sqAt(5, 0), sqAt(6, 0)],
      sqAt(6, 0),
    );
    tryCastle(
      "Q",
      rights.Q,
      "a1",
      [sqAt(3, 0), sqAt(2, 0), sqAt(1, 0)],
      [e, sqAt(3, 0), sqAt(2, 0)],
      sqAt(2, 0),
    );
  } else {
    tryCastle(
      "K",
      rights.k,
      "h8",
      [sqAt(5, 7), sqAt(6, 7)],
      [e, sqAt(5, 7), sqAt(6, 7)],
      sqAt(6, 7),
    );
    tryCastle(
      "Q",
      rights.q,
      "a8",
      [sqAt(3, 7), sqAt(2, 7), sqAt(1, 7)],
      [e, sqAt(3, 7), sqAt(2, 7)],
      sqAt(2, 7),
    );
  }
}

// ---- Apply move ------------------------------------------------------------

export function applyMove(pos: Position, m: RuleMove): Position {
  const pieces = new Map(pos.pieces);
  const mover = pieces.get(m.from);
  if (!mover) throw new Error(`applyMove: no piece on ${m.from}`);

  pieces.delete(m.from);

  if (m.castle === "K") {
    if (mover.side === "player") {
      pieces.delete("h1");
      pieces.set("f1", { type: "rook", side: "player" });
    } else {
      pieces.delete("h8");
      pieces.set("f8", { type: "rook", side: "opponent" });
    }
  } else if (m.castle === "Q") {
    if (mover.side === "player") {
      pieces.delete("a1");
      pieces.set("d1", { type: "rook", side: "player" });
    } else {
      pieces.delete("a8");
      pieces.set("d8", { type: "rook", side: "opponent" });
    }
  }

  if (m.epVictim) pieces.delete(m.epVictim);

  if (m.promotion) {
    const promoType = ({ q: "queen", r: "rook", b: "bishop", n: "knight" } as const)[m.promotion];
    pieces.set(m.to, { type: promoType, side: mover.side });
  } else {
    pieces.set(m.to, mover);
  }

  // Castling rights: any king move clears that side's rights; rook moving from
  // its corner clears that corner's rights; a piece captured on a rook corner
  // also clears that corner's rights.
  const castling: CastlingRights = { ...pos.castling };
  if (mover.type === "king") {
    if (mover.side === "player") {
      castling.K = false;
      castling.Q = false;
    } else {
      castling.k = false;
      castling.q = false;
    }
  }
  if (mover.type === "rook") {
    if (m.from === "h1") castling.K = false;
    if (m.from === "a1") castling.Q = false;
    if (m.from === "h8") castling.k = false;
    if (m.from === "a8") castling.q = false;
  }
  if (m.to === "h1") castling.K = false;
  if (m.to === "a1") castling.Q = false;
  if (m.to === "h8") castling.k = false;
  if (m.to === "a8") castling.q = false;

  let enPassant: AlgebraicSquare | null = null;
  if (m.isDouble) {
    const { file, rank } = squareCoords(m.to);
    const epRank = (mover.side === "player" ? rank - 1 : rank + 1) as RankIndex;
    enPassant = sqAt(file, epRank);
  }

  const halfmove = mover.type === "pawn" || m.isCapture ? 0 : pos.halfmove + 1;
  const fullmove = pos.turn === "opponent" ? pos.fullmove + 1 : pos.fullmove;

  return {
    pieces,
    turn: opp(pos.turn),
    castling,
    enPassant,
    halfmove,
    fullmove,
    size: pos.size,
  };
}

// ---- Legal moves -----------------------------------------------------------

export function legalMoves(
  pos: Position,
  overlays: Overlays,
  fromSquare?: AlgebraicSquare,
): RuleMove[] {
  const pseudo = pseudoLegalMoves(pos, overlays, fromSquare);
  const result: RuleMove[] = [];
  for (const m of pseudo) {
    const after = applyMove(pos, m);
    const kingSq = findKing(after, pos.turn);
    if (!kingSq) {
      // King missing (shouldn't happen in standard play). Skip.
      continue;
    }
    if (!isSquareAttacked(after, overlays, kingSq, opp(pos.turn))) {
      result.push(m);
    }
  }
  // When asking for moves from a specific square, the per-square Compel
  // filter would restrict the same square's own list — a no-op. Skip.
  if (fromSquare) return result;
  return applyCompel(result, pos, overlays);
}

/**
 * Compel filter (per docs/cards/keywords.md):
 *  - If any compelled piece of the side-to-move has legal moves, restrict
 *    the move set to only that piece's moves.
 *  - If any of those are captures, restrict further to captures only.
 *  - If no compelled piece has legal moves, the filter is a no-op.
 *
 * If multiple compelled pieces have moves, every compelled piece's moves
 * are kept (and captures-only collapsing applies across the union).
 */
function applyCompel(legal: RuleMove[], pos: Position, overlays: Overlays): RuleMove[] {
  const c = compels(overlays);
  if (c.size === 0) return legal;
  const compelledWithMoves = new Set<AlgebraicSquare>();
  for (const sq of c) {
    const piece = pos.pieces.get(sq);
    if (!piece || piece.side !== pos.turn) continue;
    if (legal.some((m) => m.from === sq)) compelledWithMoves.add(sq);
  }
  if (compelledWithMoves.size === 0) return legal;
  const fromCompelled = legal.filter((m) => compelledWithMoves.has(m.from));
  const captures = fromCompelled.filter((m) => m.isCapture);
  return captures.length > 0 ? captures : fromCompelled;
}

// ---- Insufficient material -------------------------------------------------

export function isInsufficientMaterial(pos: Position): boolean {
  type Inv = { knights: number; bishopColors: Set<number>; otherCount: number };
  const sides: Record<Side, Inv> = {
    player: { knights: 0, bishopColors: new Set(), otherCount: 0 },
    opponent: { knights: 0, bishopColors: new Set(), otherCount: 0 },
  };
  for (const [sq, p] of pos.pieces) {
    if (p.type === "king") continue;
    if (p.type === "knight") {
      sides[p.side].knights++;
    } else if (p.type === "bishop") {
      const { file, rank } = squareCoords(sq);
      sides[p.side].bishopColors.add((file + rank) & 1);
    } else {
      // pawn / rook / queen → never insufficient
      sides[p.side].otherCount++;
    }
  }
  if (sides.player.otherCount > 0 || sides.opponent.otherCount > 0) return false;
  const totalMinors = (s: Inv) => s.knights + s.bishopColors.size;
  const pl = totalMinors(sides.player);
  const op = totalMinors(sides.opponent);
  // K vs K
  if (pl === 0 && op === 0) return true;
  // K vs K+N or K vs K+B (single minor)
  if ((pl === 0 && op === 1) || (op === 0 && pl === 1)) {
    // single minor (knight or bishop)
    return true;
  }
  // K+B vs K+B with bishops on same color
  if (pl === 1 && op === 1 && sides.player.knights === 0 && sides.opponent.knights === 0) {
    const pc = [...sides.player.bishopColors][0];
    const oc = [...sides.opponent.bishopColors][0];
    if (pc !== undefined && oc !== undefined && pc === oc) return true;
  }
  return false;
}
