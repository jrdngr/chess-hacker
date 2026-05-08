// Boss-hazard walls (permanent: true) survive the start-of-turn lifetime
// tick that expires every other timed overlay. This is what lets Boss A's
// c3/d4 pillars stand for the entire match.

import { describe, expect, it } from "vitest";

import { createMatchCardState, hasWallOn, makeRng, startPlayerTurn } from "./match";
import type { Wall } from "../types";

describe("permanent boss walls", () => {
  it("are not removed when the timed-wall expiry tick runs", () => {
    const rng = makeRng(7);
    const base = createMatchCardState([], rng);
    const walls: Wall[] = [
      { square: "c3", expiresOnTurn: Number.POSITIVE_INFINITY, permanent: true },
      { square: "d4", expiresOnTurn: Number.POSITIVE_INFINITY, permanent: true },
      // A regular wall that should expire before turn 10.
      { square: "d5", expiresOnTurn: 3, permanent: false },
    ];
    let st = { ...base, walls };
    // Roll forward several turns; the permanent walls survive every tick.
    for (let i = 0; i < 10; i++) {
      st = startPlayerTurn(st, rng);
    }
    expect(hasWallOn(st, "c3")).toBe(true);
    expect(hasWallOn(st, "d4")).toBe(true);
    expect(hasWallOn(st, "d5")).toBe(false);
  });
});
