# CH-020: Run.tsx phase machine and runHistory.ts are under-tested

- **Category:** Tests — Coverage
- **Severity:** low
- **Status:** Open

## Locations

- `src/components/Run/Run.test.tsx:10-30`
- `src/components/Run/runHistory.ts`

## Problem

`Run.tsx` (782-line phase machine) has only 2 smoke tests; `runHistory.ts` (307 lines) is untested.

## Recommendation

Add tests for the Run phase transitions (draft → match → reward → shop → next) and for runHistory recording/derivation.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
