// Pure helpers for reading artifact effects off an artifact list. Every
// effect lookup returns either a number (sum across all matching effects)
// or a derived value the call sites need (effective hand size, effective
// card cost, etc.).
//
// Match-side state plumbing (hand size, energy, capture / check triggers)
// imports these helpers; callers never iterate the artifact array themselves.

import { HAND_SIZE, ENERGY_PER_TURN } from "../cards/match";
import type { Artifact, ArtifactEffect, Card } from "../types";

/**
 * Walk all effects across all artifacts, calling `visit` for each. Just a
 * tiny iteration helper — keeps the per-effect lookups consistent.
 */
function each(artifacts: ReadonlyArray<Artifact>, visit: (fx: ArtifactEffect) => void): void {
  for (const a of artifacts) {
    for (const fx of a.effects) visit(fx);
  }
}

/** Effective hand size = base HAND_SIZE + sum of hand-size-bonus effects. */
export function effectiveHandSize(artifacts: ReadonlyArray<Artifact>): number {
  let n = HAND_SIZE;
  each(artifacts, (fx) => {
    if (fx.kind === "hand-size-bonus") n += fx.amount;
  });
  return Math.max(0, n);
}

/**
 * Energy granted at the start of every player turn.
 *
 * Banking was removed in M9 — there is no longer a distinct "starting" vs
 * "per-turn" energy concept; every turn starts at the same baseline. Both
 * `start-energy-bonus` and `energy-per-turn-bonus` artifact effects feed into
 * this number; legacy artifacts using `start-energy-bonus` (e.g. Cold Boot)
 * read identically to a +1/turn bonus in the new model.
 */
export function effectiveEnergyPerTurn(artifacts: ReadonlyArray<Artifact>): number {
  let n = ENERGY_PER_TURN;
  each(artifacts, (fx) => {
    if (fx.kind === "energy-per-turn-bonus") n += fx.amount;
    else if (fx.kind === "start-energy-bonus") n += fx.amount;
  });
  return Math.max(0, n);
}

/**
 * Cost of `card` after artifact discounts — never below zero. Discounts may
 * target a specific archetype or apply globally (no `archetype` field).
 */
export function effectiveCardCost(card: Card, artifacts: ReadonlyArray<Artifact>): number {
  let cost = card.cost;
  each(artifacts, (fx) => {
    if (fx.kind !== "card-cost-discount") return;
    if (fx.archetype !== undefined && fx.archetype !== card.archetype) return;
    cost -= fx.amount;
  });
  return Math.max(0, cost);
}

/** Total gold to grant on match start (run gold, not match-scoped). */
export function goldOnMatchStart(artifacts: ReadonlyArray<Artifact>): number {
  let n = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "gold-on-match-start") n += fx.amount;
  });
  return n;
}

/** Cards to draw when the player captures an enemy piece. */
export function drawOnCapture(artifacts: ReadonlyArray<Artifact>): number {
  let n = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "draw-on-capture") n += fx.count;
  });
  return n;
}

/** Energy granted (this turn) when the player captures an enemy piece. */
export function energyOnCapture(artifacts: ReadonlyArray<Artifact>): number {
  let n = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "energy-on-capture") n += fx.amount;
  });
  return n;
}

/** Cards to draw when the player puts the opponent in check. */
export function drawOnCheck(artifacts: ReadonlyArray<Artifact>): number {
  let n = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "draw-on-check") n += fx.count;
  });
  return n;
}
