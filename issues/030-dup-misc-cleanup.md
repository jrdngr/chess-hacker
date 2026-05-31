# CH-030: Miscellaneous low-level duplication cleanup

- **Category:** Refactor — Duplication
- **Severity:** low
- **Status:** Done

## Locations

- `src/game/chess/positions.ts:149-151`
- `src/game/progression/placement.ts:133-135`
- `src/game/cards/effectHandlers.ts:683-702`
- `src/game/overlays/zoneBuffs.ts:85-92`
- `src/game/chess/rules.ts:321-344`
- `src/game/cards/match.ts:96-101`
- `src/game/chess/positions.ts:163-168`
- `src/components/Match.tsx:1504,1524,1544`
- `src/components/Run/PieceDraft.tsx:15`

## Problem

A cluster of smaller duplications: private `squareName`/`sq` helpers duplicated in positions.ts and placement.ts; knight/king/rook offset tables redefined in effectHandlers.ts and zoneBuffs.ts vs canonical-but-unexported tables in rules.ts; Fisher-Yates shuffle implemented twice (`shuffle` in match.ts, `shuffleInPlace` in positions.ts); Chess960 back-rank legality re-implemented in placement.ts (validate) vs positions.ts (generate); piece-name title-casing repeated 3x in Match.tsx vs PieceDraft.tsx's `PIECE_NAMES`.

## Recommendation

Consolidate each into a single shared export. Export the rules.ts offset tables; pick one shuffle; share one Chess960 legality predicate; reuse `PIECE_NAMES`.

## Resolution

- **Private `squareName`/`sq` helpers** (positions.ts, placement.ts) — already
  removed under CH-026; both call the canonical `squareName`.
- **Offset tables** — `KNIGHT_OFFSETS`, `ORTHOGONAL_OFFSETS`,
  `DIAGONAL_OFFSETS`, `HORIZONTAL_OFFSETS` now live in `chess/coords.ts`
  (alongside `KING_OFFSETS` from CH-028). `rules.ts` aliases its
  `KNIGHT_DELTAS` / `ROOK_DIRS` / `BISHOP_DIRS` / `HORIZONTAL_DELTAS` to them
  (orders unchanged, so move generation is identical); `effectHandlers.ts`
  (`friendlySquaresInBlast` knight table) and `zoneBuffs.ts`
  (`ORTHOGONAL_OFFSETS`) import the shared tables instead of redefining them.
- **Shuffle** — `positions.ts` `shuffleInPlace` removed; it now uses
  `shuffle` from `cards/match.ts`. Both are the same Fisher-Yates loop, so the
  seeded permutation is unchanged. (The distinct `pickK` partial shuffle is
  left as-is.)
- **Chess960 legality** — extracted `backRankLegalityErrors(backRank)` in
  `positions.ts` (bishop-opposite-color + king-between-rooks); `placement.ts`
  `validatePlacement` calls it instead of re-implementing the checks.
- **Piece-name title-casing** — added `components/Board/pieceNames.ts`
  (`PIECE_NAMES` + `pieceLabel`); `PieceDraft.tsx` imports `PIECE_NAMES` and
  `Match.tsx`'s three `type.charAt(0).toUpperCase() + type.slice(1)` sites use
  `pieceLabel`.

All 576 tests pass.

## Related Issues

- CH-028 — [dup-king-adjacency](028-dup-king-adjacency.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
