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
 *
 * `capturedAtTo`: the piece that sat on `to` BEFORE the chess move applied,
 * or null. When a trap fires on an intermediate square, the moving piece
 * never reached `to`, so any capture there must be undone — the captured
 * piece is restored on `to`. (Engine history still records the capture; same
 * trade-off Rollback accepts. capturedPieces() will count it as captured
 * even though it's back on the board.)
 */
export function resolveTrapForMove(
  engine: ChoseEngine,
  cardState: MatchCardState,
  mover: Piece,
  from: AlgebraicSquare,
  to: AlgebraicSquare,
  capturedAtTo: Piece | null = null,
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
    const intermediate = sq !== to;
    if (trap.effect === "capture") {
      // The piece is captured at the trap square. Engine may have it on `to`
      // (if the trap is at `to`) or at `to` after a pass-through; in either
      // case removing from `to` is correct because the moved piece's final
      // engine position is `to` regardless of where on the path the trap sat.
      engine.removePiece(to);
      next = clearStatusesOn(next, to);
      // Intermediate trap: piece never reached `to`. Put back whatever it
      // would have captured.
      if (intermediate && capturedAtTo) {
        engine.placePiece(to, capturedAtTo);
      }
    } else if (trap.effect === "freeze") {
      // If the trap was on an intermediate square, drag the piece back to it
      // so it stops at the trigger point. (For a trap on `to` itself, no
      // displacement is needed.)
      if (intermediate) {
        engine.displacePiece(to, sq);
        next = relocateStatuses(next, to, sq);
        if (capturedAtTo) {
          engine.placePiece(to, capturedAtTo);
        }
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
        if (intermediate && capturedAtTo) {
          engine.placePiece(to, capturedAtTo);
        }
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
  | { kind: "revive-prompt" }
  | { kind: "remove-random-own-minor" }
  | { kind: "undo-last-enemy-move" }
  | { kind: "garbage-collect"; recursive: boolean }
  | { kind: "convert-piece"; square: AlgebraicSquare }
  | { kind: "transform-piece"; square: AlgebraicSquare; newType: PieceType }
  | { kind: "transform-choice-prompt"; square: AlgebraicSquare; options: PieceType[] };

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
  onTransformPrompt?: (square: AlgebraicSquare, options: PieceType[]) => void,
): MatchCardState {
  let next = state;
  for (const raw of sideEffects) {
    const fx = raw as CardSideEffect;
    if (fx.kind === "place-piece") {
      engine.placePiece(fx.square, { type: fx.pieceType, side: "player" });
    } else if (fx.kind === "remove-piece") {
      const removed = engine.pieceAt(fx.square);
      if (removed?.side === "player") {
        next = {
          ...next,
          capturedPieces: [
            ...(next.capturedPieces ?? []),
            { type: removed.type, side: "player" as const, reason: "destroyed" as const },
          ],
        };
      } else if (removed?.side === "opponent") {
        next = { ...next, playerCaptureCount: (next.playerCaptureCount ?? 0) + 1 };
      }
      engine.removePiece(fx.square);
      next = clearStatusesOn(next, fx.square);
    } else if (fx.kind === "swap-pieces") {
      next = relocateStatuses(next, fx.a, "__swap_tmp__");
      next = relocateStatuses(next, fx.b, fx.a);
      next = relocateStatuses(next, "__swap_tmp__", fx.b);
      engine.swapPieces(fx.a, fx.b);
    } else if (fx.kind === "foreign-move") {
      const mover = engine.pieceAt(fx.from);
      const captured = engine.pieceAt(fx.to);
      engine.applyForeignMove({ from: fx.from, to: fx.to });
      next = relocateStatuses(next, fx.from, fx.to);
      if (mover) next = resolveTrapForMove(engine, next, mover, fx.from, fx.to, captured);
    } else if (fx.kind === "add-card-to-hand") {
      next = addToHand(next, fx.card);
    } else if (fx.kind === "add-card-to-draw") {
      next = shuffleIntoDraw(next, fx.card, rng);
    } else if (fx.kind === "revive-prompt") {
      onRevivePrompt();
    } else if (fx.kind === "undo-last-enemy-move") {
      // Rollback. Walk the opponent's most recent move backward as a board
      // edit — the engine's history is left untouched, and the side-to-move
      // is unchanged, so the player keeps their action. Two visible effects:
      //   1. The moved enemy piece returns to its origin square.
      //   2. If the move captured a player piece, that piece is restored to
      //      its own square (the `to` square for ordinary captures; the
      //      `epVictim` square for en-passant captures).
      // Castling is reversed by walking the rook back as well; promotion is
      // reversed by re-spawning a pawn on the origin square (the queen on
      // `to` is removed). Per-piece statuses follow the moved piece.
      //
      // Importantly, this does NOT pop engine history. The opponent's "ghost"
      // move stays in the move log so the player sees what would have
      // happened, and the dev-panel Undo (which restores from snapshots) is
      // not knocked off — every snapshot's engine history is internally
      // consistent because we never reach into the history array here.
      const last = engine.lastMoveDetails();
      if (last && last.by === "opponent") {
        const movedPiece = engine.pieceAt(last.to);
        engine.removePiece(last.to);
        if (movedPiece) {
          // Promotion reversal: the piece on `to` is the promoted form; put
          // a pawn back on `from` rather than (e.g.) a queen.
          const restoredType: PieceType = last.promotion ? "pawn" : movedPiece.type;
          engine.placePiece(last.from, { type: restoredType, side: movedPiece.side });
        }
        // Castling: also walk the rook back to its corner. Only the
        // opponent's branches are reachable here because we gated on
        // `last.by === "opponent"` above; the rank-1 cases stay as a
        // documentation reference for symmetry.
        if (last.castle === "K") {
          const rook = engine.pieceAt("f8");
          if (rook) {
            engine.removePiece("f8");
            engine.placePiece("h8", rook);
          }
        } else if (last.castle === "Q") {
          const rook = engine.pieceAt("d8");
          if (rook) {
            engine.removePiece("d8");
            engine.placePiece("a8", rook);
          }
        }
        // Restore the captured piece (if any) on its own square.
        if (last.captured && last.captured.side === "player") {
          const capturedSquare = last.epVictim ?? last.to;
          if (!engine.pieceAt(capturedSquare)) {
            engine.placePiece(capturedSquare, last.captured);
          }
        }
        next = relocateStatuses(next, last.to, last.from);
      }
    } else if (fx.kind === "garbage-collect") {
      // Sweep: destroy every enemy non-King piece currently attacked by a
      // player piece. With `recursive`, repeat until a wave destroys nothing —
      // catches discovered attacks revealed when blockers fall. The enemy
      // king is never destroyed, even when newly attacked.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const attacked = engine.attackedSquares("player");
        const victims: AlgebraicSquare[] = [];
        for (const { square, piece } of engine.pieces()) {
          if (piece.side !== "opponent") continue;
          if (piece.type === "king") continue;
          if (!attacked.has(square)) continue;
          victims.push(square);
        }
        if (victims.length === 0) break;
        next = {
          ...next,
          playerCaptureCount: (next.playerCaptureCount ?? 0) + victims.length,
        };
        for (const sq of victims) {
          engine.removePiece(sq);
          next = clearStatusesOn(next, sq);
        }
        if (!fx.recursive) break;
      }
    } else if (fx.kind === "convert-piece") {
      const piece = engine.pieceAt(fx.square);
      if (piece && piece.side === "opponent") {
        engine.removePiece(fx.square);
        engine.placePiece(fx.square, { type: piece.type, side: "player" });
      }
    } else if (fx.kind === "transform-piece") {
      const piece = engine.pieceAt(fx.square);
      if (piece && piece.side === "player") {
        engine.removePiece(fx.square);
        engine.placePiece(fx.square, { type: fx.newType, side: "player" });
      }
    } else if (fx.kind === "transform-choice-prompt") {
      onTransformPrompt?.(fx.square, fx.options);
    } else if (fx.kind === "remove-random-own-minor") {
      // Bit Rot (Boss C). Pick uniformly at random from the player's
      // knights and bishops. No-op if the player has none — the curse still
      // resolves but does nothing, which matches "destroy a minor piece if
      // you have one".
      const minors: AlgebraicSquare[] = [];
      for (const { square, piece } of engine.pieces()) {
        if (piece.side !== "player") continue;
        if (piece.type !== "knight" && piece.type !== "bishop") continue;
        minors.push(square);
      }
      if (minors.length > 0) {
        const r = rng ?? Math.random;
        const pick = minors[Math.floor(r() * minors.length)];
        engine.removePiece(pick);
        next = clearStatusesOn(next, pick);
      }
    }
  }
  return next;
}

// ---- Outcome formatters ----------------------------------------------------

export function outcomeHeadline(o: MatchOutcome): string {
  switch (o.kind) {
    case "checkmate":
    case "king-captured":
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
    case "king-captured":
      return "by king capture";
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
