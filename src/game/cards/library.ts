// Card library, loaded from JSON.
//
// Card definitions are the source of truth in `./data/*.json` (one file per
// card). Decks compose those cards by id from `./decks/*.json`. This module
// loads every JSON at startup, validates it, and exposes the typed result.
//
// Adding a card: drop a new file in `./data/`. Adding it to the starter deck:
// edit `./decks/starter.json`. No code changes required.

import type {
  Card,
  CardArchetype,
  CardCost,
  CardEffect,
  CardId,
  CardRarity,
  CardTarget,
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
];
const VALID_COSTS: readonly CardCost[] = [0, 1, 2, 3, 4];
const VALID_TARGET_KINDS = ["none", "empty-square", "enemy-piece"] as const;
const VALID_EFFECT_KINDS = ["gain-energy", "draw", "freeze-piece", "place-wall"] as const;

type DeckJson = {
  name?: unknown;
  description?: unknown;
  cards?: unknown;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
      if (typeof raw.count !== "number" || !Number.isInteger(raw.count) || raw.count < 1) {
        errors.push("'effect.count' must be a positive integer for kind 'draw'");
        return null;
      }
      return { kind: "draw", count: raw.count };
    }
    case "freeze-piece":
      return { kind: "freeze-piece" };
    case "place-wall": {
      if (
        typeof raw.durationTurns !== "number" ||
        !Number.isInteger(raw.durationTurns) ||
        raw.durationTurns < 1
      ) {
        errors.push("'effect.durationTurns' must be a positive integer for kind 'place-wall'");
        return null;
      }
      return { kind: "place-wall", durationTurns: raw.durationTurns };
    }
    default:
      errors.push(`'effect.kind' must be one of ${VALID_EFFECT_KINDS.join(", ")} (got ${JSON.stringify(kind)})`);
      return null;
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
  if (typeof raw.rarity !== "string" || !(VALID_RARITIES as readonly string[]).includes(raw.rarity)) {
    errors.push(`'rarity' must be one of ${VALID_RARITIES.join(", ")}`);
  }
  if (
    typeof raw.archetype !== "string" ||
    !(VALID_ARCHETYPES as readonly string[]).includes(raw.archetype)
  ) {
    errors.push(`'archetype' must be one of ${VALID_ARCHETYPES.join(", ")}`);
  }
  if (typeof raw.consume !== "boolean") {
    errors.push("'consume' must be a boolean");
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

  const card: Card = {
    id: raw.id as CardId,
    name: raw.name as string,
    cost: raw.cost as CardCost,
    rarity: raw.rarity as CardRarity,
    archetype: raw.archetype as CardArchetype,
    consume: raw.consume as boolean,
    description: raw.description as string,
    target,
    effect,
  };
  if (typeof raw.curse === "boolean") card.curse = raw.curse;

  // Cross-field check: target kind must agree with effect kind.
  if (effect.kind === "freeze-piece" && target.kind !== "enemy-piece") {
    errors.push("'freeze-piece' effect requires target.kind 'enemy-piece'");
  }
  if (effect.kind === "place-wall" && target.kind !== "empty-square") {
    errors.push("'place-wall' effect requires target.kind 'empty-square'");
  }
  if (
    (effect.kind === "gain-energy" || effect.kind === "draw") &&
    target.kind !== "none"
  ) {
    errors.push(`'${effect.kind}' effect requires target.kind 'none'`);
  }

  if (errors.length > 0) return { card: null, errors };

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

export const SURGE: Card = pick("surge");
export const RECONNAISSANCE: Card = pick("reconnaissance");
export const FROSTBITE: Card = pick("frostbite");
export const BARRICADE: Card = pick("barricade");

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
    throw new Error(
      `Failed to load deck '${source}':\n  - ${errors.join("\n  - ")}`,
    );
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
