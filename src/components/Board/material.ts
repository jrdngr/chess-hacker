// Standard chess material values.

import type { Piece, PieceType } from "../../game/types";

export const PIECE_VALUE: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

export function materialAdvantage(pieces: Piece[]): number {
  return pieces.reduce((sum, p) => sum + PIECE_VALUE[p.type], 0);
}
