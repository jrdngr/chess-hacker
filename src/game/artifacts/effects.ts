// Pure helpers for reading artifact effects off an artifact list. Every
// effect lookup returns either a number (sum across all matching effects)
// or a derived value the call sites need (effective hand size, effective
// card cost, etc.).
//
// Match-side state plumbing (hand size, energy, capture / check triggers)
// imports these helpers; callers never iterate the artifact array themselves.

import { HAND_SIZE, ENERGY_PER_TURN } from "../cards/match";
import type { Artifact, ArtifactEffect, Card, EmpowerPattern, PieceType, Side } from "../types";

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
  let cost: number = card.cost;
  each(artifacts, (fx) => {
    if (fx.kind === "card-cost-discount") {
      if (fx.archetype !== undefined && fx.archetype !== card.archetype) return;
      cost -= fx.amount;
    } else if (fx.kind === "card-cost-percentage-discount") {
      if (fx.archetype !== undefined && fx.archetype !== card.archetype) return;
      cost = Math.floor(cost * (1 - fx.percent / 100));
    }
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

/** Energy gained whenever the player sacrifices one of their own pieces (Scavenger). */
export function energyOnSacrifice(artifacts: ReadonlyArray<Artifact>): number {
  let n = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "energy-on-sacrifice") n += fx.amount;
  });
  return n;
}

/** Hive Mind: whether the first pawn summoned each turn should gain Shield. */
export function hasShieldFirstSummon(artifacts: ReadonlyArray<Artifact>): boolean {
  let found = false;
  each(artifacts, (fx) => {
    if (fx.kind === "shield-first-summon-per-turn") found = true;
  });
  return found;
}

/** Energy gained when the player puts the opponent in check (Zero-Day). */
export function energyOnCheck(artifacts: ReadonlyArray<Artifact>): number {
  let n = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "energy-on-check") n += fx.amount;
  });
  return n;
}

/**
 * Compound Interest: start-of-turn energy interest. For each `energy-interest`
 * artifact, gain `min(max, floor(currentEnergy / per))` energy.
 */
export function energyInterest(artifacts: ReadonlyArray<Artifact>, currentEnergy: number): number {
  let n = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "energy-interest" && fx.per > 0) {
      n += Math.min(fx.max, Math.floor(currentEnergy / fx.per));
    }
  });
  return n;
}

/** Cryostasis: extra turns added to player-applied Freeze/Root/Disarm/Downgrade. */
export function statusDurationBonus(artifacts: ReadonlyArray<Artifact>): number {
  let n = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "status-duration-bonus") n += fx.amount;
  });
  return n;
}

/** Trapsmith: extra turns added to player-placed Walls / Traps / square marks. */
export function overlayDurationBonus(artifacts: ReadonlyArray<Artifact>): number {
  let n = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "overlay-duration-bonus") n += fx.amount;
  });
  return n;
}

/** Loadbalancer: summed draw/energy granted when the player holds center majority. */
export function centerMajorityBonus(artifacts: ReadonlyArray<Artifact>): {
  draw: number;
  energy: number;
} {
  let draw = 0;
  let energy = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "center-majority-bonus") {
      draw += fx.draw;
      energy += fx.energy;
    }
  });
  return { draw, energy };
}

// ---- Piece-rule-modifier helpers --------------------------------------------
//
// These helpers feed the chess rule engine via Overlays (see
// `src/game/chess/rules.ts`). They're player-only in the prototype: the
// piece-rule-modifier discriminator covers artifacts the human player holds.

/**
 * Sides whose pawns may double-push from any rank (Pawn Storm artifact).
 * Always player-only in the prototype.
 */
export function pawnDoubleFromAnyRank(artifacts: ReadonlyArray<Artifact>): ReadonlySet<Side> {
  const out = new Set<Side>();
  each(artifacts, (fx) => {
    if (fx.kind === "piece-rule-modifier" && fx.modifier.kind === "pawn-double-from-any-rank") {
      out.add("player");
    }
  });
  return out;
}

/** Sides whose pawns may also move 1 square backward (Drill Sergeant). */
export function pawnBackwardStep(artifacts: ReadonlyArray<Artifact>): ReadonlySet<Side> {
  const out = new Set<Side>();
  each(artifacts, (fx) => {
    if (fx.kind === "piece-rule-modifier" && fx.modifier.kind === "pawn-backward-step") {
      out.add("player");
    }
  });
  return out;
}

/**
 * Effective player-side promotion rank (1-indexed). Returns `undefined` if no
 * artifact overrides the default; the caller falls back to `size.ranks`.
 * If multiple artifacts declare overrides, the lowest rank wins.
 */
export function pawnPromotionRank(artifacts: ReadonlyArray<Artifact>): number | undefined {
  let lowest: number | undefined;
  each(artifacts, (fx) => {
    if (fx.kind === "piece-rule-modifier" && fx.modifier.kind === "pawn-promotion-rank") {
      const r = fx.modifier.rank;
      if (lowest === undefined || r < lowest) lowest = r;
    }
  });
  return lowest;
}

/**
 * Side-wide empowers: every player piece of `pieceType` gains `pattern`.
 * Returned flat; multiple artifacts may stack different (type, pattern) pairs.
 */
export function pieceEmpowerAll(
  artifacts: ReadonlyArray<Artifact>,
): Array<{ pieceType: PieceType; pattern: EmpowerPattern }> {
  const out: Array<{ pieceType: PieceType; pattern: EmpowerPattern }> = [];
  each(artifacts, (fx) => {
    if (fx.kind === "piece-rule-modifier" && fx.modifier.kind === "piece-empower-all") {
      out.push({ pieceType: fx.modifier.pieceType, pattern: fx.modifier.pattern });
    }
  });
  return out;
}

/**
 * Maximum walls a player rook may attack across (Sniper Optics). Returns 0
 * when no artifact grants the effect. Stacks additively if multiple artifacts
 * declare it (none in the prototype).
 */
export function rookAttackThroughWalls(artifacts: ReadonlyArray<Artifact>): number {
  let n = 0;
  each(artifacts, (fx) => {
    if (fx.kind === "piece-rule-modifier" && fx.modifier.kind === "rook-attack-through-wall") {
      n += fx.modifier.maxWalls;
    }
  });
  return n;
}

/** True iff Phalanx (start-of-turn adjacency shield) is held. */
export function hasPhalanxShield(artifacts: ReadonlyArray<Artifact>): boolean {
  for (const a of artifacts) {
    for (const fx of a.effects) {
      if (fx.kind === "piece-rule-modifier" && fx.modifier.kind === "phalanx-adjacent-shield") {
        return true;
      }
    }
  }
  return false;
}
