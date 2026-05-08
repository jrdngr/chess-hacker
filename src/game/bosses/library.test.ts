import { describe, expect, it } from "vitest";

import { bossForAct, bossForMatch, getBossById } from "./library";
import { getCardById } from "../cards/library";

describe("boss library", () => {
  it("Boss A is the iron-garrison on match 3 / act 1", () => {
    expect(bossForMatch(3)?.id).toBe("the-firewall");
    expect(bossForAct(1)?.id).toBe("the-firewall");
  });

  it("Boss A modifier blocks the player from placing walls", () => {
    const a = getBossById("the-firewall");
    expect(a.modifier.kind).toBe("no-player-walls");
  });

  it("Boss A places permanent c3/d4 wall hazards on the 6x6 board", () => {
    const a = getBossById("the-firewall");
    expect(a.hazardWalls.sort()).toEqual(["c3", "d4"]);
  });

  it("Boss A schedules a Throttled curse on player check", () => {
    const a = getBossById("the-firewall");
    expect(a.curses).toHaveLength(1);
    expect(a.curses[0].trigger.kind).toBe("on-player-check");
    expect(a.curses[0].curseId).toBe("throttled");
    // Sanity: the curse card actually exists in the library.
    const throttled = getCardById("throttled");
    expect(throttled.curse).toBe(true);
    expect(throttled.cost).toBe(0);
  });

  it("Boss B is the-gambit on match 6 / act 2 with the captures-grant rule", () => {
    expect(bossForMatch(6)?.id).toBe("the-whale");
    expect(bossForAct(2)?.id).toBe("the-whale");
    const b = getBossById("the-whale");
    expect(b.modifier.kind).toBe("captures-grant-captured-energy");
    expect(b.curses[0].curseId).toBe("memory-leak");
    // Sanity: memoryLeak exists in the card library.
    const memoryLeak = getCardById("memory-leak");
    expect(memoryLeak.curse).toBe(true);
    expect(memoryLeak.cost).toBe(0);
  });

  it("Boss C is final-mind on match 9 / act 3 with no-promotion + void hazards", () => {
    expect(bossForMatch(9)?.id).toBe("the-singularity");
    expect(bossForAct(3)?.id).toBe("the-singularity");
    const c = getBossById("the-singularity");
    expect(c.modifier.kind).toBe("no-promotion");
    expect((c.voidSquares ?? []).sort()).toEqual(["d4", "d5", "e4", "e5"]);
    expect(c.curses.map((cu) => cu.curseId).sort()).toEqual(["echo", "hardened", "bit-rot"].sort());
    for (const id of ["hardened", "echo", "bit-rot"]) {
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
