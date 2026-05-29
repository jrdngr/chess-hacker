# CH-026: FILES / "abcdefgh" / FILE_LETTERS constant redefined in ~7 modules

- **Category:** Refactor — Duplication
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/chess/rules.ts:36`
- `src/game/cards/effectHandlers.ts:664`
- `src/game/cards/match.ts:440,543`
- `src/game/chess/positions.ts:150`
- `src/game/progression/placement.ts:134`
- `src/game/overlays/zoneBuffs.ts:34`
- `src/components/Match/targeting.ts:71`
- `src/components/Match/derivations.ts:107`

## Problem

`rules.ts:36` defines `FILES`; `effectHandlers.ts:664` defines `FILE_LETTERS = "abcdefgh"`; `match.ts` inlines `const FILES = "abcdefgh"` twice; `positions.ts` and `placement.ts` each have private byte-identical `squareName`/`sq`; UI modules use the bare literal repeatedly. A canonical `squareName` is already exported and used by usePlacement.ts.

## Recommendation

Export one `FILES` constant / `squareAt` builder and import everywhere; delete the local copies.

## Related Issues

- CH-025 — [dup-square-coord-parsing](025-dup-square-coord-parsing.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
