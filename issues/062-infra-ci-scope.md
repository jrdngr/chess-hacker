# CH-062: CI runs only on main push/PRs and only ever uses a fake Stockfish worker

- **Category:** Docs / Infra
- **Severity:** low
- **Status:** Open

## Locations

- `.github/workflows/ci.yml`
- `src/ai/stockfish.test.ts`

## Problem

ci.yml triggers only on `main` push + PRs, so dev-branch pushes get no CI until a PR opens; and the suite only ever uses a fake Worker — the real Fairy-Stockfish worker / SharedArrayBuffer / cross-origin isolation is never booted.

## Recommendation

Add the dev branch to the push trigger and a Playwright smoke test asserting `crossOriginIsolated` and `readyok`.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
