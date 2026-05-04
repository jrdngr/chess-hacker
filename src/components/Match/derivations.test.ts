import { describe, expect, it } from "vitest";

import { createMatchCardState, makeRng } from "../../game/cards/match";
import type { MatchCardState } from "../../game/types";

import { buildExtraOverlays, deriveOverlaySets } from "./derivations";

const stateWith = (patch: Partial<MatchCardState>): MatchCardState => ({
  ...createMatchCardState([], makeRng(1)),
  ...patch,
});

describe("buildExtraOverlays", () => {
  it("unions hasted squares into the disarms overlay so hasted pieces cannot capture", () => {
    const state = stateWith({
      hastes: [{ square: "e1", side: "player", expiresOnTurn: 99 }],
      disarms: [{ square: "a1", side: "player", expiresOnTurn: 99 }],
    });
    const sets = deriveOverlaySets(state);
    const extra = buildExtraOverlays(sets);
    expect(extra.disarms?.has("e1")).toBe(true);
    expect(extra.disarms?.has("a1")).toBe(true);
  });

  it("leaves the original disarmedSet object untouched when no hastes are present", () => {
    const state = stateWith({
      disarms: [{ square: "a1", side: "player", expiresOnTurn: 99 }],
    });
    const sets = deriveOverlaySets(state);
    const extra = buildExtraOverlays(sets);
    expect(extra.disarms).toBe(sets.disarmedSet);
  });
});
