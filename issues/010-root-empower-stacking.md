# CH-010: Root + Empower stacking silently loses all empower moves

- **Category:** Code — Correctness
- **Severity:** nit
- **Status:** Open

## Locations

- `src/game/chess/rules.ts:526-558`
- `src/game/chess/rules.ts:867-915`

## Problem

A rooted+empowered piece silently loses all empower moves (empower moves are never captures, and Root drops all non-captures). Confirm this is the intended interaction; if not it is a silent feel-bad.

## Recommendation

Document the intended Root×Empower interaction in docs/cards/keywords.md and add a test pinning the behavior.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
