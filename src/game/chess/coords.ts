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

import type { AlgebraicSquare, FileIndex, RankIndex } from "../types";

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
