# CH-052: Zone-control buffs are used by exactly one card

- **Category:** Game Design — Content
- **Severity:** high
- **Status:** Open

## Locations

- `docs/design/board.md`
- `src/game/types.ts:895-906`

## Problem

Zone-control buffs are used by exactly 1 card (Power Node); `rank`/`square-radius-1` regions and non-energy buffs are dead.

## Recommendation

Author cards (and an artifact) that use rank/file/radius zones and non-energy buffs.

## Proposed Content

Proposed — Chokepoint card (Cost 3 Uncommon: zone-buff on back rank; while you out-piece the enemy on a file, hand size +1); Loadbalancer artifact (Rare: turn-start, if you hold center 2x2 majority, draw 1 and next card costs 1 less).

## Related Issues

- CH-054 — [content-keyword-payoffs](054-content-keyword-payoffs.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
