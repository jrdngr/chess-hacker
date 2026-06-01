// CH-050: player→enemy status cards (Worm, Rootkit). Covers the
// apply-status-effect / afflict-random-enemy handlers and the status
// dispatcher firing them on the player's turn cadence and on enemy captures.

import { describe, expect, it } from "vitest";

import { applyEffect } from "./effectHandlers";
import { createMatchCardState, makeRng } from "./match";
import { getCardById } from "./library";
import { emptyBoard } from "./match.testHelpers";
import { fireStatusEffects } from "../status/dispatch";
import type { MatchCardState } from "../types";

const base = () => createMatchCardState([], makeRng(1));

describe("apply-status-effect handler", () => {
  it("installs a player-sourced curse that ticks on the player cadence", () => {
    const r = applyEffect(
      { kind: "apply-status-effect", statusId: "worm" },
      base(),
      { kind: "none" },
      emptyBoard,
      makeRng(1),
      getCardById("worm"),
      0,
    );
    expect(r.state.statusEffects).toEqual([
      { defId: "worm", source: "player", target: "player", attachedOnTurn: 0 },
    ]);
  });

  it("dedupes by defId — re-applying a permanent curse is a no-op", () => {
    const once = applyEffect(
      { kind: "apply-status-effect", statusId: "worm" },
      base(),
      { kind: "none" },
      emptyBoard,
      makeRng(1),
      getCardById("worm"),
      0,
    );
    const twice = applyEffect(
      { kind: "apply-status-effect", statusId: "worm" },
      once.state,
      { kind: "none" },
      emptyBoard,
      makeRng(1),
      getCardById("worm"),
      0,
    );
    expect(twice.state.statusEffects).toHaveLength(1);
  });
});

describe("afflict-random-enemy handler", () => {
  it("emits a side effect carrying the status and computed expiry", () => {
    const state: MatchCardState = { ...base(), turn: 3 };
    const r = applyEffect(
      { kind: "afflict-random-enemy", status: "freeze", minorOnly: true, durationTurns: 1 },
      state,
      { kind: "none" },
      emptyBoard,
      makeRng(1),
      getCardById("worm"),
      0,
    );
    expect(r.sideEffects).toEqual([
      { kind: "afflict-random-enemy", status: "freeze", minorOnly: true, expiresOnTurn: 4 },
    ]);
  });
});

describe("status dispatch: Worm (every 3 player turns)", () => {
  const withWorm = (turn: number): MatchCardState => ({
    ...base(),
    turn,
    statusEffects: [{ defId: "worm", source: "player", target: "player", attachedOnTurn: 0 }],
  });

  it("fires on player turn 3 and emits the freeze side effect", () => {
    const r = fireStatusEffects(
      withWorm(3),
      { kind: "turn-start", side: "player", turn: 3 },
      emptyBoard,
      makeRng(1),
    );
    expect(r.sideEffects).toContainEqual({
      kind: "afflict-random-enemy",
      status: "freeze",
      minorOnly: true,
      expiresOnTurn: 4,
    });
  });

  it("does not fire on a non-multiple player turn", () => {
    const r = fireStatusEffects(
      withWorm(2),
      { kind: "turn-start", side: "player", turn: 2 },
      emptyBoard,
      makeRng(1),
    );
    expect(r.sideEffects).toEqual([]);
  });
});

describe("status dispatch: Rootkit (on enemy capture)", () => {
  it("fires when the opponent captures, freezing for 2 (covers the enemy's next move)", () => {
    const state: MatchCardState = {
      ...base(),
      turn: 5,
      statusEffects: [{ defId: "rootkit", source: "player", target: "player", attachedOnTurn: 0 }],
    };
    const r = fireStatusEffects(
      state,
      { kind: "capture", by: "opponent", turn: 5 },
      emptyBoard,
      makeRng(1),
    );
    expect(r.sideEffects).toContainEqual({
      kind: "afflict-random-enemy",
      status: "freeze",
      minorOnly: false,
      expiresOnTurn: 7,
    });
  });

  it("does not fire when the player captures", () => {
    const state: MatchCardState = {
      ...base(),
      statusEffects: [{ defId: "rootkit", source: "player", target: "player", attachedOnTurn: 0 }],
    };
    const r = fireStatusEffects(
      state,
      { kind: "capture", by: "player", turn: 5 },
      emptyBoard,
      makeRng(1),
    );
    expect(r.sideEffects).toEqual([]);
  });
});
