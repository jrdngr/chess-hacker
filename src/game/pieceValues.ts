// Canonical chess piece values.
//
// One source of truth for "classical" material values (pawn=1, N=B=3, R=5,
// Q=9, king=0). Variants are derived explicitly so any divergence is visible
// at the definition, not silently re-typed at four call sites (CH-027).

import type { PieceType } from "./types";

/** Classical material values: pawn=1, knight=bishop=3, rook=5, queen=9. */
export const CLASSICAL_PIECE_VALUE: Readonly<Record<PieceType, number>> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

/**
 * Standard-mode random-roll budget values. Identical to the classical values
 * except pawns are free (pawn=0): pawns fill the front rank automatically, so
 * they don't draw from the non-pawn points budget.
 */
export const STANDARD_BUDGET_VALUE: Readonly<Record<PieceType, number>> = {
  ...CLASSICAL_PIECE_VALUE,
  pawn: 0,
};
