# CH-046: No clock/move-cap + draws=loss + no concede enables dead-turn/griefable states

- **Category:** Game Design — Design Hole
- **Severity:** medium
- **Status:** Open

## Locations

- `docs/design/chess-rules.md:15`

## Problem

There is no clock or move-cap; combined with draws=loss and no concede, the game permits dead-turn and griefable states (e.g. a position the player cannot win or escape).

## Recommendation

Add a move cap or a concede option; define what happens on a stalled/unwinnable position.

## Related Issues

- CH-045 — [hole-boss-c-forced-loss](045-hole-boss-c-forced-loss.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
