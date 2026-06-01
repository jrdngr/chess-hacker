// Artifact library, loaded from JSON.
//
// Artifact definitions are the source of truth in `./data/*.json` (one file
// per artifact). This module loads every JSON at startup, validates it, and
// exposes the typed result. See docs/design/artifacts.md for the design
// intent and rarity targets.
//
// Adding an artifact: drop a new file in `./data/`. No code changes required.
//
// The validator below is the canonical list of acceptable rarity, archetype
// (for cost discounts), and effect kinds. Adding a new effect kind is a
// two-step change: extend the union in `../types.ts`, then extend the
// validator here.

import type {
  Artifact,
  ArtifactEffect,
  ArtifactRarity,
  CardArchetype,
  EmpowerPattern,
  PieceRuleModifier,
  PieceType,
  ZoneBuffEffect,
  ZoneRegion,
} from "../types";
import { pickRandomByRarity } from "../progression/rarity";

export const VALID_ARTIFACT_RARITIES: readonly ArtifactRarity[] = ["common", "uncommon", "rare"];

export const VALID_ARTIFACT_EFFECT_KINDS = [
  "hand-size-bonus",
  "start-energy-bonus",
  "energy-per-turn-bonus",
  "card-cost-discount",
  "card-cost-percentage-discount",
  "gold-on-match-start",
  "draw-on-capture",
  "energy-on-capture",
  "draw-on-check",
  "energy-on-sacrifice",
  "shield-first-summon-per-turn",
  "energy-on-check",
  "energy-interest",
  "status-duration-bonus",
  "overlay-duration-bonus",
  "center-majority-bonus",
  "zone-buff",
  "piece-rule-modifier",
] as const;

const VALID_PIECE_RULE_MODIFIER_KINDS = [
  "pawn-double-from-any-rank",
  "pawn-backward-step",
  "pawn-promotion-rank",
  "piece-empower-all",
  "rook-attack-through-wall",
  "phalanx-adjacent-shield",
] as const;

const VALID_EMPOWER_PATTERNS: readonly EmpowerPattern[] = [
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
  "king-step",
];

const VALID_PIECE_TYPES: readonly PieceType[] = [
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
  "king",
];

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

const VALID_ZONE_REGION_KINDS = [
  "square",
  "square-orthogonal-1",
  "square-radius-1",
  "rank",
  "center",
] as const;

const VALID_ZONE_BUFF_KINDS = ["energy-per-turn", "hand-size"] as const;

const SQUARE_RE = /^[a-h][1-8]$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}

function validateZoneRegion(raw: unknown, errors: string[]): ZoneRegion | null {
  if (!isPlainObject(raw)) {
    errors.push("'region' must be an object");
    return null;
  }
  const kind = raw.kind;
  if (typeof kind !== "string" || !(VALID_ZONE_REGION_KINDS as readonly string[]).includes(kind)) {
    errors.push(`'region.kind' must be one of ${VALID_ZONE_REGION_KINDS.join(", ")}`);
    return null;
  }
  if (kind === "rank") {
    if (
      typeof raw.rank !== "number" ||
      !Number.isInteger(raw.rank) ||
      raw.rank < 1 ||
      raw.rank > 8
    ) {
      errors.push("'region.rank' must be an integer 1..8 for kind 'rank'");
      return null;
    }
    return { kind: "rank", rank: raw.rank };
  }
  if (kind === "center") {
    return { kind: "center" };
  }
  // anchor-based region
  const anchor = raw.anchor;
  if (typeof anchor !== "string" || !SQUARE_RE.test(anchor)) {
    errors.push(`'region.anchor' must be an algebraic square (e.g. 'd4') for kind '${kind}'`);
    return null;
  }
  return { kind, anchor } as ZoneRegion;
}

function validateZoneBuff(raw: unknown, errors: string[]): ZoneBuffEffect | null {
  if (!isPlainObject(raw)) {
    errors.push("'buff' must be an object");
    return null;
  }
  const kind = raw.kind;
  if (typeof kind !== "string" || !(VALID_ZONE_BUFF_KINDS as readonly string[]).includes(kind)) {
    errors.push(`'buff.kind' must be one of ${VALID_ZONE_BUFF_KINDS.join(", ")}`);
    return null;
  }
  if (typeof raw.amount !== "number" || !Number.isInteger(raw.amount) || raw.amount < 1) {
    errors.push("'buff.amount' must be a positive integer");
    return null;
  }
  return { kind: kind as ZoneBuffEffect["kind"], amount: raw.amount };
}

function validatePieceRuleModifier(raw: unknown, errors: string[]): PieceRuleModifier | null {
  if (!isPlainObject(raw)) {
    errors.push("'effect.modifier' must be an object for kind 'piece-rule-modifier'");
    return null;
  }
  const kind = raw.kind;
  if (
    typeof kind !== "string" ||
    !(VALID_PIECE_RULE_MODIFIER_KINDS as readonly string[]).includes(kind)
  ) {
    errors.push(
      `'effect.modifier.kind' must be one of ${VALID_PIECE_RULE_MODIFIER_KINDS.join(", ")}`,
    );
    return null;
  }
  switch (kind) {
    case "pawn-double-from-any-rank":
    case "pawn-backward-step":
    case "phalanx-adjacent-shield":
      return { kind } as PieceRuleModifier;
    case "pawn-promotion-rank": {
      if (
        typeof raw.rank !== "number" ||
        !Number.isInteger(raw.rank) ||
        raw.rank < 2 ||
        raw.rank > 8
      ) {
        errors.push("'modifier.rank' must be an integer 2..8 for kind 'pawn-promotion-rank'");
        return null;
      }
      return { kind: "pawn-promotion-rank", rank: raw.rank };
    }
    case "piece-empower-all": {
      const pt = raw.pieceType;
      if (typeof pt !== "string" || !(VALID_PIECE_TYPES as readonly string[]).includes(pt)) {
        errors.push(
          `'modifier.pieceType' must be one of ${VALID_PIECE_TYPES.join(", ")} for 'piece-empower-all'`,
        );
        return null;
      }
      const pat = raw.pattern;
      if (typeof pat !== "string" || !(VALID_EMPOWER_PATTERNS as readonly string[]).includes(pat)) {
        errors.push(
          `'modifier.pattern' must be one of ${VALID_EMPOWER_PATTERNS.join(", ")} for 'piece-empower-all'`,
        );
        return null;
      }
      return {
        kind: "piece-empower-all",
        pieceType: pt as PieceType,
        pattern: pat as EmpowerPattern,
      };
    }
    case "rook-attack-through-wall": {
      const mw = raw.maxWalls;
      if (typeof mw !== "number" || !Number.isInteger(mw) || mw < 1 || mw > 4) {
        errors.push(
          "'modifier.maxWalls' must be an integer 1..4 for kind 'rook-attack-through-wall'",
        );
        return null;
      }
      return { kind: "rook-attack-through-wall", maxWalls: mw };
    }
  }
  // Unreachable — kind already validated against the union above.
  return null;
}

function validateArtifactEffect(raw: unknown, errors: string[]): ArtifactEffect | null {
  if (!isPlainObject(raw)) {
    errors.push("artifact effect must be an object with a 'kind' field");
    return null;
  }
  const kind = raw.kind;
  switch (kind) {
    case "hand-size-bonus":
    case "start-energy-bonus":
    case "energy-per-turn-bonus":
    case "energy-on-capture":
    case "gold-on-match-start": {
      if (typeof raw.amount !== "number" || !Number.isInteger(raw.amount)) {
        errors.push(`'effect.amount' must be an integer for kind '${kind}'`);
        return null;
      }
      return { kind, amount: raw.amount } as ArtifactEffect;
    }
    case "draw-on-capture":
    case "draw-on-check": {
      if (!isPositiveInt(raw.count)) {
        errors.push(`'effect.count' must be a positive integer for kind '${kind}'`);
        return null;
      }
      return { kind, count: raw.count } as ArtifactEffect;
    }
    case "card-cost-discount": {
      if (typeof raw.amount !== "number" || !Number.isInteger(raw.amount) || raw.amount < 1) {
        errors.push("'effect.amount' must be a positive integer for kind 'card-cost-discount'");
        return null;
      }
      const archetype = raw.archetype;
      if (
        archetype !== undefined &&
        (typeof archetype !== "string" ||
          !(VALID_ARCHETYPES as readonly string[]).includes(archetype))
      ) {
        errors.push(
          `'effect.archetype' must be one of ${VALID_ARCHETYPES.join(", ")} if present for 'card-cost-discount'`,
        );
        return null;
      }
      const out: ArtifactEffect = { kind: "card-cost-discount", amount: raw.amount };
      if (typeof archetype === "string") {
        (out as { archetype?: CardArchetype }).archetype = archetype as CardArchetype;
      }
      return out;
    }
    case "card-cost-percentage-discount": {
      if (typeof raw.percent !== "number" || raw.percent <= 0 || raw.percent >= 100) {
        errors.push(
          "'effect.percent' must be a number between 0 and 100 (exclusive) for kind 'card-cost-percentage-discount'",
        );
        return null;
      }
      const archetype = raw.archetype;
      if (
        archetype !== undefined &&
        (typeof archetype !== "string" ||
          !(VALID_ARCHETYPES as readonly string[]).includes(archetype))
      ) {
        errors.push(
          `'effect.archetype' must be one of ${VALID_ARCHETYPES.join(", ")} if present for 'card-cost-percentage-discount'`,
        );
        return null;
      }
      const out: ArtifactEffect = {
        kind: "card-cost-percentage-discount",
        percent: raw.percent,
      };
      if (typeof archetype === "string") {
        (out as { archetype?: CardArchetype }).archetype = archetype as CardArchetype;
      }
      return out;
    }
    case "zone-buff": {
      const region = validateZoneRegion(raw.region, errors);
      const buff = validateZoneBuff(raw.buff, errors);
      const sourceLabel = raw.sourceLabel;
      if (typeof sourceLabel !== "string" || sourceLabel.length === 0) {
        errors.push("'effect.sourceLabel' must be a non-empty string for kind 'zone-buff'");
      }
      if (!region || !buff || typeof sourceLabel !== "string" || sourceLabel.length === 0) {
        return null;
      }
      return { kind: "zone-buff", region, buff, sourceLabel };
    }
    case "energy-on-sacrifice": {
      if (!isPositiveInt(raw.amount)) {
        errors.push("'effect.amount' must be a positive integer for kind 'energy-on-sacrifice'");
        return null;
      }
      return { kind: "energy-on-sacrifice", amount: raw.amount };
    }
    case "shield-first-summon-per-turn":
      return { kind: "shield-first-summon-per-turn" };
    case "energy-on-check": {
      if (!isPositiveInt(raw.amount)) {
        errors.push("'effect.amount' must be a positive integer for kind 'energy-on-check'");
        return null;
      }
      return { kind: "energy-on-check", amount: raw.amount };
    }
    case "energy-interest": {
      if (!isPositiveInt(raw.per) || !isPositiveInt(raw.max)) {
        errors.push(
          "'effect.per' and 'effect.max' must be positive integers for kind 'energy-interest'",
        );
        return null;
      }
      return { kind: "energy-interest", per: raw.per, max: raw.max };
    }
    case "status-duration-bonus": {
      if (!isPositiveInt(raw.amount)) {
        errors.push("'effect.amount' must be a positive integer for kind 'status-duration-bonus'");
        return null;
      }
      return { kind: "status-duration-bonus", amount: raw.amount };
    }
    case "overlay-duration-bonus": {
      if (!isPositiveInt(raw.amount)) {
        errors.push("'effect.amount' must be a positive integer for kind 'overlay-duration-bonus'");
        return null;
      }
      return { kind: "overlay-duration-bonus", amount: raw.amount };
    }
    case "center-majority-bonus": {
      const isNonNegInt = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0;
      if (!isNonNegInt(raw.draw) || !isNonNegInt(raw.energy)) {
        errors.push(
          "'effect.draw' and 'effect.energy' must be non-negative integers for kind 'center-majority-bonus'",
        );
        return null;
      }
      return {
        kind: "center-majority-bonus",
        draw: raw.draw as number,
        energy: raw.energy as number,
      };
    }
    case "piece-rule-modifier": {
      const modifier = validatePieceRuleModifier(raw.modifier, errors);
      if (!modifier) return null;
      return { kind: "piece-rule-modifier", modifier };
    }
    default:
      errors.push(
        `'effect.kind' must be one of ${VALID_ARTIFACT_EFFECT_KINDS.join(", ")} (got ${JSON.stringify(kind)})`,
      );
      return null;
  }
}

export function validateArtifact(raw: unknown): { artifact?: Artifact; errors: string[] } {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { errors: ["artifact JSON must be an object"] };
  }

  const id = raw.id;
  if (typeof id !== "string" || id.length === 0) {
    errors.push("'id' must be a non-empty string");
  }
  const name = raw.name;
  if (typeof name !== "string" || name.length === 0) {
    errors.push("'name' must be a non-empty string");
  }
  const rarity = raw.rarity;
  if (
    typeof rarity !== "string" ||
    !(VALID_ARTIFACT_RARITIES as readonly string[]).includes(rarity)
  ) {
    errors.push(`'rarity' must be one of ${VALID_ARTIFACT_RARITIES.join(", ")}`);
  }
  const description = raw.description;
  if (typeof description !== "string" || description.length === 0) {
    errors.push("'description' must be a non-empty string");
  }

  const effectsRaw = raw.effects;
  if (!Array.isArray(effectsRaw) || effectsRaw.length === 0) {
    errors.push("'effects' must be a non-empty array");
  }

  const emoji = raw.emoji;
  if (emoji !== undefined && typeof emoji !== "string") {
    errors.push("'emoji' must be a string if present");
  }

  if (errors.length > 0) return { errors };

  const effects: ArtifactEffect[] = [];
  if (Array.isArray(effectsRaw)) {
    for (let i = 0; i < effectsRaw.length; i++) {
      const childErrors: string[] = [];
      const e = validateArtifactEffect(effectsRaw[i], childErrors);
      if (!e) {
        for (const m of childErrors) errors.push(`effects[${i}]: ${m}`);
      } else {
        effects.push(e);
      }
    }
  }
  if (errors.length > 0) return { errors };

  const artifact: Artifact = {
    id: id as string,
    name: name as string,
    rarity: rarity as ArtifactRarity,
    description: description as string,
    effects,
  };
  if (typeof emoji === "string") artifact.emoji = emoji;
  return { artifact, errors };
}

function basenameNoExt(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.json$/, "");
}

function loadArtifactLibrary(): { byId: Record<string, Artifact>; ordered: Artifact[] } {
  const modules = import.meta.glob<unknown>("./data/*.json", {
    eager: true,
    import: "default",
  });

  const byId: Record<string, Artifact> = {};
  const ordered: Artifact[] = [];
  const allErrors: string[] = [];

  // Sort paths for stable ordering across runs.
  const paths = Object.keys(modules).sort();

  for (const path of paths) {
    const raw = modules[path];
    const { artifact, errors } = validateArtifact(raw);
    if (errors.length > 0) {
      allErrors.push(`${path}:\n  - ${errors.join("\n  - ")}`);
      continue;
    }
    if (!artifact) continue;

    const expectedId = basenameNoExt(path);
    if (artifact.id !== expectedId) {
      allErrors.push(
        `${path}: filename '${expectedId}.json' does not match artifact id '${artifact.id}'.`,
      );
      continue;
    }
    if (byId[artifact.id]) {
      allErrors.push(`${path}: duplicate artifact id '${artifact.id}'`);
      continue;
    }
    byId[artifact.id] = artifact;
    ordered.push(artifact);
  }

  if (allErrors.length > 0) {
    throw new Error(
      `Failed to load artifact library — fix the following ${allErrors.length === 1 ? "issue" : "issues"} in src/game/artifacts/data/:\n\n${allErrors.join("\n\n")}`,
    );
  }

  return { byId, ordered };
}

const { byId: LIBRARY, ordered: ARTIFACT_DEFS } = loadArtifactLibrary();

export const ARTIFACT_LIBRARY: Readonly<Record<string, Artifact>> = LIBRARY;

/** All artifacts in the pool — useful for tests and stable iteration. */
export function allArtifacts(): ReadonlyArray<Artifact> {
  return ARTIFACT_DEFS;
}

export function getArtifactById(id: string): Artifact {
  const a = LIBRARY[id];
  if (!a) throw new Error(`Unknown artifact id '${id}'`);
  return a;
}

export function getArtifactsByRarity(rarity: ArtifactRarity): Artifact[] {
  return ARTIFACT_DEFS.filter((a) => a.rarity === rarity);
}

/**
 * Display emoji per artifact id. Stored on each artifact's JSON; falls back
 * to a generic talisman for ids that don't declare one (e.g. user-created
 * artifacts in the Content Designer prior to assigning a glyph).
 */
export function artifactEmoji(id: string): string {
  return LIBRARY[id]?.emoji ?? "🗿";
}

/**
 * Pick `count` distinct random artifacts weighted by rarity. Mirrors the
 * card-pool weighting in `progression/run.ts`: ~70% commons, ~25% uncommons,
 * ~5% rares. Skips ids in `excludeIds` (so the same artifact can't be offered
 * twice in one shop, and one already in the run can't be re-offered).
 */
export function pickRandomArtifacts(
  count: number,
  rng: () => number,
  excludeIds: ReadonlySet<string> = new Set(),
): Artifact[] {
  return pickRandomByRarity(
    {
      commons: getArtifactsByRarity("common").filter((a) => !excludeIds.has(a.id)),
      uncommons: getArtifactsByRarity("uncommon").filter((a) => !excludeIds.has(a.id)),
      rares: getArtifactsByRarity("rare").filter((a) => !excludeIds.has(a.id)),
    },
    count,
    rng,
  );
}
