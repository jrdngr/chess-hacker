// ChoseEngine — thin wrapper around chess.js.
//
// In M1 this is mostly a delegate. Future milestones layer on:
//   - walls (M4) — filter chess.js moves by overlay
//   - move extensions (M3+) — augment legal moves
//   - square effects (M9) — fire on engine.move()
//   - zone-control buffs (M9) — eval at start-of-turn
//
// Keep this module pure TS — no React, no DOM. See architecture.md.

import { Chess, type Color, type Square as ChessSquare } from "chess.js";

import type { AlgebraicSquare, FileIndex, MatchOutcome, Piece, RankIndex, Side } from "../types";

/** chess.js piece-symbol → our PieceType. */
const PIECE_TYPE_FROM_SYMBOL = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
} as const;

/** White = "player", black = "opponent". Single-player only (overview.md). */
export function sideFromColor(c: Color): Side {
  return c === "w" ? "player" : "opponent";
}

export function colorFromSide(s: Side): Color {
  return s === "player" ? "w" : "b";
}

export type EngineMove = {
  from: AlgebraicSquare;
  to: AlgebraicSquare;
  /** Promotion piece for pawn promotion (always "q" in M1; promotion picker is later work). */
  promotion?: "q" | "r" | "b" | "n";
};

export type LegalMove = EngineMove & {
  san: string;
  isCapture: boolean;
  isPromotion: boolean;
  isCastle: boolean;
};

export class ChoseEngine {
  private chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  // ---- Position queries -----------------------------------------------------

  fen(): string {
    return this.chess.fen();
  }

  /** Side to move. */
  turn(): Side {
    return sideFromColor(this.chess.turn());
  }

  /** Returns the piece at an algebraic square, or null if empty. */
  pieceAt(square: AlgebraicSquare): Piece | null {
    const p = this.chess.get(square as ChessSquare);
    if (!p) return null;
    return {
      type: PIECE_TYPE_FROM_SYMBOL[p.type],
      side: sideFromColor(p.color),
    };
  }

  /** All occupied squares with their pieces. Useful for board rendering. */
  pieces(): Array<{ square: AlgebraicSquare; piece: Piece }> {
    const out: Array<{ square: AlgebraicSquare; piece: Piece }> = [];
    const board = this.chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f];
        if (!cell) continue;
        out.push({
          square: cell.square,
          piece: {
            type: PIECE_TYPE_FROM_SYMBOL[cell.type],
            side: sideFromColor(cell.color),
          },
        });
      }
    }
    return out;
  }

  // ---- Move generation ------------------------------------------------------

  /**
   * Legal moves from a given square (or all legal moves if no square specified).
   * In M1 this is a straight passthrough to chess.js. M4 filters by walls.
   */
  legalMoves(from?: AlgebraicSquare): LegalMove[] {
    const verbose = from
      ? this.chess.moves({ square: from as ChessSquare, verbose: true })
      : this.chess.moves({ verbose: true });
    return verbose.map((m) => ({
      from: m.from,
      to: m.to,
      promotion: m.promotion as LegalMove["promotion"],
      san: m.san,
      isCapture: m.isCapture(),
      isPromotion: m.isPromotion(),
      isCastle: m.isKingsideCastle() || m.isQueensideCastle(),
    }));
  }

  /**
   * Apply a move. Returns the resulting LegalMove descriptor, or null if illegal.
   * chess.js throws on illegal moves; we catch and return null for a calmer API.
   */
  move(m: EngineMove): LegalMove | null {
    try {
      const result = this.chess.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion ?? "q",
      });
      return {
        from: result.from,
        to: result.to,
        promotion: result.promotion as LegalMove["promotion"],
        san: result.san,
        isCapture: result.isCapture(),
        isPromotion: result.isPromotion(),
        isCastle: result.isKingsideCastle() || result.isQueensideCastle(),
      };
    } catch {
      return null;
    }
  }

  // ---- Outcome detection ----------------------------------------------------

  inCheck(): boolean {
    return this.chess.inCheck();
  }

  outcome(): MatchOutcome {
    if (this.chess.isCheckmate()) {
      // The side to move just got checkmated; the other side wins.
      const loser = sideFromColor(this.chess.turn());
      const winner: Side = loser === "player" ? "opponent" : "player";
      return { kind: "checkmate", winner };
    }
    if (this.chess.isStalemate()) {
      return { kind: "stalemate" };
    }
    if (this.chess.isInsufficientMaterial()) {
      return { kind: "draw", reason: "insufficient-material" };
    }
    if (this.chess.isThreefoldRepetition()) {
      return { kind: "draw", reason: "threefold-repetition" };
    }
    if (this.chess.isDrawByFiftyMoves()) {
      return { kind: "draw", reason: "fifty-move" };
    }
    if (this.chess.isDraw()) {
      return { kind: "draw", reason: "other" };
    }
    return { kind: "ongoing" };
  }
}

// ---- Coordinate helpers (used by Board UI) ----------------------------------

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function squareName(file: FileIndex, rank: RankIndex): AlgebraicSquare {
  return `${FILES[file]}${rank + 1}`;
}

export function squareCoords(s: AlgebraicSquare): { file: FileIndex; rank: RankIndex } {
  const file = FILES.indexOf(s[0] as (typeof FILES)[number]);
  const rank = Number(s[1]) - 1;
  return { file: file as FileIndex, rank: rank as RankIndex };
}
