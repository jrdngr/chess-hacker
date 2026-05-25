import { describe, expect, it } from "vitest";

import { ARTIFACT_LIBRARY } from "../artifacts/library";
import { getNamedDecks } from "./library";

describe("named decks", () => {
  const decks = getNamedDecks();

  it("at least one pre-made deck exists", () => {
    expect(decks.length).toBeGreaterThan(0);
  });

  it("each deck has 10 cards composed 6 commons / 3 uncommons / 1 rare", () => {
    for (const deck of decks) {
      expect(deck.cards.length, `${deck.name}: card count`).toBe(10);
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

  it("each deck's bundled artifactId resolves to a real artifact", () => {
    for (const deck of decks) {
      expect(deck.artifactId, `${deck.name}: missing artifactId`).toBeTruthy();
      expect(
        ARTIFACT_LIBRARY[deck.artifactId!],
        `${deck.name}: artifact '${deck.artifactId}' not found`,
      ).toBeDefined();
    }
  });
});
