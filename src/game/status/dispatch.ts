// Status-effect dispatcher. Pure: given a match state and an event, fire the
// effects whose triggers match, apply their CardEffect via the existing
// effectHandlers, and tick lifetimes. Returns a new state and any board
// side-effects produced (Bit Rot, Rollback, etc.).
//
// Replaces the legacy curse scheduler at src/game/bosses/scheduler.ts. Each
// status effect now owns both its trigger ("when") and its effect ("what"),
// so the boss schedule is just a list of status effect ids.
//
// Side-symmetry: a status's `target` field determines which side's events it
// listens to and whose state its effect mutates. Boss curses set target =
// "player" — they fire on player-side events (turn-start when side === player,
// on-self-* when by === player, on-opponent-* when by === opponent). Player-
// applied curses on the enemy set target = "opponent". The `target` side is
// forwarded to `applyEffect` as the `side` parameter so that per-piece
// statuses, zone buffs, and other side-aware handlers write to the correct
// side's state.

import type { Card, Side, StatusEffect } from "../types";
import { applyEffect } from "../cards/effectHandlers";
import type { BoardContext, CardSideEffect, Rng } from "../cards/match";

import { getStatusEffectById } from "./library";

/** Match-level events the status framework reacts to. */
export type StatusEvent =
  | { kind: "turn-start"; side: Side; turn: number }
  | { kind: "capture"; by: Side; turn: number }
  | { kind: "check"; by: Side; turn: number }
  | { kind: "pawn-move"; by: Side; turn: number };

export type FireResult = {
  state: import("../types").MatchCardState;
  sideEffects: CardSideEffect[];
};

function opposite(side: Side): Side {
  return side === "player" ? "opponent" : "player";
}

/**
 * Whether this status, given its target side, should fire for `event`. Tied to
 * StatusTrigger.kind:
 *  - turn-start          → event.kind === "turn-start" && event.side === target
 *  - every-n-turns       → event is a target-side turn-start matching the modulo
 *  - on-self-capture     → event.kind === "capture"   && event.by === target
 *  - on-opponent-capture → event.kind === "capture"   && event.by === opposite(target)
 *  - on-self-check       → event.kind === "check"     && event.by === target
 *  - on-self-pawn-move   → event.kind === "pawn-move" && event.by === target
 */
function matchesTrigger(status: StatusEffect, event: StatusEvent): boolean {
  const def = getStatusEffectById(status.defId);
  switch (def.trigger.kind) {
    case "turn-start":
      return event.kind === "turn-start" && event.side === status.target;
    case "every-n-turns": {
      if (event.kind !== "turn-start") return false;
      if (event.side !== status.target) return false;
      const n = def.trigger.n;
      if (n <= 0) return false;
      const first = def.trigger.firstOnTurn ?? n;
      if (event.turn < first) return false;
      return (event.turn - first) % n === 0;
    }
    case "on-self-capture":
      return event.kind === "capture" && event.by === status.target;
    case "on-opponent-capture":
      return event.kind === "capture" && event.by === opposite(status.target);
    case "on-self-check":
      return event.kind === "check" && event.by === status.target;
    case "on-self-pawn-move":
      return event.kind === "pawn-move" && event.by === status.target;
  }
}

/**
 * Build a synthetic Card for the existing applyEffect signature. Status
 * effects don't enter any pile — the synthetic source is purely a stub. Some
 * effect handlers reach into `source` (e.g. add-card-to-draw "self"); none of
 * the curse-flavored effects do, but we provide enough shape to be safe.
 */
function syntheticSourceCard(defId: string, effect: import("../types").CardEffect): Card {
  return {
    id: `status:${defId}`,
    name: defId,
    cost: 0,
    rarity: "common",
    archetype: "disruption",
    description: "",
    target: { kind: "none" },
    effect,
  };
}

/**
 * Pure: walk every active status, fire those whose trigger matches `event`,
 * apply their CardEffect via `applyEffect`, and tick lifetimes. Multiple
 * statuses can fire in a single call — the global once-per-turn cap from the
 * legacy scheduler is intentionally not preserved (per docs/design/status-
 * effects.md). The per-status `oncePerTurn` guard still applies.
 */
export function fireStatusEffects(
  state: import("../types").MatchCardState,
  event: StatusEvent,
  ctx: BoardContext,
  rng: Rng,
): FireResult {
  if (state.statusEffects.length === 0) return { state, sideEffects: [] };

  let next = state;
  const sideEffects: CardSideEffect[] = [];
  const updatedStatuses: StatusEffect[] = [];

  for (const status of state.statusEffects) {
    // Once-per-turn guard, scoped to the target side's turn counter via the
    // event itself (every event carries a target-side turn).
    const oncePerTurn = status.oncePerTurn !== false;
    if (oncePerTurn && status.lastFiredOnTurn === event.turn) {
      updatedStatuses.push(status);
      continue;
    }

    if (!matchesTrigger(status, event)) {
      updatedStatuses.push(status);
      continue;
    }

    const def = getStatusEffectById(status.defId);
    const sourceCard = syntheticSourceCard(def.id, def.effect);
    const result = applyEffect(
      def.effect,
      next,
      { kind: "none" },
      ctx,
      rng,
      sourceCard,
      -1,
      status.target,
    );
    next = result.state;
    for (const se of result.sideEffects) sideEffects.push(se);

    const updated: StatusEffect = { ...status, lastFiredOnTurn: event.turn };
    if (updated.remainingTriggers !== undefined) {
      updated.remainingTriggers = updated.remainingTriggers - 1;
      if (updated.remainingTriggers <= 0) {
        // Drop — don't push.
        continue;
      }
    }
    updatedStatuses.push(updated);
  }

  // Drop any status whose `expiresOnTurn` is on or before the event's turn.
  // Tied to target-side turn counter; we evaluate against the event's turn so
  // an opponent-target status decays on opponent turns and vice versa.
  const filtered = updatedStatuses.filter((s) => {
    if (s.expiresOnTurn === undefined) return true;
    if (s.target !== eventSideToTarget(event)) return true;
    return s.expiresOnTurn > event.turn;
  });

  return { state: { ...next, statusEffects: filtered }, sideEffects };
}

function eventSideToTarget(event: StatusEvent): Side {
  return event.kind === "turn-start" ? event.side : event.by;
}
