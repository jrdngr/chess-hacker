// CH-055: sacrifice/summon density. Swarm Protocol burst summon + the
// Scavenger (energy-on-sacrifice) artifact hook. Hive Mind's shield-on-summon
// is covered in src/components/Match/sideEffects.test.ts (needs the engine).

import { describe, expect, it } from "vitest";

import { applyEffect } from "./effectHandlers";
import { createMatchCardState, makeRng } from "./match";
import { getCardById } from "./library";
import { getArtifactById } from "../artifacts/library";
import { emptyBoard, withPieces } from "./match.testHelpers";
import type { Piece } from "../types";

const pawn = (side: "player" | "opponent"): Piece => ({ type: "pawn", side });

describe("summon-orthogonal-burst (Swarm Protocol)", () => {
  it("summons pawns on empty orthogonally-adjacent squares, skipping occupied ones", () => {
    // Target pawn on d4; d5 occupied by an enemy. Empties d3/c4/e4 get pawns.
    const ctx = withPieces({ d4: pawn("player"), d5: pawn("opponent") });
    const r = applyEffect(
      { kind: "summon-orthogonal-burst", pieceType: "pawn", maxCount: 4 },
      createMatchCardState([], makeRng(1)),
      { kind: "square", square: "d4" },
      ctx,
      makeRng(1),
      getCardById("swarm-protocol"),
      0,
    );
    const squares = r.sideEffects.map((s) => (s.kind === "place-piece" ? s.square : null));
    expect(new Set(squares)).toEqual(new Set(["d3", "c4", "e4"]));
    expect(r.sideEffects.every((s) => s.kind === "place-piece")).toBe(true);
  });

  it("respects maxCount", () => {
    const ctx = withPieces({ d4: pawn("player") }); // all 4 neighbours empty
    const r = applyEffect(
      { kind: "summon-orthogonal-burst", pieceType: "pawn", maxCount: 2 },
      createMatchCardState([], makeRng(1)),
      { kind: "square", square: "d4" },
      ctx,
      makeRng(1),
      getCardById("swarm-protocol"),
      0,
    );
    expect(r.sideEffects).toHaveLength(2);
  });
});

describe("Scavenger artifact (energy-on-sacrifice)", () => {
  it("grants +2 energy on top of a sacrifice card's own energy gain", () => {
    const withScav = {
      ...createMatchCardState([], makeRng(1)),
      artifacts: [getArtifactById("scavenger")],
    };
    const r = applyEffect(
      { kind: "sacrifice-piece", drawCount: 0, energyGain: 2 },
      withScav,
      { kind: "square", square: "d2" },
      emptyBoard,
      makeRng(1),
      getCardById("martyr-protocol"),
      0,
    );
    // 2 (card) + 2 (Scavenger) = 4.
    expect(r.state.energy).toBe(4);
  });

  it("does nothing without the artifact", () => {
    const r = applyEffect(
      { kind: "sacrifice-piece", drawCount: 0, energyGain: 2 },
      createMatchCardState([], makeRng(1)),
      { kind: "square", square: "d2" },
      emptyBoard,
      makeRng(1),
      getCardById("martyr-protocol"),
      0,
    );
    expect(r.state.energy).toBe(2);
  });
});
