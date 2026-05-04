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

const VALID_RARITIES: readonly CardRarity[] = ["common", "uncommon", "rare"];
const VALID_ARCHETYPES: readonly CardArchetype[] = [
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
const VALID_COSTS: readonly CardCost[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const VALID_TARGET_KINDS = [
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
] as const;
const VALID_EFFECT_KINDS = [
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
  "swap-own-pieces",
  "swap-rooted-with-own",
  "summon-piece",
  "sacrifice-piece",
  "marionette",
  "destroy-piece",
  "add-card-to-hand",
  "add-card-to-draw",
  "revive",
  "compound",
] as const;
const VALID_DESTROY_FILTERS = ["any", "attacked-by-player"] as const;
const VALID_ADD_CARD_HAND_SOURCES = ["random-common", "card-id", "shiv-pool"] as const;
const VALID_ADD_CARD_DRAW_SOURCES = ["self", "card-id"] as const;
const VALID_REVIVE_SELECTIONS = ["random", "choose"] as const;
const VALID_TRAP_EFFECTS: readonly TrapEffect[] = ["capture", "freeze", "push"];
const VALID_EMPOWER_PATTERNS: readonly EmpowerPattern[] = [
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
];
const VALID_PIECE_TYPES: readonly PieceType[] = [
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
    case "add-card-to-hand": {
      const source = raw.source;
      if (
        typeof source !== "string" ||
        !(VALID_ADD_CARD_HAND_SOURCES as readonly string[]).includes(source)
      ) {
        errors.push(
          `'effect.source' must be one of ${VALID_ADD_CARD_HAND_SOURCES.join(", ")} for 'add-card-to-hand'`,
        );
        return null;
      }
      const cardId = raw.cardId;
      if (source === "card-id" && (typeof cardId !== "string" || cardId.length === 0)) {
        errors.push("'effect.cardId' must be a non-empty string when source is 'card-id'");
        return null;
      }
      const count = raw.count;
      if (
        count !== undefined &&
        (typeof count !== "number" || !Number.isInteger(count) || count < 1)
      ) {
        errors.push("'effect.count' must be a positive integer if present for 'add-card-to-hand'");
        return null;
      }
      const out: CardEffect & { kind: "add-card-to-hand" } = {
        kind: "add-card-to-hand",
        source: source as "random-common" | "card-id" | "shiv-pool",
      };
      if (typeof cardId === "string" && cardId.length > 0) out.cardId = cardId;
      if (typeof count === "number") out.count = count;
      return out;
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
    case "add-card-to-hand":
    case "add-card-to-draw":
    case "revive":
      // These effects don't read the target — they're target-agnostic. They
      // can appear on any card, including compound parents whose primary
      // effect drives the target.
      return null;
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
  if (raw.consume !== undefined) {
    errors.push(
      "'consume' is no longer a valid field — every played card consumes (see docs/design/cards.md). Remove it.",
    );
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

/** All cards in the library matching `rarity`. Used for `random-common`. */
export function getCardsByRarity(rarity: CardRarity): Card[] {
  return Object.values(CARD_LIBRARY).filter((c) => c.rarity === rarity);
}

/**
 * The "shiv pool" — small filler cards that enter play only via Trick Bag.
 * Filtered by id-prefix `shiv-` so the pool stays data-driven.
 */
export function getShivPool(): Card[] {
  return Object.values(CARD_LIBRARY).filter((c) => c.id.startsWith("shiv-"));
}

export const RECONNAISSANCE: Card = pick("reconnaissance");
export const FORESIGHT: Card = pick("foresight");
export const FROSTBITE: Card = pick("frostbite");
export const TANGLED_ROOTS: Card = pick("tangled-roots");
export const FUMBLE: Card = pick("fumble");
export const PROVOKE: Card = pick("provoke");
export const BARRICADE: Card = pick("barricade");
export const HALLOWED_GROUND: Card = pick("hallowed-ground");
export const SPIKE_PIT: Card = pick("spike-pit");
export const SNARE: Card = pick("snare");
export const SPRING_TRAP: Card = pick("spring-trap");
export const QUICKSTEP: Card = pick("quickstep");
export const IRON_GUARD: Card = pick("iron-guard");
export const MARTYRS_GIFT: Card = pick("martyrs-gift");
export const KNIGHT_SOUL: Card = pick("knight-soul");
export const SWITCH_FILES: Card = pick("switch-files");
export const MARIONETTE: Card = pick("marionette");

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
