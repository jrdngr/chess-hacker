# CH-027: PIECE_VALUE defined 4 times with pawn=0/1 drift

- **Category:** Refactor — Duplication
- **Severity:** medium
- **Status:** Done

## Locations

- `src/game/cards/match.ts:63-70`
- `src/game/progression/skirmish.ts:17-24`
- `src/game/progression/standard.ts:23-30`
- `src/components/Board/material.ts:5-12`

## Problem

Four independent literals (`PIECE_ENERGY_VALUES` pawn=1, `SKIRMISH_PIECE_VALUE` pawn=1, `PIECE_VALUE` pawn=0, `PIECE_VALUE` pawn=1). The knight/bishop/rook/queen/king rows are byte-identical; the only divergence (pawn=0 in standard.ts) is intentional but invisible at each call site. Two even share the name `PIECE_VALUE`.

## Recommendation

Define one `CLASSICAL_PIECE_VALUE` (pawn=1) and derive variants explicitly, e.g. `STANDARD_BUDGET_VALUE = { ...CLASSICAL_PIECE_VALUE, pawn: 0 }`.

## Resolution

Added `src/game/pieceValues.ts` with `CLASSICAL_PIECE_VALUE` (pawn=1) and a
derived `STANDARD_BUDGET_VALUE` (`{ ...CLASSICAL_PIECE_VALUE, pawn: 0 }`). The
four former literals now alias the canonical tables (export names kept for
back-compat): `PIECE_ENERGY_VALUES` (match.ts), `SKIRMISH_PIECE_VALUE`
(skirmish.ts), and `PIECE_VALUE` (material.ts) → `CLASSICAL_PIECE_VALUE`;
`PIECE_VALUE` (standard.ts) → `STANDARD_BUDGET_VALUE`. The pawn=0 divergence is
now visible at the single derivation point.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
