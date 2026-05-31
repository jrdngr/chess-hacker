# CH-015: cardValidator.ts (1077 lines) has no direct tests

- **Category:** Tests — Coverage
- **Severity:** medium
- **Status:** Done

## Resolution

Added `cardValidator.test.ts`: a minimal valid card (plus consume/retain and a
none-target resource card) is accepted, and a table of malformed inputs is
rejected — out-of-set cost/rarity/archetype, empty id, missing name, non-string
description, unknown target/effect kinds, a missing required effect field
(place-wall durationTurns), an invalid zone-buff pattern, and a target/effect
mismatch.

## Locations

- `src/game/cards/cardValidator.ts:1010-1077`
- `src/game/cards/library.ts:67-141`

## Problem

`validateCard` is the gatekeeper turning raw JSON into typed Cards, run over the whole library at module load and on every synthesized upgrade. It owns 16 `VALID_*` allow-lists and per-effect-kind validation, but the only coverage is the implicit "the real library happens to validate" path. No test asserts that a malformed card (bad rarity, unknown effect kind, missing required field, invalid zone-buff pattern, out-of-range cost, target/effect mismatch) is rejected.

## Recommendation

Add table-driven `cardValidator.test.ts`: valid minimal card per archetype passes; each enum rejects out-of-set; each required-field effect rejects when missing.

## Related Issues

- CH-016 — [test-status-validate-untested](016-test-status-validate-untested.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
