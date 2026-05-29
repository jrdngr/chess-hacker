# CH-040: Artifact slot cap is 20 in code but 5 in most docs

- **Category:** Game Design — Design Hole
- **Severity:** high
- **Status:** Open

## Locations

- `src/game/types.ts:727`
- `src/game/progression/run.ts:283-287`
- `src/game/shop/shop.ts:230`
- `docs/README.md:66`
- `docs/design/artifacts.md:16`

## Problem

`types.ts:727` sets `ARTIFACT_SLOT_CAP = 20` (and artifacts.md:16 agrees), but README.md:66, glossary.md, and the run.ts:283 comment all say 5. A 20-cap deletes the displacement-choice mechanic. Also `pickBossArtifact` doesn't enforce the cap while shop.ts:230 does.

## Recommendation

Pick the real number (design assumes ~5), make it canonical across docs and code, and enforce consistently (including pickBossArtifact).

## Related Issues

- CH-042 — [doc-toplevel-obsolete-model](042-doc-toplevel-obsolete-model.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
