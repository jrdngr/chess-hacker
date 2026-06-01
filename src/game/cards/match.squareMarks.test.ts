// Tests for the Beacon / Repulsor Field square-mark overlay (CH-051).
// The Repulsor push-on-enemy-move is covered in
// src/components/Match/sideEffects.test.ts; here we cover the place-square-mark
// effect handler, the Beacon start-of-turn draw, and mark expiry.

import { describe, expect, it } from "vitest";

import { applyEffect } from "./effectHandlers";
import { createMatchCardState, makeRng, startPlayerTurn } from "./match";
import { getCardById } from "./library";
import { emptyBoard } from "./match.testHelpers";
import type { MatchCardState } from "../types";
import type { ZoneBoardContext } from "../overlays/zoneBuffs";

/** A deck of real cards so the draw pile has something to draw. */
function deckOf(n: number) {
  return Array.from({ length: n }, () => getCardById("stack-trace"));
}

const boardWithFriendlyOn = (square: string): ZoneBoardContext => ({
  size: { files: 8, ranks: 8 },
  pieceSideAt: (sq) => (sq === square ? "player" : null),
});

describe("place-square-mark effect handler", () => {
  it("adds a beacon mark anchored on the targeted square", () => {
    const state = createMatchCardState([], makeRng(1));
    const r = applyEffect(
      { kind: "place-square-mark", mark: "beacon", durationTurns: 4 },
      state,
      { kind: "square", square: "d4" },
      emptyBoard,
      makeRng(1),
      getCardById("beacon"),
      0,
    );
    expect(r.state.squareMarks).toEqual([
      { square: "d4", kind: "beacon", side: "player", expiresOnTurn: state.turn + 4 },
    ]);
  });
});

describe("Beacon start-of-turn draw", () => {
  it("draws 1 extra card when a friendly piece stands on the beacon", () => {
    const base: MatchCardState = {
      ...createMatchCardState(deckOf(8), makeRng(1)),
      turn: 2,
    };
    const withBeacon: MatchCardState = {
      ...base,
      squareMarks: [{ square: "d4", kind: "beacon", side: "player", expiresOnTurn: 99 }],
    };
    const ctx = boardWithFriendlyOn("d4");

    const control = startPlayerTurn(base, makeRng(1), ctx);
    const beaconed = startPlayerTurn(withBeacon, makeRng(1), ctx);

    expect(beaconed.hand.length - control.hand.length).toBe(1);
  });

  it("does not draw when no friendly piece stands on the beacon", () => {
    const base: MatchCardState = {
      ...createMatchCardState(deckOf(8), makeRng(1)),
      turn: 2,
    };
    const withBeacon: MatchCardState = {
      ...base,
      squareMarks: [{ square: "d4", kind: "beacon", side: "player", expiresOnTurn: 99 }],
    };
    // Friendly piece is elsewhere, not on the beacon.
    const ctx = boardWithFriendlyOn("a1");

    const control = startPlayerTurn(base, makeRng(1), ctx);
    const beaconed = startPlayerTurn(withBeacon, makeRng(1), ctx);

    expect(beaconed.hand.length).toBe(control.hand.length);
  });

  it("expires the mark once its lifetime runs out", () => {
    const state: MatchCardState = {
      ...createMatchCardState(deckOf(8), makeRng(1)),
      turn: 4,
      squareMarks: [{ square: "d4", kind: "beacon", side: "player", expiresOnTurn: 5 }],
    };
    // turn ticks 4 → 5; alive() keeps only expiresOnTurn > 5, so it drops.
    const next = startPlayerTurn(state, makeRng(1), boardWithFriendlyOn("d4"));
    expect(next.squareMarks).toEqual([]);
  });
});
