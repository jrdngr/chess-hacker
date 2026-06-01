// CH-053: tests for the new artifact effects added in the pool-growth pass.
// Reducers + their wiring (start-of-turn interest, status / overlay duration
// bonuses). energy-on-check is exercised via its reducer (the trigger fires in
// the Match shell, covered by Match-level tests).

import { describe, expect, it } from "vitest";

import { applyEffect } from "./effectHandlers";
import { createMatchCardState, makeRng, startPlayerTurn } from "./match";
import { getCardById } from "./library";
import { getArtifactById } from "../artifacts/library";
import { emptyBoard } from "./match.testHelpers";
import {
  energyInterest,
  energyOnCheck,
  overlayDurationBonus,
  statusDurationBonus,
} from "../artifacts/effects";
import type { MatchCardState } from "../types";

describe("new artifact reducers", () => {
  it("Compound Interest grants floor(energy/6) capped at 3", () => {
    const arts = [getArtifactById("compound-interest")];
    expect(energyInterest(arts, 5)).toBe(0);
    expect(energyInterest(arts, 12)).toBe(2);
    expect(energyInterest(arts, 30)).toBe(3); // capped at max
  });

  it("Zero-Day yields 3 energy-on-check", () => {
    expect(energyOnCheck([getArtifactById("zero-day")])).toBe(3);
  });

  it("Cryostasis / Trapsmith expose their duration bonuses", () => {
    expect(statusDurationBonus([getArtifactById("cryostasis")])).toBe(1);
    expect(overlayDurationBonus([getArtifactById("trapsmith")])).toBe(2);
  });
});

describe("Compound Interest — start-of-turn integration", () => {
  it("adds banked-energy interest to the per-turn energy gain", () => {
    const base: MatchCardState = {
      ...createMatchCardState([], makeRng(1)),
      energy: 12,
      turn: 3,
    };
    const withInterest: MatchCardState = {
      ...base,
      artifacts: [getArtifactById("compound-interest")],
    };
    const control = startPlayerTurn(base, makeRng(1));
    const boosted = startPlayerTurn(withInterest, makeRng(1));
    // 12 banked → +2 interest on top of the normal gain.
    expect(boosted.energy - control.energy).toBe(2);
  });
});

describe("Cryostasis — status duration", () => {
  it("extends a player-cast Freeze by 1 turn", () => {
    const withCryo: MatchCardState = {
      ...createMatchCardState([], makeRng(1)),
      turn: 4,
      artifacts: [getArtifactById("cryostasis")],
    };
    const r = applyEffect(
      { kind: "freeze-piece" },
      withCryo,
      { kind: "square", square: "d5" },
      emptyBoard,
      makeRng(1),
      getCardById("freeze-process"),
      0,
    );
    // turn 4 + base 1 + Cryostasis 1 = 6.
    expect(r.state.freezes.find((f) => f.square === "d5")?.expiresOnTurn).toBe(6);
  });
});

describe("Trapsmith — overlay duration", () => {
  it("extends a placed Wall by 2 turns", () => {
    const withTrapsmith: MatchCardState = {
      ...createMatchCardState([], makeRng(1)),
      turn: 2,
      artifacts: [getArtifactById("trapsmith")],
    };
    const r = applyEffect(
      { kind: "place-wall", durationTurns: 3 },
      withTrapsmith,
      { kind: "square", square: "d4" },
      emptyBoard,
      makeRng(1),
      getCardById("firewall"),
      0,
    );
    // turn 2 + 3 + Trapsmith 2 = 7.
    expect(r.state.walls.find((w) => w.square === "d4")?.expiresOnTurn).toBe(7);
  });
});
