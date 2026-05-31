# CH-029: Rarity-weighted distinct-pick loop copy-pasted

- **Category:** Refactor — Duplication
- **Severity:** low
- **Status:** Done

## Locations

- `src/game/progression/run.ts:233-258`
- `src/game/artifacts/library.ts:470-502`

## Problem

`pickRandomCards` and `pickRandomArtifacts` are structurally identical loops with the same hardcoded thresholds `r < 0.05` (rare) / `r < 0.3` (uncommon). The artifact version's own comment (library.ts:464) admits it "Mirrors the card-pool weighting in progression/run.ts." Only difference: the artifact version takes an `excludeIds` param.

## Recommendation

Extract a generic `pickRandomByRarity<T extends {id; rarity}>(...)` or at minimum hoist 0.05/0.3 to a named shared constant.

## Resolution

Added `src/game/progression/rarity.ts` with `pickRandomByRarity<T extends {
id: string }>(pools, count, rng)` plus named `RARE_THRESHOLD = 0.05` /
`UNCOMMON_THRESHOLD = 0.3` constants. `pickRandomCards` (run.ts) and
`pickRandomArtifacts` (library.ts) now build their three rarity-filtered pools
and delegate to it. The pools are passed pre-filtered (each caller applies its
own exclusions before splitting), so the RNG call sequence — and therefore
seeded determinism — is identical to the previous inline copies.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
