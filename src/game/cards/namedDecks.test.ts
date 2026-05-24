import { describe, expect, it } from "vitest";

import { ARTIFACT_LIBRARY } from "../artifacts/library";
import { getNamedDecks } from "./library";

describe("named decks", () => {
  const ALL_THEMED = ["Sysadmin", "Hackathon", "Architect", "Botnet", "Pentester"];

  it("loads all pre-made themed decks", () => {
    const names = new Set(getNamedDecks().map((d) => d.name));
    for (const n of ALL_THEMED) {
      expect(names.has(n)).toBe(true);
    }
  });

  it("each pre-made deck has 10 cards composed 6 commons / 3 uncommons / 1 rare", () => {
    const themed = getNamedDecks().filter((d) => ALL_THEMED.includes(d.name));
    expect(themed.length).toBe(ALL_THEMED.length);
    for (const deck of themed) {
      expect(deck.cards.length).toBe(10);
      let c = 0;
      let u = 0;
      let r = 0;
      for (const card of deck.cards) {
        if (card.rarity === "common") c++;
        else if (card.rarity === "uncommon") u++;
        else if (card.rarity === "rare") r++;
      }
      expect({ name: deck.name, c, u, r }).toEqual({ name: deck.name, c: 6, u: 3, r: 1 });
    }
  });

  it("each pre-made deck's bundled artifactId resolves to a real artifact", () => {
    const themed = getNamedDecks().filter((d) => ALL_THEMED.includes(d.name));
    for (const deck of themed) {
      expect(deck.artifactId).toBeTruthy();
      expect(ARTIFACT_LIBRARY[deck.artifactId!]).toBeDefined();
    }
  });
});
