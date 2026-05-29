# CH-024: Save/load persistence is fully specced but unimplemented and untested

- **Category:** Tests — Coverage
- **Severity:** low
- **Status:** Open

## Locations

- `docs/technical/persistence.md:1-128`
- `src/game/progression/run.ts:1-104`
- `src/state/palette.ts:44-92`

## Problem

The spec (two localStorage keys, per-action save points, resume-on-boot, versioning/migration) is fully written, but no `SavedRun`/`MetaState` type or save/load/migrate code exists; the only localStorage usage is palette toggles. A refresh mid-run loses the entire run and all meta-progression. NOTE: docs/roadmap/milestones.md:137 explicitly defers save/resume to a follow-up milestone, so this is a known-future gap, not shipped-broken.

## Recommendation

When built, add `persistence.ts` + colocated tests (round-trip, ID-rehydration with dropped-ID, version-mismatch invalidation). Until then keep the deferral recorded.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
