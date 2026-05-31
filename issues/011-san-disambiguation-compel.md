# CH-011: SAN disambiguation runs the Compel filter and can under-disambiguate

- **Category:** Code — Correctness
- **Severity:** nit
- **Status:** Done

## Resolution

`disambiguator` now computes candidates from a geometry-only overlay set that
strips the turn-scoped piece-restriction overlays (Compel/Root/Disarm/Freeze/
Mutex) while keeping board geometry (walls) and movement-granting overlays. SAN
disambiguation therefore reflects which same-type pieces could geometrically
reach the square, independent of which piece is allowed to move this turn.
Added an engine test (Compel on one of two rooks still yields "Rad1").

## Locations

- `src/game/chess/engine.ts:541-551`
- `src/game/chess/rules.ts:1145-1158`

## Problem

SAN disambiguation runs the Compel filter, which can under-disambiguate SAN notation when a Compel overlay is active. Display-only, so no gameplay impact — but move-log notation can be ambiguous/wrong.

## Recommendation

Generate disambiguation from the unfiltered legal move set, independent of active overlays.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
