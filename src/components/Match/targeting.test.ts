// Direct tests for the pure card-targeting helpers. These drive every
// card-targeting click (~20 target-kind branches with wall / own-half /
// adjacency / attacked-by filters) and were only touched indirectly via
// Match.test.tsx. See CH-018.

import { describe, expect, it } from "vitest";

import { ChoseEngine } from "../../game/chess/engine";
import { createMatchCardState, makeRng } from "../../game/cards/match";
import type { AlgebraicSquare, Card, MatchCardState } from "../../game/types";

import { computeBoardMode, computeValidTargetSquares } from "./targeting";

// A mixed fixture: white (player) K/e1, P/a2, N/b1, B/c1, Q/d1, R/h1;
// black (opponent) K/e8, P/a7, N/b8, B/c8, R/h8. The h-file is clear so the
// white rook on h1 attacks the black rook on h8.
const FEN = "1nb1k2r/p7/8/8/8/8/P7/1NBQK2R w - - 0 1";

function card(targetKind: string, effect: Record<string, unknown> = { kind: "noop" }): Card {
  return {
    id: "t",
    name: "Test Card",
    cost: 0,
    rarity: "common",
    archetype: "tempo",
    description: "",
    target: { kind: targetKind },
    effect,
  } as unknown as Card;
}

function compute(
  c: Card | null,
  opts: {
    engine?: ChoseEngine;
    state?: MatchCardState;
    partial?: AlgebraicSquare | null;
    walls?: AlgebraicSquare[];
    rooted?: AlgebraicSquare[];
  } = {},
): ReadonlySet<AlgebraicSquare> {
  const engine = opts.engine ?? new ChoseEngine(FEN);
  const state = opts.state ?? createMatchCardState([], makeRng(1));
  return computeValidTargetSquares(
    c,
    engine,
    state,
    opts.partial ?? null,
    [],
    new Set(opts.walls ?? []),
    new Set(opts.rooted ?? []),
  );
}

describe("computeValidTargetSquares — piece target families", () => {
  it("returns an empty set for a null card", () => {
    expect(compute(null).size).toBe(0);
  });

  it("enemy-piece selects every opponent piece (including king)", () => {
    const out = compute(card("enemy-piece"));
    expect(out).toEqual(new Set(["b8", "c8", "e8", "h8", "a7"]));
  });

  it("enemy-non-king-piece excludes the enemy king", () => {
    const out = compute(card("enemy-non-king-piece"));
    expect(out.has("e8")).toBe(false);
    expect(out).toEqual(new Set(["b8", "c8", "h8", "a7"]));
  });

  it("enemy-non-king-piece with destroy/attacked filter keeps only attacked pieces", () => {
    const out = compute(
      card("enemy-non-king-piece", { kind: "destroy-piece", filter: "attacked-by-player" }),
    );
    // Only the black rook on h8 is attacked (white rook on the clear h-file).
    expect(out).toEqual(new Set(["h8"]));
  });

  it("enemy-non-king-piece with destroy/disabled filter keeps only Frozen/Rooted/Disarmed pieces (Quarantine)", () => {
    const state: MatchCardState = {
      ...createMatchCardState([], makeRng(1)),
      freezes: [{ square: "b8", side: "opponent", expiresOnTurn: 99 }],
      disarms: [{ square: "h8", side: "opponent", expiresOnTurn: 99 }],
    };
    const out = compute(
      card("enemy-non-king-piece", { kind: "destroy-piece", filter: "disabled" }),
      {
        state,
      },
    );
    // Only the frozen knight (b8) and disarmed rook (h8) are quarantine targets.
    expect(out).toEqual(new Set(["b8", "h8"]));
  });

  it("own-piece selects all player pieces; own-non-king-piece drops the king", () => {
    expect(compute(card("own-piece"))).toEqual(new Set(["a2", "b1", "c1", "d1", "e1", "h1"]));
    const nonKing = compute(card("own-non-king-piece"));
    expect(nonKing.has("e1")).toBe(false);
    expect(nonKing).toEqual(new Set(["a2", "b1", "c1", "d1", "h1"]));
  });

  it("own-pawn selects only player pawns", () => {
    expect(compute(card("own-pawn"))).toEqual(new Set(["a2"]));
  });

  it("enemy-minor-piece selects enemy knights, bishops, and pawns", () => {
    expect(compute(card("enemy-minor-piece"))).toEqual(new Set(["b8", "c8", "a7"]));
  });

  it("own-promotable-piece excludes king and queen", () => {
    const out = compute(card("own-promotable-piece"));
    expect(out.has("e1")).toBe(false); // king
    expect(out.has("d1")).toBe(false); // queen
    expect(out).toEqual(new Set(["a2", "b1", "c1", "h1"]));
  });

  it("two-enemy-non-king-pieces excludes the already-picked partial target", () => {
    const full = compute(card("two-enemy-non-king-pieces"));
    expect(full).toEqual(new Set(["b8", "c8", "h8", "a7"]));
    const second = compute(card("two-enemy-non-king-pieces"), { partial: "b8" });
    expect(second.has("b8")).toBe(false);
    expect(second).toEqual(new Set(["c8", "h8", "a7"]));
  });
});

describe("computeValidTargetSquares — square / spatial families", () => {
  it("empty-square excludes occupied squares and walls", () => {
    const out = compute(card("empty-square"), { walls: ["d4"] });
    expect(out.has("a1")).toBe(true); // empty
    expect(out.has("b1")).toBe(false); // occupied (white knight)
    expect(out.has("d4")).toBe(false); // walled
  });

  it("square allows occupied squares (and still excludes walls)", () => {
    const out = compute(card("square"), { walls: ["d4"] });
    expect(out.has("b1")).toBe(true); // occupied is allowed
    expect(out.has("d4")).toBe(false); // wall still excluded
  });

  it("empty-square-own-half restricts to the player's half (ranks 1–4)", () => {
    const out = compute(card("empty-square-own-half"));
    expect(out.has("a1")).toBe(true); // empty, own half
    expect(out.has("a8")).toBe(false); // opponent half
    expect(out.has("b1")).toBe(false); // occupied
    for (const sq of out) expect(Number(sq.slice(1))).toBeLessThanOrEqual(4);
  });

  it("own-piece-then-adjacent-empty (partial) yields adjacent empty squares within bounds and minus walls", () => {
    // Partial on a2 (white pawn). Adjacent in-bounds empties: a1, a3, b1?(occupied),
    // b2, b3. b1 is occupied (white knight) → excluded. Wall b3.
    const out = compute(card("own-piece-then-adjacent-empty"), {
      partial: "a2",
      walls: ["b3"],
    });
    expect(out.has("a1")).toBe(true);
    expect(out.has("a3")).toBe(true);
    expect(out.has("b2")).toBe(true);
    expect(out.has("b1")).toBe(false); // occupied
    expect(out.has("b3")).toBe(false); // walled
  });
});

describe("computeBoardMode", () => {
  it("returns play mode with no targeting card", () => {
    expect(computeBoardMode(null, null, new Set())).toEqual({ kind: "play" });
  });

  it("returns drop-anywhere for a none-target card", () => {
    const mode = computeBoardMode(card("none"), null, new Set());
    expect(mode.kind).toBe("drop-anywhere");
  });

  it("returns target mode carrying the valid set for a targeted card", () => {
    const valid = new Set<AlgebraicSquare>(["b8", "c8"]);
    const mode = computeBoardMode(card("enemy-non-king-piece"), null, valid);
    expect(mode.kind).toBe("target");
    if (mode.kind === "target") {
      expect(mode.valid).toBe(valid);
      expect(mode.cardName).toBe("Test Card");
      expect(mode.hint.length).toBeGreaterThan(0);
    }
  });
});
