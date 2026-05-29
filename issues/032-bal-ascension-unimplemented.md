# CH-032: Ascension/heat system is stored but entirely unimplemented

- **Category:** Game Design — Balance
- **Severity:** high
- **Status:** Open

## Locations

- `src/game/types.ts:554`
- `src/game/progression/run.ts:57,89`
- `src/components/Run/Run.tsx:219`

## Problem

`RunState.ascension` is only ever logged (runHistory.ts, Run.tsx:219); no pricing/depth/hand-size code reads it. Every documented A1–A8 modifier is a no-op, so every Ascension level is mechanically identical to Ascension 0.

## Recommendation

Implement at least A1 (shop prices ×1.2) and A2 (AI depth), or hide Ascension in the UI and mark it unbuilt in docs.

## Proposed Content

Proposed mechanic — Sandbox: thread run.ascension into shop pricing ×(1+0.2·level) as the first real Ascension modifier.

## Related Issues

- CH-031 — [bal-ai-difficulty-flat](031-bal-ai-difficulty-flat.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
