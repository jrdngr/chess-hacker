# CH-003: Sanctuary/Shield protection is bypassed by en passant

- **Category:** Code — Correctness
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/chess/rules.ts:555`
- `src/game/chess/rules.ts:820-834`
- `src/game/chess/rules.ts:1055`

## Problem

The pseudo-legal filter enforcing Shield/Sanctuary checks `m.to`: `if (m.isCapture && (sanc.has(m.to) || sh.has(m.to))) continue;`. For en passant the captured pawn sits on `m.epVictim`, not `m.to` (the empty EP target square). A shielded pawn double-pushing carries its shield via `relocateStatuses`, but the opponent's EP capture has `m.to` = empty square and deletes the shielded pawn anyway. This contradicts the documented "cannot be captured" guarantee (docs/cards/keywords.md:53,97; docs/cards/spatial.md:20).

## Recommendation

Guard the EP victim: `if (m.isCapture) { const victimSq = m.epVictim ?? m.to; if (sanc.has(victimSq) || sh.has(victimSq)) continue; }`. Add a regression test that shields a pawn and attempts EP capture.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
