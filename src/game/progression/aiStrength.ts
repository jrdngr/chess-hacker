// Per-match AI strength schedule for a run.
//
// CH-031: a single flat depth-6 engine crushes the player in match 1 (small
// board, thin toolkit) and never ramps. This schedule scales the engine across
// the 9-match run instead. The early game uses a low Fairy-Stockfish `Skill
// Level` so a blundering engine is beatable with a starter deck; the curve
// climbs to full-strength, deep search by the finale.
//
// Boss matches (3 / 6 / 9) sit a notch above their neighbours — the engine
// plays "for real" on top of the boss's modifier / hazard / status layers.
// Non-boss matches escalate via engine strength + the composition/board-size
// curve in `standard.ts` only; abilities and rule-modifiers stay boss-exclusive
// so "boss = special rules" remains the boss identity (see docs/technical/ai.md).
//
// Skirmish and Standard share this schedule: both run 9 matches with bosses at
// 3 / 6 / 9. Numbers are first-pass picks; tune from playtesting.

import type { AiStrength } from "../../ai/stockfish";

/** Base strength per match, 1-indexed (index 0 = match 1 … index 8 = match 9). */
const BASE_SCHEDULE: ReadonlyArray<AiStrength> = [
  { skillLevel: 3, depth: 6 }, // M1
  { skillLevel: 6, depth: 6 }, // M2
  { skillLevel: 12, depth: 8 }, // M3 — Boss A
  { skillLevel: 9, depth: 7 }, // M4
  { skillLevel: 13, depth: 7 }, // M5
  { skillLevel: 16, depth: 10 }, // M6 — Boss B
  { skillLevel: 16, depth: 8 }, // M7
  { skillLevel: 18, depth: 9 }, // M8
  { skillLevel: 20, depth: 12 }, // M9 — Boss C (finale)
];

const MAX_SKILL = 20;
/** Depth cap so deep-Ascension search bounds stay responsive on these boards. */
const MAX_DEPTH = 16;

/**
 * Resolve the AI strength for a given match (1-indexed) and Ascension level.
 *
 * Each Ascension level sharpens the engine — the "Sharper Mind" axis from
 * `docs/design/progression.md`: +2 `Skill Level` per level (capped at 20) and
 * +1 search depth per two levels (capped at 16). Out-of-range match numbers
 * fall back to the finale entry.
 */
export function aiStrengthForMatch(matchNumber: number, ascension = 0): AiStrength {
  const base = BASE_SCHEDULE[matchNumber - 1] ?? BASE_SCHEDULE[BASE_SCHEDULE.length - 1];
  const a = Math.max(0, ascension);
  return {
    skillLevel: Math.min(MAX_SKILL, (base.skillLevel ?? MAX_SKILL) + 2 * a),
    depth: Math.min(MAX_DEPTH, (base.depth ?? 6) + Math.floor(a / 2)),
  };
}
