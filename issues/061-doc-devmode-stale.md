# CH-061: dev-mode.md is broadly stale vs code

- **Category:** Docs / Infra
- **Severity:** low
- **Status:** Open

## Locations

- `docs/technical/dev-mode.md`
- `src/components/Match/`
- `src/ai/`

## Problem

dev-mode.md names hooks `useMatchEngine`/`useCardSystem`/`useAiTurn` that don't exist (real: `useAiLoop`, `useCardPlay`, `useDevSandbox`, etc.), points at `DevPanel.tsx` instead of `DevPanel/index.tsx`, and references a `src/ai/toyAi.ts` non-8x8 fallback that doesn't exist.

## Recommendation

Update dev-mode.md to the real hook set, the real DevPanel path, and the actual Fairy-Stockfish variant behavior.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
