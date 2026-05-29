# CH-039: "+1 Draw" boss boon is wired to hand-size, not draw-per-turn

- **Category:** Game Design — Design Hole
- **Severity:** high
- **Status:** Open

## Locations

- `src/game/progression/run.ts:331-339`
- `docs/design/bosses.md:113-114`
- `docs/design/progression.md:24`

## Problem

The boon is built with `hand-size-bonus` while its label and the docs say "+1 card draw/turn." A real `draw-per-turn-bonus` effect kind exists and is read by `startPlayerTurn`. The boon does not do what its label says.

## Recommendation

Emit `draw-per-turn-bonus` (and possibly also `hand-size-bonus`); add a test that the boon increases cards-drawn-per-turn.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
