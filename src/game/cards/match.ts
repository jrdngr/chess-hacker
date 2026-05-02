// Pure helpers for the match-scoped card / overlay state.
//
// These functions are framework-free. They take a `MatchCardState` (and
// sometimes a context object describing the chess board) and return a new
// `MatchCardState`. No mutation. The React layer wires them up.

import type { AlgebraicSquare, Card, MatchCardState, Piece } from "../types";

/** Per `docs/design/cards.md`. */
export const HAND_SIZE = 5;
export const DEFAULT_ENERGY = 3;

export type Rng = () => number;

/**
 * Mulberry32 — small, deterministic PRNG. Used for tests and the per-run
 * seeded RNG (see `docs/technical/architecture.md`). Default callers should
 * use `Math.random` directly.
 */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: ReadonlyArray<T>, rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Initial match state: deck shuffled into the draw pile, hand empty,
 * energy 0, turn 0. Caller should immediately follow with `startPlayerTurn`
 * to deal the opening hand and set energy / turn = 1.
 */
export function createMatchCardState(
  deck: ReadonlyArray<Card>,
  rng: Rng = Math.random,
): MatchCardState {
  return {
    hand: [],
    drawPile: shuffle(deck, rng),
    discardPile: [],
    consumedPile: [],
    energy: 0,
    energyMax: DEFAULT_ENERGY,
    turn: 0,
    walls: [],
    freezes: [],
  };
}

/**
 * Draw `n` cards from the draw pile. If the draw pile empties mid-draw, the
 * discard is reshuffled into a new draw pile (silently — no penalty, per
 * `docs/design/cards.md`). If both piles are empty we draw fewer than `n`.
 *
 * Note: cards drawn this way may push the hand above HAND_SIZE — the size
 * cap only applies to the start-of-turn auto-refill (see `refillHand`).
 */
export function drawCards(
  state: MatchCardState,
  n: number,
  rng: Rng = Math.random,
): MatchCardState {
  const hand = state.hand.slice();
  let drawPile = state.drawPile.slice();
  let discardPile = state.discardPile.slice();
  for (let i = 0; i < n; i++) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      drawPile = shuffle(discardPile, rng);
      discardPile = [];
    }
    hand.push(drawPile.shift()!);
  }
  return { ...state, hand, drawPile, discardPile };
}

/** Draw until the hand is at HAND_SIZE; never trims. */
export function refillHand(state: MatchCardState, rng: Rng = Math.random): MatchCardState {
  const need = HAND_SIZE - state.hand.length;
  if (need <= 0) return state;
  return drawCards(state, need, rng);
}

/**
 * Begin a new player turn.
 *  - Increment turn counter.
 *  - Expire walls / freezes whose `expiresOnTurn <= turn`.
 *  - Refill hand to HAND_SIZE.
 *  - Reset energy to `energyMax`.
 */
export function startPlayerTurn(state: MatchCardState, rng: Rng = Math.random): MatchCardState {
  const turn = state.turn + 1;
  const walls = state.walls.filter((w) => w.expiresOnTurn > turn);
  const freezes = state.freezes.filter((f) => f.expiresOnTurn > turn);
  const next: MatchCardState = {
    ...state,
    turn,
    energy: state.energyMax,
    walls,
    freezes,
  };
  return refillHand(next, rng);
}

// ---- Card play --------------------------------------------------------------

/**
 * Where the player has aimed the card. The kind matches what the card asked
 * for (see `Card.target`); the resolver double-checks against the board.
 */
export type PlayTarget = { kind: "none" } | { kind: "square"; square: AlgebraicSquare };

/**
 * Read-only view of the chess board passed into `playCard` so it can
 * validate targets without coupling to the engine class.
 */
export type BoardContext = {
  pieceAt: (sq: AlgebraicSquare) => Piece | null;
  hasWall: (sq: AlgebraicSquare) => boolean;
};

export type PlayCardResult =
  | { ok: true; state: MatchCardState }
  | { ok: false; reason: PlayCardFailure };

export type PlayCardFailure =
  | "no-such-card"
  | "not-enough-energy"
  | "missing-target"
  | "target-not-empty"
  | "target-not-enemy-piece";

/**
 * Resolve a card play. Returns the new match state or a failure reason.
 *
 * Pure: does not mutate `state`. The caller is responsible for re-rendering.
 */
export function playCard(
  state: MatchCardState,
  cardIndex: number,
  target: PlayTarget,
  ctx: BoardContext,
  rng: Rng = Math.random,
): PlayCardResult {
  const card = state.hand[cardIndex];
  if (!card) return { ok: false, reason: "no-such-card" };
  if (state.energy < card.cost) return { ok: false, reason: "not-enough-energy" };

  switch (card.target.kind) {
    case "none":
      // No target required — accept any (we ignore an accidentally-supplied target).
      break;
    case "empty-square": {
      if (target.kind !== "square") return { ok: false, reason: "missing-target" };
      const occupied = ctx.pieceAt(target.square) !== null || ctx.hasWall(target.square);
      if (occupied) return { ok: false, reason: "target-not-empty" };
      break;
    }
    case "enemy-piece": {
      if (target.kind !== "square") return { ok: false, reason: "missing-target" };
      const p = ctx.pieceAt(target.square);
      if (!p || p.side !== "opponent") {
        return { ok: false, reason: "target-not-enemy-piece" };
      }
      break;
    }
  }

  let next: MatchCardState = { ...state, energy: state.energy - card.cost };

  switch (card.effect.kind) {
    case "gain-energy":
      next = { ...next, energy: next.energy + card.effect.amount };
      break;
    case "draw":
      next = drawCards(next, card.effect.count, rng);
      break;
    case "freeze-piece": {
      // Validated above: target.kind === "square" and pieceAt is opponent.
      const square = (target as Extract<PlayTarget, { kind: "square" }>).square;
      next = {
        ...next,
        freezes: [
          ...next.freezes.filter((f) => f.square !== square),
          { square, side: "opponent", expiresOnTurn: state.turn + 1 },
        ],
      };
      break;
    }
    case "place-wall": {
      const square = (target as Extract<PlayTarget, { kind: "square" }>).square;
      next = {
        ...next,
        walls: [
          ...next.walls.filter((w) => w.square !== square),
          { square, expiresOnTurn: state.turn + card.effect.durationTurns },
        ],
      };
      break;
    }
  }

  // Move the card to its destination pile. We rebuild hand without the played card.
  const hand = next.hand.slice();
  hand.splice(cardIndex, 1);
  if (card.consume) {
    next = { ...next, hand, consumedPile: [...next.consumedPile, card] };
  } else {
    next = { ...next, hand, discardPile: [...next.discardPile, card] };
  }
  return { ok: true, state: next };
}

// ---- Convenience predicates -------------------------------------------------

export function hasWallOn(state: MatchCardState, sq: AlgebraicSquare): boolean {
  return state.walls.some((w) => w.square === sq);
}

export function isFrozen(state: MatchCardState, sq: AlgebraicSquare): boolean {
  return state.freezes.some((f) => f.square === sq);
}
