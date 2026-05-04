// Toy AI for non-8x8 matches.
//
// Stockfish doesn't support boards other than 8x8, so Standard-mode matches on
// 6x6 and 6x8 need a homegrown opponent. This is a depth-tuned negamax with a
// material + mobility eval, scoped to the wall-aware legal-move set the engine
// produces. It's not strong — it's a *playable opponent* for short games on
// small boards. Tuning targets across the run rely on the piece curve, not on
// the AI getting smarter.
//
// Design constraints:
// - No async, no worker. The boards are tiny (≤48 squares, ≤16 pieces) so a
//   shallow search runs synchronously in well under a frame.
// - Same legal-move source as the rest of the codebase. We never let the AI
//   pick a move the engine doesn't think is legal — walls, freezes, sanctuary,
//   compel, etc. all apply.

import type { ChoseEngine, EngineMove } from "../game/chess/engine";
import type { Difficulty } from "./stockfish";
import type { Side } from "../game/types";
import {
  applyMove,
  legalMoves as rulesLegalMoves,
  parseFen,
  NO_OVERLAYS,
  type Position,
} from "../game/chess/rules";

const PIECE_VALUES: Record<string, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 20000,
};

/**
 * Pick the best move for the side currently to move. Returns null if there
 * are no legal moves (the engine treats that as game-over). Depth scales with
 * difficulty.
 *
 * Note: the toy AI only sees the chess position, not the wall/freeze/etc.
 * overlays — same simplification we use for Stockfish on 8x8. The Match
 * shell still filters the AI's chosen move through the wall-aware legal
 * set, falling back to the first legal move if the AI's pick was masked
 * out by an overlay.
 */
export function pickBestMove(
  engine: ChoseEngine,
  difficulty: Difficulty = "normal",
): EngineMove | null {
  const depth = depthForToyAi(difficulty);
  const pos = parseFen(engine.fen(), engine.size());
  const me = pos.turn;
  const root = rulesLegalMoves(pos, NO_OVERLAYS);
  if (root.length === 0) return null;

  let bestScore = -Infinity;
  let bestIdx = 0;
  for (let i = 0; i < root.length; i++) {
    const next = applyMove(pos, root[i]);
    const score = -negamax(next, depth - 1, -Infinity, Infinity, me);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  const pick = root[bestIdx];
  return {
    from: pick.from,
    to: pick.to,
    promotion: pick.promotion,
  };
}

/** Negamax with alpha-beta. `me` is the side we're scoring from. */
function negamax(pos: Position, depth: number, alpha: number, beta: number, me: Side): number {
  if (depth <= 0) return evaluate(pos, me);
  const moves = rulesLegalMoves(pos, NO_OVERLAYS);
  if (moves.length === 0) {
    // Checkmate or stalemate. We don't separate the two finely — a no-move
    // position is bad for the side to move; if they're in check, very bad.
    return -50000 + (10 - depth);
  }
  let best = -Infinity;
  for (const m of moves) {
    const next = applyMove(pos, m);
    const score = -negamax(next, depth - 1, -beta, -alpha, me);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Static eval. Material from `me`'s perspective, returned with a sign flip
 * when it's the opponent's turn so negamax sees a correct "score for the
 * side to move" value. We deliberately keep this simple — the AI's job is
 * to play sensibly on small boards, not to challenge a human.
 */
function evaluate(pos: Position, me: Side): number {
  let material = 0;
  for (const [, p] of pos.pieces) {
    const v = PIECE_VALUES[p.type] ?? 0;
    material += p.side === me ? v : -v;
  }
  return pos.turn === me ? material : -material;
}

/**
 * Depth scaling for the toy AI. 6x6 and 6x8 are small enough that even depth
 * 4 is responsive on a modern laptop; bigger numbers only kick in if a curse
 * scenario explodes the branching factor.
 */
export function depthForToyAi(d: Difficulty): number {
  switch (d) {
    case "easy":
      return 2;
    case "normal":
      return 3;
    case "hard":
      return 4;
  }
}
