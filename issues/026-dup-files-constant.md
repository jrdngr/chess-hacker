# CH-026: FILES / "abcdefgh" / FILE_LETTERS constant redefined in ~7 modules

- **Category:** Refactor — Duplication
- **Severity:** medium
- **Status:** Done

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

## Resolution

`FILES` and `squareName` now live in `src/game/chess/coords.ts` (added in
CH-025) and are imported everywhere; the local copies are deleted:

- `rules.ts` `FILES` array — removed (the canonical lives in coords, re-exported
  via rules → engine).
- `effectHandlers.ts` `FILE_LETTERS = "abcdefgh"` — removed; both build sites
  use the imported `FILES`.
- `match.ts` two inline `const FILES = "abcdefgh"` — removed; use the import.
- `positions.ts` private `squareName` and `placement.ts` private `sq` —
  removed; both call the canonical `squareName` (same 0-indexed signature).
- `zoneBuffs.ts`, `targeting.ts`, `derivations.ts` bare `"abcdefgh"[f]` literals
  — replaced with the imported `FILES`.

(The remaining `"abcdefgh"` literals — Board.tsx's file-label rendering and a
positions test — are outside this issue's scope.)

## Related Issues

- CH-025 — [dup-square-coord-parsing](025-dup-square-coord-parsing.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
