# CH-004: resurrect-piece removes by an index into the unfiltered capturedPieces array

- **Category:** Code — Correctness
- **Severity:** low
- **Status:** Done

## Locations

- `src/game/cards/effectHandlers.ts:609-625`
- `src/components/Match.tsx:1539-1548`

## Problem

`resurrect-piece` removes by an index into the _unfiltered_ `capturedPieces` while the UI supplies a _filtered_ index (player-side only). Latent today because all push sites currently use `side:"player"`, but it will desync the moment an enemy-side or card-destroyed entry is added to the pool (see related teleport bug).

## Recommendation

Resolve the resurrected piece by a stable identity (id) rather than a positional index, or filter the array consistently on both sides.

## Related Issues

- CH-001 — [ssh-tunnel-teleport-phantom](001-ssh-tunnel-teleport-phantom.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
