# CH-037: Self-Destruct at cost 2 is a cheap multi-capture clear

- **Category:** Game Design — Balance
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/cards/data/self-destruct.json`
- `src/game/cards/effectHandlers.ts:544-562`

## Problem

Cost 2 uncommon destroys own piece + all adjacent enemy non-kings; on cramped small boards this is a huge swing, refunded by capture-energy (3 minors = +9).

## Recommendation

Raise to 3-4, restrict to orthogonal adjacency, or cap pieces destroyed.

## Related Issues

- CH-035 — [bal-overclock-undercosted](035-bal-overclock-undercosted.md)
- CH-014 — [test-sacrifice-detonate-untested](014-test-sacrifice-detonate-untested.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
