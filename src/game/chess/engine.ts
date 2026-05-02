// ChoseEngine — chess board state with wall/freeze-aware rules.
//
// Move generation, legality filtering, and check evaluation all live in
// `rules.ts` and respect the active overlay set. The engine itself owns
// the running position + history and exposes the same surface the rest of
// the codebase has consumed since M1.
//
// Pure TS — no React, no DOM. See architecture.md.

import type { AlgebraicSquare, MatchOutcome, Piece, PieceType, Side } from "../types";

import {
  STARTING_FEN,
  applyMove,
  findKing,
  isInCheck,
  isInsufficientMaterial,
  isSquareAttacked,
  legalMoves as rulesLegalMoves,
  parseFen,
  serializeFen,
  squareCoords,
  squareName,
  type Overlays,
  type Position,
  type RuleMove,
} from "./rules";

export { squareCoords, squareName };

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

type HistoryEntry = {
  move: RuleMove;
  /** Side that made the move (the side-to-move BEFORE applying it). */
  by: Side;
  /** What the move captured, if anything. */
  captured: Piece | null;
  /** Position signature for repetition counting. */
  signatureBefore: string;
};

export class ChoseEngine {
  private position: Position;
  private overlays: Overlays = EMPTY_OVERLAYS;
  private history: HistoryEntry[] = [];

  constructor(fen?: string) {
    this.position = parseFen(fen ?? STARTING_FEN);
  }

  // ---- Overlays (walls / freezes) -----------------------------------------

  /**
   * Set the active wall and freeze overlays. The engine takes a reference;
   * pass new sets when the overlays change so move generation reflects them.
   */
  setOverlays(walls: ReadonlySet<AlgebraicSquare>, freezes: ReadonlySet<AlgebraicSquare>): void {
    this.overlays = { walls, freezes };
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
   * The most recently played move, or null if the game just started / was
   * reset. Used for last-move highlighting on the board.
   */
  lastMove(): { from: AlgebraicSquare; to: AlgebraicSquare } | null {
    const last = this.history[this.history.length - 1];
    if (!last) return null;
    return { from: last.move.from, to: last.move.to };
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

  outcome(): MatchOutcome {
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
