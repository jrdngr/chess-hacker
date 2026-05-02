// Starter card pool for M3.
//
// Per `docs/roadmap/milestones.md`, M3 only needs the four prototype effects:
//   - Tempo: "+1 energy this turn"
//   - Tempo: "Draw 2 cards"
//   - Disruption: "Freeze an enemy piece"
//   - Spatial: "Place a wall on a chosen square"
//
// We add a couple of variants so the starter deck has some texture. The full
// pool target (~40-60 cards across archetypes — see milestones.md M13) is
// content work for later.

import type { Card, CardId } from "../types";

export const SURGE: Card = {
  id: "surge",
  name: "Surge",
  cost: 0,
  rarity: "common",
  archetype: "resource",
  consume: false,
  description: "+1 energy this turn.",
  target: { kind: "none" },
  effect: { kind: "gain-energy", amount: 1 },
};

export const RECONNAISSANCE: Card = {
  id: "reconnaissance",
  name: "Reconnaissance",
  cost: 1,
  rarity: "common",
  archetype: "resource",
  consume: false,
  description: "Draw 2 cards.",
  target: { kind: "none" },
  effect: { kind: "draw", count: 2 },
};

export const FROSTBITE: Card = {
  id: "frostbite",
  name: "Frostbite",
  cost: 2,
  rarity: "common",
  archetype: "disruption",
  consume: false,
  description: "Freeze an enemy piece. It can't be moved on the opponent's next turn.",
  target: { kind: "enemy-piece" },
  effect: { kind: "freeze-piece" },
};

export const BARRICADE: Card = {
  id: "barricade",
  name: "Barricade",
  cost: 1,
  rarity: "common",
  archetype: "spatial",
  consume: false,
  description: "Place a wall on an empty square. Lasts 3 turns.",
  target: { kind: "empty-square" },
  effect: { kind: "place-wall", durationTurns: 3 },
};

export const CARD_LIBRARY: Record<CardId, Card> = {
  [SURGE.id]: SURGE,
  [RECONNAISSANCE.id]: RECONNAISSANCE,
  [FROSTBITE.id]: FROSTBITE,
  [BARRICADE.id]: BARRICADE,
};

/**
 * Starter deck for the M3 prototype.
 *
 * 10 cards, weighted toward the cheap utility / spatial cards so an opening
 * hand of 5 has a high chance of being playable on turn 1 with energy = 3.
 */
export const STARTER_DECK_IDS: CardId[] = [
  "surge",
  "surge",
  "surge",
  "reconnaissance",
  "reconnaissance",
  "frostbite",
  "frostbite",
  "barricade",
  "barricade",
  "barricade",
];

export function makeStarterDeck(): Card[] {
  return STARTER_DECK_IDS.map((id) => {
    const c = CARD_LIBRARY[id];
    if (!c) throw new Error(`unknown card id: ${id}`);
    return c;
  });
}
