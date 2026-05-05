// Boss definitions. Hand-crafted, one per act. Per `docs/design/bosses.md`.
//
// All three bosses are now wired end-to-end through Match.tsx:
//   Boss A (5×6) — modifier: no-player-walls; hazards: c3/c4 walls;
//                  curse: Stalwart on player check.
//   Boss B (7×7) — modifier: captures grant the captured side +1 energy;
//                  hazards: pre-placed +1 energy/turn buff anchored at d1;
//                  curse: Greed every 4 turns.
//   Boss C (8×8) — modifier: pawn promotion disabled;
//                  hazards: 2x2 void at d4/d5/e4/e5 (any piece ending on
//                  one of these squares is destroyed);
//                  curses: Final Resolve (turn 1), Echo (on player check),
//                  Inevitability (every 5 turns).
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
  {
    id: "the-gambit",
    name: "The Gambit",
    matchNumber: 6,
    modifier: { kind: "captures-grant-captured-energy" },
    modifierDescription:
      "When a piece is captured, the captured side gains +1 energy on their next turn.",
    hazardWalls: [],
    zoneBuffs: [
      {
        region: { kind: "square", anchor: "d1" },
        buff: { kind: "energy-per-turn", amount: 1 },
        sourceLabel: "Throne",
      },
    ],
    curses: [{ trigger: { kind: "every-n-turns", n: 4 }, curseId: "greed" }],
    description:
      "A gambler's court. Every trade tilts both ways — and the throne on d1 hums with stolen power.",
  },
  {
    id: "final-mind",
    name: "The Final Mind",
    matchNumber: 9,
    modifier: { kind: "no-promotion" },
    modifierDescription: "Your pawns cannot promote.",
    hazardWalls: [],
    voidSquares: ["d4", "d5", "e4", "e5"],
    curses: [
      { trigger: { kind: "turn", turn: 1 }, curseId: "final-resolve" },
      { trigger: { kind: "on-player-check" }, curseId: "echo" },
      { trigger: { kind: "every-n-turns", n: 5 }, curseId: "inevitability" },
    ],
    description:
      "An emptiness yawns across the center. Your pawns will not become more — only the move you find now will save you.",
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
