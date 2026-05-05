// Boss library, loaded from JSON. Hand-crafted, one per act.
// See docs/design/bosses.md for the design intent.
//
// Definitions are the source of truth in `./data/*.json`. This module loads
// every JSON at startup, validates it, and exposes the typed result.
//
// All three bosses are wired end-to-end through Match.tsx:
//   Boss A (5×6) — modifier: no-player-walls; hazards: c3/c4 walls;
//                  curse: Throttled on player check.
//   Boss B (7×7) — modifier: captures grant the captured side +1 energy;
//                  hazards: pre-placed +1 energy/turn buff anchored at d1;
//                  curse: Memory Leak every 4 turns.
//   Boss C (8×8) — modifier: pawn promotion disabled;
//                  hazards: 2x2 void at d4/d5/e4/e5 (any piece ending on
//                  one of these squares is destroyed);
//                  curses: Hardened (turn 1), Echo (on player check),
//                  Bit Rot (every 5 turns).
//
// `curseId` references are validated lazily (at first lookup, via
// `getCardById`) to avoid module-init ordering between card and boss
// libraries.

import type {
  AlgebraicSquare,
  BossDef,
  BossId,
  BossModifier,
  CurseScheduleEntry,
  CurseTrigger,
  ZoneBuffEffect,
  ZoneRegion,
} from "../types";

export const VALID_BOSS_IDS: readonly BossId[] = ["the-firewall", "the-whale", "the-singularity"];
export const VALID_MATCH_NUMBERS = [3, 6, 9] as const;
export const VALID_BOSS_MODIFIER_KINDS = [
  "no-player-walls",
  "captures-grant-captured-energy",
  "no-promotion",
] as const;
export const VALID_CURSE_TRIGGER_KINDS = [
  "turn",
  "every-n-turns",
  "on-player-check",
  "on-player-capture",
] as const;

const VALID_ZONE_REGION_KINDS = [
  "square",
  "square-orthogonal-1",
  "square-radius-1",
  "rank",
] as const;
const VALID_ZONE_BUFF_KINDS = ["energy-per-turn", "hand-size"] as const;

const SQUARE_RE = /^[a-h][1-8]$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}

function validateSquare(v: unknown, label: string, errors: string[]): AlgebraicSquare | null {
  if (typeof v !== "string" || !SQUARE_RE.test(v)) {
    errors.push(`'${label}' must be an algebraic square (e.g. 'd4'); got ${JSON.stringify(v)}`);
    return null;
  }
  return v as AlgebraicSquare;
}

function validateModifier(raw: unknown, errors: string[]): BossModifier | null {
  if (!isPlainObject(raw)) {
    errors.push("'modifier' must be an object with a 'kind' field");
    return null;
  }
  const kind = raw.kind;
  if (
    typeof kind !== "string" ||
    !(VALID_BOSS_MODIFIER_KINDS as readonly string[]).includes(kind)
  ) {
    errors.push(`'modifier.kind' must be one of ${VALID_BOSS_MODIFIER_KINDS.join(", ")}`);
    return null;
  }
  return { kind } as BossModifier;
}

function validateCurseTrigger(raw: unknown, errors: string[]): CurseTrigger | null {
  if (!isPlainObject(raw)) {
    errors.push("'trigger' must be an object with a 'kind' field");
    return null;
  }
  const kind = raw.kind;
  if (
    typeof kind !== "string" ||
    !(VALID_CURSE_TRIGGER_KINDS as readonly string[]).includes(kind)
  ) {
    errors.push(`'trigger.kind' must be one of ${VALID_CURSE_TRIGGER_KINDS.join(", ")}`);
    return null;
  }
  switch (kind) {
    case "turn": {
      if (!isPositiveInt(raw.turn)) {
        errors.push("'trigger.turn' must be a positive integer for kind 'turn'");
        return null;
      }
      return { kind: "turn", turn: raw.turn };
    }
    case "every-n-turns": {
      if (!isPositiveInt(raw.n)) {
        errors.push("'trigger.n' must be a positive integer for kind 'every-n-turns'");
        return null;
      }
      return { kind: "every-n-turns", n: raw.n };
    }
    case "on-player-check":
      return { kind: "on-player-check" };
    case "on-player-capture":
      return { kind: "on-player-capture" };
  }
  return null;
}

function validateCurseEntry(raw: unknown, errors: string[]): CurseScheduleEntry | null {
  if (!isPlainObject(raw)) {
    errors.push("curse entry must be an object");
    return null;
  }
  const trigger = validateCurseTrigger(raw.trigger, errors);
  const curseId = raw.curseId;
  if (typeof curseId !== "string" || curseId.length === 0) {
    errors.push("'curseId' must be a non-empty string");
  }
  if (!trigger || typeof curseId !== "string" || curseId.length === 0) return null;
  return { trigger, curseId };
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
  const anchor = validateSquare(raw.anchor, "region.anchor", errors);
  if (!anchor) return null;
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

export function validateBossDef(raw: unknown): { boss?: BossDef; errors: string[] } {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { errors: ["boss JSON must be an object"] };
  }

  const id = raw.id;
  if (typeof id !== "string" || !(VALID_BOSS_IDS as readonly string[]).includes(id)) {
    errors.push(`'id' must be one of ${VALID_BOSS_IDS.join(", ")}`);
  }
  const name = raw.name;
  if (typeof name !== "string" || name.length === 0) {
    errors.push("'name' must be a non-empty string");
  }
  const matchNumber = raw.matchNumber;
  if (
    typeof matchNumber !== "number" ||
    !(VALID_MATCH_NUMBERS as readonly number[]).includes(matchNumber)
  ) {
    errors.push(`'matchNumber' must be one of ${VALID_MATCH_NUMBERS.join(", ")}`);
  }

  const modifier = validateModifier(raw.modifier, errors);

  const modifierDescription = raw.modifierDescription;
  if (typeof modifierDescription !== "string" || modifierDescription.length === 0) {
    errors.push("'modifierDescription' must be a non-empty string");
  }

  const description = raw.description;
  if (typeof description !== "string" || description.length === 0) {
    errors.push("'description' must be a non-empty string");
  }

  const hazardWallsRaw = raw.hazardWalls;
  const hazardWalls: AlgebraicSquare[] = [];
  if (!Array.isArray(hazardWallsRaw)) {
    errors.push("'hazardWalls' must be an array (use [] for none)");
  } else {
    hazardWallsRaw.forEach((sq, i) => {
      const v = validateSquare(sq, `hazardWalls[${i}]`, errors);
      if (v) hazardWalls.push(v);
    });
  }

  const voidSquaresRaw = raw.voidSquares;
  const voidSquares: AlgebraicSquare[] = [];
  if (voidSquaresRaw !== undefined) {
    if (!Array.isArray(voidSquaresRaw)) {
      errors.push("'voidSquares' must be an array if present");
    } else {
      voidSquaresRaw.forEach((sq, i) => {
        const v = validateSquare(sq, `voidSquares[${i}]`, errors);
        if (v) voidSquares.push(v);
      });
    }
  }

  const zoneBuffsRaw = raw.zoneBuffs;
  const zoneBuffs: { region: ZoneRegion; buff: ZoneBuffEffect; sourceLabel: string }[] = [];
  if (zoneBuffsRaw !== undefined) {
    if (!Array.isArray(zoneBuffsRaw)) {
      errors.push("'zoneBuffs' must be an array if present");
    } else {
      zoneBuffsRaw.forEach((entry, i) => {
        if (!isPlainObject(entry)) {
          errors.push(`zoneBuffs[${i}] must be an object`);
          return;
        }
        const childErrors: string[] = [];
        const region = validateZoneRegion(entry.region, childErrors);
        const buff = validateZoneBuff(entry.buff, childErrors);
        const sourceLabel = entry.sourceLabel;
        if (typeof sourceLabel !== "string" || sourceLabel.length === 0) {
          childErrors.push("'sourceLabel' must be a non-empty string");
        }
        if (childErrors.length > 0) {
          for (const m of childErrors) errors.push(`zoneBuffs[${i}]: ${m}`);
          return;
        }
        zoneBuffs.push({ region: region!, buff: buff!, sourceLabel: sourceLabel as string });
      });
    }
  }

  const cursesRaw = raw.curses;
  const curses: CurseScheduleEntry[] = [];
  if (!Array.isArray(cursesRaw)) {
    errors.push("'curses' must be an array (use [] for none)");
  } else {
    cursesRaw.forEach((entry, i) => {
      const childErrors: string[] = [];
      const e = validateCurseEntry(entry, childErrors);
      if (!e) {
        for (const m of childErrors) errors.push(`curses[${i}]: ${m}`);
      } else {
        curses.push(e);
      }
    });
  }

  if (errors.length > 0) return { errors };

  const boss: BossDef = {
    id: id as BossId,
    name: name as string,
    matchNumber: matchNumber as 3 | 6 | 9,
    modifier: modifier!,
    modifierDescription: modifierDescription as string,
    hazardWalls,
    curses,
    description: description as string,
  };
  if (voidSquaresRaw !== undefined) boss.voidSquares = voidSquares;
  if (zoneBuffsRaw !== undefined) boss.zoneBuffs = zoneBuffs;
  return { boss, errors };
}

function basenameNoExt(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.json$/, "");
}

function loadBossLibrary(): BossDef[] {
  const modules = import.meta.glob<unknown>("./data/*.json", {
    eager: true,
    import: "default",
  });

  const out: BossDef[] = [];
  const seen = new Set<string>();
  const allErrors: string[] = [];

  // Sort paths for stable ordering across runs.
  const paths = Object.keys(modules).sort();

  for (const path of paths) {
    const raw = modules[path];
    const { boss, errors } = validateBossDef(raw);
    if (errors.length > 0) {
      allErrors.push(`${path}:\n  - ${errors.join("\n  - ")}`);
      continue;
    }
    if (!boss) continue;

    const expectedId = basenameNoExt(path);
    if (boss.id !== expectedId) {
      allErrors.push(`${path}: filename '${expectedId}.json' does not match boss id '${boss.id}'.`);
      continue;
    }
    if (seen.has(boss.id)) {
      allErrors.push(`${path}: duplicate boss id '${boss.id}'`);
      continue;
    }
    seen.add(boss.id);
    out.push(boss);
  }

  if (allErrors.length > 0) {
    throw new Error(
      `Failed to load boss library — fix the following ${allErrors.length === 1 ? "issue" : "issues"} in src/game/bosses/data/:\n\n${allErrors.join("\n\n")}`,
    );
  }

  // Sort by matchNumber so consumers can rely on canonical act order regardless
  // of filename alphabetisation.
  out.sort((a, b) => a.matchNumber - b.matchNumber);
  return out;
}

export const BOSS_DEFS: ReadonlyArray<BossDef> = loadBossLibrary();

const LIBRARY: Map<BossId, BossDef> = new Map(BOSS_DEFS.map((b) => [b.id, b]));

export function getBossById(id: BossId): BossDef {
  const b = LIBRARY.get(id);
  if (!b) throw new Error(`Unknown boss id '${id}'`);
  return b;
}

/**
 * Look up the boss for a given match number, or null if no boss is defined
 * for that match.
 */
export function bossForMatch(matchNumber: number): BossDef | null {
  return BOSS_DEFS.find((b) => b.matchNumber === matchNumber) ?? null;
}

/**
 * Boss for the act ending in `act` (1, 2, or 3). Returns null if that act's
 * boss isn't defined.
 */
export function bossForAct(act: 1 | 2 | 3): BossDef | null {
  return bossForMatch(act * 3);
}
