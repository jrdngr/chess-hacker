// CH-056: per-act boss pool selection + the two new bosses' periodic
// mechanics (Survey / Audit) and The Overseer's hand-size penalty.

import { describe, expect, it } from "vitest";

import { bossesForMatch, getBossById } from "./library";
import { activeBossFor, createRun } from "../progression/run";
import { fireStatusEffects } from "../status/dispatch";
import { createMatchCardState, makeRng, drawCards } from "../cards/match";
import { emptyBoard } from "../cards/match.testHelpers";
import { getCardById } from "../cards/library";
import type { MatchCardState } from "../types";

describe("Act-2 boss pool", () => {
  it("contains The Whale, The Cartographer, and The Overseer at match 6", () => {
    const ids = bossesForMatch(6).map((b) => b.id);
    expect(ids).toContain("the-whale");
    expect(ids).toContain("the-cartographer");
    expect(ids).toContain("the-overseer");
  });

  it("activeBossFor picks a pool member, stable for a given seed", () => {
    const run = { ...createRun({ mode: "standard", rngSeed: 12345 }), matchNumber: 6 };
    const a = activeBossFor(run);
    const b = activeBossFor(run);
    expect(a?.id).toBe(b?.id); // deterministic across calls
    expect(bossesForMatch(6).map((x) => x.id)).toContain(a!.id);
  });

  it("different seeds can select different Act-2 bosses", () => {
    const ids = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const run = { ...createRun({ mode: "standard", rngSeed: seed }), matchNumber: 6 };
      ids.add(activeBossFor(run)!.id);
    }
    expect(ids.size).toBeGreaterThan(1); // the pool actually varies
  });
});

describe("periodic boss status effects", () => {
  const withStatus = (defId: string): MatchCardState => ({
    ...createMatchCardState([], makeRng(1)),
    turn: 3,
    statusEffects: [{ defId, source: "opponent", target: "player", attachedOnTurn: 0 }],
  });

  it("Cartographer survey emits a place-wall-random side effect every 3 turns", () => {
    const r = fireStatusEffects(
      withStatus("cartographer-survey"),
      { kind: "turn-start", side: "player", turn: 3 },
      emptyBoard,
      makeRng(1),
    );
    expect(r.sideEffects).toContainEqual({ kind: "place-wall-random" });
  });

  it("Overseer audit emits a disarm-random-player-non-pawn side effect each turn", () => {
    const r = fireStatusEffects(
      withStatus("overseer-audit"),
      { kind: "turn-start", side: "player", turn: 3 },
      emptyBoard,
      makeRng(1),
    );
    expect(r.sideEffects).toContainEqual({
      kind: "disarm-random-player-non-pawn",
      expiresOnTurn: 4,
    });
  });
});

describe("The Overseer — hand-size penalty", () => {
  it("reduces the effective hand limit by the modifier amount", () => {
    expect(getBossById("the-overseer").modifier).toEqual({ kind: "hand-size-penalty", amount: 1 });
    const deck = Array.from({ length: 12 }, () => getCardById("stack-trace"));
    const base = createMatchCardState(deck, makeRng(1));
    // Fill the hand up against the limit with, then without, the penalty.
    const withPenalty = drawCards({ ...base, bossHandSizeDelta: -1 }, 99, makeRng(1), true);
    const noPenalty = drawCards({ ...base, bossHandSizeDelta: 0 }, 99, makeRng(1), true);
    expect(noPenalty.hand.length - withPenalty.hand.length).toBe(1);
  });
});
