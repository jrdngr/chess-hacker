// Skirmish placement validation and FEN generation.

import type { Rng } from "../cards/match";
import { backRankLegalityErrors, placeBackRank } from "../chess/positions";
import { pawnStartRank, serializeFen, type Position } from "../chess/rules";
import { squareName } from "../chess/coords";
import type { BoardSize, PieceSet, PieceType, Side } from "../types";
import { SKIRMISH_PIECE_VALUE, skirmishValueCap } from "./skirmish";

export function emptyBoardFen(size: BoardSize): string {
  const row = String(size.files);
  return Array(size.ranks).fill(row).join("/") + " w - - 0 1";
}

export type PlacementResult = {
  valid: boolean;
  errors: string[];
};

export function validatePlacement(
  backRank: (PieceType | null)[],
  pawnRank: (boolean | null)[],
  files: number,
  matchNumber: number,
): PlacementResult {
  const errors: string[] = [];

  const placed = backRank.filter((t): t is PieceType => t !== null);
  if (!placed.includes("king")) {
    errors.push("King must be placed on the back rank.");
  }

  // Bishop-color and king-between-rooks geometry — shared with the Chess960
  // generator so the two never drift.
  errors.push(...backRankLegalityErrors(backRank));

  const allPlaced: PieceType[] = [...placed];
  for (let f = 0; f < files; f++) {
    if (pawnRank[f]) allPlaced.push("pawn");
  }
  const totalValue = allPlaced.reduce((s, t) => s + SKIRMISH_PIECE_VALUE[t], 0);
  const cap = skirmishValueCap(matchNumber);
  if (totalValue > cap) {
    errors.push(`Placement value ${totalValue} exceeds cap of ${cap}.`);
  }

  return { valid: errors.length === 0, errors };
}

export function buildSkirmishFen(
  playerBackRank: (PieceType | null)[],
  playerPawnFiles: boolean[],
  boardSize: BoardSize,
  rng: Rng,
  aiPieceSet?: PieceSet,
): string {
  const { files, ranks } = boardSize;

  // Determine the AI army. Regular matches mirror the player; boss matches
  // provide an explicit aiPieceSet.
  let aiBackRank: (PieceType | null)[];
  let aiPawnCount: number;
  if (aiPieceSet) {
    aiBackRank = placeBackRank(aiPieceSet, files, rng);
    aiPawnCount = aiPieceSet.pawns;
  } else {
    aiBackRank = [...playerBackRank];
    aiPawnCount = playerPawnFiles.filter(Boolean).length;
  }

  const pieces = new Map<string, { type: PieceType; side: Side }>();

  for (let f = 0; f < files; f++) {
    const t = playerBackRank[f];
    if (t) pieces.set(squareName(f, 0), { type: t, side: "player" });
  }

  const wPawnRank = pawnStartRank(boardSize, "player");
  for (let f = 0; f < files; f++) {
    if (playerPawnFiles[f]) {
      pieces.set(squareName(f, wPawnRank), { type: "pawn", side: "player" });
    }
  }

  const blackBack = ranks - 1;
  for (let f = 0; f < files; f++) {
    const t = aiBackRank[f];
    if (t) pieces.set(squareName(f, blackBack), { type: t, side: "opponent" });
  }

  const bPawnRank = pawnStartRank(boardSize, "opponent");
  if (aiPieceSet) {
    const aiPawnFiles: number[] = [];
    for (let f = 0; f < files; f++) aiPawnFiles.push(f);
    const pawnFileCount = Math.min(aiPawnCount, files);
    for (let f = 0; f < pawnFileCount; f++) {
      pieces.set(squareName(aiPawnFiles[f], bPawnRank), { type: "pawn", side: "opponent" });
    }
  } else {
    for (let f = 0; f < files; f++) {
      if (playerPawnFiles[f]) {
        pieces.set(squareName(f, bPawnRank), { type: "pawn", side: "opponent" });
      }
    }
  }

  const position: Position = {
    pieces,
    turn: "player",
    castling: { K: false, Q: false, k: false, q: false },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    size: boardSize,
  };

  return serializeFen(position);
}
