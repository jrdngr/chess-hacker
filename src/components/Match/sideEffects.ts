// Pure side-effect appliers + outcome formatters for the Match shell.
//
// These are the bits of Match.tsx that mutate the chess engine + return new
// MatchCardState in response to (a) a chess move resolving a trap, (b) a card
// resolver returning a list of board-mutation side effects. They live here as
// plain functions so Match's component body stays mostly composition + render,
// and so unit tests can call them directly with a fresh engine.
//
// Pure TS — no React, no DOM.

import type { ChoseEngine } from "../../game/chess/engine";
import { movePath } from "../../game/chess/engine";
import {
  addToHand,
  clearStatusesOn,
  relocateStatuses,
  shuffleIntoDraw,
  type Rng,
} from "../../game/cards/match";
import type {
  AlgebraicSquare,
  Card,
  MatchCardState,
  MatchOutcome,
  Piece,
  PieceType,
} from "../../game/types";

/**
 * Resolve any trap the moved piece walked into or crossed. Returns the new
 * card state. Mutates the engine in place if the trap displaces or captures
 * the piece.
 *
 * The first trap found along the move path (origin → destination, exclusive
 * of origin) fires; subsequent traps on the same path are not consulted —
 * the piece never made it that far.
 */
export function resolveTrapForMove(
  engine: ChoseEngine,
  cardState: MatchCardState,
  mover: Piece,
  from: AlgebraicSquare,
  to: AlgebraicSquare,
): MatchCardState {
  const path = movePath(mover.type, from, to);
  for (let i = 0; i < path.length; i++) {
    const sq = path[i];
    const trap = cardState.traps.find((t) => t.square === sq);
    if (!trap) continue;

    let next: MatchCardState = {
      ...cardState,
      traps: cardState.traps.filter((t) => t.square !== sq),
    };
    if (trap.effect === "capture") {
      // The piece is captured at the trap square. Engine may have it on `to`
      // (if the trap is at `to`) or at `to` after a pass-through; in either
      // case removing from `to` is correct because the moved piece's final
      // engine position is `to` regardless of where on the path the trap sat.
      engine.removePiece(to);
      next = clearStatusesOn(next, to);
    } else if (trap.effect === "freeze") {
      // If the trap was on an intermediate square, drag the piece back to it
      // so it stops at the trigger point. (For a trap on `to` itself, no
      // displacement is needed.)
      if (sq !== to) {
        engine.displacePiece(to, sq);
        next = relocateStatuses(next, to, sq);
      }
      next = {
        ...next,
        freezes: [
          ...next.freezes.filter((f) => f.square !== sq),
          { square: sq, side: mover.side, expiresOnTurn: next.turn + 1 },
        ],
      };
    } else if (trap.effect === "push") {
      // Push back one square along the path. For a trap at index 0 (the only
      // step away from origin) the push lands on `from`; for an intermediate
      // trap it lands on the previous path square. If that square is occupied
      // (e.g. the move originated there but it's now occupied by the same
      // piece returning, which shouldn't happen — or some other piece was
      // displaced into it) the push fizzles and the trap re-arms.
      const pushBack = i === 0 ? from : path[i - 1];
      if (engine.pieceAt(pushBack)) {
        next = { ...next, traps: [...next.traps, trap] };
      } else if (pushBack !== to) {
        engine.displacePiece(to, pushBack);
        next = relocateStatuses(next, to, pushBack);
      }
    }
    return next;
  }
  return cardState;
}

/**
 * The side-effect kinds the card resolver can return. Mirrors the union in
 * `game/cards/match.ts` but locally typed so this module doesn't depend on
 * the resolver's internals.
 */
type CardSideEffect =
  | { kind: "place-piece"; square: AlgebraicSquare; pieceType: PieceType }
  | { kind: "remove-piece"; square: AlgebraicSquare }
  | { kind: "swap-pieces"; a: AlgebraicSquare; b: AlgebraicSquare }
  | { kind: "foreign-move"; from: AlgebraicSquare; to: AlgebraicSquare }
  | { kind: "add-card-to-hand"; card: Card }
  | { kind: "add-card-to-draw"; card: Card }
  | { kind: "revive-prompt" };

/**
 * Apply the side effects produced by the card resolver. Mutates the engine
 * in place. Returns the (possibly further-mutated) match state. Triggering
 * the revive flow is signalled to the caller via `onRevivePrompt` rather
 * than baked in, so the Match shell controls the modal lifecycle.
 */
export function applyCardSideEffects(
  engine: ChoseEngine,
  state: MatchCardState,
  sideEffects: ReadonlyArray<unknown>,
  rng: Rng | undefined,
  onRevivePrompt: () => void,
): MatchCardState {
  let next = state;
  for (const raw of sideEffects) {
    const fx = raw as CardSideEffect;
    if (fx.kind === "place-piece") {
      engine.placePiece(fx.square, { type: fx.pieceType, side: "player" });
    } else if (fx.kind === "remove-piece") {
      engine.removePiece(fx.square);
      next = clearStatusesOn(next, fx.square);
    } else if (fx.kind === "swap-pieces") {
      next = relocateStatuses(next, fx.a, "__swap_tmp__");
      next = relocateStatuses(next, fx.b, fx.a);
      next = relocateStatuses(next, "__swap_tmp__", fx.b);
      engine.swapPieces(fx.a, fx.b);
    } else if (fx.kind === "foreign-move") {
      const mover = engine.pieceAt(fx.from);
      engine.applyForeignMove({ from: fx.from, to: fx.to });
      next = relocateStatuses(next, fx.from, fx.to);
      if (mover) next = resolveTrapForMove(engine, next, mover, fx.from, fx.to);
    } else if (fx.kind === "add-card-to-hand") {
      next = addToHand(next, fx.card);
    } else if (fx.kind === "add-card-to-draw") {
      next = shuffleIntoDraw(next, fx.card, rng);
    } else if (fx.kind === "revive-prompt") {
      onRevivePrompt();
    }
  }
  return next;
}

// ---- Outcome formatters ----------------------------------------------------

export function outcomeHeadline(o: MatchOutcome): string {
  switch (o.kind) {
    case "checkmate":
      return o.winner === "player" ? "White wins" : "Black wins";
    case "stalemate":
      return "Stalemate";
    case "draw":
      return "Draw";
    case "ongoing":
      return "";
  }
}

export function outcomeDetail(o: MatchOutcome): string {
  switch (o.kind) {
    case "checkmate":
      return "by checkmate";
    case "stalemate":
      return "no legal moves";
    case "draw":
      switch (o.reason) {
        case "insufficient-material":
          return "insufficient material";
        case "threefold-repetition":
          return "threefold repetition";
        case "fifty-move":
          return "fifty-move rule";
        case "other":
          return "drawn position";
      }
      break;
    case "ongoing":
      return "";
  }
}
