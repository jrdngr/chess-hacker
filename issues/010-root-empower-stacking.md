# CH-010: Root + Empower stacking silently loses all empower moves

- **Category:** Code — Correctness
- **Severity:** nit
- **Status:** Done

## Resolution

Confirmed as intended: Empower-granted moves are always non-captures, and Root
drops all non-capturing moves, so a rooted+empowered piece keeps only its
native adjacent captures. Documented the interaction under Root in
`docs/cards/keywords.md` and pinned it with `rules.test.ts` (empower move
present without Root, suppressed with Root; adjacent capture survives).

## Locations

- `src/game/chess/rules.ts:526-558`
- `src/game/chess/rules.ts:867-915`

## Problem

A rooted+empowered piece silently loses all empower moves (empower moves are never captures, and Root drops all non-captures). Confirm this is the intended interaction; if not it is a silent feel-bad.

## Recommendation

Document the intended Root×Empower interaction in docs/cards/keywords.md and add a test pinning the behavior.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
