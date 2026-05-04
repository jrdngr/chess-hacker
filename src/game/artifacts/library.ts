// Artifact library — the prototype pool the shop and (later) boss rewards
// pull from. See docs/design/artifacts.md for the design intent and rarity
// targets. Pool is intentionally small (~10) for M6; expansion is M11.
//
// Each artifact lists one or more `effects`. Effects are evaluated by the
// pure helpers in `./effects.ts`. Cards / pieces / energy / triggers are all
// covered — see the union in `../types.ts`.

import type { Artifact, ArtifactRarity } from "../types";

const ARTIFACT_DEFS: ReadonlyArray<Artifact> = [
  // ---- Common ------------------------------------------------------------
  {
    id: "stone-hourglass",
    name: "Stone Hourglass",
    rarity: "common",
    description: "Hand size +1.",
    effects: [{ kind: "hand-size-bonus", amount: 1 }],
  },
  {
    id: "spark-coil",
    name: "Spark Coil",
    rarity: "common",
    description: "Start each match with +1 energy on turn 1.",
    effects: [{ kind: "start-energy-bonus", amount: 1 }],
  },
  {
    id: "rallying-banner",
    name: "Rallying Banner",
    rarity: "common",
    description: "Tempo cards cost 1 less (minimum 0).",
    effects: [{ kind: "card-cost-discount", archetype: "tempo", amount: 1 }],
  },
  {
    id: "vampiric-charm",
    name: "Vampiric Charm",
    rarity: "common",
    description: "When you capture an enemy piece, draw 1 card.",
    effects: [{ kind: "draw-on-capture", count: 1 }],
  },
  {
    id: "hunters-edge",
    name: "Hunter's Edge",
    rarity: "common",
    description: "When you capture an enemy piece, gain 1 energy this turn.",
    effects: [{ kind: "energy-on-capture", amount: 1 }],
  },
  {
    id: "lucky-coin",
    name: "Lucky Coin",
    rarity: "common",
    description: "Gain 2 gold at the start of every match.",
    effects: [{ kind: "gold-on-match-start", amount: 2 }],
  },

  // ---- Uncommon ----------------------------------------------------------
  {
    id: "cunning-sigil",
    name: "Cunning Sigil",
    rarity: "uncommon",
    description: "Spatial cards cost 1 less (minimum 0).",
    effects: [{ kind: "card-cost-discount", archetype: "spatial", amount: 1 }],
  },
  {
    id: "war-drum",
    name: "War Drum",
    rarity: "uncommon",
    description: "Gain +1 extra energy at the start of every turn.",
    effects: [{ kind: "energy-per-turn-bonus", amount: 1 }],
  },
  {
    id: "tacticians-eye",
    name: "Tactician's Eye",
    rarity: "uncommon",
    description: "When you put the opponent in check, draw 1 card.",
    effects: [{ kind: "draw-on-check", count: 1 }],
  },

  // ---- Rare --------------------------------------------------------------
  {
    id: "power-conduit",
    name: "Power Conduit",
    rarity: "rare",
    description: "All cards cost 1 less (minimum 0).",
    effects: [{ kind: "card-cost-discount", amount: 1 }],
  },
  {
    id: "royal-patronage",
    name: "Royal Patronage",
    rarity: "rare",
    description: "Hand size +1, and gain 4 gold at the start of every match.",
    effects: [
      { kind: "hand-size-bonus", amount: 1 },
      { kind: "gold-on-match-start", amount: 4 },
    ],
  },
];

const LIBRARY: Record<string, Artifact> = Object.fromEntries(ARTIFACT_DEFS.map((a) => [a.id, a]));

const DUPLICATE_IDS = ARTIFACT_DEFS.map((a) => a.id).filter((id, i, arr) => arr.indexOf(id) !== i);
if (DUPLICATE_IDS.length > 0) {
  throw new Error(`Duplicate artifact ids in pool: ${DUPLICATE_IDS.join(", ")}`);
}

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
  const commons = getArtifactsByRarity("common").filter((a) => !excludeIds.has(a.id));
  const uncommons = getArtifactsByRarity("uncommon").filter((a) => !excludeIds.has(a.id));
  const rares = getArtifactsByRarity("rare").filter((a) => !excludeIds.has(a.id));

  const out: Artifact[] = [];
  const used = new Set<string>();
  const cap = Math.min(count, commons.length + uncommons.length + rares.length);
  while (out.length < cap) {
    const r = rng();
    let pool: Artifact[];
    if (r < 0.05 && rares.length > 0) pool = rares;
    else if (r < 0.3 && uncommons.length > 0) pool = uncommons;
    else pool = commons;
    const candidates = pool.filter((a) => !used.has(a.id));
    if (candidates.length === 0) {
      const all = [...commons, ...uncommons, ...rares].filter((a) => !used.has(a.id));
      if (all.length === 0) break;
      const pick = all[Math.floor(rng() * all.length)];
      out.push(pick);
      used.add(pick.id);
      continue;
    }
    const pick = candidates[Math.floor(rng() * candidates.length)];
    out.push(pick);
    used.add(pick.id);
  }
  return out;
}
