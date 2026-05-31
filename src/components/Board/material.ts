// Standard chess material values.

import type { Piece } from "../../game/types";
import { CLASSICAL_PIECE_VALUE } from "../../game/pieceValues";

export const PIECE_VALUE = CLASSICAL_PIECE_VALUE;

export function materialAdvantage(pieces: Piece[]): number {
  return pieces.reduce((sum, p) => sum + PIECE_VALUE[p.type], 0);
}
