// CH-059: Boss-C counterplay cards. Watchdog Timer (shield-all-friendly) and
// the softened Kernel Panic (grant-extra-move).

import { describe, expect, it } from "vitest";

import { applyEffect } from "./effectHandlers";
import { createMatchCardState, makeRng } from "./match";
import { getCardById } from "./library";
import { emptyBoard, withPieces, noTarget } from "./match.testHelpers";
import type { Piece } from "../types";

const piece = (type: Piece["type"], side: Piece["side"]): Piece => ({ type, side });

describe("shield-all-friendly (Watchdog Timer)", () => {
  it("shields every friendly piece (and no enemy piece) until the stated turn", () => {
    const ctx = withPieces({
      d4: piece("pawn", "player"),
      e5: piece("knight", "player"),
      a8: piece("rook", "opponent"),
    });
    const state = { ...createMatchCardState([], makeRng(1)), turn: 3 };
    const r = applyEffect(
      { kind: "shield-all-friendly", durationTurns: 1 },
      state,
      noTarget(),
      ctx,
      makeRng(1),
      getCardById("watchdog-timer"),
      0,
    );
    const shielded = new Set(r.state.shields.map((s) => s.square));
    expect(shielded.has("d4")).toBe(true);
    expect(shielded.has("e5")).toBe(true);
    expect(shielded.has("a8")).toBe(false); // enemy piece never shielded
    expect(r.state.shields.find((s) => s.square === "d4")?.expiresOnTurn).toBe(4);
  });
});

describe("grant-extra-move (Kernel Panic, softened)", () => {
  it("adds to the player's extra-move budget this turn", () => {
    const r = applyEffect(
      { kind: "grant-extra-move", count: 1 },
      { ...createMatchCardState([], makeRng(1)), playerExtraMovesRemaining: 0 },
      noTarget(),
      emptyBoard,
      makeRng(1),
      getCardById("kernel-panic"),
      0,
    );
    expect(r.state.playerExtraMovesRemaining).toBe(1);
  });
});
