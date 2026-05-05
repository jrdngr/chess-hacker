import {
  VALID_ADD_CARD_DRAW_SOURCES,
  VALID_ARCHETYPES,
  VALID_COSTS,
  VALID_DESTROY_FILTERS,
  VALID_EFFECT_KINDS,
  VALID_EMPOWER_PATTERNS,
  VALID_PIECE_TYPES,
  VALID_RARITIES,
  VALID_REVIVE_SELECTIONS,
  VALID_TARGET_KINDS,
  VALID_TRAP_EFFECTS,
  VALID_ZONE_BUFF_EFFECT_KINDS,
  VALID_ZONE_BUFF_PATTERNS,
} from "../game/cards/library";
import { VALID_ARTIFACT_EFFECT_KINDS, VALID_ARTIFACT_RARITIES } from "../game/artifacts/library";
import { VALID_BOSS_MODIFIER_KINDS, VALID_CURSE_TRIGGER_KINDS } from "../game/bosses/library";

export {
  VALID_ADD_CARD_DRAW_SOURCES,
  VALID_ARCHETYPES,
  VALID_ARTIFACT_EFFECT_KINDS,
  VALID_ARTIFACT_RARITIES,
  VALID_BOSS_MODIFIER_KINDS,
  VALID_COSTS,
  VALID_CURSE_TRIGGER_KINDS,
  VALID_DESTROY_FILTERS,
  VALID_EFFECT_KINDS,
  VALID_EMPOWER_PATTERNS,
  VALID_PIECE_TYPES,
  VALID_RARITIES,
  VALID_REVIVE_SELECTIONS,
  VALID_TARGET_KINDS,
  VALID_TRAP_EFFECTS,
  VALID_ZONE_BUFF_EFFECT_KINDS,
  VALID_ZONE_BUFF_PATTERNS,
};

export type FieldSpec =
  | { name: string; type: "number"; min?: number; optional?: boolean }
  | { name: string; type: "string"; optional?: boolean }
  | { name: string; type: "boolean"; optional?: boolean }
  | {
      name: string;
      type: "enum";
      enumValues: readonly string[];
      optional?: boolean;
    };

/**
 * Per-effect-kind payload schema. Drives the dynamic sub-form rendering.
 * Effects whose payload is a single primitive list here. Effects with
 * nested object payloads (`place-zone-buff`, `compound`) are rendered by
 * dedicated components in `CardEditor`.
 */
export const CARD_EFFECT_FIELDS: Record<string, FieldSpec[]> = {
  "gain-energy": [{ name: "amount", type: "number" }],
  draw: [{ name: "count", type: "number", min: 1 }],
  scry: [{ name: "count", type: "number", min: 1 }],
  "freeze-piece": [],
  "root-piece": [{ name: "durationTurns", type: "number", min: 1, optional: true }],
  "disarm-piece": [],
  "compel-piece": [],
  "shield-piece": [],
  "haste-piece": [],
  "empower-piece": [
    { name: "pattern", type: "enum", enumValues: VALID_EMPOWER_PATTERNS },
    { name: "singleUse", type: "boolean", optional: true },
  ],
  "lightning-piece": [{ name: "actions", type: "number", min: 1 }],
  "place-wall": [{ name: "durationTurns", type: "number", min: 1 }],
  "place-sanctuary": [{ name: "durationTurns", type: "number", min: 1 }],
  "place-trap": [
    { name: "trapEffect", type: "enum", enumValues: VALID_TRAP_EFFECTS },
    { name: "durationTurns", type: "number", min: 1 },
  ],
  // place-zone-buff: see special-case renderer
  "swap-own-pieces": [],
  "swap-rooted-with-own": [],
  "summon-piece": [{ name: "pieceType", type: "enum", enumValues: VALID_PIECE_TYPES }],
  "sacrifice-piece": [
    { name: "drawCount", type: "number", min: 0 },
    { name: "energyGain", type: "number", min: 0 },
  ],
  marionette: [],
  "destroy-piece": [{ name: "filter", type: "enum", enumValues: VALID_DESTROY_FILTERS }],
  "add-card-to-draw": [
    { name: "source", type: "enum", enumValues: VALID_ADD_CARD_DRAW_SOURCES },
    { name: "cardId", type: "string", optional: true },
  ],
  revive: [{ name: "selection", type: "enum", enumValues: VALID_REVIVE_SELECTIONS }],
  "next-move-constraint": [{ name: "constraint", type: "enum", enumValues: ["must-not-check"] }],
  "pending-energy-loss-on-no-capture": [{ name: "amount", type: "number", min: 1 }],
  "forbid-zero-cost-this-turn": [],
  "boss-extra-move": [{ name: "count", type: "number", min: 1 }],
  "capture-random-own-minor": [],
  "apply-retain-to-hand-card": [],
  // compound: see special-case renderer
};

/** Per-artifact-effect payload schema. */
export const ARTIFACT_EFFECT_FIELDS: Record<string, FieldSpec[]> = {
  "hand-size-bonus": [{ name: "amount", type: "number" }],
  "start-energy-bonus": [{ name: "amount", type: "number" }],
  "energy-per-turn-bonus": [{ name: "amount", type: "number" }],
  "card-cost-discount": [
    { name: "amount", type: "number", min: 1 },
    { name: "archetype", type: "enum", enumValues: VALID_ARCHETYPES, optional: true },
  ],
  "gold-on-match-start": [{ name: "amount", type: "number" }],
  "draw-on-capture": [{ name: "count", type: "number", min: 1 }],
  "energy-on-capture": [{ name: "amount", type: "number" }],
  "draw-on-check": [{ name: "count", type: "number", min: 1 }],
  // zone-buff: special-case renderer
};

/**
 * For known effect kinds, return the canonical default payload (used when
 * the user switches kinds in the dropdown). For unknown kinds (introduced
 * via "+ Add new value…"), returns null and the caller carries an empty
 * payload that the user fills in via the new payload-field editors.
 */
export function defaultCardEffectPayload(kind: string): Record<string, unknown> | null {
  const fields = CARD_EFFECT_FIELDS[kind];
  if (kind === "place-zone-buff") {
    return {
      pattern: "square-orthogonal-1",
      durationTurns: 3,
      buff: { kind: "energy-per-turn", amount: 1 },
      sourceLabel: "",
    };
  }
  if (kind === "compound") {
    return { effects: [] };
  }
  if (!fields) return null;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.optional) continue;
    if (f.type === "number") out[f.name] = f.min ?? 0;
    else if (f.type === "string") out[f.name] = "";
    else if (f.type === "boolean") out[f.name] = false;
    else if (f.type === "enum") out[f.name] = f.enumValues[0];
  }
  return out;
}

export function defaultArtifactEffectPayload(kind: string): Record<string, unknown> | null {
  if (kind === "zone-buff") {
    return {
      region: { kind: "rank", rank: 4 },
      buff: { kind: "hand-size", amount: 1 },
      sourceLabel: "",
    };
  }
  const fields = ARTIFACT_EFFECT_FIELDS[kind];
  if (!fields) return null;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.optional) continue;
    if (f.type === "number") out[f.name] = f.min ?? 0;
    else if (f.type === "string") out[f.name] = "";
    else if (f.type === "boolean") out[f.name] = false;
    else if (f.type === "enum") out[f.name] = f.enumValues[0];
  }
  return out;
}
