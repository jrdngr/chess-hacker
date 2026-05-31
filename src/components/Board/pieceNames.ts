// Display names for piece types — one source of truth for the title-cased
// labels used across the UI (piece-draft cards, promotion / transform / revive
// pickers).

import type { PieceType } from "../../game/types";

export const PIECE_NAMES: Record<PieceType, string> = {
  pawn: "Pawn",
  knight: "Knight",
  bishop: "Bishop",
  rook: "Rook",
  queen: "Queen",
  king: "King",
};

/** Title-cased display label for a piece type, e.g. `"knight" → "Knight"`. */
export function pieceLabel(type: PieceType): string {
  return PIECE_NAMES[type];
}
