// Standard-mode per-match config: board size + piece set per match.
//
// Standard is the default mode. Both sides start each match with a small
// piece set on a small board and grow on a fixed curve to a full 16-piece
// army on 8x8 across the 9-match run. There's no piece drafting in Standard;
// the curve is symmetric and deterministic.
//
// Tuning knobs live here. The numbers below are first-pass picks; playtest
// will move them.

import type { BoardSize, PieceSet } from "../types";

export type StandardMatchConfig = {
  /** 1-indexed match number across the run (1..9). */
  matchNumber: number;
  size: BoardSize;
  pieceSet: PieceSet;
  /** Whether this match is the act-end boss. */
  isBoss: boolean;
  /** Approximate target move-count for an average player. */
  moveTarget: number;
};

const M = (
  matchNumber: number,
  files: number,
  ranks: number,
  backRank: PieceSet["backRank"],
  pawns: number,
  isBoss: boolean,
  moveTarget: number,
): StandardMatchConfig => ({
  matchNumber,
  size: { files, ranks },
  pieceSet: { backRank, pawns },
  isBoss,
  moveTarget,
});

/**
 * The Standard run: 9 matches, three boards (6x6 → 6x8 → 8x8), three boss
 * matches (3, 6, 9). The piece curve grows monotonically.
 */
export const STANDARD_MATCHES: ReadonlyArray<StandardMatchConfig> = [
  M(1, 6, 6, ["king"], 4, false, 10),
  M(2, 6, 6, ["king", "knight", "bishop"], 4, false, 12),
  M(3, 6, 6, ["king", "knight", "bishop", "rook"], 4, true, 15),
  M(4, 6, 8, ["king", "knight", "bishop", "rook"], 5, false, 18),
  M(5, 6, 8, ["king", "knight", "knight", "bishop", "rook"], 6, false, 22),
  M(6, 6, 8, ["king", "knight", "knight", "bishop", "bishop", "rook", "rook"], 6, true, 28),
  M(
    7,
    8,
    8,
    ["king", "knight", "knight", "bishop", "bishop", "rook", "rook"],
    7,
    false,
    35,
  ),
  M(
    8,
    8,
    8,
    ["king", "knight", "knight", "bishop", "bishop", "rook", "rook"],
    8,
    false,
    42,
  ),
  M(
    9,
    8,
    8,
    ["king", "knight", "knight", "bishop", "bishop", "rook", "rook", "queen"],
    8,
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
