import { describe, expect, it } from "vitest";

import { ARTIFACT_LIBRARY } from "../artifacts/library";
import { getNamedDecks } from "./library";

describe("named decks", () => {
  it("loads the three pre-made themed decks (Sysadmin, Hackathon, Architect)", () => {
    const names = new Set(getNamedDecks().map((d) => d.name));
    expect(names.has("Sysadmin")).toBe(true);
    expect(names.has("Hackathon")).toBe(true);
    expect(names.has("Architect")).toBe(true);
  });

  it("each pre-made deck has 10 cards composed 6 commons / 3 uncommons / 1 rare", () => {
    const themed = getNamedDecks().filter((d) =>
      ["Sysadmin", "Hackathon", "Architect"].includes(d.name),
    );
    expect(themed.length).toBe(3);
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
    const themed = getNamedDecks().filter((d) =>
      ["Sysadmin", "Hackathon", "Architect"].includes(d.name),
    );
    for (const deck of themed) {
      expect(deck.artifactId).toBeTruthy();
      expect(ARTIFACT_LIBRARY[deck.artifactId!]).toBeDefined();
    }
  });
});
