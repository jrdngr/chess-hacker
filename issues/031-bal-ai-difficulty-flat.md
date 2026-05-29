# CH-031: AI difficulty is flat across the entire run

- **Category:** Game Design — Balance
- **Severity:** critical
- **Status:** Open

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

## Related Issues

- CH-032 — [bal-ascension-unimplemented](032-bal-ascension-unimplemented.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
