# CH-036: A single shop artifact can starve card acquisition

- **Category:** Game Design — Balance
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/shop/shop.ts:54`
- `docs/design/cards.md`

## Problem

Shops are the only card source yet realistic income is ~14-20 and one artifact costs 12-28, while the +5 interest breakpoint wants 25 hoarded — contradictory pulls. A player may add very few cards across a run.

## Recommendation

Add feat gold / lower early card prices / raise win bonus; verify a player can add ~8-12 cards across 8 shops.

## Related Issues

- CH-033 — [bal-feat-gold-not-awarded](033-bal-feat-gold-not-awarded.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
