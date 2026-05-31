// Skirmish-mode constants and helpers.
//
// Skirmish is the roguelite army-builder mode. The player starts with a tiny
// roster (K + 2P + N + B) and drafts pieces (P/N/B/R/Q) between matches. Before
// each match the player manually places their pieces: back-rank on rank 1
// (Chess960 rules), pawns on rank 2 (free arrangement). A per-match placement
// value cap is the sole constraint on what can be placed. The enemy mirrors the
// player's placed composition with an independent Chess960 layout; bosses use
// their canonical armies.

import type { Rng } from "../cards/match";
import { consumeRng } from "./run";
import type { BoardSize, Piece, PieceDraftOffer, PieceType, RunState } from "../types";
import { CLASSICAL_PIECE_VALUE } from "../pieceValues";

// ---- Piece values (for placement cap) ----------------------------------------

export const SKIRMISH_PIECE_VALUE = CLASSICAL_PIECE_VALUE;

// ---- Per-match placement value cap -------------------------------------------

const VALUE_CAP_TABLE: ReadonlyArray<number> = [
  8, // M1  (6x6)
  12, // M2  (6x6)
  16, // M3  (6x6, Boss A)
  20, // M4  (7x7)
  24, // M5  (7x7)
  28, // M6  (7x7, Boss B)
  32, // M7  (8x8)
  36, // M8  (8x8)
  40, // M9  (8x8, Boss C)
];

export function skirmishValueCap(matchNumber: number): number {
  return VALUE_CAP_TABLE[matchNumber - 1] ?? VALUE_CAP_TABLE[VALUE_CAP_TABLE.length - 1];
}

// ---- Board size per match ----------------------------------------------------

export function skirmishBoardSize(matchNumber: number): BoardSize {
  if (matchNumber <= 3) return { files: 6, ranks: 6 };
  if (matchNumber <= 6) return { files: 7, ranks: 7 };
  return { files: 8, ranks: 8 };
}

// ---- Draft rarity weights ----------------------------------------------------

type DraftableType = "pawn" | "knight" | "bishop" | "rook" | "queen";

const DRAFT_WEIGHTS: ReadonlyArray<{ type: DraftableType; weight: number }> = [
  { type: "pawn", weight: 30 },
  { type: "knight", weight: 25 },
  { type: "bishop", weight: 25 },
  { type: "rook", weight: 15 },
  { type: "queen", weight: 5 },
];

export const PAWN_HARD_CAP = 8;
export const PIECE_DRAFT_SIZE = 3;
export const PIECE_SKIP_GOLD = 5;

// ---- Starting roster ---------------------------------------------------------

export const SKIRMISH_STARTING_ROSTER: ReadonlyArray<Piece> = [
  { type: "king", side: "player" },
  { type: "pawn", side: "player" },
  { type: "pawn", side: "player" },
  { type: "pawn", side: "player" },
  { type: "knight", side: "player" },
  { type: "bishop", side: "player" },
];

// ---- Helpers -----------------------------------------------------------------

export function placementValue(pieces: PieceType[]): number {
  return pieces.reduce((sum, t) => sum + SKIRMISH_PIECE_VALUE[t], 0);
}

export function rosterPawnCount(roster: ReadonlyArray<Piece>): number {
  return roster.filter((p) => p.type === "pawn").length;
}

// ---- Draft generation --------------------------------------------------------

export function generatePieceDraftOffer(state: RunState): {
  offer: PieceDraftOffer;
  next: RunState;
} {
  const { rng, next } = consumeRng(state);
  const roster = state.roster ?? [];
  const pawnsOwned = rosterPawnCount(roster);

  const eligible = DRAFT_WEIGHTS.filter((w) => {
    if (w.type === "pawn" && pawnsOwned >= PAWN_HARD_CAP) return false;
    return true;
  });

  const totalWeight = eligible.reduce((s, w) => s + w.weight, 0);
  const pieces = rollDistinct(eligible, totalWeight, PIECE_DRAFT_SIZE, rng);

  return {
    offer: { pieces, skipGold: PIECE_SKIP_GOLD },
    next,
  };
}

function rollDistinct(
  eligible: ReadonlyArray<{ type: DraftableType; weight: number }>,
  totalWeight: number,
  count: number,
  rng: Rng,
): PieceType[] {
  const out: PieceType[] = [];
  for (let i = 0; i < count; i++) {
    let r = rng() * totalWeight;
    for (const { type, weight } of eligible) {
      r -= weight;
      if (r <= 0) {
        out.push(type);
        break;
      }
    }
    if (out.length <= i) {
      out.push(eligible[0].type);
    }
  }
  return out;
}

// ---- Draft resolution --------------------------------------------------------

export function draftPiece(state: RunState, pieceType: PieceType): RunState {
  const roster = state.roster ? [...state.roster] : [];
  roster.push({ type: pieceType, side: "player" });
  return { ...state, roster };
}

export function skipPieceDraft(state: RunState, skipGold: number): RunState {
  return { ...state, gold: state.gold + skipGold };
}
