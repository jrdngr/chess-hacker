// Canonical square-coordinate helpers and the file-letter constant (CH-025,
// CH-026).
//
// One indexing convention for file/rank pairs:
//   - file: 0-indexed column. "a" → 0, "h" → 7.
//   - rank: 0-indexed row.    "a1" → 0, "a8" → 7. This matches the `RankIndex`
//     used throughout the rule engine and by `squareName` / `squareCoords`.
//
// Some call sites work in 1-indexed *algebraic* ranks (the number printed in
// the square, e.g. the `8` in "e8"). For those, `rankNumberOf` returns the
// 1-indexed value so a migration off hand-rolled `Number(s.slice(1))` does not
// silently shift ranks. Pick the helper that matches the surrounding math:
//   - 0-indexed math (RankIndex / board arrays): `rankOf`, `squareName`.
//   - 1-indexed math (algebraic rank, bounds like `r >= 1 && r <= ranks`):
//     `rankNumberOf`, and build squares with `FILES[file] + String(rank)`.

import type { AlgebraicSquare, BoardSize, FileIndex, RankIndex } from "../types";

/** File letters in order. Index with a 0-indexed file: `FILES[0] === "a"`. */
export const FILES = "abcdefgh";

/** Build an algebraic square from a 0-indexed file and 0-indexed rank. */
export function squareName(file: FileIndex, rank: RankIndex): AlgebraicSquare {
  // Algebraic ranks have one or two digits ("a1".."h10" — we cap at 8 today,
  // but the helper is robust either way).
  return `${FILES[file]}${rank + 1}`;
}

/** Split an algebraic square into 0-indexed file/rank. */
export function squareCoords(s: AlgebraicSquare): { file: FileIndex; rank: RankIndex } {
  return { file: fileOf(s), rank: rankOf(s) };
}

/** 0-indexed file of a square. `fileOf("c4") === 2`. */
export function fileOf(s: AlgebraicSquare): FileIndex {
  return FILES.indexOf(s[0]) as FileIndex;
}

/** 0-indexed rank of a square (RankIndex). `rankOf("c4") === 3`. */
export function rankOf(s: AlgebraicSquare): RankIndex {
  return (Number(s.slice(1)) - 1) as RankIndex;
}

/** 1-indexed algebraic rank number of a square. `rankNumberOf("c4") === 4`. */
export function rankNumberOf(s: AlgebraicSquare): number {
  return Number(s.slice(1));
}

// ---- Geometry: king-step adjacency ----------------------------------------

/**
 * The eight king-step adjacency offsets as `[df, dr]` deltas, in file-major
 * (then rank-ascending) scan order: `[-1,-1] … [1,1]`. This is the order the
 * 3×3 enumeration has always produced, so `kingAdjacentSquares` yields squares
 * in a stable, file-then-rank sequence (some callers — e.g. Self-Destruct's
 * blast — rely on this order). Distinct from the rule engine's move-direction
 * tables, which order orthogonal-before-diagonal.
 */
export const KING_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/** Whether a 0-indexed (file, rank) pair lies on a `size` board. */
export function withinBounds(size: BoardSize, file: number, rank: number): boolean {
  return file >= 0 && file < size.files && rank >= 0 && rank < size.ranks;
}

// ---- Geometry: piece move-direction tables --------------------------------
//
// `[df, dr]` deltas shared by the rule engine (move generation) and the card /
// overlay geometry. Orders match the rule engine's historical move-generation
// order, so move lists — and the tests that assert them — are unchanged.

/** Knight move offsets. */
export const KNIGHT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

/** Orthogonal (rook) directions. */
export const ORTHOGONAL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Diagonal (bishop) directions. */
export const DIAGONAL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

/** Horizontal (left/right) single steps. */
export const HORIZONTAL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
];

/**
 * The king-step-adjacent squares around `center` that lie on a `size` board.
 * Excludes `center` itself unless `includeCenter` is set (the 3×3 region used
 * by Mutex Lock / zone-radius buffs includes the anchor; blast/adjacency
 * patterns exclude it).
 */
export function kingAdjacentSquares(
  center: AlgebraicSquare,
  size: BoardSize,
  opts: { includeCenter?: boolean } = {},
): AlgebraicSquare[] {
  const f0 = fileOf(center);
  const r0 = rankOf(center);
  const out: AlgebraicSquare[] = [];
  if (opts.includeCenter && withinBounds(size, f0, r0)) out.push(center);
  for (const [df, dr] of KING_OFFSETS) {
    const f = f0 + df;
    const r = r0 + dr;
    if (!withinBounds(size, f, r)) continue;
    out.push(squareName(f as FileIndex, r as RankIndex));
  }
  return out;
}
