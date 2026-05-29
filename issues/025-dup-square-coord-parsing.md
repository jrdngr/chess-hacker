# CH-025: Square coordinate parsing reimplemented inline in 7+ files

- **Category:** Refactor — Duplication
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/chess/rules.ts:40,46`
- `src/game/cards/match.ts:589,599-602`
- `src/game/cards/effectHandlers.ts:544-545,681-682`
- `src/game/overlays/zoneBuffs.ts:49-50`
- `src/components/Match/targeting.ts:61-62`
- `src/components/Match/derivations.ts:98-99`
- `src/components/Match/useDevSandbox.ts:190-195`

## Problem

`rules.ts` exports canonical `squareName(file,rank)` and `squareCoords(s)` (re-exported via engine.ts:41), yet modules decode/encode squares by hand (`s.charCodeAt(0) - "a".charCodeAt(0)`, `Number(s.slice(1))`). Conventions diverge: `squareCoords` returns a 0-indexed rank while hand-rolled versions keep 1-indexed, and `useDevSandbox` uses yet another 0-indexed convention — so a mechanical refactor would silently shift ranks at several sites.

## Recommendation

Add a small coord module (`fileOf`, `rankOf` with one fixed indexing convention, `squareAt(file,rank)`) and route all inline call sites through it. Migrate carefully given the indexing divergence.

## Related Issues

- CH-026 — [dup-files-constant](026-dup-files-constant.md)
- CH-027 — [dup-piece-value](027-dup-piece-value.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
