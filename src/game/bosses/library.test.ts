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

  it("returns null for matches without a defined boss", () => {
    expect(bossForMatch(1)).toBeNull();
    expect(bossForMatch(6)).toBeNull(); // M9 work — not in M8.
    expect(bossForAct(2)).toBeNull();
  });
});
