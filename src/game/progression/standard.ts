// Standard-mode per-match config: board size + piece-set spec per match.
//
// Standard is the default mode. The 9-match run uses three square boards,
// one per act: Act 1 = 6×6, Act 2 = 7×7, Act 3 = 8×8. The board only grows
// after an act-end boss, so all three matches in an act share a size and
// the boss is played on the act's board. Within an act the piece curve
// climbs match-to-match up to a full 16-piece army by the finale. There's
// no piece drafting in Standard.
//
// Composition is "points-budget driven" for non-boss matches: each match
// names a non-pawn points budget plus a pool of allowed piece types, and we
// roll a Chess960-legal back rank from that. Pawns fill the front rank
// (`pawns = files`). Bosses keep hand-tuned explicit compositions; their
// hazards in `docs/design/bosses.md` are designed around them.
//
// Tuning knobs live here. The numbers below are first-pass picks; playtest
// will move them.

import type { Rng } from "../cards/match";
import type { BoardSize, PieceSet, PieceType } from "../types";

/** Standard chess piece values, used by the random-roll budget. */
export const PIECE_VALUE: Readonly<Record<PieceType, number>> = {
  pawn: 0,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

/**
 * Chess960-legal per-side caps. The roll skips a piece type once its count
 * hits the cap, so a generated army can never have e.g. 3 knights or 2 queens.
 */
export const PIECE_CAP: Readonly<Record<PieceType, number>> = {
  pawn: Number.POSITIVE_INFINITY,
  knight: 2,
  bishop: 2,
  rook: 2,
  queen: 1,
  king: 1,
};

/**
 * Spec for the back rank of a match.
 *
 * - `explicit`: hand-listed multiset (used by bosses). The list must include
 *   the king and obey the per-type caps.
 * - `random`: roll non-pawn pieces from `allowedPieces` until a non-pawn
 *   points budget is exhausted; cap-respecting, so the result is always a
 *   Chess960-legal army.
 */
export type PieceSpec =
  | { kind: "explicit"; backRank: PieceType[] }
  | { kind: "random"; allowedPieces: PieceType[]; nonPawnPointsBudget: number };

export type StandardMatchConfig = {
  /** 1-indexed match number across the run (1..9). */
  matchNumber: number;
  size: BoardSize;
  /**
   * Pawn count per side. Equals `size.files` for the current curve (full
   * pawn rank), but kept explicit so future tuning can decouple the two.
   */
  pawns: number;
  pieceSpec: PieceSpec;
  /** Whether this match is the act-end boss. */
  isBoss: boolean;
  /** Approximate target move-count for an average player. */
  moveTarget: number;
};

const explicit = (backRank: PieceType[]): PieceSpec => ({ kind: "explicit", backRank });
const random = (allowedPieces: PieceType[], nonPawnPointsBudget: number): PieceSpec => ({
  kind: "random",
  allowedPieces,
  nonPawnPointsBudget,
});

const M = (
  matchNumber: number,
  files: number,
  ranks: number,
  pieceSpec: PieceSpec,
  isBoss: boolean,
  moveTarget: number,
): StandardMatchConfig => ({
  matchNumber,
  size: { files, ranks },
  pawns: files,
  pieceSpec,
  isBoss,
  moveTarget,
});

const MINORS_AND_ROOK: PieceType[] = ["knight", "bishop", "rook"];
const MINORS_ROOK_QUEEN: PieceType[] = ["knight", "bishop", "rook", "queen"];

/**
 * The Standard run: 9 matches across three acts. One square board per act
 * (6×6, 7×7, 8×8); the board only grows after each act-end boss (matches
 * 3, 6, 9). The piece curve grows monotonically.
 */
export const STANDARD_MATCHES: ReadonlyArray<StandardMatchConfig> = [
  M(1, 6, 6, random(MINORS_AND_ROOK, 9), false, 12),
  M(2, 6, 6, random(MINORS_AND_ROOK, 13), false, 15),
  M(3, 6, 6, explicit(["king", "knight", "bishop", "rook"]), true, 16),
  M(4, 7, 7, random(MINORS_AND_ROOK, 13), false, 20),
  M(5, 7, 7, random(MINORS_AND_ROOK, 18), false, 24),
  M(6, 7, 7, explicit(["king", "knight", "knight", "bishop", "bishop", "rook", "rook"]), true, 28),
  M(7, 8, 8, random(MINORS_ROOK_QUEEN, 21), false, 36),
  M(8, 8, 8, random(MINORS_ROOK_QUEEN, 24), false, 44),
  M(
    9,
    8,
    8,
    explicit(["king", "knight", "knight", "bishop", "bishop", "rook", "rook", "queen"]),
    true,
    50,
  ),
];

/** Look up the per-match config for Standard mode. */
export function standardMatchConfig(matchNumber: number): StandardMatchConfig {
  const cfg = STANDARD_MATCHES[matchNumber - 1];
  if (!cfg) throw new Error(`no Standard config for match ${matchNumber}`);
  return cfg;
}

/**
 * Roll a Chess960-legal back rank from a budget + allowed pool. King is
 * always at index 0. Non-pawn pieces are drawn until no allowed type both
 * fits within the remaining budget and is below its per-type cap.
 *
 * Caps + budgets are tuned so the result always fits within the back rank,
 * but a defensive slot guard (`back.length < files`) is included anyway.
 */
export function rollPieceSet(
  spec: Extract<PieceSpec, { kind: "random" }>,
  pawns: number,
  files: number,
  rng: Rng,
): PieceSet {
  const back: PieceType[] = ["king"];
  const counts = new Map<PieceType, number>([["king", 1]]);
  let budget = spec.nonPawnPointsBudget;
  while (back.length < files) {
    const affordable = spec.allowedPieces.filter((p) => {
      const v = PIECE_VALUE[p];
      const c = counts.get(p) ?? 0;
      return v > 0 && v <= budget && c < PIECE_CAP[p];
    });
    if (affordable.length === 0) break;
    const pick = affordable[Math.floor(rng() * affordable.length)];
    back.push(pick);
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
    budget -= PIECE_VALUE[pick];
  }
  return { backRank: back, pawns };
}

/** Resolve a match config to a concrete `PieceSet`, rolling if random. */
export function resolvePieceSet(cfg: StandardMatchConfig, rng: Rng): PieceSet {
  if (cfg.pieceSpec.kind === "explicit") {
    return { backRank: [...cfg.pieceSpec.backRank], pawns: cfg.pawns };
  }
  return rollPieceSet(cfg.pieceSpec, cfg.pawns, cfg.size.files, rng);
}
