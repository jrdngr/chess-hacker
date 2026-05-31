// Chess960-style starting-position generator, generalized to arbitrary board
// sizes and piece sets.
//
// For each match Standard mode produces a fresh randomized starting position.
// On 8x8 with the standard back-rank set this is exactly Chess960; smaller
// boards or reduced piece sets follow the same constraints, slack on the ones
// that don't apply (no two bishops → no opposite-color constraint; no two
// rooks → no king-between-rooks constraint, and castling is unavailable).
//
// Constraint order:
//   1. If two bishops are present, they go on opposite-color squares.
//   2. If two rooks are present, the king is placed between them.
//   3. Remaining pieces fill the rest of the back rank in any order.
//   4. White's back rank is mirrored to black.
//   5. Pawns fill the white-pawn rank and the black-pawn rank.
//
// We don't validate that the resulting position is "interesting" (some
// arrangements may be lopsided on small boards). Tuning targets across the run
// rely on the piece curve, not on per-match position equality.

import type { Rng } from "../cards/match";
import type { BoardSize, PieceSet, PieceType, Side } from "../types";
import { pawnStartRank, serializeFen, type Position } from "./rules";
import { squareName } from "./coords";

/** A generated starting position bundled with the board size it lives on. */
export type GeneratedPosition = { fen: string; size: BoardSize };

/**
 * Place the back-rank pieces randomly, respecting the bishop and rook
 * constraints. Throws if the piece set won't fit (`backRank.length > files`).
 */
export function placeBackRank(pieceSet: PieceSet, files: number, rng: Rng): (PieceType | null)[] {
  const back = pieceSet.backRank;
  if (back.length > files) {
    throw new Error(`backRank has ${back.length} pieces but board has ${files} files`);
  }
  const slots: (PieceType | null)[] = new Array(files).fill(null);

  const counts = new Map<PieceType, number>();
  for (const t of back) counts.set(t, (counts.get(t) ?? 0) + 1);

  const remainingFiles = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < files; i++) if (slots[i] === null) out.push(i);
    return out;
  };

  // 1. Two bishops on opposite-color squares (file parity).
  if ((counts.get("bishop") ?? 0) >= 2) {
    const empty = remainingFiles();
    const evens = empty.filter((f) => f % 2 === 0);
    const odds = empty.filter((f) => f % 2 === 1);
    if (evens.length > 0 && odds.length > 0) {
      slots[evens[Math.floor(rng() * evens.length)]] = "bishop";
      const oddsLeft = remainingFiles().filter((f) => f % 2 === 1);
      slots[oddsLeft[Math.floor(rng() * oddsLeft.length)]] = "bishop";
      counts.set("bishop", (counts.get("bishop") ?? 0) - 2);
    }
  }

  // 2. King between two rooks. Pick three slots in increasing file order.
  if ((counts.get("rook") ?? 0) >= 2 && (counts.get("king") ?? 0) >= 1) {
    const empty = remainingFiles();
    if (empty.length >= 3) {
      // Pick three distinct positions; sort. Place rook, king, rook in that order.
      const triple = pickK(empty, 3, rng).sort((a, b) => a - b);
      slots[triple[0]] = "rook";
      slots[triple[1]] = "king";
      slots[triple[2]] = "rook";
      counts.set("rook", (counts.get("rook") ?? 0) - 2);
      counts.set("king", (counts.get("king") ?? 0) - 1);
    }
  }

  // 3. Remaining pieces — flatten the leftover counts into a multiset, shuffle,
  //    drop into the remaining empty slots in order.
  const leftover: PieceType[] = [];
  for (const [t, n] of counts) for (let i = 0; i < n; i++) leftover.push(t);
  shuffleInPlace(leftover, rng);
  const empties = remainingFiles();
  for (let i = 0; i < empties.length && i < leftover.length; i++) {
    slots[empties[i]] = leftover[i];
  }

  return slots;
}

/**
 * Generate a Chess960-style starting position for the given piece set and
 * board size. Returns a FEN paired with the board size — callers persist both
 * because standard FEN is implicitly 8x8.
 */
export function generateChess960Position(
  pieceSet: PieceSet,
  size: BoardSize,
  rng: Rng,
): GeneratedPosition {
  const slots = placeBackRank(pieceSet, size.files, rng);
  const pieces = new Map<string, { type: PieceType; side: Side }>();
  const whiteBack = 0;
  const blackBack = size.ranks - 1;
  for (let f = 0; f < size.files; f++) {
    const t = slots[f];
    if (!t) continue;
    pieces.set(squareName(f, whiteBack), { type: t, side: "player" });
    pieces.set(squareName(f, blackBack), { type: t, side: "opponent" });
  }
  // Pawns. `pieceSet.pawns` may be fewer than `size.files` (e.g. a sandbox
  // setup with reduced pawn counts). Pick the pawn files randomly, keeping
  // white and black symmetric (same files for both). Standard mode currently
  // sets `pawns === size.files`, so the front rank is fully populated.
  const wPawnRank = 1;
  const bPawnRank = size.ranks - 2;
  const pawnFileCount = Math.min(pieceSet.pawns, size.files);
  const allFiles: number[] = [];
  for (let f = 0; f < size.files; f++) allFiles.push(f);
  shuffleInPlace(allFiles, rng);
  const pawnFiles = allFiles.slice(0, pawnFileCount).sort((a, b) => a - b);
  for (const f of pawnFiles) {
    pieces.set(squareName(f, wPawnRank), { type: "pawn", side: "player" });
    pieces.set(squareName(f, bPawnRank), { type: "pawn", side: "opponent" });
  }

  // Castling rights: only set on 8x8 boards where the standard layout puts
  // rooks at the corners and the king in between. On generated 960 layouts
  // the king isn't necessarily on e1, so we'd need to encode the rook files
  // — we don't bother for the prototype. Castling is therefore "unavailable
  // unless the layout happens to look standard" on 8x8, and never available
  // off 8x8. That's fine for our tuning targets.
  const castling = { K: false, Q: false, k: false, q: false };

  const position: Position = {
    pieces,
    turn: "player",
    castling,
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    size,
  };
  // Sanity: the helper we use mirrors `pawnStartRank`, asserted here so the
  // doc claim stays true if these constants ever diverge.
  if (pawnStartRank(size, "player") !== wPawnRank) {
    throw new Error("pawnStartRank disagrees with generator");
  }
  return { fen: serializeFen(position), size };
}

function pickK<T>(arr: readonly T[], k: number, rng: Rng): T[] {
  // Reservoir-style: copy + Fisher-Yates partial.
  const a = arr.slice();
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

function shuffleInPlace<T>(arr: T[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
