import { describe, expect, it } from "vitest";

import { bossForAct, bossForMatch, getBossById } from "./library";
import { getCardById } from "../cards/library";

describe("boss library", () => {
  it("Boss A is the iron-garrison on match 3 / act 1", () => {
    expect(bossForMatch(3)?.id).toBe("iron-garrison");
    expect(bossForAct(1)?.id).toBe("iron-garrison");
  });

  it("Boss A modifier blocks the player from placing walls", () => {
    const a = getBossById("iron-garrison");
    expect(a.modifier.kind).toBe("no-player-walls");
  });

  it("Boss A places permanent c3/c4 wall hazards on the 5x6 board", () => {
    const a = getBossById("iron-garrison");
    expect(a.hazardWalls.sort()).toEqual(["c3", "c4"]);
  });

  it("Boss A schedules a Stalwart curse on player check", () => {
    const a = getBossById("iron-garrison");
    expect(a.curses).toHaveLength(1);
    expect(a.curses[0].trigger.kind).toBe("on-player-check");
    expect(a.curses[0].curseId).toBe("stalwart");
    // Sanity: the curse card actually exists in the library.
    const stalwart = getCardById("stalwart");
    expect(stalwart.curse).toBe(true);
    expect(stalwart.cost).toBe(0);
  });

  it("Boss B is the-gambit on match 6 / act 2 with the captures-grant rule", () => {
    expect(bossForMatch(6)?.id).toBe("the-gambit");
    expect(bossForAct(2)?.id).toBe("the-gambit");
    const b = getBossById("the-gambit");
    expect(b.modifier.kind).toBe("captures-grant-captured-energy");
    expect(b.curses[0].curseId).toBe("greed");
    // Sanity: greed exists in the card library.
    const greed = getCardById("greed");
    expect(greed.curse).toBe(true);
    expect(greed.cost).toBe(0);
  });

  it("Boss C is final-mind on match 9 / act 3 with no-promotion + void hazards", () => {
    expect(bossForMatch(9)?.id).toBe("final-mind");
    expect(bossForAct(3)?.id).toBe("final-mind");
    const c = getBossById("final-mind");
    expect(c.modifier.kind).toBe("no-promotion");
    expect((c.voidSquares ?? []).sort()).toEqual(["d4", "d5", "e4", "e5"]);
    expect(c.curses.map((cu) => cu.curseId).sort()).toEqual(
      ["echo", "final-resolve", "inevitability"].sort(),
    );
    for (const id of ["final-resolve", "echo", "inevitability"]) {
      const card = getCardById(id);
      expect(card.curse).toBe(true);
      expect(card.cost).toBe(0);
    }
  });

  it("returns null for matches without a defined boss", () => {
    expect(bossForMatch(1)).toBeNull();
    expect(bossForMatch(2)).toBeNull();
    expect(bossForMatch(4)).toBeNull();
    expect(bossForMatch(7)).toBeNull();
  });
});
