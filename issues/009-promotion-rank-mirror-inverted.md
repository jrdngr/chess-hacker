# CH-009: promotionRank opponent-side mirror formula is likely inverted (dead code)

- **Category:** Code — Correctness
- **Severity:** low
- **Status:** Done

## Resolution

Verified the formula is **correct**, not inverted. `promotionRank` returns a
0-indexed `RankIndex`. A player override `O` (1-indexed) reflects across the
board to the opponent: 1-indexed mirrored rank `size.ranks + 1 - O`, i.e.
RankIndex `size.ranks - O` — exactly what the code computes. On 8 ranks,
override 7 gives player RankIndex 6 (rank 7) and opponent RankIndex 1 (rank 2),
both "one rank short of the far edge." The misleading doc comment (which mixed
1- and 0-indexed) was rewritten, and the branch is now pinned by unit tests in
`rules.test.ts`.

## Locations

- `src/game/chess/rules.ts:64-75`
- `src/game/chess/rules.ts:150-154`

## Problem

The `promotionRank` opponent-side mirror formula `size.ranks - override` is likely inverted. Currently dead/unreachable, but it will misfire if a feature ever enables an opponent-side promotion-rank override.

## Recommendation

Verify the intended mirror (`size.ranks - override + 1`?) and add a unit test, or remove the dead branch until needed.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
