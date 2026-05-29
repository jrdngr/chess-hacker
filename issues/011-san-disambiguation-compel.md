# CH-011: SAN disambiguation runs the Compel filter and can under-disambiguate

- **Category:** Code — Correctness
- **Severity:** nit
- **Status:** Open

## Locations

- `src/game/chess/engine.ts:541-551`
- `src/game/chess/rules.ts:1145-1158`

## Problem

SAN disambiguation runs the Compel filter, which can under-disambiguate SAN notation when a Compel overlay is active. Display-only, so no gameplay impact — but move-log notation can be ambiguous/wrong.

## Recommendation

Generate disambiguation from the unfiltered legal move set, independent of active overlays.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
