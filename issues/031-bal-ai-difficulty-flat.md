# CH-031: AI difficulty is flat across the entire run

- **Category:** Game Design — Balance
- **Severity:** critical
- **Status:** Done

## Locations

- `src/ai/stockfish.ts:478-487`
- `src/components/Match/useAiLoop.ts:170`
- `src/components/Match.tsx:341,378`

## Problem

`depthForDifficulty` maps to a fixed depth (easy=2/normal=6/hard=10), and `useAiLoop.ts:170` uses a single `difficulty` state initialized to `'normal'`, never varied by match/act/ascension. A depth-6 (~1800+ Elo) Stockfish crushes the player in match 1 (small board, tiny toolkit) and never ramps.

## Recommendation

Scale depth or Stockfish Skill Level / UCI_Elo by `matchNumber` and `ascension` (e.g. act1 ~4-6 → finale ~14-18, +1-2 per Ascension level). See proposed "Race Condition" mechanic.

## Proposed Content

Proposed mechanic — Race Condition: per-match Stockfish Skill/Elo schedule (act1 ~4-6 → finale ~14-18), +1-2 per Ascension.

## Resolution

Replaced the single flat `depthForDifficulty` knob with a per-match
**`AiStrength` profile** (`{ skillLevel?, elo?, depth?, movetimeMs? }`):

- `StockfishEngine.setStrength()` emits `Skill Level` / `UCI_LimitStrength` +
  `UCI_Elo` setoptions; `goBoundsForStrength` derives the per-search `go` bound.
  The low end now leans on Skill Level (human-like blunders → beatable early
  game) rather than raw depth.
- `src/game/progression/aiStrength.ts` holds the per-match schedule
  (`aiStrengthForMatch(matchNumber, ascension)`): Skill 3 / depth 6 at match 1
  → Skill 20 / depth 12 at the finale, with boss spikes at 3/6/9 and an
  Ascension sharpen (+2 Skill/level, +1 depth per 2 levels; capped 20/16).
- `Run.tsx` passes the scheduled strength into `Match`, which threads it through
  `useAiLoop`. The free-play `easy/normal/hard` selector still works (depth-only
  profile) but is hidden in run mode so the schedule can't be bypassed.

Design decision (with the user): non-boss matches escalate via **engine
strength + composition only**. Active/passive ability kits and rule-modifiers
stay boss-exclusive; "boss = special rules" is preserved. Light terrain on later
normal matches and STS-style elites are recorded as deferred open questions.

## Related Issues

- CH-032 — [bal-ascension-unimplemented](032-bal-ascension-unimplemented.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
