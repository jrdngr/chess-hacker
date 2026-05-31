import { describe, expect, it } from "vitest";

import {
  evaluateFeats,
  totalFeatGold,
  FEAT_GOLD_CAP,
  FAST_WIN_MAX_TURNS,
  type FeatInput,
} from "./feats";

// A baseline that earns NO feats: slow win, no queen captured, a major piece
// lost to the opponent, an empty draw pile, and at least one card played.
const NOTHING: FeatInput = {
  turnsPlayed: FAST_WIN_MAX_TURNS + 1,
  capturedByPlayer: ["pawn", "knight"],
  lostToOpponent: ["rook"],
  drawPileCount: 0,
  cardsPlayed: 3,
};

const ids = (input: FeatInput) => evaluateFeats(input).map((f) => f.id);

describe("evaluateFeats", () => {
  it("earns nothing from the baseline", () => {
    expect(evaluateFeats(NOTHING)).toEqual([]);
  });

  it("queen-capture fires only when the player captured a queen", () => {
    expect(ids({ ...NOTHING, capturedByPlayer: ["queen"] })).toContain("queen-capture");
    expect(ids({ ...NOTHING, capturedByPlayer: ["rook", "bishop"] })).not.toContain(
      "queen-capture",
    );
  });

  it("fast-win fires at the threshold but not one turn over", () => {
    expect(ids({ ...NOTHING, turnsPlayed: FAST_WIN_MAX_TURNS })).toContain("fast-win");
    expect(ids({ ...NOTHING, turnsPlayed: FAST_WIN_MAX_TURNS + 1 })).not.toContain("fast-win");
  });

  it("no-major-loss fires when no rook/queen was taken by the opponent", () => {
    expect(ids({ ...NOTHING, lostToOpponent: [] })).toContain("no-major-loss");
    expect(ids({ ...NOTHING, lostToOpponent: ["pawn", "knight", "bishop"] })).toContain(
      "no-major-loss",
    );
    expect(ids({ ...NOTHING, lostToOpponent: ["queen"] })).not.toContain("no-major-loss");
    expect(ids({ ...NOTHING, lostToOpponent: ["rook"] })).not.toContain("no-major-loss");
  });

  it("no-major-loss counts only opponent captures (sacrificed majors don't appear here)", () => {
    // A rook the player sacrifices via a card is never added to lostToOpponent,
    // so the feat still fires — verified by the input contract.
    expect(ids({ ...NOTHING, lostToOpponent: [] })).toContain("no-major-loss");
  });

  it("cards-remaining fires only with a non-empty draw pile", () => {
    expect(ids({ ...NOTHING, drawPileCount: 1 })).toContain("cards-remaining");
    expect(ids({ ...NOTHING, drawPileCount: 0 })).not.toContain("cards-remaining");
  });

  it("restraint fires only when zero cards were played", () => {
    expect(ids({ ...NOTHING, cardsPlayed: 0 })).toContain("restraint");
    expect(ids({ ...NOTHING, cardsPlayed: 1 })).not.toContain("restraint");
  });

  it("returns feats in display order", () => {
    const all: FeatInput = {
      turnsPlayed: 1,
      capturedByPlayer: ["queen"],
      lostToOpponent: [],
      drawPileCount: 5,
      cardsPlayed: 0,
    };
    expect(ids(all)).toEqual([
      "queen-capture",
      "fast-win",
      "no-major-loss",
      "cards-remaining",
      "restraint",
    ]);
  });
});

describe("totalFeatGold", () => {
  it("sums earned feat gold", () => {
    expect(
      totalFeatGold([
        { id: "fast-win", label: "Fast Win", gold: 4 },
        { id: "cards-remaining", label: "Cards Remaining", gold: 3 },
      ]),
    ).toBe(7);
  });

  it("is 0 for no feats", () => {
    expect(totalFeatGold([])).toBe(0);
  });

  it("caps the total at FEAT_GOLD_CAP when every feat is earned", () => {
    const all: FeatInput = {
      turnsPlayed: 1,
      capturedByPlayer: ["queen"],
      lostToOpponent: [],
      drawPileCount: 5,
      cardsPlayed: 0,
    };
    const awards = evaluateFeats(all);
    const raw = awards.reduce((sum, a) => sum + a.gold, 0);
    expect(raw).toBeGreaterThan(FEAT_GOLD_CAP);
    expect(totalFeatGold(awards)).toBe(FEAT_GOLD_CAP);
  });
});
