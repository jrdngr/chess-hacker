// Shared types for the game logic layer.
// Keep this file free of React/DOM imports — see docs/technical/architecture.md.

export type FileIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type RankIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Square = { file: FileIndex; rank: RankIndex };

export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

/**
 * Logical sides. Mapped to chess.js colors ("w" / "b") at the engine boundary.
 * In the prototype the human player is always white = "player".
 */
export type Side = "player" | "opponent";

export type Piece = {
  type: PieceType;
  side: Side;
};

export type MatchOutcome =
  | { kind: "ongoing" }
  | { kind: "checkmate"; winner: Side }
  | { kind: "stalemate" }
  | {
      kind: "draw";
      reason: "insufficient-material" | "threefold-repetition" | "fifty-move" | "other";
    };

/** Algebraic-square string, e.g. "e4". Used at the engine boundary. */
export type AlgebraicSquare = string;
