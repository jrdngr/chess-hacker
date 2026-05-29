# CH-043: Skirmish starting roster contradicts itself across docs and code

- **Category:** Game Design — Design Hole
- **Severity:** medium
- **Status:** Open

## Locations

- `docs/design/pieces.md:5-13`
- `docs/design/modes.md:63`
- `src/game/progression/skirmish.ts:70-77`

## Problem

pieces.md:5-13 (5 pieces, soft caps) contradicts modes.md:63 / skirmish.ts:70-77 (K+3P+N+B = 6 pieces, 8-pawn hard cap only).

## Recommendation

Decide the canonical starting roster and caps, then align pieces.md, modes.md and the code.

## Related Issues

- CH-034 — [bal-skirmish-mirror-gameable](034-bal-skirmish-mirror-gameable.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
