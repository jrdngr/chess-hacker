// ChoseEngine — chess board state with wall/freeze-aware rules.
//
// Move generation, legality filtering, and check evaluation all live in
// `rules.ts` and respect the active overlay set. The engine itself owns
// the running position + history and exposes the same surface the rest of
// the codebase has consumed since M1.
//
// Pure TS — no React, no DOM. See architecture.md.

import type {
  AlgebraicSquare,
  BoardSize,
  EmpowerPattern,
  FileIndex,
  MatchOutcome,
  Piece,
  PieceType,
  RankIndex,
  Side,
} from "../types";

import {
  STANDARD_SIZE,
  STARTING_FEN,
  applyMove,
  findKing,
  isInCheck,
  isInsufficientMaterial,
  isSquareAttacked,
  legalMoves as rulesLegalMoves,
  movePath,
  parseFen,
  serializeFen,
  squareCoords,
  squareName,
  type Overlays,
  type Position,
  type RuleMove,
} from "./rules";

export { movePath, squareCoords, squareName };

export type EngineMove = {
  from: AlgebraicSquare;
  to: AlgebraicSquare;
  /** Promotion piece for pawn promotion (always "q" by default in M1). */
  promotion?: "q" | "r" | "b" | "n";
};

export type LegalMove = EngineMove & {
  san: string;
  isCapture: boolean;
  isPromotion: boolean;
  isCastle: boolean;
};

const EMPTY_OVERLAYS: Overlays = { walls: new Set(), freezes: new Set() };

/** Optional overlay fields the engine can pass through to the rule layer. */
export type ExtraOverlays = {
  roots?: ReadonlySet<AlgebraicSquare>;
  disarms?: ReadonlySet<AlgebraicSquare>;
  compels?: ReadonlySet<AlgebraicSquare>;
  shields?: ReadonlySet<AlgebraicSquare>;
  sanctuaries?: ReadonlySet<AlgebraicSquare>;
  empowers?: ReadonlyMap<AlgebraicSquare, ReadonlySet<EmpowerPattern>>;
  /** Sides whose pawns may double-push from any rank (Pawn Storm artifact). */
  pawnDoubleFromAnyRank?: ReadonlySet<Side>;
  /** Sides whose pawns may also move 1 square backward (Drill Sergeant). */
  pawnBackwardStep?: ReadonlySet<Side>;
  /** Side-specific promotion-rank overrides (Promotion Engine). */
  pawnPromotionRanks?: { player?: number; opponent?: number };
  /** Side-specific rook attack-through-wall counts (Sniper Optics). */
  rookAttackThroughWalls?: { player?: number; opponent?: number };
  /**
   * Mutex Lock zone: squares the opponent may not move to. Union of the
   * 3×3 king-step-adjacent regions around each currently-active mutex lock
   * anchor. Empty / absent when no locks are active.
   */
  forbiddenForOpponent?: ReadonlySet<AlgebraicSquare>;
  sudoSquares?: ReadonlySet<AlgebraicSquare>;
  downgrades?: ReadonlySet<AlgebraicSquare>;
};

type HistoryEntry = {
  move: RuleMove;
  /** Side that made the move (the side-to-move BEFORE applying it). */
  by: Side;
  /** What the move captured, if anything. */
  captured: Piece | null;
  /** Position signature for repetition counting. */
  signatureBefore: string;
};

/**
 * An opaque snapshot of the engine's mutable state — board position and move
 * history — captured at a point in time so the React layer can revert to it
 * later (the Undo button). Overlays are *not* part of the snapshot; they're
 * derived from card state, which the React layer snapshots separately.
 */
export type EngineSnapshot = {
  position: Position;
  history: HistoryEntry[];
};

export class ChoseEngine {
  private position: Position;
  private overlays: Overlays = EMPTY_OVERLAYS;
  private history: HistoryEntry[] = [];

  /**
   * Build an engine for a given starting position.
   * - `fen` defaults to the standard 8x8 chess opening.
   * - `size` defaults to 8x8. Pass it explicitly for non-8x8 positions
   *   (Standard mode matches and the dev sandbox); the FEN must match.
   */
  constructor(fen?: string, size: BoardSize = STANDARD_SIZE) {
    this.position = parseFen(fen ?? STARTING_FEN, size);
  }

  /** Current board dimensions. */
  size(): BoardSize {
    return this.position.size;
  }

  /**
   * Capture the engine's mutable state. `restore` re-applies it. The snapshot
   * is shallow but safe — `position` is treated immutably by `applyMove`, and
   * `history` is sliced before being stored.
   */
  snapshot(): EngineSnapshot {
    return { position: this.position, history: this.history.slice() };
  }

  restore(snapshot: EngineSnapshot): void {
    this.position = snapshot.position;
    this.history = snapshot.history.slice();
  }

  // ---- Overlays (walls / freezes) -----------------------------------------

  /**
   * Set the active wall and freeze overlays. The engine takes a reference;
   * pass new sets when the overlays change so move generation reflects them.
   *
   * `extra` carries the rest of the card-spawned overlays (root, disarm,
   * compel, shield, sanctuary, empower). All optional — unset fields are
   * treated as empty by the rule layer.
   */
  setOverlays(
    walls: ReadonlySet<AlgebraicSquare>,
    freezes: ReadonlySet<AlgebraicSquare>,
    extra: ExtraOverlays = {},
  ): void {
    this.overlays = { walls, freezes, ...extra };
  }

  // ---- Position queries ----------------------------------------------------

  fen(): string {
    return serializeFen(this.position);
  }

  /** Side to move. */
  turn(): Side {
    return this.position.turn;
  }

  /** Returns the piece at an algebraic square, or null if empty. */
  pieceAt(square: AlgebraicSquare): Piece | null {
    return this.position.pieces.get(square) ?? null;
  }

  /** All occupied squares with their pieces. Useful for board rendering. */
  pieces(): Array<{ square: AlgebraicSquare; piece: Piece }> {
    const out: Array<{ square: AlgebraicSquare; piece: Piece }> = [];
    for (const [square, piece] of this.position.pieces) out.push({ square, piece });
    return out;
  }

  /**
   * Whether `square` is attacked by any piece on `by`'s side under the
   * current overlays. Thin pass-through to the rule layer; used by cards
   * that filter targets by what the player's pieces are threatening
   * (e.g. Exploit).
   */
  isSquareAttackedBy(square: AlgebraicSquare, by: Side): boolean {
    return isSquareAttacked(this.position, this.overlays, square, by);
  }

  /**
   * Every square attacked by `side` under the current overlays. Used by the
   * "board vision" UI overlay to colour squares the player or opponent
   * threatens. Walls block sliding attacks; frozen pieces don't attack —
   * same as the rule used for check evaluation.
   */
  attackedSquares(side: Side): Set<AlgebraicSquare> {
    const out = new Set<AlgebraicSquare>();
    const { files, ranks } = this.position.size;
    for (let r = 0; r < ranks; r++) {
      for (let f = 0; f < files; f++) {
        const sq = squareName(f as FileIndex, r as RankIndex);
        if (isSquareAttacked(this.position, this.overlays, sq, side)) out.add(sq);
      }
    }
    return out;
  }

  // ---- Move generation -----------------------------------------------------

  legalMoves(from?: AlgebraicSquare): LegalMove[] {
    const moves = rulesLegalMoves(this.position, this.overlays, from);
    return moves.map((m) => this.toLegalMove(m));
  }

  /**
   * Apply a move. Returns the resulting LegalMove descriptor, or null if
   * illegal under our wall/freeze-aware rules.
   */
  move(m: EngineMove): LegalMove | null {
    const candidates = rulesLegalMoves(this.position, this.overlays);
    const promo = m.promotion ?? "q";
    const found = candidates.find(
      (c) =>
        c.from === m.from && c.to === m.to && (c.promotion === undefined || c.promotion === promo),
    );
    if (!found) return null;

    const by = this.position.turn;
    const captured = found.capturedPiece
      ? { type: found.capturedPiece.type, side: found.capturedPiece.side }
      : null;
    const signatureBefore = repetitionSignature(this.position);
    // Build the LegalMove (with SAN) against the position *before* applying.
    const legal = this.toLegalMove(found);
    this.position = applyMove(this.position, found);
    this.history.push({ move: found, by, captured, signatureBefore });
    return legal;
  }

  /**
   * Read-only metadata about the most recent recorded move. Used by
   * Rollback (the card) to walk the moved piece back to its origin square
   * without touching engine history. Returns null if no move has been
   * recorded yet.
   */
  lastMoveDetails(): {
    from: AlgebraicSquare;
    to: AlgebraicSquare;
    by: Side;
    captured: Piece | null;
    /** Promotion target if the move promoted; absent otherwise. */
    promotion?: "q" | "r" | "b" | "n";
    /** Castle side if the move was castling; absent otherwise. */
    castle?: "K" | "Q";
    /**
     * Square of the en-passant victim (different from `to` only on en-passant
     * captures). Absent when the move was not en-passant.
     */
    epVictim?: AlgebraicSquare;
  } | null {
    const last = this.history[this.history.length - 1];
    if (!last) return null;
    return {
      from: last.move.from,
      to: last.move.to,
      by: last.by,
      captured: last.captured,
      ...(last.move.promotion ? { promotion: last.move.promotion } : {}),
      ...(last.move.castle ? { castle: last.move.castle } : {}),
      ...(last.move.epVictim ? { epVictim: last.move.epVictim } : {}),
    };
  }

  /**
   * The most recently played move, or null if the game just started / was
   * reset. Used for last-move highlighting on the board.
   */
  lastMove(): { from: AlgebraicSquare; to: AlgebraicSquare } | null {
    const last = this.history[this.history.length - 1];
    if (!last) return null;
    return { from: last.move.from, to: last.move.to };
  }

  /**
   * Place a new piece on an empty square. Used by Summon cards (e.g.,
   * Knight Patch). Throws if the square is already occupied. Does NOT
   * flip the turn or record history; the caller is still on the same turn.
   */
  placePiece(square: AlgebraicSquare, piece: Piece): void {
    if (this.position.pieces.has(square))
      throw new Error(`placePiece: ${square} is already occupied`);
    const pieces = new Map(this.position.pieces);
    pieces.set(square, piece);
    this.position = { ...this.position, pieces };
  }

  /**
   * Remove the piece on `square`. Used by Sacrifice cards and Trap (capture).
   * Captured pieces are NOT credited to either side's `capturedPieces` —
   * card-driven removal is a separate accounting category. Does not flip
   * the turn or record history.
   */
  removePiece(square: AlgebraicSquare): Piece | null {
    const piece = this.position.pieces.get(square);
    if (!piece) return null;
    const pieces = new Map(this.position.pieces);
    pieces.delete(square);
    this.position = { ...this.position, pieces };
    return piece;
  }

  /**
   * Swap the contents of two squares. Used by Switch Files. Does not flip
   * the turn or record history. Requires at least one square to be occupied;
   * an empty/empty swap is a no-op.
   */
  swapPieces(a: AlgebraicSquare, b: AlgebraicSquare): void {
    if (a === b) return;
    const pa = this.position.pieces.get(a);
    const pb = this.position.pieces.get(b);
    const pieces = new Map(this.position.pieces);
    if (pa) pieces.set(b, pa);
    else pieces.delete(b);
    if (pb) pieces.set(a, pb);
    else pieces.delete(a);
    this.position = { ...this.position, pieces };
  }

  /**
   * Force the side-to-move. Used by Haste / Overclock to grant a second
   * action to the player after their first move (which would have otherwise
   * flipped the turn to the opponent). Does not record history.
   */
  forceTurn(side: Side): void {
    if (this.position.turn === side) return;
    this.position = { ...this.position, turn: side };
  }

  /**
   * Move a piece from `from` to `to`, ignoring legality. Used by Trap (push):
   * the displacement is a card effect, not a chess move, so it bypasses the
   * normal legal-move check. No-ops if `from` is empty or `to` is occupied.
   * Does not flip the turn.
   */
  displacePiece(from: AlgebraicSquare, to: AlgebraicSquare): void {
    if (from === to) return;
    const piece = this.position.pieces.get(from);
    if (!piece) return;
    if (this.position.pieces.has(to)) return;
    const pieces = new Map(this.position.pieces);
    pieces.delete(from);
    pieces.set(to, piece);
    this.position = { ...this.position, pieces };
  }

  /**
   * Legal moves *as if it were the other side's turn*. Used by Remote Access
   * to enumerate the puppet target's options while the player is still
   * mid-turn. Restores the original turn before returning.
   */
  foreignLegalMoves(from: AlgebraicSquare): LegalMove[] {
    const original = this.position.turn;
    const flipped: Side = original === "player" ? "opponent" : "player";
    this.position = { ...this.position, turn: flipped };
    try {
      return this.legalMoves(from);
    } finally {
      this.position = { ...this.position, turn: original };
    }
  }

  /**
   * Apply a move as if the *other* side made it, while it's still the
   * current side's turn. Used by Remote Access (player makes the opponent
   * move) and Trap (push) (push the opponent piece back). Returns the
   * resulting LegalMove descriptor, or null if the move is illegal under
   * the foreign side's rules. After the foreign move resolves, the
   * side-to-move is unchanged (the card play continues on the original
   * side's turn).
   */
  applyForeignMove(m: EngineMove): LegalMove | null {
    const original = this.position.turn;
    const flipped: Side = original === "player" ? "opponent" : "player";
    this.position = { ...this.position, turn: flipped };
    const result = this.move(m);
    if (!result) {
      // Restore turn (move() didn't apply anything).
      this.position = { ...this.position, turn: original };
      return null;
    }
    // After move(), turn flipped from `flipped` → original. Done.
    return result;
  }

  /**
   * Captured pieces, partitioned by the side that did the capturing.
   *
   *   byPlayer:   opponent pieces the human white side has taken
   *   byOpponent: player pieces the black side has taken
   */
  capturedPieces(): { byPlayer: Piece[]; byOpponent: Piece[] } {
    const byPlayer: Piece[] = [];
    const byOpponent: Piece[] = [];
    for (const h of this.history) {
      if (!h.captured) continue;
      (h.by === "player" ? byPlayer : byOpponent).push(h.captured);
    }
    return { byPlayer, byOpponent };
  }

  // ---- Outcome detection ---------------------------------------------------

  inCheck(): boolean {
    return isInCheck(this.position, this.overlays);
  }

  /**
   * Whether `m` would put the opposing side in check. Used by the Throttled
   * curse to filter the player's legal-move set down to non-checking moves.
   * Snapshot / apply / inspect / restore — the engine is left untouched.
   */
  wouldDeliverCheck(m: EngineMove): boolean {
    const snap = this.snapshot();
    try {
      const applied = this.move(m);
      if (!applied) return false;
      // After move(), turn flipped; inCheck() now reports whether the new
      // side-to-move (the side `m` just hit) is in check.
      return this.inCheck();
    } finally {
      this.restore(snap);
    }
  }

  outcome(): MatchOutcome {
    // King capture ends the match for whichever side still has a king. This
    // can only arise from card-driven moves (e.g. an empowered piece moving
    // through a normal-rules-illegal capture) — the standard legality filter
    // never permits capturing the king.
    const playerKing = findKing(this.position, "player");
    const opponentKing = findKing(this.position, "opponent");
    if (!playerKing && opponentKing) return { kind: "king-captured", winner: "opponent" };
    if (playerKing && !opponentKing) return { kind: "king-captured", winner: "player" };

    const moves = rulesLegalMoves(this.position, this.overlays);
    if (moves.length === 0) {
      if (isInCheck(this.position, this.overlays)) {
        const loser = this.position.turn;
        const winner: Side = loser === "player" ? "opponent" : "player";
        return { kind: "checkmate", winner };
      }
      return { kind: "stalemate" };
    }
    if (isInsufficientMaterial(this.position)) {
      return { kind: "draw", reason: "insufficient-material" };
    }
    if (this.position.halfmove >= 100) {
      return { kind: "draw", reason: "fifty-move" };
    }
    if (this.threefoldRepetition()) {
      return { kind: "draw", reason: "threefold-repetition" };
    }
    return { kind: "ongoing" };
  }

  // ---- Internal helpers ----------------------------------------------------

  private toLegalMove(m: RuleMove): LegalMove {
    return {
      from: m.from,
      to: m.to,
      promotion: m.promotion,
      san: this.computeSan(m),
      isCapture: m.isCapture,
      isPromotion: m.isPromotion,
      isCastle: !!m.castle,
    };
  }

  private threefoldRepetition(): boolean {
    const sig = repetitionSignature(this.position);
    let count = 1; // current position counts once
    for (const h of this.history) {
      if (h.signatureBefore === sig) count++;
      if (count >= 3) return true;
    }
    return false;
  }

  /**
   * SAN is generated from the move + the position BEFORE the move (since
   * disambiguation depends on which other pieces of the same type could
   * have moved to the same square). We re-run pseudo-legal generation on
   * a snapshot to disambiguate cleanly.
   */
  private computeSan(m: RuleMove): string {
    // Castling
    if (m.castle === "K") return appendCheckSuffix(this.position, this.overlays, m, "O-O");
    if (m.castle === "Q") return appendCheckSuffix(this.position, this.overlays, m, "O-O-O");

    const piece = this.position.pieces.get(m.from);
    if (!piece) return ""; // shouldn't happen

    let body: string;
    if (piece.type === "pawn") {
      const fromFile = m.from[0];
      const target = m.to;
      const promo = m.promotion ? `=${m.promotion.toUpperCase()}` : "";
      body = m.isCapture ? `${fromFile}x${target}${promo}` : `${target}${promo}`;
    } else {
      const letter = pieceLetter(piece.type);
      const disamb = disambiguator(this.position, this.overlays, m, piece.type);
      const cap = m.isCapture ? "x" : "";
      body = `${letter}${disamb}${cap}${m.to}`;
    }

    return appendCheckSuffix(this.position, this.overlays, m, body);
  }
}

// ---- Free helpers (used by SAN generation) --------------------------------

function pieceLetter(t: PieceType): string {
  switch (t) {
    case "knight":
      return "N";
    case "bishop":
      return "B";
    case "rook":
      return "R";
    case "queen":
      return "Q";
    case "king":
      return "K";
    case "pawn":
      return "";
  }
}

function disambiguator(pos: Position, overlays: Overlays, m: RuleMove, type: PieceType): string {
  const candidates = rulesLegalMoves(pos, overlays).filter(
    (c) => c.from !== m.from && c.to === m.to && pos.pieces.get(c.from)?.type === type,
  );
  if (candidates.length === 0) return "";
  const sameFile = candidates.some((c) => c.from[0] === m.from[0]);
  const sameRank = candidates.some((c) => c.from[1] === m.from[1]);
  if (!sameFile) return m.from[0];
  if (!sameRank) return m.from[1];
  return m.from;
}

function appendCheckSuffix(pos: Position, overlays: Overlays, m: RuleMove, body: string): string {
  const after = applyMove(pos, m);
  const them = after.turn;
  const kingSq = findKing(after, them);
  if (!kingSq) return body;
  const inCheck = isSquareAttacked(
    after,
    overlays,
    kingSq,
    them === "player" ? "opponent" : "player",
  );
  if (!inCheck) return body;
  // Mate iff no legal replies under the same overlays.
  const replies = rulesLegalMoves(after, overlays);
  return replies.length === 0 ? `${body}#` : `${body}+`;
}

/**
 * A "FEN minus move counters" used to detect threefold repetition. We don't
 * try to be fully spec-perfect about en-passant equivalence (the standard is
 * subtle there) — the prototype just uses the four positional fields and
 * accepts the occasional false positive.
 */
function repetitionSignature(pos: Position): string {
  const fen = serializeFen(pos);
  return fen.split(" ").slice(0, 4).join(" ");
}
