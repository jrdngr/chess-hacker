// Pure helpers for the match-scoped card / overlay state.
//
// These functions are framework-free. They take a `MatchCardState` (and
// sometimes a context object describing the chess board) and return a new
// `MatchCardState` plus a list of board-side effects (place piece, remove
// piece, swap, etc.) for the React layer to apply against the chess engine.
// No mutation. The React layer wires them up.

import type {
  AlgebraicSquare,
  Artifact,
  Card,
  CardEffect,
  CardId,
  EmpowerStatus,
  LightningStatus,
  MatchCardState,
  Piece,
  PieceStatus,
  PieceType,
  Side,
  ZoneBuff,
} from "../types";
import {
  effectiveCardCost,
  effectiveEnergyPerTurn,
  effectiveHandSize,
  effectiveStartingEnergy,
} from "../artifacts/effects";
import {
  activeZoneBuffs,
  zoneBuffEnergyPerTurn,
  zoneBuffHandSize,
  type ZoneBoardContext,
} from "../overlays/zoneBuffs";
import { getCardById, getCardsByRarity, getShivPool } from "./library";

/** Per `docs/design/cards.md`. */
export const HAND_SIZE = 5;
/** Energy gained on the very first player turn. */
export const STARTING_ENERGY = 1;
/** Energy added at the start of every subsequent player turn. */
export const ENERGY_PER_TURN = 1;
/** Hard cap on banked energy. */
export const ENERGY_MAX = 10;

export function clampEnergy(n: number): number {
  if (n < 0) return 0;
  if (n > ENERGY_MAX) return ENERGY_MAX;
  return n;
}

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
 * to deal the opening hand and set turn = 1, energy = STARTING_ENERGY.
 *
 * Artifacts default to none — callers in a real run should pass the run's
 * artifact list so per-match modifiers (hand size, energy, discounts,
 * trigger hooks) take effect.
 */
export function createMatchCardState(
  deck: ReadonlyArray<Card>,
  rng: Rng = Math.random,
  artifacts: ReadonlyArray<Artifact> = [],
): MatchCardState {
  return {
    hand: [],
    drawPile: shuffle(deck, rng),
    consumedPile: [],
    acquisitionLog: deck.slice(),
    energy: 0,
    turn: 0,
    walls: [],
    freezes: [],
    roots: [],
    disarms: [],
    compels: [],
    shields: [],
    hastes: [],
    lightnings: [],
    empowers: [],
    sanctuaries: [],
    traps: [],
    zoneBuffs: zoneBuffsFromArtifacts(artifacts),
    artifacts,
  };
}

/**
 * Materialise artifact-granted zone-buffs into a starting list. Artifact
 * buffs have no expiry and stay active for the whole match. Card-placed
 * buffs are appended later via `applyEffect`.
 */
function zoneBuffsFromArtifacts(artifacts: ReadonlyArray<Artifact>): ZoneBuff[] {
  const out: ZoneBuff[] = [];
  for (const a of artifacts) {
    for (const fx of a.effects) {
      if (fx.kind !== "zone-buff") continue;
      out.push({
        region: fx.region,
        effect: fx.buff,
        side: "player",
        sourceLabel: fx.sourceLabel,
      });
    }
  }
  return out;
}

/**
 * Draw `n` cards from the draw pile. When the draw pile empties, draws
 * fizzle — there is no reshuffle (consume-all rule, see
 * `docs/design/cards.md`). The match continues card-free once the deck
 * runs out.
 *
 * Note: cards drawn this way may push the hand above HAND_SIZE — the size
 * cap only applies to the start-of-turn auto-refill (see `refillHand`).
 */
export function drawCards(
  state: MatchCardState,
  n: number,
  _rng: Rng = Math.random,
): MatchCardState {
  const hand = state.hand.slice();
  const drawPile = state.drawPile.slice();
  for (let i = 0; i < n; i++) {
    if (drawPile.length === 0) break;
    hand.push(drawPile.shift()!);
  }
  return { ...state, hand, drawPile };
}

/**
 * Draw until the hand is at the effective hand size (HAND_SIZE plus any
 * artifact bonuses, plus any active zone-buff `hand-size` bonuses); never
 * trims an oversized hand. `ctx` is optional — without it, zone-buffs are
 * skipped (e.g., legacy tests that don't model the chess board).
 */
export function refillHand(
  state: MatchCardState,
  rng: Rng = Math.random,
  ctx?: ZoneBoardContext,
): MatchCardState {
  const target = effectiveHandSize(state.artifacts ?? []) + zoneBuffsHandSizeFor(state, ctx);
  const need = target - state.hand.length;
  if (need <= 0) return state;
  return drawCards(state, need, rng);
}

function zoneBuffsHandSizeFor(state: MatchCardState, ctx?: ZoneBoardContext): number {
  if (!ctx) return 0;
  const buffs = state.zoneBuffs ?? [];
  if (buffs.length === 0) return 0;
  return zoneBuffHandSize(activeZoneBuffs(buffs, ctx));
}

function zoneBuffsEnergyPerTurnFor(state: MatchCardState, ctx?: ZoneBoardContext): number {
  if (!ctx) return 0;
  const buffs = state.zoneBuffs ?? [];
  if (buffs.length === 0) return 0;
  return zoneBuffEnergyPerTurn(activeZoneBuffs(buffs, ctx));
}

/**
 * Begin a new player turn.
 *  - Increment turn counter.
 *  - Expire walls / freezes / sanctuaries / traps / debuffs / shields /
 *    one-turn buffs (haste/empower/lightning) whose `expiresOnTurn <= turn`.
 *  - Refill hand to HAND_SIZE.
 *  - Bank energy: first turn starts at STARTING_ENERGY; subsequent turns
 *    add ENERGY_PER_TURN, capped at ENERGY_MAX. Unspent energy carries.
 */
export function startPlayerTurn(
  state: MatchCardState,
  rng: Rng = Math.random,
  ctx?: ZoneBoardContext,
): MatchCardState {
  const turn = state.turn + 1;
  const alive = <T extends { expiresOnTurn: number }>(arr: T[]) =>
    arr.filter((x) => x.expiresOnTurn > turn);
  // Zone-buffs without an `expiresOnTurn` (artifact-granted) live forever; the
  // rest tick like every other timed overlay.
  const liveZoneBuffs = (state.zoneBuffs ?? []).filter(
    (b) => b.expiresOnTurn === undefined || b.expiresOnTurn > turn,
  );
  const artifacts = state.artifacts ?? [];
  // Tick happens before evaluation, so a buff that just expired this turn
  // doesn't grant its bonus on its own expiry tick.
  const tickedState: MatchCardState = { ...state, zoneBuffs: liveZoneBuffs };
  const zoneEnergyBonus = zoneBuffsEnergyPerTurnFor(tickedState, ctx);
  const energy =
    turn === 1
      ? clampEnergy(effectiveStartingEnergy(artifacts) + zoneEnergyBonus)
      : clampEnergy(state.energy + effectiveEnergyPerTurn(artifacts) + zoneEnergyBonus);
  const next: MatchCardState = {
    ...tickedState,
    turn,
    energy,
    walls: alive(state.walls),
    freezes: alive(state.freezes),
    roots: alive(state.roots),
    disarms: alive(state.disarms),
    compels: alive(state.compels),
    shields: alive(state.shields),
    hastes: alive(state.hastes),
    lightnings: alive(state.lightnings),
    empowers: alive(state.empowers),
    sanctuaries: alive(state.sanctuaries),
    traps: alive(state.traps),
  };
  return refillHand(next, rng, ctx);
}

// ---- Card play --------------------------------------------------------------

/**
 * Where the player has aimed the card. The kind matches what the card asked
 * for (see `Card.target`); the resolver double-checks against the board.
 *
 * `two-squares` covers both Switch Files (two own pieces) and Marionette
 * (enemy piece + destination); the card's target.kind disambiguates.
 */
export type PlayTarget =
  | { kind: "none" }
  | { kind: "square"; square: AlgebraicSquare }
  | { kind: "two-squares"; first: AlgebraicSquare; second: AlgebraicSquare };

/**
 * Per-card half-board limit for empty-square-own-half. Player half is the
 * lower half of the board: ranks 1..floor(totalRanks/2). Default of 8 keeps
 * legacy callers (tests, prototype matches) seeing the standard 1–4 split.
 */
export function isInPlayerHalf(square: AlgebraicSquare, totalRanks: number = 8): boolean {
  const r = Number(square.slice(1));
  return r >= 1 && r <= Math.floor(totalRanks / 2);
}

/**
 * Read-only view of the chess board passed into `playCard` so it can
 * validate targets without coupling to the engine class.
 */
export type BoardContext = {
  pieceAt: (sq: AlgebraicSquare) => Piece | null;
  hasWall: (sq: AlgebraicSquare) => boolean;
  /** True iff `sq` is currently attacked by a piece on `by`'s side. */
  isAttackedBy: (sq: AlgebraicSquare, by: Side) => boolean;
  /** True iff the piece on `sq` carries a Tangled (root) status. */
  isRooted: (sq: AlgebraicSquare) => boolean;
  /** Number of ranks on the board. Defaults to 8 if unspecified. */
  boardRanks?: number;
};

/**
 * Side-effects the resolver wants applied to the chess engine or to the
 * card state. The engine boundary is owned by the React layer; we describe
 * the change as data so `playCard` stays pure.
 */
export type CardSideEffect =
  | { kind: "place-piece"; square: AlgebraicSquare; pieceType: PieceType }
  | { kind: "remove-piece"; square: AlgebraicSquare }
  | { kind: "swap-pieces"; a: AlgebraicSquare; b: AlgebraicSquare }
  | { kind: "foreign-move"; from: AlgebraicSquare; to: AlgebraicSquare }
  | { kind: "add-card-to-hand"; card: Card }
  | { kind: "add-card-to-draw"; card: Card }
  | { kind: "revive-prompt" };

export type PlayCardResult =
  | { ok: true; state: MatchCardState; sideEffects: CardSideEffect[] }
  | { ok: false; reason: PlayCardFailure };

export type PlayCardFailure =
  | "no-such-card"
  | "not-enough-energy"
  | "missing-target"
  | "target-not-empty"
  | "target-not-enemy-piece"
  | "target-not-enemy-non-king-piece"
  | "target-not-attacked-by-player"
  | "target-not-rooted"
  | "target-not-own-piece"
  | "target-not-own-non-king-piece"
  | "target-not-distinct"
  | "target-not-in-own-half"
  | "target-not-empty-or-walled"
  | "target-soul-same-piece-type";

/**
 * Resolve a card play. Returns the new match state, side effects, or a
 * failure reason. Pure: does not mutate `state`.
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
  const cost = effectiveCardCost(card, state.artifacts ?? []);
  if (state.energy < cost) return { ok: false, reason: "not-enough-energy" };

  const validation = validateTarget(card, target, ctx);
  if (validation) return { ok: false, reason: validation };

  let next: MatchCardState = { ...state, energy: clampEnergy(state.energy - cost) };
  const sideEffects: CardSideEffect[] = [];

  const applied = applyEffect(card.effect, next, target, ctx, rng, card);
  next = applied.state;
  sideEffects.push(...applied.sideEffects);

  // Universal rule: every played card lands in the consumed pile.
  const hand = next.hand.slice();
  hand.splice(cardIndex, 1);
  next = { ...next, hand, consumedPile: [...next.consumedPile, card] };
  return { ok: true, state: next, sideEffects };
}

function validateTarget(card: Card, target: PlayTarget, ctx: BoardContext): PlayCardFailure | null {
  switch (card.target.kind) {
    case "none":
      return null;
    case "empty-square": {
      if (target.kind !== "square") return "missing-target";
      if (ctx.pieceAt(target.square) !== null || ctx.hasWall(target.square))
        return "target-not-empty";
      return null;
    }
    case "empty-square-own-half": {
      if (target.kind !== "square") return "missing-target";
      if (!isInPlayerHalf(target.square, ctx.boardRanks)) return "target-not-in-own-half";
      if (ctx.pieceAt(target.square) !== null || ctx.hasWall(target.square))
        return "target-not-empty";
      return null;
    }
    case "enemy-piece": {
      if (target.kind !== "square") return "missing-target";
      const p = ctx.pieceAt(target.square);
      if (!p || p.side !== "opponent") return "target-not-enemy-piece";
      return null;
    }
    case "enemy-non-king-piece": {
      if (target.kind !== "square") return "missing-target";
      const p = ctx.pieceAt(target.square);
      if (!p || p.side !== "opponent") return "target-not-enemy-piece";
      if (p.type === "king") return "target-not-enemy-non-king-piece";
      if (
        card.effect.kind === "destroy-piece" &&
        card.effect.filter === "attacked-by-player" &&
        !ctx.isAttackedBy(target.square, "player")
      ) {
        return "target-not-attacked-by-player";
      }
      return null;
    }
    case "own-piece": {
      if (target.kind !== "square") return "missing-target";
      const p = ctx.pieceAt(target.square);
      if (!p || p.side !== "player") return "target-not-own-piece";
      if (
        card.effect.kind === "empower-piece" &&
        card.effect.singleUse === true &&
        card.effect.pattern === p.type
      ) {
        return "target-soul-same-piece-type";
      }
      return null;
    }
    case "own-non-king-piece": {
      if (target.kind !== "square") return "missing-target";
      const p = ctx.pieceAt(target.square);
      if (!p || p.side !== "player") return "target-not-own-piece";
      if (p.type === "king") return "target-not-own-non-king-piece";
      return null;
    }
    case "two-own-pieces": {
      if (target.kind !== "two-squares") return "missing-target";
      if (target.first === target.second) return "target-not-distinct";
      const a = ctx.pieceAt(target.first);
      const b = ctx.pieceAt(target.second);
      if (!a || a.side !== "player" || !b || b.side !== "player") return "target-not-own-piece";
      return null;
    }
    case "marionette": {
      // Two squares: an enemy piece and its destination. We trust the React
      // layer to only offer destinations from the engine's legal-move set;
      // we still sanity-check the enemy-piece source here.
      if (target.kind !== "two-squares") return "missing-target";
      if (target.first === target.second) return "target-not-distinct";
      const enemy = ctx.pieceAt(target.first);
      if (!enemy || enemy.side !== "opponent") return "target-not-enemy-piece";
      return null;
    }
    case "rooted-enemy-and-own-piece": {
      // First square: rooted enemy non-king piece. Second: one of player's pieces.
      if (target.kind !== "two-squares") return "missing-target";
      if (target.first === target.second) return "target-not-distinct";
      const enemy = ctx.pieceAt(target.first);
      if (!enemy || enemy.side !== "opponent") return "target-not-enemy-piece";
      if (enemy.type === "king") return "target-not-enemy-non-king-piece";
      if (!ctx.isRooted(target.first)) return "target-not-rooted";
      const own = ctx.pieceAt(target.second);
      if (!own || own.side !== "player") return "target-not-own-piece";
      return null;
    }
  }
}

type EffectResult = { state: MatchCardState; sideEffects: CardSideEffect[] };

function applyEffect(
  effect: CardEffect,
  state: MatchCardState,
  target: PlayTarget,
  ctx: BoardContext,
  rng: Rng,
  source: Card,
): EffectResult {
  switch (effect.kind) {
    case "gain-energy":
      return {
        state: { ...state, energy: clampEnergy(state.energy + effect.amount) },
        sideEffects: [],
      };
    case "draw":
      return { state: drawCards(state, effect.count, rng), sideEffects: [] };
    case "scry":
      // Scry: peek at the top N cards of the deck. The actual reordering UI
      // is owned by the React layer; the resolver can't know the new order
      // here. We surface the deck untouched and let the UI replace the top
      // N via `setDeckTop` in MatchCardState directly. For data purposes
      // the effect is a no-op at this layer; the UI layer handles the prompt.
      return { state, sideEffects: [] };
    case "freeze-piece":
      return {
        state: addStatus(state, "freezes", squareTarget(target), state.turn + 1, "opponent"),
        sideEffects: [],
      };
    case "root-piece":
      return {
        state: addStatus(
          state,
          "roots",
          squareTarget(target),
          state.turn + (effect.durationTurns ?? 1),
          "opponent",
        ),
        sideEffects: [],
      };
    case "disarm-piece":
      return {
        state: addStatus(state, "disarms", squareTarget(target), state.turn + 1, "opponent"),
        sideEffects: [],
      };
    case "compel-piece":
      return {
        state: addStatus(state, "compels", squareTarget(target), state.turn + 1, "opponent"),
        sideEffects: [],
      };
    case "shield-piece":
      return {
        state: addStatus(state, "shields", squareTarget(target), state.turn + 1, "player"),
        sideEffects: [],
      };
    case "haste-piece":
      return {
        state: addStatus(state, "hastes", squareTarget(target), state.turn + 1, "player"),
        sideEffects: [],
      };
    case "empower-piece": {
      const sq = squareTarget(target);
      // Both regular and single-use empowers expire at the start of the next
      // player turn. Single-use additionally drops as soon as the player moves
      // a different piece (handled by `dropOtherSingleUseEmpowers`).
      const status: EmpowerStatus = {
        square: sq,
        side: "player",
        expiresOnTurn: state.turn + 1,
        pattern: effect.pattern,
      };
      if (effect.singleUse) status.singleUse = true;
      // Stack patterns: keep one entry per (square, pattern). If the same
      // pattern is applied twice, prefer the strictest variant — a non-single-
      // use empower wins over a single-use one.
      const existing = state.empowers.find((e) => e.square === sq && e.pattern === effect.pattern);
      if (existing && !existing.singleUse) status.singleUse = false;
      if (status.singleUse === false) delete (status as { singleUse?: boolean }).singleUse;
      return {
        state: {
          ...state,
          empowers: [
            ...state.empowers.filter((e) => !(e.square === sq && e.pattern === effect.pattern)),
            status,
          ],
        },
        sideEffects: [],
      };
    }
    case "lightning-piece": {
      const sq = squareTarget(target);
      const status: LightningStatus = {
        square: sq,
        side: "player",
        expiresOnTurn: state.turn + 1,
        remaining: effect.actions,
      };
      return {
        state: {
          ...state,
          lightnings: [...state.lightnings.filter((l) => l.square !== sq), status],
        },
        sideEffects: [],
      };
    }
    case "place-wall": {
      const sq = squareTarget(target);
      return {
        state: {
          ...state,
          walls: [
            ...state.walls.filter((w) => w.square !== sq),
            { square: sq, expiresOnTurn: state.turn + effect.durationTurns },
          ],
        },
        sideEffects: [],
      };
    }
    case "place-sanctuary": {
      const sq = squareTarget(target);
      return {
        state: {
          ...state,
          sanctuaries: [
            ...state.sanctuaries.filter((s) => s.square !== sq),
            { square: sq, expiresOnTurn: state.turn + effect.durationTurns },
          ],
        },
        sideEffects: [],
      };
    }
    case "place-trap": {
      const sq = squareTarget(target);
      return {
        state: {
          ...state,
          traps: [
            ...state.traps.filter((t) => t.square !== sq),
            {
              square: sq,
              effect: effect.trapEffect,
              expiresOnTurn: state.turn + effect.durationTurns,
            },
          ],
        },
        sideEffects: [],
      };
    }
    case "place-zone-buff": {
      const sq = squareTarget(target);
      const buff: ZoneBuff = {
        region: { kind: effect.pattern, anchor: sq },
        effect: effect.buff,
        side: "player",
        expiresOnTurn: state.turn + effect.durationTurns,
        sourceLabel: effect.sourceLabel,
      };
      // Only one zone-buff per anchor square — placing on the same square
      // overwrites the existing buff (mirrors sanctuary/wall stacking).
      return {
        state: {
          ...state,
          zoneBuffs: [
            ...(state.zoneBuffs ?? []).filter(
              (b) => !(b.region.kind === effect.pattern && anchorOf(b) === sq),
            ),
            buff,
          ],
        },
        sideEffects: [],
      };
    }
    case "swap-own-pieces": {
      if (target.kind !== "two-squares") return { state, sideEffects: [] };
      return {
        state,
        sideEffects: [{ kind: "swap-pieces", a: target.first, b: target.second }],
      };
    }
    case "swap-rooted-with-own": {
      if (target.kind !== "two-squares") return { state, sideEffects: [] };
      return {
        state,
        sideEffects: [{ kind: "swap-pieces", a: target.first, b: target.second }],
      };
    }
    case "summon-piece": {
      const sq = squareTarget(target);
      return {
        state,
        sideEffects: [{ kind: "place-piece", square: sq, pieceType: effect.pieceType }],
      };
    }
    case "sacrifice-piece": {
      const sq = squareTarget(target);
      let next = drawCards(state, effect.drawCount, rng);
      next = { ...next, energy: clampEnergy(next.energy + effect.energyGain) };
      return {
        state: next,
        sideEffects: [{ kind: "remove-piece", square: sq }],
      };
    }
    case "marionette": {
      if (target.kind !== "two-squares") return { state, sideEffects: [] };
      return {
        state,
        sideEffects: [{ kind: "foreign-move", from: target.first, to: target.second }],
      };
    }
    case "destroy-piece": {
      const sq = squareTarget(target);
      return {
        state,
        sideEffects: [{ kind: "remove-piece", square: sq }],
      };
    }
    case "add-card-to-hand": {
      const cards = pickCardsForSource(effect.source, effect.cardId, effect.count ?? 1, rng);
      return {
        state,
        sideEffects: cards.map((card) => ({ kind: "add-card-to-hand", card })),
      };
    }
    case "add-card-to-draw": {
      const card =
        effect.source === "self"
          ? cloneCardDef(source)
          : effect.cardId
            ? cloneCardDef(getCardById(effect.cardId))
            : null;
      if (!card) return { state, sideEffects: [] };
      return { state, sideEffects: [{ kind: "add-card-to-draw", card }] };
    }
    case "revive": {
      if (effect.selection === "random") {
        if (state.consumedPile.length === 0) return { state, sideEffects: [] };
        const idx = Math.floor(rng() * state.consumedPile.length);
        const picked = state.consumedPile[idx];
        const consumedPile = state.consumedPile
          .slice(0, idx)
          .concat(state.consumedPile.slice(idx + 1));
        return {
          state: { ...state, consumedPile },
          sideEffects: [{ kind: "add-card-to-hand", card: picked }],
        };
      }
      // "choose": defer to UI prompt; the UI calls `completeRevive` once the
      // player picks a card from the consumed pile.
      return { state, sideEffects: [{ kind: "revive-prompt" }] };
    }
    case "compound": {
      let next = state;
      const sideEffects: CardSideEffect[] = [];
      for (const child of effect.effects) {
        const r = applyEffect(child, next, target, ctx, rng, source);
        next = r.state;
        sideEffects.push(...r.sideEffects);
      }
      return { state: next, sideEffects };
    }
  }
}

/**
 * Resolve the "source" of an `add-card-to-hand` effect into concrete `Card`s.
 * Returns up to `count` fresh card-definition copies.
 */
function pickCardsForSource(
  src: "random-common" | "card-id" | "shiv-pool",
  cardId: CardId | undefined,
  count: number,
  rng: Rng,
): Card[] {
  if (src === "card-id") {
    if (!cardId) return [];
    return Array.from({ length: count }, () => cloneCardDef(getCardById(cardId)));
  }
  const pool = src === "random-common" ? getCardsByRarity("common") : getShivPool();
  if (pool.length === 0) return [];
  const out: Card[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(cloneCardDef(pool[idx]));
  }
  return out;
}

/**
 * Returns a fresh `Card` value with the same definition. Cards are stored as
 * structurally-equal records, but we shallow-clone so any future per-instance
 * fields (e.g., upgrade markers) don't bleed across copies.
 */
function cloneCardDef(card: Card): Card {
  return { ...card, target: { ...card.target }, effect: cloneEffect(card.effect) };
}

function cloneEffect(effect: CardEffect): CardEffect {
  if (effect.kind === "compound") {
    return { kind: "compound", effects: effect.effects.map(cloneEffect) };
  }
  return { ...effect };
}

function squareTarget(t: PlayTarget): AlgebraicSquare {
  if (t.kind === "square") return t.square;
  if (t.kind === "two-squares") return t.first;
  throw new Error(`expected square target, got ${t.kind}`);
}

function anchorOf(buff: ZoneBuff): AlgebraicSquare | null {
  if (buff.region.kind === "rank") return null;
  return buff.region.anchor;
}

type StatusKey = "freezes" | "roots" | "disarms" | "compels" | "shields" | "hastes";

function addStatus(
  state: MatchCardState,
  key: StatusKey,
  square: AlgebraicSquare,
  expiresOnTurn: number,
  side: "player" | "opponent",
): MatchCardState {
  const status: PieceStatus = { square, side, expiresOnTurn };
  return {
    ...state,
    [key]: [...state[key].filter((s) => s.square !== square), status],
  };
}

// ---- Convenience predicates -------------------------------------------------

export function hasWallOn(state: MatchCardState, sq: AlgebraicSquare): boolean {
  return state.walls.some((w) => w.square === sq);
}

export function isFrozen(state: MatchCardState, sq: AlgebraicSquare): boolean {
  return state.freezes.some((f) => f.square === sq);
}

export function isRooted(state: MatchCardState, sq: AlgebraicSquare): boolean {
  return state.roots.some((r) => r.square === sq);
}

export function isDisarmed(state: MatchCardState, sq: AlgebraicSquare): boolean {
  return state.disarms.some((d) => d.square === sq);
}

export function isCompelled(state: MatchCardState, sq: AlgebraicSquare): boolean {
  return state.compels.some((c) => c.square === sq);
}

export function isShielded(state: MatchCardState, sq: AlgebraicSquare): boolean {
  return state.shields.some((s) => s.square === sq);
}

export function hasSanctuary(state: MatchCardState, sq: AlgebraicSquare): boolean {
  return state.sanctuaries.some((s) => s.square === sq);
}

export function trapAt(state: MatchCardState, sq: AlgebraicSquare) {
  return state.traps.find((t) => t.square === sq) ?? null;
}

export function hasteAt(state: MatchCardState, sq: AlgebraicSquare): PieceStatus | null {
  return state.hastes.find((h) => h.square === sq) ?? null;
}

export function lightningAt(state: MatchCardState, sq: AlgebraicSquare): LightningStatus | null {
  return state.lightnings.find((l) => l.square === sq) ?? null;
}

export function empowerAt(state: MatchCardState, sq: AlgebraicSquare): EmpowerStatus | null {
  return state.empowers.find((e) => e.square === sq) ?? null;
}

/**
 * Move a buff/debuff status that's stored by square when its piece relocates
 * (e.g., after a move or swap). Used by the React layer after a chess move
 * to keep haste/empower/shield/etc. attached to the right piece.
 */
export function relocateStatuses(
  state: MatchCardState,
  from: AlgebraicSquare,
  to: AlgebraicSquare,
): MatchCardState {
  const move = <T extends { square: AlgebraicSquare }>(arr: T[]): T[] =>
    arr.map((x) => (x.square === from ? { ...x, square: to } : x));
  return {
    ...state,
    freezes: move(state.freezes),
    roots: move(state.roots),
    disarms: move(state.disarms),
    compels: move(state.compels),
    shields: move(state.shields),
    hastes: move(state.hastes),
    lightnings: move(state.lightnings),
    empowers: move(state.empowers),
  };
}

/**
 * Drop any per-square statuses sitting on `square` (e.g., after the piece
 * there is captured or removed by Sacrifice).
 */
export function clearStatusesOn(state: MatchCardState, square: AlgebraicSquare): MatchCardState {
  const drop = <T extends { square: AlgebraicSquare }>(arr: T[]): T[] =>
    arr.filter((x) => x.square !== square);
  return {
    ...state,
    freezes: drop(state.freezes),
    roots: drop(state.roots),
    disarms: drop(state.disarms),
    compels: drop(state.compels),
    shields: drop(state.shields),
    hastes: drop(state.hastes),
    lightnings: drop(state.lightnings),
    empowers: drop(state.empowers),
  };
}

/**
 * Replace the top N of the draw pile with a custom-ordered subset.
 * Used by the Foresight (scry) UI when the player commits a new order.
 */
export function setDeckTop(state: MatchCardState, top: Card[]): MatchCardState {
  // The caller supplies exactly the same set of cards that were on top.
  // Anything they didn't include stays where it was.
  const remainder = state.drawPile.slice(top.length);
  return { ...state, drawPile: [...top, ...remainder] };
}

/**
 * Decrement (or remove) a Lightning status after one of its actions is used.
 * Returns the new state.
 */
export function consumeLightningAction(
  state: MatchCardState,
  square: AlgebraicSquare,
): MatchCardState {
  const lightnings = state.lightnings.flatMap((l) => {
    if (l.square !== square) return [l];
    const next = l.remaining - 1;
    if (next <= 1) return []; // 1 remaining means the standard turn-flip move handles it
    return [{ ...l, remaining: next }];
  });
  return { ...state, lightnings };
}

/** Drop a haste status (e.g., after the second move was made). */
export function consumeHaste(state: MatchCardState, square: AlgebraicSquare): MatchCardState {
  return { ...state, hastes: state.hastes.filter((h) => h.square !== square) };
}

/**
 * Drop every single-use empower whose square doesn't match `keepSquare`.
 * Called after a player chess move with the move's `from` square: the moving
 * piece's empowers survive (and are then relocated to `to`); empowers on any
 * other piece are consumed by the act of "moving someone else."
 */
export function dropOtherSingleUseEmpowers(
  state: MatchCardState,
  keepSquare: AlgebraicSquare,
): MatchCardState {
  return {
    ...state,
    empowers: state.empowers.filter((e) => !e.singleUse || e.square === keepSquare),
  };
}

// ---- Card-economy helpers ---------------------------------------------------

/**
 * Splice `card` into the draw pile at a random index. The played card itself
 * still goes to the consumed pile via `playCard` — this is how
 * self-replicating cards keep a copy in rotation.
 */
export function shuffleIntoDraw(
  state: MatchCardState,
  card: Card,
  rng: Rng = Math.random,
): MatchCardState {
  const idx = Math.floor(rng() * (state.drawPile.length + 1));
  const drawPile = state.drawPile.slice();
  drawPile.splice(idx, 0, card);
  return { ...state, drawPile, acquisitionLog: [...state.acquisitionLog, card] };
}

/**
 * Return the cards still in the draw pile, ordered by acquisition rather
 * than by upcoming draw order. Used by the Draw-pile inspector. Handles
 * duplicate references (e.g., a starter deck with three Foresights all
 * pointing to the same Card object) via a multiset walk.
 */
export function drawPileInAcquisitionOrder(state: MatchCardState): Card[] {
  const remaining = new Map<Card, number>();
  for (const c of state.drawPile) remaining.set(c, (remaining.get(c) ?? 0) + 1);
  const out: Card[] = [];
  for (const c of state.acquisitionLog) {
    const n = remaining.get(c) ?? 0;
    if (n > 0) {
      out.push(c);
      remaining.set(c, n - 1);
    }
  }
  return out;
}

/**
 * Append `card` to the hand. No HAND_SIZE enforcement — the cap is only
 * applied at start-of-turn refill; transient overflow is allowed.
 */
export function addToHand(state: MatchCardState, card: Card): MatchCardState {
  return { ...state, hand: [...state.hand, card] };
}

/**
 * Complete a "choose" revive: move the picked card from `consumedPile` to
 * `hand`. Used by the UI after the chooser closes. No-op if the id is no
 * longer in the consumed pile (defensive — UI may have raced).
 */
export function completeRevive(state: MatchCardState, cardIndex: number): MatchCardState {
  if (cardIndex < 0 || cardIndex >= state.consumedPile.length) return state;
  const card = state.consumedPile[cardIndex];
  const consumedPile = state.consumedPile
    .slice(0, cardIndex)
    .concat(state.consumedPile.slice(cardIndex + 1));
  return { ...state, consumedPile, hand: [...state.hand, card] };
}

/**
 * Capture-grants-Soul: when the player captures an enemy non-king piece,
 * splice the matching Soul card into the player's draw pile. No-op for
 * opponent captures, missing pieces, or kings (which can't be captured).
 *
 * The mapping (pawn/knight/bishop/rook/queen → corresponding Soul) is
 * fixed; missing soul cards in the library no-op safely.
 */
export function grantSoulOnCapture(
  state: MatchCardState,
  captured: Piece | null,
  by: Side,
  rng: Rng = Math.random,
): MatchCardState {
  if (by !== "player") return state;
  if (!captured || captured.side !== "opponent") return state;
  const soulId = SOUL_BY_PIECE_TYPE[captured.type];
  if (!soulId) return state;
  let soul: Card;
  try {
    soul = cloneCardDef(getCardById(soulId));
  } catch {
    return state;
  }
  return shuffleIntoDraw(state, soul, rng);
}

const SOUL_BY_PIECE_TYPE: Partial<Record<PieceType, CardId>> = {
  pawn: "pawn-soul",
  knight: "knight-soul",
  bishop: "bishop-soul",
  rook: "rook-soul",
  queen: "queen-soul",
};
