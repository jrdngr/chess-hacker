// Card library, loaded from JSON.
//
// Card definitions are the source of truth in `./data/*.json` (one file per
// card). Decks compose those cards by id from `./decks/*.json`. This module
// loads every JSON at startup, validates it, and exposes the typed result.
//
// Adding a card: drop a new file in `./data/`. Adding it to the starter deck:
// edit `./decks/starter.json`. No code changes required.
//
// The validator below is the canonical list of acceptable archetype, target,
// and effect kinds for the prototype. Adding a new effect or target kind is a
// two-step change: extend the union type in `../types.ts`, then extend the
// validator here.

import type {
  Card,
  CardArchetype,
  CardCost,
  CardEffect,
  CardId,
  CardRarity,
  CardTarget,
  EmpowerPattern,
  PieceType,
  TrapEffect,
} from "../types";

import starterDeckJson from "./decks/starter.json";

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
];
export const VALID_COSTS: readonly CardCost[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const VALID_TARGET_KINDS = [
  "none",
  "empty-square",
  "empty-square-own-half",
  "enemy-piece",
  "enemy-non-king-piece",
  "own-piece",
  "own-non-king-piece",
  "two-own-pieces",
  "marionette",
  "rooted-enemy-and-own-piece",
  "hand-card",
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
  "summon-piece",
  "sacrifice-piece",
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
  "compound",
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
];
export const VALID_PIECE_TYPES: readonly PieceType[] = [
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
  "king",
];

type DeckJson = {
  name?: unknown;
  description?: unknown;
  cards?: unknown;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}

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
    case "freeze-piece":
      return { kind: "freeze-piece" };
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
    case "disarm-piece":
      return { kind: "disarm-piece" };
    case "compel-piece":
      return { kind: "compel-piece" };
    case "shield-piece":
      return { kind: "shield-piece" };
    case "haste-piece":
      return { kind: "haste-piece" };
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
      const out: CardEffect & { kind: "empower-piece" } = {
        kind: "empower-piece",
        pattern: p as EmpowerPattern,
      };
      if (singleUse === true) out.singleUse = true;
      return out;
    }
    case "lightning-piece": {
      if (!isPositiveInt(raw.actions)) {
        errors.push("'effect.actions' must be a positive integer for kind 'lightning-piece'");
        return null;
      }
      return { kind: "lightning-piece", actions: raw.actions };
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
    case "apply-retain-to-hand-card":
      return { kind: "apply-retain-to-hand-card" };
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
    case "shield-piece":
    case "haste-piece":
    case "empower-piece":
    case "lightning-piece":
      return tk === "own-piece" ? null : `'${effect.kind}' effect requires target.kind 'own-piece'`;
    case "place-wall":
    case "place-sanctuary":
    case "place-trap":
    case "place-zone-buff":
      return tk === "empty-square"
        ? null
        : `'${effect.kind}' effect requires target.kind 'empty-square'`;
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
    case "marionette":
      return tk === "marionette" ? null : "'marionette' effect requires target.kind 'marionette'";
    case "destroy-piece":
      return tk === "enemy-non-king-piece"
        ? null
        : "'destroy-piece' effect requires target.kind 'enemy-non-king-piece'";
    case "add-card-to-draw":
    case "revive":
      // These effects don't read the target — they're target-agnostic. They
      // can appear on any card, including compound parents whose primary
      // effect drives the target.
      return null;
    case "next-move-constraint":
      return tk === "none" ? null : "'next-move-constraint' effect requires target.kind 'none'";
    case "pending-energy-loss-on-no-capture":
    case "forbid-zero-cost-this-turn":
    case "boss-extra-move":
    case "capture-random-own-minor":
      return tk === "none" ? null : `'${effect.kind}' effect requires target.kind 'none'`;
    case "apply-retain-to-hand-card":
      return tk === "hand-card"
        ? null
        : "'apply-retain-to-hand-card' effect requires target.kind 'hand-card'";
    case "compound": {
      for (const child of effect.effects) {
        const m = targetMatchesEffect(target, child);
        if (m) return `compound: ${m}`;
      }
      return null;
    }
  }
}

function validateCard(raw: unknown): { card: Card | null; errors: string[] } {
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
  if (raw.curse !== undefined && typeof raw.curse !== "boolean") {
    errors.push("'curse' must be a boolean if present");
  }
  if (typeof raw.description !== "string") {
    errors.push("'description' must be a string");
  }

  const target = validateTarget(raw.target, errors);
  const effect = validateEffect(raw.effect, errors);

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
  if (typeof raw.curse === "boolean") card.curse = raw.curse;
  if (typeof raw.consume === "boolean") card.consume = raw.consume;
  if (typeof raw.retain === "boolean") card.retain = raw.retain;

  return { card, errors: [] };
}

function basenameNoExt(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.json$/, "");
}

function loadCardLibrary(): Record<CardId, Card> {
  const modules = import.meta.glob<unknown>("./data/*.json", {
    eager: true,
    import: "default",
  });

  const library: Record<CardId, Card> = {};
  const allErrors: string[] = [];

  for (const [path, raw] of Object.entries(modules)) {
    const { card, errors } = validateCard(raw);
    if (errors.length > 0) {
      allErrors.push(`${path}:\n  - ${errors.join("\n  - ")}`);
      continue;
    }
    if (!card) continue;

    const expectedId = basenameNoExt(path);
    if (card.id !== expectedId) {
      allErrors.push(
        `${path}: filename '${expectedId}.json' does not match card id '${card.id}'. Rename the file or the id so they agree.`,
      );
      continue;
    }

    if (library[card.id]) {
      allErrors.push(`${path}: duplicate card id '${card.id}'`);
      continue;
    }

    library[card.id] = card;
  }

  if (allErrors.length > 0) {
    throw new Error(
      `Failed to load card library — fix the following ${allErrors.length === 1 ? "issue" : "issues"} in src/game/cards/data/:\n\n${allErrors.join("\n\n")}`,
    );
  }

  return library;
}

export const CARD_LIBRARY: Record<CardId, Card> = loadCardLibrary();

// Convenience named exports for tests and call-sites that want a specific card
// by name. These are checked at module load: if a card disappears from the
// JSON, this throws with a clear message instead of leaving an undefined hole.
function pick(id: CardId): Card {
  const card = CARD_LIBRARY[id];
  if (!card) {
    throw new Error(
      `Card '${id}' is referenced from library.ts but no such card exists in src/game/cards/data/. Add ${id}.json or update the reference.`,
    );
  }
  return card;
}

/**
 * Look up a card definition by id. Throws if no such card is in the library.
 * Use this in resolvers / runtime callers that pass a string id from data.
 */
export function getCardById(id: CardId): Card {
  const card = CARD_LIBRARY[id];
  if (!card) {
    throw new Error(
      `Unknown card id '${id}' — not found in src/game/cards/data/. Either fix the reference or add ${id}.json.`,
    );
  }
  return card;
}

/** All cards in the library matching `rarity`. */
export function getCardsByRarity(rarity: CardRarity): Card[] {
  return Object.values(CARD_LIBRARY).filter((c) => c.rarity === rarity);
}

export const PORT_SCAN: Card = pick("port-scan");
export const STACK_TRACE: Card = pick("stack-trace");
export const FREEZE_PROCESS: Card = pick("freeze-process");
export const CHROOT: Card = pick("chroot");
export const READ_ONLY: Card = pick("read-only");
export const PHISHING: Card = pick("phishing");
export const FIREWALL: Card = pick("firewall");
export const TRUSTED_ZONE: Card = pick("trusted-zone");
export const LOGIC_BOMB: Card = pick("logic-bomb");
export const HONEYPOT: Card = pick("honeypot");
export const CONNECTION_RESET: Card = pick("connection-reset");
export const OVERCLOCK: Card = pick("overclock");
export const ENCRYPTED: Card = pick("encrypted");
export const KILL_9: Card = pick("kill-9");
export const KNIGHT_PATCH: Card = pick("knight-patch");
export const SWITCH_FILES: Card = pick("switch-files");
export const REMOTE_ACCESS: Card = pick("remote-access");

// ---- Decks ------------------------------------------------------------------

function expandDeck(source: string, json: DeckJson, library: Record<CardId, Card>): Card[] {
  const errors: string[] = [];
  if (typeof json.name !== "string" || json.name.length === 0) {
    errors.push("'name' must be a non-empty string");
  }
  if (!Array.isArray(json.cards)) {
    errors.push("'cards' must be an array");
  }

  const out: Card[] = [];
  if (Array.isArray(json.cards)) {
    json.cards.forEach((entry, i) => {
      if (!isPlainObject(entry)) {
        errors.push(`cards[${i}] must be an object with 'id' and 'count'`);
        return;
      }
      const id = entry.id;
      const count = entry.count;
      if (typeof id !== "string" || id.length === 0) {
        errors.push(`cards[${i}].id must be a non-empty string`);
        return;
      }
      if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
        errors.push(`cards[${i}].count must be a positive integer (card '${id}')`);
        return;
      }
      const card = library[id];
      if (!card) {
        errors.push(
          `cards[${i}] references unknown card id '${id}'. Add src/game/cards/data/${id}.json or fix the deck entry.`,
        );
        return;
      }
      for (let n = 0; n < count; n++) out.push(card);
    });
  }

  if (errors.length > 0) {
    throw new Error(`Failed to load deck '${source}':\n  - ${errors.join("\n  - ")}`);
  }
  return out;
}

const STARTER_DECK: ReadonlyArray<Card> = expandDeck(
  "src/game/cards/decks/starter.json",
  starterDeckJson as DeckJson,
  CARD_LIBRARY,
);

export function makeStarterDeck(): Card[] {
  return STARTER_DECK.slice();
}

// ---- Named decks (Content Designer) ----------------------------------------
//
// The Content Designer's Vite middleware writes named decks to
// `./decks/named/*.json`. The game picks them up via `import.meta.glob`,
// which Vite re-evaluates on file changes (HMR), so newly authored decks
// appear in the dev panel without a manual page reload.

const NAMED_DECK_MODULES = import.meta.glob<unknown>("./decks/named/*.json", {
  eager: true,
  import: "default",
});

export type NamedDeck = { name: string; cards: Card[] };

export function getNamedDecks(): NamedDeck[] {
  const out: NamedDeck[] = [];
  const paths = Object.keys(NAMED_DECK_MODULES).sort();
  for (const path of paths) {
    const raw = NAMED_DECK_MODULES[path];
    try {
      const cards = expandDeck(path, raw as DeckJson, CARD_LIBRARY);
      const name =
        typeof (raw as DeckJson).name === "string" && ((raw as DeckJson).name as string).length > 0
          ? ((raw as DeckJson).name as string)
          : basenameNoExt(path);
      out.push({ name, cards });
    } catch (err) {
      // Don't crash the game on a malformed named deck; surface a console
      // warning instead. The deck simply won't appear in the dev panel.
      // eslint-disable-next-line no-console
      console.warn(`Skipping named deck '${path}': ${err instanceof Error ? err.message : err}`);
    }
  }
  return out;
}
