# CH-055: Sacrifice (2 cards) and Summon (3 cards) archetypes lack density and anchors

- **Category:** Game Design — Content
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/cards/data/`
- `src/game/artifacts/library.ts`

## Problem

Sacrifice (2 cards) and Summon (3 cards) lack density and any supporting artifact to anchor a build.

## Recommendation

Add cheap enablers, payoffs, and a supporting artifact for each archetype.

## Proposed Content

Proposed — Martyr Protocol (Cost 1 Common: destroy own pawn → gain 2 energy, draw 1); Swarm Protocol (Cost 6 Uncommon: summon a pawn on each empty square orthogonally adjacent to one chosen pawn, ≤4); plus Scavenger and Hive Mind artifacts.

## Related Issues

- CH-053 — [content-artifact-pool-thin](053-content-artifact-pool-thin.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
