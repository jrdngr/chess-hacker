// Card library, loaded from JSON.
//
// Card definitions are the source of truth in `./data/*.json` (one file per
// card). Decks compose those cards by id from `./decks/*.json`. This module
// loads every JSON at startup, validates it (via `cardValidator.ts`), and
// exposes the typed result.
//
// Adding a card: drop a new file in `./data/`. Adding it to the starter deck:
// edit `./decks/starter.json`. No code changes required.
//
// The validator's canonical lists of acceptable archetype, target, and effect
// kinds live in `cardValidator.ts`. Adding a new effect or target kind is a
// two-step change: extend the union type in `../types.ts`, then extend the
// validator there.

import type { Card, CardId, CardRarity } from "../types";

import { isPlainObject, validateCard } from "./cardValidator";
import starterDeckJson from "./decks/starter.json";

// Re-export the validation enums so call sites that previously imported them
// from `library.ts` (e.g. `src/designer/schemas.ts`) continue to work.
export {
  VALID_ADD_CARD_DRAW_SOURCES,
  VALID_ARCHETYPES,
  VALID_COSTS,
  VALID_DESTROY_FILTERS,
  VALID_EFFECT_KINDS,
  VALID_EMPOWER_PATTERNS,
  VALID_PIECE_TYPES,
  VALID_POWER_KINDS,
  VALID_RARITIES,
  VALID_REVIVE_SELECTIONS,
  VALID_TARGET_KINDS,
  VALID_TRAP_EFFECTS,
  VALID_ZONE_BUFF_EFFECT_KINDS,
  VALID_ZONE_BUFF_PATTERNS,
} from "./cardValidator";

type DeckJson = {
  name?: unknown;
  description?: unknown;
  artifactId?: unknown;
  cards?: unknown;
};

function basenameNoExt(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.json$/, "");
}

/** Suffix appended to a base card's id/name when its upgraded variant is registered. */
export const UPGRADE_SUFFIX = "+";

function loadCardLibrary(): Record<CardId, Card> {
  const modules = import.meta.glob<unknown>("./data/*.json", {
    eager: true,
    import: "default",
  });

  const library: Record<CardId, Card> = {};
  const allErrors: string[] = [];

  // ---- Pass 1: load + validate base cards from JSON files ------------------

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
    if (card.id.endsWith(UPGRADE_SUFFIX)) {
      allErrors.push(
        `${path}: card id '${card.id}' must not end in '${UPGRADE_SUFFIX}' — that suffix is reserved for auto-generated upgraded variants.`,
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

  // ---- Pass 2: every base card must define an `upgrade` block --------------

  const missingUpgrades: CardId[] = [];
  for (const card of Object.values(library)) {
    if (!card.upgrade) missingUpgrades.push(card.id);
  }
  if (missingUpgrades.length > 0) {
    throw new Error(
      `Card library: ${missingUpgrades.length} card(s) missing required 'upgrade' block:\n  - ${missingUpgrades.join("\n  - ")}\n\nEvery base card must define an inline upgrade delta (see docs/design/cards.md).`,
    );
  }

  // ---- Pass 3: expand each base into an upgraded variant -------------------

  const expansionErrors: string[] = [];
  for (const base of Object.values(library)) {
    const upgradedId = base.id + UPGRADE_SUFFIX;
    if (library[upgradedId]) {
      expansionErrors.push(
        `upgrade for '${base.id}': '${upgradedId}' is already registered (was the same id loaded from a JSON file?).`,
      );
      continue;
    }
    const { card: upgraded, errors } = validateCard(buildUpgradedRaw(base));
    if (errors.length > 0) {
      expansionErrors.push(`upgrade for '${base.id}':\n  - ${errors.join("\n  - ")}`);
      continue;
    }
    if (upgraded) library[upgradedId] = upgraded;
  }
  if (expansionErrors.length > 0) {
    throw new Error(`Failed to expand card upgrades:\n\n${expansionErrors.join("\n\n")}`);
  }

  return library;
}

/**
 * Synthesize the raw-JSON shape for an upgraded variant from a base card.
 * Used by the library's pass-3 expansion: feed this into `validateCard` so
 * the upgraded card runs through the same per-field and cross-field
 * (`target ↔ effect`) checks as a base card. The upgraded variant has no
 * further `upgrade` field — single-tier only.
 */
function buildUpgradedRaw(base: Card): Record<string, unknown> {
  const u = base.upgrade ?? {};
  const raw: Record<string, unknown> = {
    id: base.id + UPGRADE_SUFFIX,
    name: base.name + UPGRADE_SUFFIX,
    cost: u.cost ?? base.cost,
    rarity: u.rarity ?? base.rarity,
    archetype: base.archetype,
    description: u.description ?? base.description,
    target: u.target ?? base.target,
    effect: u.effect ?? base.effect,
  };
  // Tristate keyword inheritance: upgrade may set to false to remove the
  // keyword, or omit to inherit.
  const consume = u.consume !== undefined ? u.consume : base.consume;
  const retain = u.retain !== undefined ? u.retain : base.retain;
  if (typeof consume === "boolean") raw.consume = consume;
  if (typeof retain === "boolean") raw.retain = retain;
  return raw;
}

export const CARD_LIBRARY: Record<CardId, Card> = loadCardLibrary();

/**
 * Return the upgraded variant of a base card, or `null` if `card` is already
 * upgraded. Looks up `<card.id>+` in the library — every base card has a
 * registered upgrade, so a non-null return value is guaranteed for any
 * library card whose id does not already end in `+`.
 */
export function getUpgradedCard(card: Card): Card | null {
  if (isUpgraded(card)) return null;
  return CARD_LIBRARY[card.id + UPGRADE_SUFFIX] ?? null;
}

/** True iff `card.id` ends in the upgrade suffix (`+`). */
export function isUpgraded(card: Card): boolean {
  return card.id.endsWith(UPGRADE_SUFFIX);
}

/**
 * Library cards that are NOT upgraded variants. Use this anywhere shop offers,
 * booster packs, drafts, or other "random card from the pool" generators draw
 * from CARD_LIBRARY — upgraded variants are obtained only through the Smith
 * service, never offered directly.
 */
export function baseLibraryCards(): Card[] {
  return Object.values(CARD_LIBRARY).filter((c) => !isUpgraded(c));
}

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

/**
 * All BASE cards in the library matching `rarity`. Upgraded variants (`<id>+`)
 * are filtered out — they are only obtainable through the shop Smith service,
 * never offered in drafts, packs, or other random pools.
 */
export function getCardsByRarity(rarity: CardRarity): Card[] {
  return baseLibraryCards().filter((c) => c.rarity === rarity);
}

/**
 * Group library cards by archetype, sort each group by (cost, name), and
 * sort the archetype list alphabetically. Used by the dev-panel Library and
 * Deck-editor overlays.
 */
export function groupCardsByArchetype(): Array<[string, Card[]]> {
  const groups = new Map<string, Card[]>();
  for (const card of Object.values(CARD_LIBRARY)) {
    const list = groups.get(card.archetype);
    if (list) list.push(card);
    else groups.set(card.archetype, [card]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
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

export type NamedDeck = {
  name: string;
  description?: string;
  cards: Card[];
  /** Optional id of an artifact to bundle with this deck (e.g. on the
   *  pre-game deck-select screen). The id is not validated against the
   *  artifact library here to keep this module's import graph small —
   *  callers that care should look it up via `ARTIFACT_LIBRARY`. */
  artifactId?: string;
};

export function getNamedDecks(): NamedDeck[] {
  const out: NamedDeck[] = [];
  const paths = Object.keys(NAMED_DECK_MODULES).sort();
  for (const path of paths) {
    const raw = NAMED_DECK_MODULES[path];
    try {
      const cards = expandDeck(path, raw as DeckJson, CARD_LIBRARY);
      const json = raw as DeckJson;
      const name =
        typeof json.name === "string" && (json.name as string).length > 0
          ? (json.name as string)
          : basenameNoExt(path);
      const description =
        typeof json.description === "string" && (json.description as string).length > 0
          ? (json.description as string)
          : undefined;
      const artifactId =
        typeof json.artifactId === "string" && (json.artifactId as string).length > 0
          ? (json.artifactId as string)
          : undefined;
      out.push({ name, description, cards, artifactId });
    } catch (err) {
      // Don't crash the game on a malformed named deck; surface a console
      // warning instead. The deck simply won't appear in the dev panel.
      // eslint-disable-next-line no-console
      console.warn(`Skipping named deck '${path}': ${err instanceof Error ? err.message : err}`);
    }
  }
  return out;
}
