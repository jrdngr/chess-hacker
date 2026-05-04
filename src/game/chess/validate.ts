// Position validator for the dev sandbox editor.
//
// The editor is "anything goes" — placing extra kings, pawns on the back
// rank, leaving the wrong side in check are all permitted because the dev
// might be reproducing a bug. validate() doesn't BLOCK any of those; it just
// flags them so the UI can outline the board red and tint the offending
// pieces. Highlight semantics are owned by the caller; this returns the raw
// list of violations.
//
// Rules checked (each is a separate violation kind):
//   - king-count:       each side must have exactly one king.
//   - kings-adjacent:   the two kings cannot be one king-step apart.
//   - pawn-back-rank:   no pawn on rank 0 (would have promoted) or rank
//                       `ranks-1` (same on the other side).
//   - opponent-in-check: the side NOT to move cannot already be in check —
//                       only the side to move may be.
//
// We don't validate "exactly N pawns per side" or "bishops on opposite
// colors" — odd starts can come from draft or card play, and the dev tool
// shouldn't whine about positions that are perfectly legal mid-match.

import { isSquareAttacked, NO_OVERLAYS, squareCoords, type Position } from "./rules";
import type { AlgebraicSquare } from "../types";

export type ValidationViolation =
  | {
      kind: "king-count";
      side: "player" | "opponent";
      count: number;
      squares: AlgebraicSquare[];
      message: string;
    }
  | {
      kind: "kings-adjacent";
      squares: AlgebraicSquare[];
      message: string;
    }
  | {
      kind: "pawn-back-rank";
      squares: AlgebraicSquare[];
      message: string;
    }
  | {
      kind: "opponent-in-check";
      kingSquare: AlgebraicSquare;
      attackerSquares: AlgebraicSquare[];
      squares: AlgebraicSquare[];
      message: string;
    };

export type ValidationResult = {
  ok: boolean;
  violations: ValidationViolation[];
};

/**
 * Validate a position. Returns `ok: true` with an empty list when nothing is
 * wrong; otherwise `ok: false` with one violation per failing rule. Each
 * violation carries a `squares` list of every contributing square so the
 * caller can highlight them all.
 */
export function validatePosition(pos: Position): ValidationResult {
  const violations: ValidationViolation[] = [];

  // 1. King count per side
  const playerKings: AlgebraicSquare[] = [];
  const opponentKings: AlgebraicSquare[] = [];
  for (const [sq, p] of pos.pieces) {
    if (p.type !== "king") continue;
    if (p.side === "player") playerKings.push(sq);
    else opponentKings.push(sq);
  }
  if (playerKings.length !== 1) {
    violations.push({
      kind: "king-count",
      side: "player",
      count: playerKings.length,
      squares: playerKings,
      message:
        playerKings.length === 0
          ? "White is missing a king."
          : `White has ${playerKings.length} kings.`,
    });
  }
  if (opponentKings.length !== 1) {
    violations.push({
      kind: "king-count",
      side: "opponent",
      count: opponentKings.length,
      squares: opponentKings,
      message:
        opponentKings.length === 0
          ? "Black is missing a king."
          : `Black has ${opponentKings.length} kings.`,
    });
  }

  // 2. Kings cannot be adjacent. Only meaningful when each side has exactly one.
  if (playerKings.length === 1 && opponentKings.length === 1) {
    const a = squareCoords(playerKings[0]);
    const b = squareCoords(opponentKings[0]);
    const df = Math.abs(a.file - b.file);
    const dr = Math.abs(a.rank - b.rank);
    if (Math.max(df, dr) <= 1) {
      violations.push({
        kind: "kings-adjacent",
        squares: [playerKings[0], opponentKings[0]],
        message: "Kings are adjacent.",
      });
    }
  }

  // 3. Pawns on the back ranks.
  const backRankSquares: AlgebraicSquare[] = [];
  const lastRank = pos.size.ranks - 1;
  for (const [sq, p] of pos.pieces) {
    if (p.type !== "pawn") continue;
    const { rank } = squareCoords(sq);
    if (rank === 0 || rank === lastRank) backRankSquares.push(sq);
  }
  if (backRankSquares.length > 0) {
    backRankSquares.sort();
    violations.push({
      kind: "pawn-back-rank",
      squares: backRankSquares,
      message:
        backRankSquares.length === 1
          ? `Pawn on a back rank (${backRankSquares[0]}).`
          : `Pawns on back ranks (${backRankSquares.join(", ")}).`,
    });
  }

  // 4. Side not to move cannot be in check.
  const them = pos.turn === "player" ? "opponent" : "player";
  const themKings = them === "player" ? playerKings : opponentKings;
  if (themKings.length === 1) {
    const kingSq = themKings[0];
    if (isSquareAttacked(pos, NO_OVERLAYS, kingSq, pos.turn)) {
      const attackers = findAttackers(pos, kingSq, pos.turn);
      const themLabel = them === "player" ? "White" : "Black";
      const sideToMoveLabel = pos.turn === "player" ? "White" : "Black";
      violations.push({
        kind: "opponent-in-check",
        kingSquare: kingSq,
        attackerSquares: attackers,
        squares: [kingSq, ...attackers],
        message: `${sideToMoveLabel} is to move but ${themLabel} is in check.`,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

/** All squares attacking `target` from `attacker` side. Walls / freezes ignored. */
function findAttackers(
  pos: Position,
  target: AlgebraicSquare,
  attacker: "player" | "opponent",
): AlgebraicSquare[] {
  // Cheap brute: for each piece of `attacker` side, ask `isSquareAttacked` on
  // a 1-piece subset. A direct generator would be faster but this is editor
  // code, only runs on edits.
  const out: AlgebraicSquare[] = [];
  for (const [sq, p] of pos.pieces) {
    if (p.side !== attacker) continue;
    const subset = new Map<AlgebraicSquare, typeof p>();
    subset.set(sq, p);
    // Include the king on the target so attackers that need a victim still
    // resolve correctly (only relevant for the engine's pawn-attack code,
    // which doesn't actually consume the target — but defensive).
    const targetPiece = pos.pieces.get(target);
    if (targetPiece) subset.set(target, targetPiece);
    const subsetPos: Position = { ...pos, pieces: subset };
    if (isSquareAttacked(subsetPos, NO_OVERLAYS, target, attacker)) out.push(sq);
  }
  return out.sort();
}

/**
 * Flatten every "offending square" from a result into one Set. The dev panel
 * uses this to drive the per-piece red-tint highlight.
 */
export function offendingSquares(result: ValidationResult): Set<AlgebraicSquare> {
  const out = new Set<AlgebraicSquare>();
  for (const v of result.violations) {
    for (const sq of v.squares) out.add(sq);
  }
  return out;
}
