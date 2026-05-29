# CH-029: Rarity-weighted distinct-pick loop copy-pasted

- **Category:** Refactor — Duplication
- **Severity:** low
- **Status:** Open

## Locations

- `src/game/progression/run.ts:233-258`
- `src/game/artifacts/library.ts:470-502`

## Problem

`pickRandomCards` and `pickRandomArtifacts` are structurally identical loops with the same hardcoded thresholds `r < 0.05` (rare) / `r < 0.3` (uncommon). The artifact version's own comment (library.ts:464) admits it "Mirrors the card-pool weighting in progression/run.ts." Only difference: the artifact version takes an `excludeIds` param.

## Recommendation

Extract a generic `pickRandomByRarity<T extends {id; rarity}>(...)` or at minimum hoist 0.05/0.3 to a named shared constant.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
