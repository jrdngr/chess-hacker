# CH-016: status/validate.ts has no direct tests

- **Category:** Tests — Coverage
- **Severity:** low
- **Status:** Open

## Locations

- `src/game/status/validate.ts`

## Problem

The status-effect validator mirrors cardValidator's gatekeeper role for status definitions but has no direct rejection tests, so a too-permissive regression goes uncaught.

## Recommendation

Add a table-driven test mirroring the cardValidator approach: valid status def passes; malformed defs are rejected.

## Related Issues

- CH-015 — [test-cardvalidator-untested](015-test-cardvalidator-untested.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
