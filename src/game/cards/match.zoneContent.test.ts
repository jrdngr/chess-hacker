// CH-052: Chokepoint (rank zone-buff card) + Loadbalancer (center-majority
// artifact). Covers the place-zone-buff-region handler and the start-of-turn
// center-majority bonus.

import { describe, expect, it } from "vitest";

import { applyEffect } from "./effectHandlers";
import { createMatchCardState, makeRng, startPlayerTurn } from "./match";
import { getCardById } from "./library";
import { getArtifactById } from "../artifacts/library";
import { emptyBoard } from "./match.testHelpers";
import type { MatchCardState } from "../types";
import type { ZoneBoardContext } from "../overlays/zoneBuffs";

describe("place-zone-buff-region (Chokepoint)", () => {
  it("appends a rank-1 hand-size zone buff with the right expiry", () => {
    const state: MatchCardState = { ...createMatchCardState([], makeRng(1)), turn: 2 };
    const r = applyEffect(
      {
        kind: "place-zone-buff-region",
        region: { kind: "rank", rank: 1 },
        buff: { kind: "hand-size", amount: 1 },
        durationTurns: 4,
        sourceLabel: "Chokepoint",
      },
      state,
      { kind: "none" },
      emptyBoard,
      makeRng(1),
      getCardById("chokepoint"),
      0,
    );
    expect(r.state.zoneBuffs).toContainEqual({
      region: { kind: "rank", rank: 1 },
      effect: { kind: "hand-size", amount: 1 },
      side: "player",
      expiresOnTurn: 6,
      sourceLabel: "Chokepoint",
    });
  });
});

describe("Loadbalancer — center-majority start-of-turn bonus", () => {
  const deck = () => Array.from({ length: 8 }, () => getCardById("stack-trace"));
  // Player holds 3 of the 4 center squares (d4/e4/d5), opponent none.
  const playerMajority: ZoneBoardContext = {
    size: { files: 8, ranks: 8 },
    pieceSideAt: (sq) => (sq === "d4" || sq === "e4" || sq === "d5" ? "player" : null),
  };
  const opponentHeld: ZoneBoardContext = {
    size: { files: 8, ranks: 8 },
    pieceSideAt: (sq) =>
      sq === "d4" || sq === "e4" || sq === "d5" || sq === "e5" ? "opponent" : null,
  };

  it("draws 1 and grants 1 energy when the player holds center majority", () => {
    const base: MatchCardState = { ...createMatchCardState(deck(), makeRng(1)), turn: 2 };
    const withLB: MatchCardState = { ...base, artifacts: [getArtifactById("loadbalancer")] };
    const control = startPlayerTurn(base, makeRng(1), playerMajority);
    const boosted = startPlayerTurn(withLB, makeRng(1), playerMajority);
    expect(boosted.energy - control.energy).toBe(1);
    expect(boosted.hand.length - control.hand.length).toBe(1);
  });

  it("does nothing when the player lacks center majority", () => {
    const withLB: MatchCardState = {
      ...createMatchCardState(deck(), makeRng(1)),
      turn: 2,
      artifacts: [getArtifactById("loadbalancer")],
    };
    const control: MatchCardState = { ...withLB, artifacts: [] };
    const a = startPlayerTurn(withLB, makeRng(1), opponentHeld);
    const b = startPlayerTurn(control, makeRng(1), opponentHeld);
    expect(a.energy).toBe(b.energy);
    expect(a.hand.length).toBe(b.hand.length);
  });
});
