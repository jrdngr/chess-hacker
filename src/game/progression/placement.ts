// Skirmish placement validation and FEN generation.

import { shuffle, type Rng } from "../cards/match";
import { backRankLegalityErrors, placeBackRank, placeConscriptionFiller } from "../chess/positions";
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
  matchNumber: number,
  rng: Rng,
  aiPieceSet?: PieceSet,
): string {
  const { files, ranks } = boardSize;

  // Determine the AI army. Boss matches provide an explicit aiPieceSet; regular
  // matches mirror the player and conscript filler up to the value cap.
  let aiBackRank: (PieceType | null)[];
  let aiPawnFiles: number[];
  if (aiPieceSet) {
    aiBackRank = placeBackRank(aiPieceSet, files, rng);
    const pawnFileCount = Math.min(aiPieceSet.pawns, files);
    aiPawnFiles = [];
    for (let f = 0; f < pawnFileCount; f++) aiPawnFiles.push(f);
  } else {
    const army = buildConscriptionArmy(playerBackRank, playerPawnFiles, files, matchNumber, rng);
    aiBackRank = army.backRank;
    aiPawnFiles = army.pawnFiles;
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
  for (const f of aiPawnFiles) {
    pieces.set(squareName(f, bPawnRank), { type: "pawn", side: "opponent" });
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

/**
 * Build the regular-match (non-boss) enemy army: an exact file-for-file mirror
 * of the player's placement, conscripting extra "filler" pieces up to the match
 * value cap when the player places under it. Under-placing therefore only
 * weakens the player (CH-034). Filler types are drawn weighted by the player's
 * placed composition ("more of what you brought"); pawns (value 1) close any
 * remainder, so the gap always closes exactly. Filler that won't fit the back
 * rank legally falls back to pawns.
 *
 * At full placement (gap 0) this returns the exact symmetric mirror and consumes
 * no `rng`, preserving existing seeds/FENs.
 */
function buildConscriptionArmy(
  playerBackRank: (PieceType | null)[],
  playerPawnFiles: boolean[],
  files: number,
  matchNumber: number,
  rng: Rng,
): { backRank: (PieceType | null)[]; pawnFiles: number[] } {
  const mirroredBackRank = [...playerBackRank];
  const mirroredPawnFiles: number[] = [];
  for (let f = 0; f < files; f++) if (playerPawnFiles[f]) mirroredPawnFiles.push(f);

  const placedTypes = playerBackRank.filter((t): t is PieceType => t !== null);
  const placedValue =
    placedTypes.reduce((s, t) => s + SKIRMISH_PIECE_VALUE[t], 0) + mirroredPawnFiles.length;
  const gap = Math.max(0, skirmishValueCap(matchNumber) - placedValue);

  // Full placement → exact symmetric mirror, no filler, no rng consumed.
  if (gap === 0) {
    return { backRank: mirroredBackRank, pawnFiles: mirroredPawnFiles };
  }

  // "More of what you brought": weight filler by the player's placed
  // composition (king is never filler).
  const composition = new Map<PieceType, number>();
  for (const t of playerBackRank) {
    if (t && t !== "king") composition.set(t, (composition.get(t) ?? 0) + 1);
  }
  if (mirroredPawnFiles.length > 0) composition.set("pawn", mirroredPawnFiles.length);
  const weights = [...composition].map(([type, weight]) => ({ type, weight }));

  // Draw filler with replacement until the gap closes exactly.
  const fillerBackRank: PieceType[] = [];
  let fillerPawns = 0;
  let remaining = gap;
  while (remaining > 0) {
    const type = pickFiller(weights, remaining, rng);
    remaining -= SKIRMISH_PIECE_VALUE[type];
    if (type === "pawn") fillerPawns++;
    else fillerBackRank.push(type);
  }

  // Slot non-pawn filler into empty back-rank files, keeping the rank legal;
  // anything that won't fit becomes pawns of equal value.
  const { backRank, leftover } = placeConscriptionFiller(
    mirroredBackRank,
    fillerBackRank,
    files,
    rng,
  );
  let pawnsToAdd = fillerPawns + leftover.reduce((s, t) => s + SKIRMISH_PIECE_VALUE[t], 0);

  // Top up enemy pawns onto empty pawn files (board width is the hard limit).
  const pawnFileSet = new Set(mirroredPawnFiles);
  const emptyPawnFiles = shuffle(
    Array.from({ length: files }, (_, f) => f).filter((f) => !pawnFileSet.has(f)),
    rng,
  );
  for (const f of emptyPawnFiles) {
    if (pawnsToAdd <= 0) break;
    pawnFileSet.add(f);
    pawnsToAdd--;
  }

  return { backRank, pawnFiles: [...pawnFileSet].sort((a, b) => a - b) };
}

/**
 * Weighted pick (with replacement) of a filler type whose value fits the
 * remaining gap. Falls back to a pawn (value 1) when nothing else fits, which
 * guarantees the gap always closes.
 */
function pickFiller(
  weights: ReadonlyArray<{ type: PieceType; weight: number }>,
  remaining: number,
  rng: Rng,
): PieceType {
  const affordable = weights.filter((w) => SKIRMISH_PIECE_VALUE[w.type] <= remaining);
  if (affordable.length === 0) return "pawn";
  const total = affordable.reduce((s, w) => s + w.weight, 0);
  let r = rng() * total;
  for (const w of affordable) {
    r -= w.weight;
    if (r <= 0) return w.type;
  }
  return affordable[affordable.length - 1].type;
}
