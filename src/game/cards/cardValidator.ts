// Card-JSON validator. Loaded once at startup by `library.ts`; defines the
// canonical list of acceptable archetype, target, and effect kinds. Adding a
// new effect or target kind is a two-step change: extend the union types in
// `../types.ts`, then extend the relevant VALID_* constant + the matching
// case in `validateEffect` here.

import type {
  Card,
  CardArchetype,
  CardCost,
  CardEffect,
  CardId,
  CardRarity,
  CardTarget,
  CardUpgradeDelta,
  EmpowerPattern,
  PieceType,
  PowerEffect,
  TrapEffect,
} from "../types";

// ---- Validation enums -------------------------------------------------------

export const VALID_RARITIES: readonly CardRarity[] = ["common", "uncommon", "rare"];
export const VALID_ARCHETYPES: readonly CardArchetype[] = [
  "tempo",
  "spatial",
  "movement",
  "disruption",
  "resource",
  "defensive",
  "burst",
  "sacrifice",
  "summon",
  "swap",
  "power",
];
export const VALID_COSTS: readonly CardCost[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
];
export const VALID_TARGET_KINDS = [
  "none",
  "square",
  "empty-square",
  "empty-square-own-half",
  "enemy-piece",
  "enemy-non-king-piece",
  "own-piece",
  "own-non-king-piece",
  "two-own-pieces",
  "two-enemy-non-king-pieces",
  "own-piece-then-adjacent-empty",
  "marionette",
  "rooted-enemy-and-own-piece",
  "enemy-and-own-piece",
  "hand-card",
  "own-pawn",
  "enemy-minor-piece",
  "own-non-king-piece-then-empty-square",
  "captured-friendly-piece-then-empty-square-own-half",
] as const;
export const VALID_EFFECT_KINDS = [
  "gain-energy",
  "draw",
  "scry",
  "freeze-piece",
  "root-piece",
  "disarm-piece",
  "compel-piece",
  "shield-piece",
  "haste-piece",
  "empower-piece",
  "lightning-piece",
  "place-wall",
  "place-sanctuary",
  "place-trap",
  "place-zone-buff",
  "swap-own-pieces",
  "swap-rooted-with-own",
  "swap-with-enemy",
  "swap-enemy-pieces",
  "summon-piece",
  "summon-adjacent",
  "sacrifice-piece",
  "sacrifice-blast-action",
  "mutex-lock",
  "garbage-collect",
  "marionette",
  "destroy-piece",
  "add-card-to-draw",
  "revive",
  "next-move-constraint",
  "pending-energy-loss-on-no-capture",
  "forbid-zero-cost-this-turn",
  "boss-extra-move",
  "capture-random-own-minor",
  "apply-retain-to-hand-card",
  "pending-energy-next-turn",
  "play-power",
  "undo-last-enemy-move",
  "sudo-piece",
  "hot-swap",
  "downgrade-piece",
  "convert-piece",
  "transform-piece-up",
  "sacrifice-detonate",
  "gain-energy-per-capture",
  "place-backdoor",
  "teleport-piece",
  "resurrect-piece",
  "insert-probe",
  "compound",
] as const;
export const VALID_POWER_KINDS = [
  "energy-per-turn",
  "draw-per-turn",
  "extra-chess-move-per-turn",
  "haste-pawns-per-turn",
  "shield-back-rank-per-turn",
  "root-half-entrants-per-turn",
] as const;
export const VALID_ZONE_BUFF_PATTERNS = ["square-orthogonal-1", "square-radius-1"] as const;
export const VALID_ZONE_BUFF_EFFECT_KINDS = ["energy-per-turn", "hand-size"] as const;
export const VALID_DESTROY_FILTERS = ["any", "attacked-by-player"] as const;
export const VALID_ADD_CARD_DRAW_SOURCES = ["self", "card-id"] as const;
export const VALID_REVIVE_SELECTIONS = ["random", "choose"] as const;
export const VALID_TRAP_EFFECTS: readonly TrapEffect[] = ["capture", "freeze", "push"];
export const VALID_EMPOWER_PATTERNS: readonly EmpowerPattern[] = [
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
  "king-step",
  "diagonal-step",
  "horizontal-step",
];
export const VALID_PIECE_TYPES: readonly PieceType[] = [
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
  "king",
];

/**
 * Acceptable `pieceType` values for the `summon-adjacent` effect (Fork).
 * In addition to the normal piece-type set, the upgrade variant uses the
 * sentinel `"copy-of-source"` to summon a copy of the targeted source piece.
 */
export const VALID_SUMMON_ADJACENT_PIECE_TYPES = [
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
  "king",
  "copy-of-source",
] as const;

/** Blast patterns for `sacrifice-blast-action` (Buffer Overflow). */
export const VALID_BLAST_PATTERNS = ["king-step", "king-step-and-knight"] as const;

// ---- Tiny shared helpers ----------------------------------------------------

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}

/**
 * Validate the optional `durationTurns` field shared by status-applying card
 * effects (haste-piece, empower-piece). Pushes an error
 * and returns null on bad input; returns the value (or undefined if absent).
 */
function validateDurationTurns(
  v: unknown,
  effectKind: string,
  errors: string[],
): number | undefined | null {
  if (v === undefined) return undefined;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 8) {
    errors.push(
      `'effect.durationTurns' must be a positive integer 1..8 if present for kind '${effectKind}'`,
    );
    return null;
  }
  return v;
}

// ---- Target validation ------------------------------------------------------

function validateTarget(raw: unknown, errors: string[]): CardTarget | null {
  if (!isPlainObject(raw)) {
    errors.push("'target' must be an object with a 'kind' field");
    return null;
  }
  const kind = raw.kind;
  if (typeof kind !== "string" || !(VALID_TARGET_KINDS as readonly string[]).includes(kind)) {
    errors.push(`'target.kind' must be one of ${VALID_TARGET_KINDS.join(", ")}`);
    return null;
  }
  return { kind } as CardTarget;
}

// ---- Effect validation (the big switch) ------------------------------------

function validateEffect(raw: unknown, errors: string[]): CardEffect | null {
  if (!isPlainObject(raw)) {
    errors.push("'effect' must be an object with a 'kind' field");
    return null;
  }
  const kind = raw.kind;
  switch (kind) {
    case "gain-energy": {
      if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount)) {
        errors.push("'effect.amount' must be a number for kind 'gain-energy'");
        return null;
      }
      return { kind: "gain-energy", amount: raw.amount };
    }
    case "draw": {
      if (!isPositiveInt(raw.count)) {
        errors.push("'effect.count' must be a positive integer for kind 'draw'");
        return null;
      }
      return { kind: "draw", count: raw.count };
    }
    case "scry": {
      if (!isPositiveInt(raw.count)) {
        errors.push("'effect.count' must be a positive integer for kind 'scry'");
        return null;
      }
      return { kind: "scry", count: raw.count };
    }
    case "freeze-piece": {
      const dt = validateDurationTurns(raw.durationTurns, "freeze-piece", errors);
      if (dt === null) return null;
      const out: CardEffect & { kind: "freeze-piece" } = { kind: "freeze-piece" };
      if (typeof dt === "number") out.durationTurns = dt;
      return out;
    }
    case "root-piece": {
      const dt = raw.durationTurns;
      if (dt !== undefined && (typeof dt !== "number" || !Number.isInteger(dt) || dt < 1)) {
        errors.push(
          "'effect.durationTurns' must be a positive integer if present for 'root-piece'",
        );
        return null;
      }
      const out: CardEffect = { kind: "root-piece" };
      if (typeof dt === "number") (out as { durationTurns?: number }).durationTurns = dt;
      return out;
    }
    case "disarm-piece": {
      const dt = validateDurationTurns(raw.durationTurns, "disarm-piece", errors);
      if (dt === null) return null;
      const out: CardEffect & { kind: "disarm-piece" } = { kind: "disarm-piece" };
      if (typeof dt === "number") out.durationTurns = dt;
      return out;
    }
    case "compel-piece":
      return { kind: "compel-piece" };
    case "shield-piece": {
      const dt = validateDurationTurns(raw.durationTurns, "shield-piece", errors);
      if (dt === null) return null;
      const out: CardEffect & { kind: "shield-piece" } = { kind: "shield-piece" };
      if (typeof dt === "number") out.durationTurns = dt;
      return out;
    }
    case "haste-piece": {
      const dt = validateDurationTurns(raw.durationTurns, "haste-piece", errors);
      if (dt === null) return null;
      const out: CardEffect & { kind: "haste-piece" } = { kind: "haste-piece" };
      if (typeof dt === "number") out.durationTurns = dt;
      return out;
    }
    case "empower-piece": {
      const p = raw.pattern;
      if (typeof p !== "string" || !(VALID_EMPOWER_PATTERNS as readonly string[]).includes(p)) {
        errors.push(
          `'effect.pattern' must be one of ${VALID_EMPOWER_PATTERNS.join(", ")} for kind 'empower-piece'`,
        );
        return null;
      }
      const singleUse = raw.singleUse;
      if (singleUse !== undefined && typeof singleUse !== "boolean") {
        errors.push("'effect.singleUse' must be a boolean if present for kind 'empower-piece'");
        return null;
      }
      const dt = validateDurationTurns(raw.durationTurns, "empower-piece", errors);
      if (dt === null) return null;
      if (singleUse === true && typeof dt === "number") {
        errors.push(
          "'effect.singleUse' and 'effect.durationTurns' are mutually exclusive for 'empower-piece'",
        );
        return null;
      }
      const filter = raw.pieceTypeFilter;
      if (
        filter !== undefined &&
        (typeof filter !== "string" || !(VALID_PIECE_TYPES as readonly string[]).includes(filter))
      ) {
        errors.push(
          `'effect.pieceTypeFilter' must be one of ${VALID_PIECE_TYPES.join(", ")} if present for kind 'empower-piece'`,
        );
        return null;
      }
      const out: CardEffect & { kind: "empower-piece" } = {
        kind: "empower-piece",
        pattern: p as EmpowerPattern,
      };
      if (singleUse === true) out.singleUse = true;
      if (typeof dt === "number") out.durationTurns = dt;
      if (typeof filter === "string") out.pieceTypeFilter = filter as PieceType;
      return out;
    }
    case "lightning-piece": {
      if (!isPositiveInt(raw.actions)) {
        errors.push("'effect.actions' must be a positive integer for kind 'lightning-piece'");
        return null;
      }
      const filter = raw.pieceTypeFilter;
      if (
        filter !== undefined &&
        (typeof filter !== "string" || !(VALID_PIECE_TYPES as readonly string[]).includes(filter))
      ) {
        errors.push(
          `'effect.pieceTypeFilter' must be one of ${VALID_PIECE_TYPES.join(", ")} if present for kind 'lightning-piece'`,
        );
        return null;
      }
      const out: CardEffect & { kind: "lightning-piece" } = {
        kind: "lightning-piece",
        actions: raw.actions,
      };
      if (typeof filter === "string") out.pieceTypeFilter = filter as PieceType;
      return out;
    }
    case "place-wall": {
      if (!isPositiveInt(raw.durationTurns)) {
        errors.push("'effect.durationTurns' must be a positive integer for kind 'place-wall'");
        return null;
      }
      return { kind: "place-wall", durationTurns: raw.durationTurns };
    }
    case "place-sanctuary": {
      if (!isPositiveInt(raw.durationTurns)) {
        errors.push("'effect.durationTurns' must be a positive integer for kind 'place-sanctuary'");
        return null;
      }
      return { kind: "place-sanctuary", durationTurns: raw.durationTurns };
    }
    case "place-trap": {
      const fx = raw.trapEffect;
      if (typeof fx !== "string" || !(VALID_TRAP_EFFECTS as readonly string[]).includes(fx)) {
        errors.push(
          `'effect.trapEffect' must be one of ${VALID_TRAP_EFFECTS.join(", ")} for kind 'place-trap'`,
        );
        return null;
      }
      if (!isPositiveInt(raw.durationTurns)) {
        errors.push("'effect.durationTurns' must be a positive integer for kind 'place-trap'");
        return null;
      }
      return {
        kind: "place-trap",
        trapEffect: fx as TrapEffect,
        durationTurns: raw.durationTurns,
      };
    }
    case "place-zone-buff": {
      const pattern = raw.pattern;
      if (
        typeof pattern !== "string" ||
        !(VALID_ZONE_BUFF_PATTERNS as readonly string[]).includes(pattern)
      ) {
        errors.push(
          `'effect.pattern' must be one of ${VALID_ZONE_BUFF_PATTERNS.join(", ")} for kind 'place-zone-buff'`,
        );
        return null;
      }
      if (!isPositiveInt(raw.durationTurns)) {
        errors.push("'effect.durationTurns' must be a positive integer for kind 'place-zone-buff'");
        return null;
      }
      const buff = raw.buff;
      if (!isPlainObject(buff)) {
        errors.push("'effect.buff' must be an object for kind 'place-zone-buff'");
        return null;
      }
      const buffKind = buff.kind;
      if (
        typeof buffKind !== "string" ||
        !(VALID_ZONE_BUFF_EFFECT_KINDS as readonly string[]).includes(buffKind)
      ) {
        errors.push(
          `'effect.buff.kind' must be one of ${VALID_ZONE_BUFF_EFFECT_KINDS.join(", ")} for 'place-zone-buff'`,
        );
        return null;
      }
      if (typeof buff.amount !== "number" || !Number.isInteger(buff.amount) || buff.amount < 1) {
        errors.push("'effect.buff.amount' must be a positive integer for kind 'place-zone-buff'");
        return null;
      }
      const sourceLabel = raw.sourceLabel;
      if (typeof sourceLabel !== "string" || sourceLabel.length === 0) {
        errors.push("'effect.sourceLabel' must be a non-empty string for kind 'place-zone-buff'");
        return null;
      }
      return {
        kind: "place-zone-buff",
        pattern: pattern as "square-orthogonal-1" | "square-radius-1",
        buff: {
          kind: buffKind as "energy-per-turn" | "hand-size",
          amount: buff.amount,
        },
        durationTurns: raw.durationTurns,
        sourceLabel,
      };
    }
    case "swap-own-pieces":
      return { kind: "swap-own-pieces" };
    case "summon-piece": {
      const pt = raw.pieceType;
      if (typeof pt !== "string" || !(VALID_PIECE_TYPES as readonly string[]).includes(pt)) {
        errors.push(
          `'effect.pieceType' must be one of ${VALID_PIECE_TYPES.join(", ")} for kind 'summon-piece'`,
        );
        return null;
      }
      return { kind: "summon-piece", pieceType: pt as PieceType };
    }
    case "sacrifice-piece": {
      const drawCount = raw.drawCount;
      const energyGain = raw.energyGain;
      if (typeof drawCount !== "number" || !Number.isInteger(drawCount) || drawCount < 0) {
        errors.push("'effect.drawCount' must be a non-negative integer for kind 'sacrifice-piece'");
        return null;
      }
      if (typeof energyGain !== "number" || !Number.isInteger(energyGain) || energyGain < 0) {
        errors.push(
          "'effect.energyGain' must be a non-negative integer for kind 'sacrifice-piece'",
        );
        return null;
      }
      return { kind: "sacrifice-piece", drawCount, energyGain };
    }
    case "marionette":
      return { kind: "marionette" };
    case "swap-rooted-with-own":
      return { kind: "swap-rooted-with-own" };
    case "swap-with-enemy":
      return { kind: "swap-with-enemy" };
    case "swap-enemy-pieces":
      return { kind: "swap-enemy-pieces" };
    case "summon-adjacent": {
      const pt = raw.pieceType;
      if (
        typeof pt !== "string" ||
        !(VALID_SUMMON_ADJACENT_PIECE_TYPES as readonly string[]).includes(pt)
      ) {
        errors.push(
          `'effect.pieceType' must be one of ${VALID_SUMMON_ADJACENT_PIECE_TYPES.join(", ")} for kind 'summon-adjacent'`,
        );
        return null;
      }
      return {
        kind: "summon-adjacent",
        pieceType: pt as PieceType | "copy-of-source",
      };
    }
    case "sacrifice-blast-action": {
      const pattern = raw.pattern;
      if (
        typeof pattern !== "string" ||
        !(VALID_BLAST_PATTERNS as readonly string[]).includes(pattern)
      ) {
        errors.push(
          `'effect.pattern' must be one of ${VALID_BLAST_PATTERNS.join(", ")} for kind 'sacrifice-blast-action'`,
        );
        return null;
      }
      if (!isPositiveInt(raw.actions)) {
        errors.push(
          "'effect.actions' must be a positive integer for kind 'sacrifice-blast-action'",
        );
        return null;
      }
      return {
        kind: "sacrifice-blast-action",
        pattern: pattern as "king-step" | "king-step-and-knight",
        actions: raw.actions,
      };
    }
    case "mutex-lock": {
      if (!isPositiveInt(raw.durationTurns)) {
        errors.push("'effect.durationTurns' must be a positive integer for kind 'mutex-lock'");
        return null;
      }
      return { kind: "mutex-lock", durationTurns: raw.durationTurns };
    }
    case "garbage-collect": {
      if (typeof raw.recursive !== "boolean") {
        errors.push("'effect.recursive' must be a boolean for kind 'garbage-collect'");
        return null;
      }
      return { kind: "garbage-collect", recursive: raw.recursive };
    }
    case "destroy-piece": {
      const filter = raw.filter;
      if (
        typeof filter !== "string" ||
        !(VALID_DESTROY_FILTERS as readonly string[]).includes(filter)
      ) {
        errors.push(
          `'effect.filter' must be one of ${VALID_DESTROY_FILTERS.join(", ")} for 'destroy-piece'`,
        );
        return null;
      }
      return { kind: "destroy-piece", filter: filter as "any" | "attacked-by-player" };
    }
    case "add-card-to-draw": {
      const source = raw.source;
      if (
        typeof source !== "string" ||
        !(VALID_ADD_CARD_DRAW_SOURCES as readonly string[]).includes(source)
      ) {
        errors.push(
          `'effect.source' must be one of ${VALID_ADD_CARD_DRAW_SOURCES.join(", ")} for 'add-card-to-draw'`,
        );
        return null;
      }
      const cardId = raw.cardId;
      if (source === "card-id" && (typeof cardId !== "string" || cardId.length === 0)) {
        errors.push("'effect.cardId' must be a non-empty string when source is 'card-id'");
        return null;
      }
      const out: CardEffect & { kind: "add-card-to-draw" } = {
        kind: "add-card-to-draw",
        source: source as "self" | "card-id",
      };
      if (typeof cardId === "string" && cardId.length > 0) out.cardId = cardId;
      return out;
    }
    case "revive": {
      const sel = raw.selection;
      if (
        typeof sel !== "string" ||
        !(VALID_REVIVE_SELECTIONS as readonly string[]).includes(sel)
      ) {
        errors.push(
          `'effect.selection' must be one of ${VALID_REVIVE_SELECTIONS.join(", ")} for 'revive'`,
        );
        return null;
      }
      return { kind: "revive", selection: sel as "random" | "choose" };
    }
    case "next-move-constraint": {
      const c = raw.constraint;
      if (c !== "must-not-check") {
        errors.push("'effect.constraint' must be 'must-not-check' for kind 'next-move-constraint'");
        return null;
      }
      return { kind: "next-move-constraint", constraint: c };
    }
    case "pending-energy-loss-on-no-capture": {
      if (!isPositiveInt(raw.amount)) {
        errors.push(
          "'effect.amount' must be a positive integer for kind 'pending-energy-loss-on-no-capture'",
        );
        return null;
      }
      return { kind: "pending-energy-loss-on-no-capture", amount: raw.amount };
    }
    case "forbid-zero-cost-this-turn":
      return { kind: "forbid-zero-cost-this-turn" };
    case "boss-extra-move": {
      if (!isPositiveInt(raw.count)) {
        errors.push("'effect.count' must be a positive integer for kind 'boss-extra-move'");
        return null;
      }
      return { kind: "boss-extra-move", count: raw.count };
    }
    case "capture-random-own-minor":
      return { kind: "capture-random-own-minor" };
    case "undo-last-enemy-move":
      return { kind: "undo-last-enemy-move" };
    case "apply-retain-to-hand-card":
      return { kind: "apply-retain-to-hand-card" };
    case "pending-energy-next-turn": {
      if (!isPositiveInt(raw.amount)) {
        errors.push(
          "'effect.amount' must be a positive integer for kind 'pending-energy-next-turn'",
        );
        return null;
      }
      return { kind: "pending-energy-next-turn", amount: raw.amount };
    }
    case "play-power": {
      const inner = raw.effect;
      if (!isPlainObject(inner)) {
        errors.push("'effect.effect' must be an object for kind 'play-power'");
        return null;
      }
      const innerKind = inner.kind;
      if (
        typeof innerKind !== "string" ||
        !(VALID_POWER_KINDS as readonly string[]).includes(innerKind)
      ) {
        errors.push(
          `'effect.effect.kind' must be one of ${VALID_POWER_KINDS.join(", ")} for kind 'play-power'`,
        );
        return null;
      }
      if (typeof inner.amount !== "number" || !Number.isInteger(inner.amount) || inner.amount < 1) {
        errors.push("'effect.effect.amount' must be a positive integer for kind 'play-power'");
        return null;
      }
      if (innerKind === "root-half-entrants-per-turn") {
        const disarm = inner.disarm;
        if (disarm !== undefined && typeof disarm !== "boolean") {
          errors.push(
            "'effect.effect.disarm' must be a boolean if present for power kind 'root-half-entrants-per-turn'",
          );
          return null;
        }
        const pe: PowerEffect & { kind: "root-half-entrants-per-turn" } = {
          kind: "root-half-entrants-per-turn",
          amount: inner.amount,
        };
        if (disarm === true) pe.disarm = true;
        return { kind: "play-power", effect: pe };
      }
      return {
        kind: "play-power",
        effect: {
          kind: innerKind as
            | "energy-per-turn"
            | "draw-per-turn"
            | "extra-chess-move-per-turn"
            | "haste-pawns-per-turn"
            | "shield-back-rank-per-turn",
          amount: inner.amount,
        },
      };
    }
    case "sudo-piece":
      return { kind: "sudo-piece" };
    case "hot-swap": {
      const canCapture = raw.canCapture;
      if (canCapture !== undefined && typeof canCapture !== "boolean") {
        errors.push("'effect.canCapture' must be a boolean if present for kind 'hot-swap'");
        return null;
      }
      const out: CardEffect & { kind: "hot-swap" } = { kind: "hot-swap" };
      if (canCapture === true) out.canCapture = true;
      return out;
    }
    case "downgrade-piece": {
      if (!isPositiveInt(raw.durationTurns)) {
        errors.push("'effect.durationTurns' must be a positive integer for kind 'downgrade-piece'");
        return null;
      }
      return { kind: "downgrade-piece", durationTurns: raw.durationTurns };
    }
    case "convert-piece":
      return { kind: "convert-piece" };
    case "transform-piece-up":
      return { kind: "transform-piece-up" };
    case "sacrifice-detonate": {
      const drawCount = raw.drawCount;
      if (drawCount !== undefined && (!Number.isInteger(drawCount) || (drawCount as number) < 0)) {
        errors.push(
          "'effect.drawCount' must be a non-negative integer if present for kind 'sacrifice-detonate'",
        );
        return null;
      }
      const out: CardEffect & { kind: "sacrifice-detonate" } = { kind: "sacrifice-detonate" };
      if (typeof drawCount === "number") out.drawCount = drawCount;
      return out;
    }
    case "gain-energy-per-capture":
      return { kind: "gain-energy-per-capture" };
    case "place-backdoor": {
      const count = raw.count;
      if (count !== undefined && (!Number.isInteger(count) || (count as number) < 1)) {
        errors.push(
          "'effect.count' must be a positive integer if present for kind 'place-backdoor'",
        );
        return null;
      }
      const out: CardEffect & { kind: "place-backdoor" } = { kind: "place-backdoor" };
      if (typeof count === "number") out.count = count;
      return out;
    }
    case "teleport-piece":
      return { kind: "teleport-piece" };
    case "resurrect-piece":
      return { kind: "resurrect-piece" };
    case "insert-probe": {
      if (!isPositiveInt(raw.durationTurns)) {
        errors.push("'effect.durationTurns' must be a positive integer for kind 'insert-probe'");
        return null;
      }
      return { kind: "insert-probe", durationTurns: raw.durationTurns };
    }
    case "compound": {
      const children = raw.effects;
      if (!Array.isArray(children) || children.length === 0) {
        errors.push("'effect.effects' must be a non-empty array for 'compound'");
        return null;
      }
      const resolved: CardEffect[] = [];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!isPlainObject(child)) {
          errors.push(`'effect.effects[${i}]' must be an object`);
          return null;
        }
        if (child.kind === "compound") {
          errors.push("'compound' effects may not nest 'compound' children (one level only)");
          return null;
        }
        const ce = validateEffect(child, errors);
        if (!ce) return null;
        resolved.push(ce);
      }
      return { kind: "compound", effects: resolved };
    }
    default:
      errors.push(
        `'effect.kind' must be one of ${VALID_EFFECT_KINDS.join(", ")} (got ${JSON.stringify(kind)})`,
      );
      return null;
  }
}

// ---- Cross-field check (target ↔ effect) -----------------------------------

/**
 * Cross-field check: a card's effect.kind must agree with its target.kind.
 * The contract is "what the player must aim at to cast this effect" — it's
 * how the UI knows whether to ask for a square, an own piece, etc.
 */
function targetMatchesEffect(target: CardTarget, effect: CardEffect): string | null {
  const tk = target.kind;
  switch (effect.kind) {
    case "gain-energy":
    case "draw":
    case "scry":
      return tk === "none" ? null : `'${effect.kind}' effect requires target.kind 'none'`;
    case "freeze-piece":
    case "disarm-piece":
    case "compel-piece":
      return tk === "enemy-piece"
        ? null
        : `'${effect.kind}' effect requires target.kind 'enemy-piece'`;
    case "root-piece":
      return tk === "enemy-piece" || tk === "enemy-non-king-piece"
        ? null
        : "'root-piece' effect requires target.kind 'enemy-piece' or 'enemy-non-king-piece'";
    case "haste-piece":
    case "empower-piece":
    case "lightning-piece":
      return tk === "own-piece" ? null : `'${effect.kind}' effect requires target.kind 'own-piece'`;
    case "place-wall":
    case "place-trap":
      return tk === "empty-square"
        ? null
        : `'${effect.kind}' effect requires target.kind 'empty-square'`;
    case "place-sanctuary":
    case "place-zone-buff":
      // Buff overlays legitimately apply on top of an occupied square.
      return tk === "square" || tk === "empty-square"
        ? null
        : `'${effect.kind}' effect requires target.kind 'square' or 'empty-square'`;
    case "summon-piece":
      return tk === "empty-square" || tk === "empty-square-own-half"
        ? null
        : "'summon-piece' effect requires target.kind 'empty-square' or 'empty-square-own-half'";
    case "sacrifice-piece":
      return tk === "own-non-king-piece"
        ? null
        : "'sacrifice-piece' effect requires target.kind 'own-non-king-piece'";
    case "swap-own-pieces":
      return tk === "two-own-pieces"
        ? null
        : "'swap-own-pieces' effect requires target.kind 'two-own-pieces'";
    case "swap-rooted-with-own":
      return tk === "rooted-enemy-and-own-piece"
        ? null
        : "'swap-rooted-with-own' effect requires target.kind 'rooted-enemy-and-own-piece'";
    case "swap-with-enemy":
      return tk === "enemy-and-own-piece"
        ? null
        : "'swap-with-enemy' effect requires target.kind 'enemy-and-own-piece'";
    case "swap-enemy-pieces":
      return tk === "two-enemy-non-king-pieces"
        ? null
        : "'swap-enemy-pieces' effect requires target.kind 'two-enemy-non-king-pieces'";
    case "summon-adjacent":
      return tk === "own-piece-then-adjacent-empty"
        ? null
        : "'summon-adjacent' effect requires target.kind 'own-piece-then-adjacent-empty'";
    case "sacrifice-blast-action":
      return tk === "own-non-king-piece"
        ? null
        : "'sacrifice-blast-action' effect requires target.kind 'own-non-king-piece'";
    case "mutex-lock":
      return tk === "own-piece" ? null : "'mutex-lock' effect requires target.kind 'own-piece'";
    case "garbage-collect":
      return tk === "none" ? null : "'garbage-collect' effect requires target.kind 'none'";
    case "marionette":
      return tk === "marionette" ? null : "'marionette' effect requires target.kind 'marionette'";
    case "destroy-piece":
      return tk === "enemy-non-king-piece"
        ? null
        : "'destroy-piece' effect requires target.kind 'enemy-non-king-piece'";
    case "add-card-to-draw":
    case "revive":
    case "shield-piece":
      // These effects don't read the target — they're target-agnostic. They
      // can appear on any card, including compound parents whose primary
      // effect drives the target. shield-piece handles two-squares targets
      // (e.g. Git Revert+ applies Shield to the square where a piece was placed).
      return null;
    case "next-move-constraint":
      return tk === "none" ? null : "'next-move-constraint' effect requires target.kind 'none'";
    case "pending-energy-loss-on-no-capture":
    case "forbid-zero-cost-this-turn":
    case "boss-extra-move":
    case "capture-random-own-minor":
    case "pending-energy-next-turn":
    case "play-power":
    case "undo-last-enemy-move":
      return tk === "none" ? null : `'${effect.kind}' effect requires target.kind 'none'`;
    case "apply-retain-to-hand-card":
      return tk === "hand-card"
        ? null
        : "'apply-retain-to-hand-card' effect requires target.kind 'hand-card'";
    case "sudo-piece":
      return tk === "own-pawn" ? null : "'sudo-piece' effect requires target.kind 'own-pawn'";
    case "hot-swap":
      return tk === "own-non-king-piece"
        ? null
        : "'hot-swap' effect requires target.kind 'own-non-king-piece'";
    case "downgrade-piece":
      return tk === "enemy-non-king-piece"
        ? null
        : "'downgrade-piece' effect requires target.kind 'enemy-non-king-piece'";
    case "convert-piece":
      return tk === "enemy-minor-piece" || tk === "enemy-non-king-piece"
        ? null
        : "'convert-piece' effect requires target.kind 'enemy-minor-piece' or 'enemy-non-king-piece'";
    case "transform-piece-up":
      return tk === "own-non-king-piece"
        ? null
        : "'transform-piece-up' effect requires target.kind 'own-non-king-piece'";
    case "sacrifice-detonate":
      return tk === "own-non-king-piece"
        ? null
        : "'sacrifice-detonate' effect requires target.kind 'own-non-king-piece'";
    case "gain-energy-per-capture":
      return tk === "none" ? null : "'gain-energy-per-capture' effect requires target.kind 'none'";
    case "place-backdoor":
      return tk === "empty-square"
        ? null
        : "'place-backdoor' effect requires target.kind 'empty-square'";
    case "teleport-piece":
      return tk === "own-non-king-piece-then-empty-square"
        ? null
        : "'teleport-piece' effect requires target.kind 'own-non-king-piece-then-empty-square'";
    case "resurrect-piece":
      return tk === "captured-friendly-piece-then-empty-square-own-half"
        ? null
        : "'resurrect-piece' effect requires target.kind 'captured-friendly-piece-then-empty-square-own-half'";
    case "insert-probe":
      return tk === "none" ? null : "'insert-probe' effect requires target.kind 'none'";
    case "compound": {
      for (const child of effect.effects) {
        const m = targetMatchesEffect(target, child);
        if (m) return `compound: ${m}`;
      }
      return null;
    }
  }
}

// ---- Upgrade block validation ----------------------------------------------

/** Fields the author may set inside `upgrade`. Anything else is a typo. */
const VALID_UPGRADE_KEYS: ReadonlySet<string> = new Set([
  "cost",
  "rarity",
  "description",
  "consume",
  "retain",
  "target",
  "effect",
]);

/**
 * Validate the optional `upgrade` block on a card. Per-field rules mirror the
 * top-level card validation. Cross-checks (target ↔ effect) are NOT performed
 * here — they run on the fully-merged upgraded card in `library.ts` after
 * expansion, since either field may have been overridden.
 *
 * Returns `null` if the block was provided but invalid (errors pushed onto
 * `errors`); returns `undefined` if no `upgrade` was provided (acceptable —
 * the library-level check enforces presence on base cards).
 */
function validateUpgrade(
  raw: unknown,
  errors: string[],
): { delta: CardUpgradeDelta | null; absent: boolean } {
  if (raw === undefined) return { delta: null, absent: true };
  if (!isPlainObject(raw)) {
    errors.push("'upgrade' must be an object if present");
    return { delta: null, absent: false };
  }

  // Catch typos and reject the system-controlled fields up front.
  for (const key of Object.keys(raw)) {
    if (key === "id" || key === "name" || key === "archetype") {
      errors.push(
        `'upgrade.${key}' is system-controlled and cannot be overridden — drop this field`,
      );
      return { delta: null, absent: false };
    }
    if (!VALID_UPGRADE_KEYS.has(key)) {
      errors.push(
        `unknown 'upgrade.${key}' (allowed: ${Array.from(VALID_UPGRADE_KEYS).join(", ")})`,
      );
      return { delta: null, absent: false };
    }
  }

  const delta: CardUpgradeDelta = {};

  if (raw.cost !== undefined) {
    if (typeof raw.cost !== "number" || !(VALID_COSTS as readonly number[]).includes(raw.cost)) {
      errors.push(`'upgrade.cost' must be one of ${VALID_COSTS.join(", ")}`);
      return { delta: null, absent: false };
    }
    delta.cost = raw.cost as CardCost;
  }
  if (raw.rarity !== undefined) {
    if (
      typeof raw.rarity !== "string" ||
      !(VALID_RARITIES as readonly string[]).includes(raw.rarity)
    ) {
      errors.push(`'upgrade.rarity' must be one of ${VALID_RARITIES.join(", ")}`);
      return { delta: null, absent: false };
    }
    delta.rarity = raw.rarity as CardRarity;
  }
  if (raw.description !== undefined) {
    if (typeof raw.description !== "string" || raw.description.length === 0) {
      errors.push("'upgrade.description' must be a non-empty string");
      return { delta: null, absent: false };
    }
    delta.description = raw.description;
  }
  if (raw.consume !== undefined) {
    if (typeof raw.consume !== "boolean") {
      errors.push("'upgrade.consume' must be a boolean");
      return { delta: null, absent: false };
    }
    delta.consume = raw.consume;
  }
  if (raw.retain !== undefined) {
    if (typeof raw.retain !== "boolean") {
      errors.push("'upgrade.retain' must be a boolean");
      return { delta: null, absent: false };
    }
    delta.retain = raw.retain;
  }
  if (raw.target !== undefined) {
    const target = validateTarget(raw.target, errors);
    if (!target) return { delta: null, absent: false };
    delta.target = target;
  }
  if (raw.effect !== undefined) {
    const effect = validateEffect(raw.effect, errors);
    if (!effect) return { delta: null, absent: false };
    delta.effect = effect;
  }

  return { delta, absent: false };
}

// ---- Top-level card validation ---------------------------------------------

export function validateCard(raw: unknown): { card: Card | null; errors: string[] } {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    errors.push("file must contain a JSON object");
    return { card: null, errors };
  }

  if (typeof raw.id !== "string" || raw.id.length === 0) {
    errors.push("'id' must be a non-empty string");
  }
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    errors.push("'name' must be a non-empty string");
  }
  if (typeof raw.cost !== "number" || !(VALID_COSTS as readonly number[]).includes(raw.cost)) {
    errors.push(`'cost' must be one of ${VALID_COSTS.join(", ")}`);
  }
  if (
    typeof raw.rarity !== "string" ||
    !(VALID_RARITIES as readonly string[]).includes(raw.rarity)
  ) {
    errors.push(`'rarity' must be one of ${VALID_RARITIES.join(", ")}`);
  }
  if (
    typeof raw.archetype !== "string" ||
    !(VALID_ARCHETYPES as readonly string[]).includes(raw.archetype)
  ) {
    errors.push(`'archetype' must be one of ${VALID_ARCHETYPES.join(", ")}`);
  }
  if (raw.consume !== undefined && typeof raw.consume !== "boolean") {
    errors.push("'consume' must be a boolean if present");
  }
  if (raw.retain !== undefined && typeof raw.retain !== "boolean") {
    errors.push("'retain' must be a boolean if present");
  }
  if (typeof raw.description !== "string") {
    errors.push("'description' must be a string");
  }

  const target = validateTarget(raw.target, errors);
  const effect = validateEffect(raw.effect, errors);
  const upgradeResult = validateUpgrade(raw.upgrade, errors);

  if (errors.length > 0 || !target || !effect) {
    return { card: null, errors };
  }

  const mismatch = targetMatchesEffect(target, effect);
  if (mismatch) {
    errors.push(mismatch);
    return { card: null, errors };
  }

  const card: Card = {
    id: raw.id as CardId,
    name: raw.name as string,
    cost: raw.cost as CardCost,
    rarity: raw.rarity as CardRarity,
    archetype: raw.archetype as CardArchetype,
    description: raw.description as string,
    target,
    effect,
  };
  if (typeof raw.consume === "boolean") card.consume = raw.consume;
  if (typeof raw.retain === "boolean") card.retain = raw.retain;
  if (upgradeResult.delta) card.upgrade = upgradeResult.delta;

  return { card, errors: [] };
}
