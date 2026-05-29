# CH-063: No keyboard equivalent for drag placement / card targeting

- **Category:** Docs / Infra
- **Severity:** nit
- **Status:** Open

## Locations

- `src/components/Board/Board.tsx:225-425`

## Problem

Board.tsx uses real buttons with role=gridcell + descriptive aria-label, role=grid/row, and role=status hints — accessibility is otherwise good. The only gap is no keyboard equivalent for drag placement/targeting (no onKeyDown handlers). No action needed for the prototype, recorded for completeness.

## Recommendation

If keyboard play becomes a goal, add onKeyDown handlers for select/place/target on board squares.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
