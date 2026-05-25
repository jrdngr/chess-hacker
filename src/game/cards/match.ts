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
  EmpowerStatus,
  HandCard,
  LightningStatus,
  MatchCardState,
  Piece,
  PieceStatus,
  PieceType,
  Side,
  Wall,
  ZoneBuff,
} from "../types";
import {
  effectiveCardCost,
  effectiveEnergyPerTurn,
  effectiveHandSize,
  hasPhalanxShield,
  pieceEmpowerAll,
} from "../artifacts/effects";
import {
  activeZoneBuffs,
  zoneBuffEnergyPerTurn,
  zoneBuffHandSize,
  type ZoneBoardContext,
} from "../overlays/zoneBuffs";
import { applyEffect } from "./effectHandlers";

/** Per `docs/design/cards.md`. */
export const HAND_SIZE = 7;
/** Passive energy gained at the start of every player turn. */
export const ENERGY_PER_TURN = 1;
/** Energy at match start (before first turn). */
export const STARTING_ENERGY = 0;
/** Cards drawn at the start of each player turn. */
export const DRAW_PER_TURN = 2;
/** Cards drawn as the opening hand at match start. */
export const STARTING_HAND_SIZE = 3;

/** Energy cap — excess energy is lost. */
export const ENERGY_CAP = 20;

export function clampEnergy(n: number): number {
  if (n < 0) return 0;
  if (n > ENERGY_CAP) return ENERGY_CAP;
  return n;
}

/** Standard chess piece values for capture-grants-energy. */
export const PIECE_ENERGY_VALUES: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0,
};

/**
 * Sentinel value used by tests that want "more than enough energy to play
 * any card" — kept as an export so legacy callers still compile.
 */
export const ENERGY_MAX = 99;

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
 * Initial match state: deck shuffled into the draw pile, starting hand
 * drawn (STARTING_HAND_SIZE cards), energy at STARTING_ENERGY, turn 0.
 * Caller should immediately follow with `startPlayerTurn` to begin turn 1.
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
  const shuffled = shuffle(deck, rng);
  const startingHand: HandCard[] = [];
  for (let i = 0; i < STARTING_HAND_SIZE && shuffled.length > 0; i++) {
    startingHand.push({ card: shuffled.shift()!, retained: false });
  }
  return {
    hand: startingHand,
    drawPile: shuffled,
    discardPile: [],
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
    mutexLocks: [],
    zoneBuffs: zoneBuffsFromArtifacts(artifacts),
    artifacts,
    activePowers: [],
    statusEffects: [],
    downgrades: [],
    backdoors: [],
    capturedPieces: [],
    playerCaptureCount: 0,
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
 * Draw `n` cards from the draw pile. When the draw pile empties mid-draw,
 * the discard pile is shuffled to form a new draw pile and drawing continues
 * (the standard cycling-deck rule, see `docs/cards/keywords.md`). Cards in
 * the consumed pile never re-enter the cycle. If both piles are empty, the
 * remaining draws fizzle.
 *
 * When `respectHandLimit` is true (default false), drawing stops when the
 * hand reaches the effective hand size (HAND_SIZE + artifact bonuses). The
 * start-of-turn draw uses this; card effects that say "draw N" do not.
 */
export function drawCards(
  state: MatchCardState,
  n: number,
  rng: Rng = Math.random,
  respectHandLimit = false,
): MatchCardState {
  const handLimit = respectHandLimit ? effectiveHandSize(state.artifacts ?? []) : Infinity;
  const hand = state.hand.slice();
  let drawPile = state.drawPile.slice();
  let discardPile = state.discardPile.slice();
  for (let i = 0; i < n; i++) {
    if (respectHandLimit && hand.length >= handLimit) break;
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      drawPile = shuffle(discardPile, rng);
      discardPile = [];
    }
    hand.push({ card: drawPile.shift()!, retained: false });
  }
  return { ...state, hand, drawPile, discardPile };
}

/**
 * Draw DRAW_PER_TURN cards (+ any Power draw bonuses), stopping if the hand
 * reaches the effective hand size (HAND_SIZE + artifact bonuses + zone-buff
 * bonuses). Cards persist between turns — this is NOT a refill-to-cap.
 */
export function refillHand(
  state: MatchCardState,
  rng: Rng = Math.random,
  ctx?: ZoneBoardContext,
): MatchCardState {
  const drawCount = DRAW_PER_TURN + powerDrawBonus(state);
  if (drawCount <= 0) return state;
  const handLimitWithBonuses =
    effectiveHandSize(state.artifacts ?? []) + zoneBuffsHandSizeFor(state, ctx);
  const drawState = { ...state, artifacts: state.artifacts ?? [] };
  // Temporarily set hand limit for the draw call
  const hand = state.hand.slice();
  let drawPile = state.drawPile.slice();
  let discardPile = state.discardPile.slice();
  for (let i = 0; i < drawCount; i++) {
    if (hand.length >= handLimitWithBonuses) break;
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      drawPile = shuffle(discardPile, rng);
      discardPile = [];
    }
    hand.push({ card: drawPile.shift()!, retained: false });
  }
  return { ...drawState, hand, drawPile, discardPile };
}

/** Sum of all "draw-per-turn" Power effects on this match. */
function powerDrawBonus(state: MatchCardState): number {
  let n = 0;
  for (const p of state.activePowers ?? []) {
    if (p.kind === "draw-per-turn") n += p.amount;
  }
  return n;
}

/** Sum of all "energy-per-turn" Power effects on this match. */
function powerEnergyBonus(state: MatchCardState): number {
  let n = 0;
  for (const p of state.activePowers ?? []) {
    if (p.kind === "energy-per-turn") n += p.amount;
  }
  return n;
}

/** Sum of all "extra-chess-move-per-turn" Power effects on this match. */
function powerExtraMoves(state: MatchCardState): number {
  let n = 0;
  for (const p of state.activePowers ?? []) {
    if (p.kind === "extra-chess-move-per-turn") n += p.amount;
  }
  return n;
}

/**
 * Forced end-of-turn discard: the player chooses one card from hand to
 * discard. In the new persistent-hand system, cards stay in hand between
 * turns — only the forced discard moves cards to the discard pile.
 */
export function discardCardFromHand(state: MatchCardState, handIndex: number): MatchCardState {
  if (handIndex < 0 || handIndex >= state.hand.length) return state;
  const hand = state.hand.slice();
  const [removed] = hand.splice(handIndex, 1);
  return { ...state, hand, discardPile: [...state.discardPile, removed.card] };
}

/**
 * @deprecated Legacy alias. In the new persistent-hand system, cards stay
 * between turns. This no-ops so callers that still reference it don't crash.
 */
export function discardHandAtTurnEnd(state: MatchCardState): MatchCardState {
  return state;
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
 *  - Draw DRAW_PER_TURN cards (up to hand limit).
 *  - Add ENERGY_PER_TURN to the persistent energy pool (+ artifact bonuses
 *    + zone-buff bonus + Power bonus + queued/pending one-shot grants
 *    - any greed penalty). Energy is capped at ENERGY_CAP.
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
  // Boss B / Memory Leak: if the status left a pending penalty and no capture
  // happened between then and now, take 1 energy. The flag is cleared
  // whether or not it triggered.
  const greedPenalty = state.pendingEnergyLossOnNoCapture && !state.capturedThisTurn ? 1 : 0;
  // Boss B modifier: queued energy from the captures-grant-captured-energy
  // rule. Applied (and cleared) at the start of the player's next turn.
  const queuedCaptureEnergy = state.pendingPlayerEnergyOnTurnStart ?? 0;
  // Cache Warmup et al — bonus carried into this start-of-turn from the
  // previous turn's plays. Cleared after applying.
  const pendingNextTurnEnergy = state.pendingEnergyNextTurn ?? 0;
  const energyGain =
    effectiveEnergyPerTurn(artifacts) +
    powerEnergyBonus(tickedState) +
    zoneEnergyBonus +
    queuedCaptureEnergy +
    pendingNextTurnEnergy -
    greedPenalty;
  const energy = clampEnergy(state.energy + energyGain);
  // Mutex Lock snapshot/decrement. This runs at the top of each player turn,
  // i.e. between two opponent turns from the lock's perspective. For each
  // active lock:
  //   - If the anchor piece is no longer on the board (sacrificed, swapped
  //     off, …) → fizzle (drop the lock).
  //   - Otherwise decrement remainingTurns; drop when it hits 0.
  // When `ctx` is omitted (legacy tests), we keep the locks unchanged on the
  // assumption the test setup is not exercising the anchor-life logic.
  const liveMutexLocks =
    ctx?.pieceSideAt !== undefined
      ? (state.mutexLocks ?? []).flatMap((l) => {
          if (ctx.pieceSideAt(l.anchor) !== "player") return [];
          const next = l.remainingTurns - 1;
          if (next <= 0) return [];
          return [{ ...l, remainingTurns: next }];
        })
      : (state.mutexLocks ?? []);
  const next: MatchCardState = {
    ...tickedState,
    turn,
    energy,
    walls: aliveWalls(state.walls, turn),
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
    mutexLocks: liveMutexLocks,
    downgrades: alive(state.downgrades ?? []),
    pendingEnergyLossOnNoCapture: false,
    capturedThisTurn: false,
    noZeroCostCardsThisTurn: false,
    pendingPlayerEnergyOnTurnStart: 0,
    pendingEnergyNextTurn: 0,
    continuationSquare: undefined,
    sudoSquare: undefined,
    pendingHotSwap: undefined,
    playerExtraMovesRemaining: powerExtraMoves(tickedState),
    probeExpiresOnTurn:
      (state.probeExpiresOnTurn ?? 0) > turn ? state.probeExpiresOnTurn : undefined,
  };
  // Turn 0→1 is match start — the opening hand was already drawn by
  // createMatchCardState, so skip the per-turn draw.
  const refilled = state.turn === 0 ? next : refillHand(next, rng, ctx);
  return applyStartOfTurnArtifactsAndPowers(refilled, ctx);
}

/**
 * Apply start-of-turn artifact and Power effects that need a board snapshot:
 *  - piece-empower-all (Polished Bishop, Cavalry Doctrine)
 *  - phalanx-adjacent-shield (Phalanx)
 *  - haste-pawns-per-turn (Pawn Storm Power)
 *  - shield-back-rank-per-turn (Garrison Mode Power, king-excluded)
 *
 * Each effect re-applies a one-turn status using the current board state, so
 * the alive()-filter at the top of `startPlayerTurn` doesn't need to know
 * about them. No-op when `ctx.pieceTypeAt` isn't provided (e.g. tests that
 * skip the board context entirely).
 */
function applyStartOfTurnArtifactsAndPowers(
  state: MatchCardState,
  ctx?: ZoneBoardContext,
): MatchCardState {
  if (!ctx?.pieceTypeAt) return state;
  const expires = state.turn + 1;
  const pieceTypeAt = ctx.pieceTypeAt;
  const pieceSideAt = ctx.pieceSideAt;
  const { files, ranks } = ctx.size;
  const FILES = "abcdefgh";

  const empowerSpecs = pieceEmpowerAll(state.artifacts ?? []);
  const phalanx = hasPhalanxShield(state.artifacts ?? []);
  const hastePawns = (state.activePowers ?? []).some((p) => p.kind === "haste-pawns-per-turn");
  const shieldBackRank = (state.activePowers ?? []).some(
    (p) => p.kind === "shield-back-rank-per-turn",
  );

  const intrusionDetection = (state.activePowers ?? []).find(
    (p) => p.kind === "root-half-entrants-per-turn",
  );

  if (
    empowerSpecs.length === 0 &&
    !phalanx &&
    !hastePawns &&
    !shieldBackRank &&
    !intrusionDetection
  ) {
    return state;
  }

  let next = state;
  for (let f = 0; f < files; f++) {
    for (let r = 1; r <= ranks; r++) {
      const sq = FILES[f] + String(r);
      if (pieceSideAt(sq) !== "player") continue;
      const type = pieceTypeAt(sq);
      if (!type) continue;

      // piece-empower-all: append per (sq, pattern) without dropping any
      // existing single-use empower (Patches stack independently).
      for (const spec of empowerSpecs) {
        if (spec.pieceType !== type) continue;
        const existing = (next.empowers ?? []).find(
          (e) => e.square === sq && e.pattern === spec.pattern,
        );
        if (existing) continue;
        next = {
          ...next,
          empowers: [
            ...next.empowers,
            { square: sq, side: "player", expiresOnTurn: expires, pattern: spec.pattern },
          ],
        };
      }

      // Phalanx: if any orthogonally-adjacent square has a friendly piece,
      // shield this piece for one turn.
      if (phalanx && hasOrthFriend(pieceSideAt, files, ranks, f, r)) {
        next = addStatus(next, "shields", sq, expires, "player");
      }

      // Pawn Storm Power: haste every player pawn at the start of each turn.
      if (hastePawns && type === "pawn") {
        next = addStatus(next, "hastes", sq, expires, "player");
      }

      // Garrison Mode Power: shield every non-king player piece on rank 1
      // until the player's next turn.
      if (shieldBackRank && r === 1 && type !== "king") {
        next = addStatus(next, "shields", sq, expires, "player");
      }
    }
  }

  // Intrusion Detection Power: root (and optionally disarm) enemy pieces
  // that entered the player's half since the last turn start.
  if (intrusionDetection) {
    const halfRank = Math.floor(ranks / 2);
    const currentEnemyHalf: AlgebraicSquare[] = [];
    for (let f = 0; f < files; f++) {
      for (let r = 1; r <= halfRank; r++) {
        const sq = FILES[f] + String(r);
        if (pieceSideAt(sq) === "opponent") currentEnemyHalf.push(sq);
      }
    }
    const prev = new Set(next.lastTurnEnemyHalfSquares ?? []);
    for (const sq of currentEnemyHalf) {
      if (!prev.has(sq)) {
        next = addStatus(next, "roots", sq, expires, "opponent");
        if (
          intrusionDetection.kind === "root-half-entrants-per-turn" &&
          intrusionDetection.disarm
        ) {
          next = addStatus(next, "disarms", sq, expires, "opponent");
        }
      }
    }
    next = { ...next, lastTurnEnemyHalfSquares: currentEnemyHalf };
  }

  return next;
}

function hasOrthFriend(
  pieceSideAt: (sq: AlgebraicSquare) => Side | null,
  files: number,
  ranks: number,
  f: number,
  r: number,
): boolean {
  const FILES = "abcdefgh";
  const offsets: ReadonlyArray<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [df, dr] of offsets) {
    const nf = f + df;
    const nr = r + dr;
    if (nf < 0 || nf >= files) continue;
    if (nr < 1 || nr > ranks) continue;
    if (pieceSideAt(FILES[nf] + String(nr)) === "player") return true;
  }
  return false;
}

/**
 * Wall lifetime: permanent (boss-hazard) walls survive every tick;
 * card-placed walls expire when their `expiresOnTurn` is reached.
 */
function aliveWalls(walls: ReadonlyArray<Wall>, turn: number): Wall[] {
  return walls.filter((w) => w.permanent === true || w.expiresOnTurn > turn);
}

// ---- Card play --------------------------------------------------------------

/**
 * Where the player has aimed the card. The kind matches what the card asked
 * for (see `Card.target`); the resolver double-checks against the board.
 *
 * `two-squares` covers both Switch Files (two own pieces) and Remote Access
 * (enemy piece + destination); the card's target.kind disambiguates.
 */
export type PlayTarget =
  | { kind: "none" }
  | { kind: "square"; square: AlgebraicSquare }
  | { kind: "two-squares"; first: AlgebraicSquare; second: AlgebraicSquare }
  | { kind: "hand-card"; index: number };

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
 * Whether `b` is one king-step away from `a` (file/rank distance ≤ 1, and not
 * the same square). Used by Fork to validate spawn-adjacent-to-source.
 */
export function isKingAdjacent(a: AlgebraicSquare, b: AlgebraicSquare): boolean {
  if (a === b) return false;
  const fileA = a.charCodeAt(0) - "a".charCodeAt(0);
  const rankA = Number(a.slice(1));
  const fileB = b.charCodeAt(0) - "a".charCodeAt(0);
  const rankB = Number(b.slice(1));
  return Math.abs(fileA - fileB) <= 1 && Math.abs(rankA - rankB) <= 1;
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
  /** Number of files on the board. Defaults to 8 if unspecified. */
  boardFiles?: number;
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
  | { kind: "revive-prompt" }
  /** Bit Rot (Boss C): destroy a random own minor piece. */
  | { kind: "remove-random-own-minor" }
  /** Rollback: reverse the opponent's most recent chess move. */
  | { kind: "undo-last-enemy-move" }
  /**
   * Garbage Collect: destroy every enemy non-King piece currently attacked
   * by one of the player's pieces. If `recursive`, repeat until a sweep
   * destroys nothing — this catches discovered attacks revealed by removing
   * blockers. The enemy king is never destroyed.
   */
  | { kind: "garbage-collect"; recursive: boolean }
  | { kind: "convert-piece"; square: AlgebraicSquare }
  | { kind: "transform-piece"; square: AlgebraicSquare; newType: PieceType }
  | { kind: "transform-choice-prompt"; square: AlgebraicSquare; options: PieceType[] };

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
  | "target-not-adjacent"
  | "target-not-in-own-half"
  | "target-not-empty-or-walled"
  | "target-patch-same-piece-type"
  | "target-hand-card-out-of-range"
  | "target-hand-card-self"
  | "target-hand-card-already-retained"
  | "target-piece-type-mismatch"
  | "effect-forbidden-by-modifier";

/**
 * Per-match rules surfaced from boss modifiers (or other future sources).
 * The card resolver consults these before applying the effect.
 */
export type MatchRules = {
  /**
   * Effect kinds the player is not allowed to play. Used by Boss A's
   * `no-player-walls` modifier to block `place-wall` cards.
   */
  forbiddenCardEffectKinds?: ReadonlySet<CardEffect["kind"]>;
  /**
   * Boss C (`no-promotion`): when true, the player's pawns cannot promote.
   * Promotion candidates are filtered from the engine's legal-move set in
   * Match.tsx, and the AI variant uses the same filter via `searchmoves`.
   */
  noPromotion?: boolean;
};

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
  rules: MatchRules = {},
): PlayCardResult {
  const slot = state.hand[cardIndex];
  if (!slot) return { ok: false, reason: "no-such-card" };
  const card = slot.card;
  if (isCardEffectForbidden(card.effect, rules)) {
    return { ok: false, reason: "effect-forbidden-by-modifier" };
  }
  const cost = effectiveCardCost(card, state.artifacts ?? []);
  if (state.energy < cost) return { ok: false, reason: "not-enough-energy" };
  // Hardened (Boss C): once the status fires this turn, no further 0-cost
  // cards may be played for the rest of the turn.
  if (state.noZeroCostCardsThisTurn && cost === 0) {
    return { ok: false, reason: "effect-forbidden-by-modifier" };
  }

  const validation = validateTarget(card, target, ctx, state, cardIndex);
  if (validation) return { ok: false, reason: validation };

  let next: MatchCardState = { ...state, energy: clampEnergy(state.energy - cost) };
  const sideEffects: CardSideEffect[] = [];

  const applied = applyEffect(card.effect, next, target, ctx, rng, card, cardIndex);
  next = applied.state;
  sideEffects.push(...applied.sideEffects);

  // Splice the played slot out of hand. Then route the played card based on
  // its disposal mode:
  //  - `consume: true` cards land in the consumed pile (gone for the match,
  //    not eligible for revival).
  //  - All others land in the discard pile (will cycle back via shuffle).
  const hand = next.hand.slice();
  hand.splice(cardIndex, 1);
  if (card.consume) {
    next = { ...next, hand, consumedPile: [...next.consumedPile, card] };
  } else {
    next = { ...next, hand, discardPile: [...next.discardPile, card] };
  }
  return { ok: true, state: next, sideEffects };
}

/**
 * Whether playing this card would violate a match modifier. Currently only
 * checks `forbiddenCardEffectKinds` against the top-level effect kind and any
 * compound child kinds. Used both by the resolver and by the Hand UI to grey
 * out forbidden cards.
 */
export function isCardEffectForbidden(effect: CardEffect, rules: MatchRules): boolean {
  const set = rules.forbiddenCardEffectKinds;
  if (!set || set.size === 0) return false;
  if (set.has(effect.kind)) return true;
  if (effect.kind === "compound") {
    for (const child of effect.effects) if (set.has(child.kind)) return true;
  }
  return false;
}

function validateTarget(
  card: Card,
  target: PlayTarget,
  ctx: BoardContext,
  state: MatchCardState,
  playingIndex: number,
): PlayCardFailure | null {
  switch (card.target.kind) {
    case "none":
      return null;
    case "square": {
      if (target.kind !== "square") return "missing-target";
      // Walls block buff placement (no overlay surface), but pieces are fine.
      if (ctx.hasWall(target.square)) return "target-not-empty";
      return null;
    }
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
        return "target-patch-same-piece-type";
      }
      if (
        card.effect.kind === "lightning-piece" &&
        card.effect.pieceTypeFilter !== undefined &&
        card.effect.pieceTypeFilter !== p.type
      ) {
        return "target-piece-type-mismatch";
      }
      if (
        card.effect.kind === "empower-piece" &&
        card.effect.pieceTypeFilter !== undefined &&
        card.effect.pieceTypeFilter !== p.type
      ) {
        return "target-piece-type-mismatch";
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
    case "two-enemy-non-king-pieces": {
      // Race Condition: two distinct enemy non-king squares.
      if (target.kind !== "two-squares") return "missing-target";
      if (target.first === target.second) return "target-not-distinct";
      const a = ctx.pieceAt(target.first);
      const b = ctx.pieceAt(target.second);
      if (!a || a.side !== "opponent" || !b || b.side !== "opponent") {
        return "target-not-enemy-piece";
      }
      if (a.type === "king" || b.type === "king") return "target-not-enemy-non-king-piece";
      return null;
    }
    case "own-non-king-piece-then-adjacent-empty": {
      // Fork: source = own non-king piece; spawn = adjacent empty (king-step).
      if (target.kind !== "two-squares") return "missing-target";
      if (target.first === target.second) return "target-not-distinct";
      const source = ctx.pieceAt(target.first);
      if (!source || source.side !== "player") return "target-not-own-piece";
      if (source.type === "king") return "target-not-own-non-king-piece";
      if (ctx.pieceAt(target.second) !== null || ctx.hasWall(target.second)) {
        return "target-not-empty";
      }
      if (!isKingAdjacent(target.first, target.second)) return "target-not-adjacent";
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
    case "enemy-and-own-piece": {
      // First: any enemy non-king piece. Second: one of player's pieces.
      if (target.kind !== "two-squares") return "missing-target";
      if (target.first === target.second) return "target-not-distinct";
      const enemy = ctx.pieceAt(target.first);
      if (!enemy || enemy.side !== "opponent") return "target-not-enemy-piece";
      if (enemy.type === "king") return "target-not-enemy-non-king-piece";
      const own = ctx.pieceAt(target.second);
      if (!own || own.side !== "player") return "target-not-own-piece";
      return null;
    }
    case "hand-card": {
      if (target.kind !== "hand-card") return "missing-target";
      if (target.index < 0 || target.index >= state.hand.length) {
        return "target-hand-card-out-of-range";
      }
      if (target.index === playingIndex) return "target-hand-card-self";
      const slot = state.hand[target.index];
      if (slot.retained) return "target-hand-card-already-retained";
      return null;
    }
    case "own-pawn": {
      if (target.kind !== "square") return "missing-target";
      const p = ctx.pieceAt(target.square);
      if (!p || p.side !== "player") return "target-not-own-piece";
      if (p.type !== "pawn") return "target-piece-type-mismatch";
      return null;
    }
    case "enemy-minor-piece": {
      if (target.kind !== "square") return "missing-target";
      const p = ctx.pieceAt(target.square);
      if (!p || p.side !== "opponent") return "target-not-enemy-piece";
      if (p.type !== "knight" && p.type !== "bishop" && p.type !== "pawn")
        return "target-not-enemy-non-king-piece";
      return null;
    }
    case "own-non-king-piece-then-empty-square": {
      if (target.kind !== "two-squares") return "missing-target";
      const source = ctx.pieceAt(target.first);
      if (!source || source.side !== "player") return "target-not-own-piece";
      if (source.type === "king") return "target-not-own-non-king-piece";
      if (ctx.pieceAt(target.second) !== null || ctx.hasWall(target.second))
        return "target-not-empty";
      return null;
    }
    case "captured-friendly-piece-then-empty-square-own-half": {
      // Git Revert: first step picks from captured list (UI-driven), second picks empty square.
      // At this layer we validate the placement square. The captured-piece selection
      // is validated by the UI before reaching playCard.
      if (target.kind !== "two-squares") return "missing-target";
      if (!isInPlayerHalf(target.second, ctx.boardRanks)) return "target-not-in-own-half";
      if (ctx.pieceAt(target.second) !== null || ctx.hasWall(target.second))
        return "target-not-empty";
      return null;
    }
  }
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
  // Mutex locks are anchored to a piece; relocate the anchor too so the lock
  // zone follows the locked piece across the current player turn. The
  // re-snapshot at end-of-player-turn then uses the new anchor square.
  const moveAnchor = (arr: MatchCardState["mutexLocks"]): MatchCardState["mutexLocks"] =>
    arr.map((l) => (l.anchor === from ? { ...l, anchor: to } : l));
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
    mutexLocks: moveAnchor(state.mutexLocks ?? []),
    downgrades: move(state.downgrades ?? []),
  };
}

/**
 * Drop any per-square statuses sitting on `square` (e.g., after the piece
 * there is captured or removed by Sacrifice).
 */
export function clearStatusesOn(state: MatchCardState, square: AlgebraicSquare): MatchCardState {
  const drop = <T extends { square: AlgebraicSquare }>(arr: T[]): T[] =>
    arr.filter((x) => x.square !== square);
  // Mutex locks anchored to a piece on `square` fizzle when the piece is
  // removed (captured, sacrificed, swapped off). Per design: anchor-lost =
  // lock gone for good.
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
    mutexLocks: (state.mutexLocks ?? []).filter((l) => l.anchor !== square),
    downgrades: drop(state.downgrades ?? []),
  };
}

/**
 * Replace the top N of the draw pile with a custom-ordered subset.
 * Used by the Stack Trace (scry) UI when the player commits a new order.
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

/** Drop a haste status. Called right after the FIRST move resolves so the
 *  second move's legal moves are generated without the haste-disarm union
 *  (i.e., the second move is allowed to capture). */
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
 * Splice `card` into the draw pile at a random index. Used by capture-grants-
 * Patch (see `grantPatchOnCapture`) and by the `add-card-to-draw` card effect.
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
 * duplicate references (e.g., a starter deck with three Stack Traces all
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
 * applied at start-of-turn refill; transient overflow is allowed. Added
 * cards are not retained by default; Bookmark is the way to grant Retain.
 */
export function addToHand(state: MatchCardState, card: Card): MatchCardState {
  return { ...state, hand: [...state.hand, { card, retained: false }] };
}

/**
 * Complete a "choose" revive: move the picked card from the discard pile to
 * the hand. Used by the UI after the chooser closes. No-op if the id is no
 * longer in the discard pile (defensive — UI may have raced).
 */
export function completeRevive(state: MatchCardState, cardIndex: number): MatchCardState {
  if (cardIndex < 0 || cardIndex >= state.discardPile.length) return state;
  const card = state.discardPile[cardIndex];
  const discardPile = state.discardPile
    .slice(0, cardIndex)
    .concat(state.discardPile.slice(cardIndex + 1));
  return { ...state, discardPile, hand: [...state.hand, { card, retained: false }] };
}

/**
 * Capture-grants-Energy: when the player captures an enemy non-king piece,
 * add the piece's standard chess value to the player's energy pool. No-op
 * for opponent captures, missing pieces, or kings (which can't be captured).
 */
export function grantEnergyOnCapture(
  state: MatchCardState,
  captured: Piece | null,
  by: Side,
): MatchCardState {
  if (by !== "player") return state;
  if (!captured || captured.side !== "opponent") return state;
  const value = PIECE_ENERGY_VALUES[captured.type] ?? 0;
  if (value === 0) return state;
  return { ...state, energy: clampEnergy(state.energy + value) };
}

/**
 * @deprecated Legacy alias. Use `grantEnergyOnCapture` instead.
 * Kept so call sites compile during migration.
 */
export const grantPatchOnCapture = (
  state: MatchCardState,
  captured: Piece | null,
  by: Side,
  _rng?: Rng,
): MatchCardState => grantEnergyOnCapture(state, captured, by);
