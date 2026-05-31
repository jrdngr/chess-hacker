# CH-034: Skirmish enemy-mirroring is gameable and removes opponent variety

- **Category:** Game Design — Balance
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/progression/placement.ts:72`
- `src/components/Match/usePlacement.ts:91-129,484-523`
- `docs/design/modes.md:64,101`

## Problem

The enemy mirrors the player's _placed_ composition, so under-placing value forces a symmetric weak enemy and the value cap becomes a player-controlled dial; drafting a queen hands the enemy the same queen. Exact mirroring also removes opponent variety and kills the "Pandora's Box queen" fantasy.

## Recommendation

Set enemy value to the cap (or ~80% early → 100% finale) so under-placing only weakens the player, and give a value-equivalent non-identical roster instead of an exact mirror. See [[project-skirmish-design]] memory for prior decisions.

## Proposed Content

Proposed mechanic — Conscription / Asymmetric Skirmish scaling: set enemy value to the cap so under-placing only weakens the player.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
