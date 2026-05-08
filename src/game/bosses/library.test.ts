import { describe, expect, it } from "vitest";

import { bossForAct, bossForMatch, getBossById } from "./library";
import { getStatusEffectById } from "../status/library";

describe("boss library", () => {
  it("Boss A is the-firewall on match 3 / act 1", () => {
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

  it("Boss A applies the Throttled status effect", () => {
    const a = getBossById("the-firewall");
    expect(a.statusEffects).toEqual(["throttled"]);
    const throttled = getStatusEffectById("throttled");
    expect(throttled.trigger.kind).toBe("on-self-check");
    expect(throttled.flavor).toBe("curse");
  });

  it("Boss B is the-whale on match 6 / act 2 with the captures-grant rule", () => {
    expect(bossForMatch(6)?.id).toBe("the-whale");
    expect(bossForAct(2)?.id).toBe("the-whale");
    const b = getBossById("the-whale");
    expect(b.modifier.kind).toBe("captures-grant-captured-energy");
    expect(b.statusEffects).toEqual(["memory-leak"]);
    const memoryLeak = getStatusEffectById("memory-leak");
    expect(memoryLeak.trigger.kind).toBe("every-n-turns");
  });

  it("Boss C is the-singularity on match 9 / act 3 with no-promotion + void hazards", () => {
    expect(bossForMatch(9)?.id).toBe("the-singularity");
    expect(bossForAct(3)?.id).toBe("the-singularity");
    const c = getBossById("the-singularity");
    expect(c.modifier.kind).toBe("no-promotion");
    expect((c.voidSquares ?? []).sort()).toEqual(["d4", "d5", "e4", "e5"]);
    expect([...c.statusEffects].sort()).toEqual(["bit-rot", "echo", "hardened"]);
    for (const id of ["hardened", "echo", "bit-rot"]) {
      const def = getStatusEffectById(id);
      expect(def.flavor).toBe("curse");
    }
  });

  it("returns null for matches without a defined boss", () => {
    expect(bossForMatch(1)).toBeNull();
    expect(bossForMatch(2)).toBeNull();
    expect(bossForMatch(4)).toBeNull();
    expect(bossForMatch(7)).toBeNull();
  });
});
