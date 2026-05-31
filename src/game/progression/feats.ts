// Performance feats — stacking gold bonuses for in-match accomplishments.
//
// Pure helpers — no React, no engine. The Match shell computes the achieved
// feats at match-end (from the engine snapshot + card state) and surfaces them
// on RunMatchOutcome; the run shell (applyMatchOutcome) adds the capped feat
// gold to the win bonus. See docs/design/economy.md ("Performance bonuses").
//
// Feats are only awarded on a win. The list, gold values, and cap below are
// prototype tuning knobs.

import type { FeatAward, PieceType } from "../types";

// ---- Tuning knobs (prototype starting values, see docs/design/economy.md) --

/** Capture the enemy queen. */
export const FEAT_QUEEN_CAPTURE_GOLD = 5;
/** Win in FAST_WIN_MAX_TURNS player turns or fewer. */
export const FEAT_FAST_WIN_GOLD = 4;
/** Win without the opponent capturing any of your major pieces. */
export const FEAT_NO_MAJOR_LOSS_GOLD = 5;
/** Win with cards still left in your draw pile. */
export const FEAT_CARDS_REMAINING_GOLD = 3;
/** Win without playing a single card all match. */
export const FEAT_RESTRAINT_GOLD = 4;

/** Maximum player turns that still counts as a "fast" win. */
export const FAST_WIN_MAX_TURNS = 25;
/** Total feat gold is capped here — raw max (21) intentionally exceeds it. */
export const FEAT_GOLD_CAP = 12;

/** "Major" pieces for the No Major Loss feat — rook/queen (king loss ⇒ a loss). */
const MAJOR_PIECE_TYPES: ReadonlySet<PieceType> = new Set<PieceType>(["rook", "queen"]);

/** Match metrics needed to evaluate feats — all derivable at match-end. */
export type FeatInput = {
  /** Player turns played this match (cardState.turn). */
  turnsPlayed: number;
  /** Enemy piece types the player captured (engine.capturedPieces().byPlayer). */
  capturedByPlayer: PieceType[];
  /**
   * Player piece types the OPPONENT captured (engine.capturedPieces().byOpponent).
   * Pieces the player sacrifices via cards are NOT here, so they don't break
   * No Major Loss — only enemy captures count.
   */
  lostToOpponent: PieceType[];
  /** Cards still in the draw pile at match-end (cardState.drawPile.length). */
  drawPileCount: number;
  /** Cards the player played this match (cardState.cardsPlayedThisMatch). */
  cardsPlayed: number;
};

/**
 * Evaluate which performance feats a winning match earned. Returns only the
 * achieved feats, in display order. (Caller is responsible for only invoking
 * this on a win.)
 */
export function evaluateFeats(input: FeatInput): FeatAward[] {
  const awards: FeatAward[] = [];

  if (input.capturedByPlayer.includes("queen")) {
    awards.push({ id: "queen-capture", label: "Queen Capture", gold: FEAT_QUEEN_CAPTURE_GOLD });
  }
  if (input.turnsPlayed <= FAST_WIN_MAX_TURNS) {
    awards.push({ id: "fast-win", label: "Fast Win", gold: FEAT_FAST_WIN_GOLD });
  }
  if (!input.lostToOpponent.some((t) => MAJOR_PIECE_TYPES.has(t))) {
    awards.push({ id: "no-major-loss", label: "No Major Loss", gold: FEAT_NO_MAJOR_LOSS_GOLD });
  }
  if (input.drawPileCount > 0) {
    awards.push({
      id: "cards-remaining",
      label: "Cards Remaining",
      gold: FEAT_CARDS_REMAINING_GOLD,
    });
  }
  if (input.cardsPlayed === 0) {
    awards.push({ id: "restraint", label: "Restraint", gold: FEAT_RESTRAINT_GOLD });
  }

  return awards;
}

/** Sum of earned feat gold, capped at FEAT_GOLD_CAP. */
export function totalFeatGold(awards: ReadonlyArray<FeatAward>): number {
  const raw = awards.reduce((sum, a) => sum + a.gold, 0);
  return Math.min(FEAT_GOLD_CAP, raw);
}
