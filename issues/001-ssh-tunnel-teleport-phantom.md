# CH-001: SSH Tunnel teleport records own piece as destroyed and drops its buffs

- **Category:** Code — Correctness
- **Severity:** high
- **Status:** Open

## Locations

- `src/components/Match/sideEffects.ts:157-171`
- `src/game/cards/effectHandlers.ts:583-596`
- `src/game/cards/data/ssh-tunnel.json`

## Problem

`teleport-piece` emits `{remove-piece, first}` then `{place-piece, second}`. SSH Tunnel always targets OWN pieces, so the remove-piece handler pushes `{type, side:"player", reason:"destroyed"}` into `capturedPieces` for a piece still on the board. The paired place-piece never relocates statuses (unlike swap/foreign-move), so Shield/Haste/Empower/Lightning are stripped. `resurrect-piece` (effectHandlers.ts:609-624) filters only by `side === "player"` and does not exclude `reason:"destroyed"` or `type === "king"`, so Git Revert can resurrect the phantom; with SSH Tunnel+ (king allowed) this seeds a second player king.

## Recommendation

Add a dedicated `move-piece`/teleport side effect using `engine.displacePiece` + `relocateStatuses`, or special-case teleport so the remove does not push to `capturedPieces` and the place relocates statuses. Add a regression test.

## Related Issues

- CH-002 — [bit-flip-keeps-enemy-statuses](002-bit-flip-keeps-enemy-statuses.md)
- CH-004 — [resurrect-piece-index-mismatch](004-resurrect-piece-index-mismatch.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
