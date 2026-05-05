// Zone-control buffs (M7).
//
// A zone-buff grants its `effect` while the controlling side has at least one
// piece on a square inside the buff's region. This module is the source of
// truth for:
//
//   - Resolving a `ZoneRegion` to a concrete set of squares for a given board.
//   - Deciding whether a buff is "active" (controlled) given a board context.
//   - Summing the energy / hand-size bonuses across the active buffs at the
//     start of a player turn.
//
// Pure TypeScript — no React. The pattern matches the rest of `game/`.

import type { AlgebraicSquare, BoardSize, Side, ZoneBuff, ZoneRegion } from "../types";

/** Just enough of the chess board to evaluate zone-buff control. */
export type ZoneBoardContext = {
  size: BoardSize;
  /** Whose piece (if any) sits on this square. */
  pieceSideAt: (sq: AlgebraicSquare) => Side | null;
};

/** Enumerate every square in `region` that fits on a `size` board. */
export function regionSquares(region: ZoneRegion, size: BoardSize): Set<AlgebraicSquare> {
  const out = new Set<AlgebraicSquare>();
  if (region.kind === "rank") {
    if (region.rank < 1 || region.rank > size.ranks) return out;
    for (let f = 0; f < size.files; f++) out.add("abcdefgh"[f] + region.rank);
    return out;
  }
  // Both anchored patterns share the same expansion logic, just different
  // neighbour offsets.
  const offsets = region.kind === "square-radius-1" ? KING_RADIUS_OFFSETS : ORTHOGONAL_OFFSETS;
  const fileIdx = "abcdefgh".indexOf(region.anchor[0]);
  const rank = Number(region.anchor.slice(1));
  if (fileIdx < 0 || !Number.isFinite(rank)) return out;
  // The anchor itself counts toward the region.
  if (fileIdx >= 0 && fileIdx < size.files && rank >= 1 && rank <= size.ranks) {
    out.add(region.anchor);
  }
  for (const [df, dr] of offsets) {
    const f = fileIdx + df;
    const r = rank + dr;
    if (f < 0 || f >= size.files) continue;
    if (r < 1 || r > size.ranks) continue;
    out.add("abcdefgh"[f] + r);
  }
  return out;
}

const ORTHOGONAL_OFFSETS: ReadonlyArray<[number, number]> = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

const KING_RADIUS_OFFSETS: ReadonlyArray<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/**
 * True iff the buff's controlling side has at least one piece on any square
 * in the buff's region. This is the "control" check from the design doc —
 * see `docs/design/board.md` ("Zone-control buffs").
 */
export function isZoneBuffActive(buff: ZoneBuff, ctx: ZoneBoardContext): boolean {
  const squares = regionSquares(buff.region, ctx.size);
  for (const sq of squares) {
    if (ctx.pieceSideAt(sq) === buff.side) return true;
  }
  return false;
}

/**
 * Evaluate every buff in `buffs` against the board, returning the subset that
 * is currently active (controlled). Side-effect free; the returned objects
 * are the same references as in the input array.
 */
export function activeZoneBuffs(buffs: ReadonlyArray<ZoneBuff>, ctx: ZoneBoardContext): ZoneBuff[] {
  return buffs.filter((b) => isZoneBuffActive(b, ctx));
}

/** Sum the `energy-per-turn` bonus across the active buffs (player side). */
export function zoneBuffEnergyPerTurn(active: ReadonlyArray<ZoneBuff>): number {
  let n = 0;
  for (const b of active) {
    if (b.side !== "player") continue;
    if (b.effect.kind === "energy-per-turn") n += b.effect.amount;
  }
  return n;
}

/** Sum the `hand-size` bonus across the active buffs (player side). */
export function zoneBuffHandSize(active: ReadonlyArray<ZoneBuff>): number {
  let n = 0;
  for (const b of active) {
    if (b.side !== "player") continue;
    if (b.effect.kind === "hand-size") n += b.effect.amount;
  }
  return n;
}

/** Convenience helper: union of every region's squares (for aura rendering). */
export function zoneBuffSquares(
  buffs: ReadonlyArray<ZoneBuff>,
  size: BoardSize,
): Set<AlgebraicSquare> {
  const out = new Set<AlgebraicSquare>();
  for (const b of buffs) {
    for (const sq of regionSquares(b.region, size)) out.add(sq);
  }
  return out;
}
