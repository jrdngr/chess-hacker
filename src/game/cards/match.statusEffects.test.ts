// Per-curse parity tests for the status-effect framework. Each migrated boss
// curse (Throttled / Memory Leak / Hardened / Echo / Bit Rot) gets one block
// asserting that its trigger fires the right downstream flag or side effect.
//
// Replaces the legacy match.curses.test.ts which exercised the curse-card-in-
// hand machinery.

import { describe, expect, it } from "vitest";

import {
  STARTING_ENERGY,
  createMatchCardState,
  makeRng,
  startPlayerTurn,
  type BoardContext,
} from "./match";
import { fireStatusEffects } from "../status/dispatch";
import type { MatchCardState, StatusEffect } from "../types";

const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
  isAttackedBy: () => false,
  isRooted: () => false,
};

function bossCurse(defId: string, overrides: Partial<StatusEffect> = {}): StatusEffect {
  return {
    defId,
    source: "opponent",
    target: "player",
    attachedOnTurn: 0,
    oncePerTurn: true,
    ...overrides,
  };
}

function withStatuses(state: MatchCardState, statuses: StatusEffect[]): MatchCardState {
  return { ...state, statusEffects: statuses };
}

describe("Throttled (on-self-check → next-move-constraint)", () => {
  it("sets mustNotCheckNextMove when the player puts the boss in check", () => {
    const rng = makeRng(1);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = withStatuses(st, [bossCurse("throttled")]);
    const res = fireStatusEffects(
      st,
      { kind: "check", by: "player", turn: st.turn },
      emptyBoard,
      rng,
    );
    expect(res.state.mustNotCheckNextMove).toBe(true);
  });
});

describe("Memory Leak (every-n-turns 4 → pending-energy-loss-on-no-capture)", () => {
  it("sets pendingEnergyLossOnNoCapture on turns 4, 8, 12 only", () => {
    const rng = makeRng(2);
    const st = startPlayerTurn(createMatchCardState([], rng), rng);
    for (const turn of [1, 2, 3, 5, 6, 7]) {
      const fresh = withStatuses(st, [bossCurse("memory-leak")]);
      const res = fireStatusEffects(
        fresh,
        { kind: "turn-start", side: "player", turn },
        emptyBoard,
        rng,
      );
      expect(res.state.pendingEnergyLossOnNoCapture).toBeFalsy();
    }
    for (const turn of [4, 8, 12]) {
      const fresh = withStatuses(st, [bossCurse("memory-leak")]);
      const res = fireStatusEffects(
        fresh,
        { kind: "turn-start", side: "player", turn },
        emptyBoard,
        rng,
      );
      expect(res.state.pendingEnergyLossOnNoCapture).toBe(true);
    }
  });
});

describe("Hardened (turn-start, remainingTriggers 1 → forbid-zero-cost-this-turn)", () => {
  it("fires once on turn 1 then drops itself", () => {
    const rng = makeRng(3);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = withStatuses(st, [bossCurse("hardened", { remainingTriggers: 1 })]);
    const res = fireStatusEffects(
      st,
      { kind: "turn-start", side: "player", turn: 1 },
      emptyBoard,
      rng,
    );
    expect(res.state.noZeroCostCardsThisTurn).toBe(true);
    expect(res.state.statusEffects.find((s) => s.defId === "hardened")).toBeUndefined();
  });
});

describe("Echo (on-self-check → boss-extra-move)", () => {
  it("grants the boss one extra move every time the player checks", () => {
    const rng = makeRng(4);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = withStatuses(st, [bossCurse("echo")]);
    const res = fireStatusEffects(
      st,
      { kind: "check", by: "player", turn: st.turn },
      emptyBoard,
      rng,
    );
    expect(res.state.bossExtraMoves).toBe(1);
  });
});

describe("Bit Rot (every-n-turns 5 → capture-random-own-minor)", () => {
  it("emits a remove-random-own-minor side effect on turns 5, 10, ...", () => {
    const rng = makeRng(5);
    const st = startPlayerTurn(createMatchCardState([], rng), rng);
    const fresh = withStatuses(st, [bossCurse("bit-rot")]);
    const res = fireStatusEffects(
      fresh,
      { kind: "turn-start", side: "player", turn: 5 },
      emptyBoard,
      rng,
    );
    expect(res.sideEffects.some((e) => e.kind === "remove-random-own-minor")).toBe(true);
  });
});

describe("multiple statuses fire on the same turn (no global cap)", () => {
  it("Boss C: Echo + on-self-check fires both Echo and Throttled on a single check", () => {
    const rng = makeRng(6);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = withStatuses(st, [bossCurse("throttled"), bossCurse("echo")]);
    const res = fireStatusEffects(
      st,
      { kind: "check", by: "player", turn: st.turn },
      emptyBoard,
      rng,
    );
    expect(res.state.mustNotCheckNextMove).toBe(true);
    expect(res.state.bossExtraMoves).toBe(1);
  });
});

describe("starter state has STARTING_ENERGY and no status effects by default", () => {
  it("starts with empty statusEffects", () => {
    const rng = makeRng(7);
    const st = startPlayerTurn(createMatchCardState([], rng), rng);
    expect(st.energy).toBeGreaterThanOrEqual(STARTING_ENERGY);
    expect(st.statusEffects).toEqual([]);
  });
});
