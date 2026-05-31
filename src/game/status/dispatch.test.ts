// Status dispatcher behavior: trigger matching, lifetime ticking, side
// symmetry. Per-curse parity (Throttled / Memory Leak / etc.) is covered in
// src/game/cards/match.statusEffects.test.ts.

import { describe, expect, it, vi } from "vitest";

import { createMatchCardState, makeRng, startPlayerTurn, type BoardContext } from "../cards/match";
import type { MatchCardState, StatusEffect } from "../types";

import { fireStatusEffects, type StatusEvent } from "./dispatch";

// Inject a synthetic def using the on-self-pawn-move trigger (no shipped def
// uses it yet) so we can give that trigger positive coverage. Every other id
// delegates to the real library, so the rest of the suite is unaffected.
vi.mock("./library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./library")>();
  return {
    ...actual,
    getStatusEffectById: (id: string) =>
      id === "pawn-pinger"
        ? {
            id: "pawn-pinger",
            name: "Pawn Pinger",
            description: "Fires when you move a pawn.",
            trigger: { kind: "on-self-pawn-move" },
            effect: { kind: "next-move-constraint", constraint: "must-not-check" },
            flavor: "curse",
          }
        : actual.getStatusEffectById(id as never),
  };
});

const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
  isAttackedBy: () => false,
  isRooted: () => false,
};

function withStatuses(state: MatchCardState, statuses: StatusEffect[]): MatchCardState {
  return { ...state, statusEffects: statuses };
}

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

describe("fireStatusEffects", () => {
  it("returns the input state unchanged when no statuses are active", () => {
    const rng = makeRng(1);
    const st = startPlayerTurn(createMatchCardState([], rng), rng);
    const res = fireStatusEffects(
      st,
      { kind: "turn-start", side: "player", turn: st.turn },
      emptyBoard,
      rng,
    );
    expect(res.state).toBe(st);
    expect(res.sideEffects).toEqual([]);
  });

  it("Throttled (on-self-check) sets must-not-check exactly once per player turn", () => {
    const rng = makeRng(2);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = withStatuses(st, [bossCurse("throttled")]);

    // First check on this turn fires.
    const e1: StatusEvent = { kind: "check", by: "player", turn: st.turn };
    const r1 = fireStatusEffects(st, e1, emptyBoard, rng);
    expect(r1.state.mustNotCheckNextMove).toBe(true);
    expect(r1.state.statusEffects[0]?.lastFiredOnTurn).toBe(st.turn);

    // Second check on the same turn does not refire (oncePerTurn).
    const r2 = fireStatusEffects({ ...r1.state, mustNotCheckNextMove: false }, e1, emptyBoard, rng);
    expect(r2.state.mustNotCheckNextMove).toBeFalsy();
  });

  it("does not fire on opponent-side events when target=player", () => {
    const rng = makeRng(3);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = withStatuses(st, [bossCurse("throttled")]);
    const res = fireStatusEffects(
      st,
      { kind: "check", by: "opponent", turn: st.turn },
      emptyBoard,
      rng,
    );
    expect(res.state.mustNotCheckNextMove).toBeFalsy();
  });

  it("every-n-turns fires on turns N, 2N, 3N…", () => {
    const rng = makeRng(4);
    const baseSt = startPlayerTurn(createMatchCardState([], rng), rng);

    // Below the first firing turn (1,2,3) AND non-multiple turns ABOVE it
    // (5,6,7,9,10,11) must not fire. The latter catches a "fires every turn
    // >= N" regression that the original test (only 1,2,3 + 4,8,12) missed.
    for (const turn of [1, 2, 3, 5, 6, 7, 9, 10, 11]) {
      const fresh = withStatuses(baseSt, [bossCurse("memory-leak")]);
      const res = fireStatusEffects(
        fresh,
        { kind: "turn-start", side: "player", turn },
        emptyBoard,
        rng,
      );
      expect(res.state.pendingEnergyLossOnNoCapture).toBeFalsy();
    }
    for (const turn of [4, 8, 12]) {
      // Reset lastFiredOnTurn between turns so each one is fresh.
      const fresh = withStatuses(baseSt, [bossCurse("memory-leak")]);
      const res = fireStatusEffects(
        fresh,
        { kind: "turn-start", side: "player", turn },
        emptyBoard,
        rng,
      );
      expect(res.state.pendingEnergyLossOnNoCapture).toBe(1);
    }
  });

  it("hardened drops itself after firing on turn 1 (remainingTriggers: 1)", () => {
    const rng = makeRng(5);
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

  it("bit-rot emits a remove-random-own-minor side effect every 5 turns", () => {
    const rng = makeRng(6);
    const baseSt = startPlayerTurn(createMatchCardState([], rng), rng);
    const stWith = withStatuses(baseSt, [bossCurse("bit-rot")]);
    const res = fireStatusEffects(
      stWith,
      { kind: "turn-start", side: "player", turn: 5 },
      emptyBoard,
      rng,
    );
    expect(res.sideEffects.some((e) => e.kind === "remove-random-own-minor")).toBe(true);
  });

  it("multiple statuses fire independently on the same event (no global cap)", () => {
    const rng = makeRng(7);
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

  it("on-self-pawn-move fires on a self pawn-move event", () => {
    const rng = makeRng(8);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = withStatuses(st, [bossCurse("pawn-pinger")]);
    const res = fireStatusEffects(
      st,
      { kind: "pawn-move", by: "player", turn: st.turn },
      emptyBoard,
      rng,
    );
    expect(res.state.mustNotCheckNextMove).toBe(true);
    expect(res.state.statusEffects[0]?.lastFiredOnTurn).toBe(st.turn);
  });

  it("on-self-pawn-move does NOT fire on a non-pawn-move (check) event", () => {
    const rng = makeRng(8);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = withStatuses(st, [bossCurse("pawn-pinger")]);
    const res = fireStatusEffects(
      st,
      { kind: "check", by: "player", turn: st.turn },
      emptyBoard,
      rng,
    );
    expect(res.state.mustNotCheckNextMove).toBeFalsy();
  });

  it("a non-pawn-move status (on-self-check) does not fire on a pawn-move event", () => {
    const rng = makeRng(8);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = withStatuses(st, [bossCurse("throttled")]);
    const res = fireStatusEffects(
      st,
      { kind: "pawn-move", by: "player", turn: st.turn },
      emptyBoard,
      rng,
    );
    expect(res.state.mustNotCheckNextMove).toBeFalsy();
  });

  it("fires only once per turn even with several matching events", () => {
    const rng = makeRng(9);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = withStatuses(st, [bossCurse("echo")]);

    const e1: StatusEvent = { kind: "check", by: "player", turn: st.turn };
    let res = fireStatusEffects(st, e1, emptyBoard, rng);
    expect(res.state.bossExtraMoves).toBe(1);

    res = fireStatusEffects(res.state, e1, emptyBoard, rng);
    expect(res.state.bossExtraMoves).toBe(1); // no second fire
  });

  it("opponent-targeting status effects fire without throwing", () => {
    const rng = makeRng(10);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    const playerCurse: StatusEffect = {
      defId: "throttled",
      source: "player",
      target: "opponent",
      attachedOnTurn: 0,
      oncePerTurn: true,
    };
    st = withStatuses(st, [playerCurse]);
    const res = fireStatusEffects(
      st,
      { kind: "check", by: "opponent", turn: st.turn },
      emptyBoard,
      rng,
    );
    expect(res.state.mustNotCheckNextMove).toBe(true);
    expect(res.state.statusEffects[0]?.lastFiredOnTurn).toBe(st.turn);
  });
});
