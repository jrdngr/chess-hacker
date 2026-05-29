# CH-007: place-zone-buff autoPlace whiffs with no refund when all candidate squares are walled

- **Category:** Code — Correctness
- **Severity:** nit
- **Status:** Open

## Locations

- `src/game/cards/effectHandlers.ts:272-304`
- `src/game/cards/match.ts:724-743`

## Problem

`place-zone-buff` with `autoPlace` produces no buff and no refund if every candidate square is walled — after the card cost is paid and the card is consumed. The player loses energy and a card for zero effect.

## Recommendation

Refund the card/energy when autoPlace finds no legal square, or block playing the card when no legal square exists.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
