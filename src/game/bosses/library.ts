// Boss definitions. Hand-crafted, one per act. Per `docs/design/bosses.md`.
//
// M8 implements Boss A end-to-end. Boss B and Boss C are sketched for M9,
// but their modifiers / hazards are not yet wired through Match.tsx — only
// Boss A's modifier (`no-player-walls`) and hazards (c3/c4 indestructible
// walls) and curse trigger (`on-player-check` → Stalwart) are live.
//
// Boss A coordinates target the 5×6 Standard board (per docs/design/modes.md
// match 3). The c3/c4 walls split the 5-file board down the middle.

import type { BossDef, BossId } from "../types";

export const BOSS_DEFS: ReadonlyArray<BossDef> = [
  {
    id: "iron-garrison",
    name: "The Iron Garrison",
    matchNumber: 3,
    modifier: { kind: "no-player-walls" },
    modifierDescription: "You cannot place walls.",
    hazardWalls: ["c3", "c4"],
    curses: [{ trigger: { kind: "on-player-check" }, curseId: "stalwart" }],
    description:
      "A fortress of pillars splits the board down the middle. Bring siege, not subtlety.",
  },
];

const LIBRARY: Map<BossId, BossDef> = new Map(BOSS_DEFS.map((b) => [b.id, b]));

export function getBossById(id: BossId): BossDef {
  const b = LIBRARY.get(id);
  if (!b) throw new Error(`Unknown boss id '${id}'`);
  return b;
}

/**
 * Look up the boss for a given match number, or null if no boss is defined
 * yet for that match. Standard mode has bosses on matches 3, 6, 9; M8 only
 * implements match 3 (Boss A).
 */
export function bossForMatch(matchNumber: number): BossDef | null {
  return BOSS_DEFS.find((b) => b.matchNumber === matchNumber) ?? null;
}

/**
 * Boss for the act ending in `act` (1, 2, or 3). Returns null if that act's
 * boss isn't defined yet.
 */
export function bossForAct(act: 1 | 2 | 3): BossDef | null {
  return bossForMatch(act * 3);
}
