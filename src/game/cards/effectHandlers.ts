// Card-effect handlers: the body of `applyEffect`, extracted from match.ts.
//
// Pure functions: each handler takes the current MatchCardState (plus context)
// and returns a new state + a list of board-side effects for the React layer
// to apply. Grouped by domain — status / overlay / card-manip / movement /
// misc — but exported as a single dispatcher (`applyEffect`) so the call site
// in `playCard` doesn't have to dispatch.

import type {
  AlgebraicSquare,
  Card,
  CardEffect,
  EmpowerStatus,
  LightningStatus,
  MatchCardState,
  PieceStatus,
  PowerEffect,
  ZoneBuff,
} from "../types";
import {
  clampEnergy,
  drawCards,
  type BoardContext,
  type CardSideEffect,
  type PlayTarget,
  type Rng,
} from "./match";
import { getCardById } from "./library";

export type EffectResult = { state: MatchCardState; sideEffects: CardSideEffect[] };

/**
 * Apply a single card effect against the match state. Pure — returns a new
 * state plus side effects. Compound effects fan out recursively. Validation
 * (target, cost, forbidden-by-rules) happens in `playCard` before this is
 * called, so handlers may assume the effect's preconditions are met.
 */
export function applyEffect(
  effect: CardEffect,
  state: MatchCardState,
  target: PlayTarget,
  ctx: BoardContext,
  rng: Rng,
  source: Card,
  playingIndex: number,
): EffectResult {
  switch (effect.kind) {
    // ---- Card / resource manipulation --------------------------------------
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
      // Revivers pull from the discard pile only — Consume cards are gone for
      // the match and cannot be returned.
      if (effect.selection === "random") {
        if (state.discardPile.length === 0) return { state, sideEffects: [] };
        const idx = Math.floor(rng() * state.discardPile.length);
        const picked = state.discardPile[idx];
        const discardPile = state.discardPile
          .slice(0, idx)
          .concat(state.discardPile.slice(idx + 1));
        return {
          state: { ...state, discardPile },
          sideEffects: [{ kind: "add-card-to-hand", card: picked }],
        };
      }
      // "choose": defer to UI prompt; the UI calls `completeRevive` once the
      // player picks a card from the discard pile.
      return { state, sideEffects: [{ kind: "revive-prompt" }] };
    }
    case "apply-retain-to-hand-card": {
      // Bookmark. Validation already ensured the index is in range, not the
      // playing slot, not a curse, and not already retained.
      if (target.kind !== "hand-card") return { state, sideEffects: [] };
      const hand = state.hand.map((slot, i) =>
        i === target.index ? { card: slot.card, retained: true } : slot,
      );
      return { state: { ...state, hand }, sideEffects: [] };
    }
    case "pending-energy-next-turn": {
      return {
        state: {
          ...state,
          pendingEnergyNextTurn: (state.pendingEnergyNextTurn ?? 0) + effect.amount,
        },
        sideEffects: [],
      };
    }

    // ---- Status (per-piece buffs/debuffs) ----------------------------------
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
    case "haste-piece": {
      const dur = effect.durationTurns ?? 1;
      return {
        state: addStatus(state, "hastes", squareTarget(target), state.turn + dur, "player"),
        sideEffects: [],
      };
    }
    case "haste-all-of-type": {
      // Walk the board for player pieces of the given type and apply Haste.
      const dur = effect.durationTurns ?? 1;
      const expires = state.turn + dur;
      const files = ctx.boardFiles ?? 8;
      const ranks = ctx.boardRanks ?? 8;
      const FILES = "abcdefgh";
      let next = state;
      for (let f = 0; f < files; f++) {
        for (let r = 1; r <= ranks; r++) {
          const sq = FILES[f] + String(r);
          const p = ctx.pieceAt(sq);
          if (!p || p.side !== "player" || p.type !== effect.pieceType) continue;
          next = addStatus(next, "hastes", sq, expires, "player");
        }
      }
      return { state: next, sideEffects: [] };
    }
    case "empower-piece": {
      const sq = squareTarget(target);
      // Both regular and single-use empowers expire at the start of the next
      // player turn. Single-use additionally drops as soon as the player moves
      // a different piece (handled by `dropOtherSingleUseEmpowers`).
      const dur = effect.durationTurns ?? 1;
      const status: EmpowerStatus = {
        square: sq,
        side: "player",
        expiresOnTurn: state.turn + dur,
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

    // ---- Overlays (square-anchored) ----------------------------------------
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

    // ---- Movement / board side-effects -------------------------------------
    case "swap-own-pieces":
    case "swap-rooted-with-own":
    case "swap-with-enemy": {
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
      return { state, sideEffects: [{ kind: "remove-piece", square: sq }] };
    }
    case "capture-random-own-minor": {
      // Bit Rot (Boss C). Pick a random own minor piece (knight or bishop).
      // The actual board removal is wired up by Match.tsx via the
      // `remove-piece` side effect — playCard is pure and only sees the
      // BoardContext, so we delegate the random choice through a side effect
      // that Match resolves with full board access.
      return { state, sideEffects: [{ kind: "remove-random-own-minor" }] };
    }
    case "undo-last-enemy-move": {
      // Rollback. The actual unwind happens against the engine in
      // sideEffects.ts — playCard is pure and can't peek at the engine's
      // history, so we just emit the side effect.
      return { state, sideEffects: [{ kind: "undo-last-enemy-move" }] };
    }

    // ---- Misc state flags --------------------------------------------------
    case "next-move-constraint": {
      // Currently the only constraint is `must-not-check`; the chess-move
      // path (Match.tsx) reads this flag and filters legal moves.
      return {
        state: { ...state, mustNotCheckNextMove: true },
        sideEffects: [],
      };
    }
    case "pending-energy-loss-on-no-capture": {
      // Memory Leak (Boss B). If no capture happens before the next turn starts,
      // -1 energy at start-of-turn. The amount is folded into the flag's
      // single-turn lifetime; multiple Memory Leak plays in one turn are no-ops
      // beyond the first since the flag is binary. Acceptable: Boss B's
      // schedule (every 4 turns) prevents stacking in practice.
      return { state: { ...state, pendingEnergyLossOnNoCapture: true }, sideEffects: [] };
    }
    case "forbid-zero-cost-this-turn": {
      return { state: { ...state, noZeroCostCardsThisTurn: true }, sideEffects: [] };
    }
    case "boss-extra-move": {
      const current = state.bossExtraMoves ?? 0;
      return {
        state: { ...state, bossExtraMoves: current + effect.count },
        sideEffects: [],
      };
    }
    case "play-power": {
      // Append the power to the match-scoped active list. Card itself goes to
      // the consumed pile via the `consume: true` flag on the JSON definition,
      // handled by playCard's disposal step.
      return {
        state: {
          ...state,
          activePowers: [...(state.activePowers ?? []), { ...effect.effect } as PowerEffect],
        },
        sideEffects: [],
      };
    }
    case "compound": {
      let next = state;
      const sideEffects: CardSideEffect[] = [];
      for (const child of effect.effects) {
        const r = applyEffect(child, next, target, ctx, rng, source, playingIndex);
        next = r.state;
        sideEffects.push(...r.sideEffects);
      }
      return { state: next, sideEffects };
    }
  }
}

// ---- Internal helpers -------------------------------------------------------

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

function squareTarget(t: PlayTarget): AlgebraicSquare {
  if (t.kind === "square") return t.square;
  if (t.kind === "two-squares") return t.first;
  throw new Error(`expected square target, got ${t.kind}`);
}

function anchorOf(buff: ZoneBuff): AlgebraicSquare | null {
  if (buff.region.kind === "rank" || buff.region.kind === "center") return null;
  return buff.region.anchor;
}

/**
 * Returns a fresh `Card` value with the same definition. Cards are stored as
 * structurally-equal records, but we shallow-clone so any future per-instance
 * fields (e.g., upgrade markers) don't bleed across copies.
 */
export function cloneCardDef(card: Card): Card {
  return { ...card, target: { ...card.target }, effect: cloneEffect(card.effect) };
}

function cloneEffect(effect: CardEffect): CardEffect {
  if (effect.kind === "compound") {
    return { kind: "compound", effects: effect.effects.map(cloneEffect) };
  }
  return { ...effect };
}
