// Tests for the five new cards added alongside this PR:
//   Race Condition, Fork, Buffer Overflow, Mutex Lock, Garbage Collect.
// Exercises the new target / effect kinds end-to-end through playCard, and
// the Mutex Lock snapshot/fizzle pipeline through startPlayerTurn.

import { describe, expect, it } from "vitest";

import type { BoardContext, PlayTarget } from "./match";
import {
  clearStatusesOn,
  createMatchCardState,
  lightningAt,
  makeRng,
  playCard,
  relocateStatuses,
  startPlayerTurn,
} from "./match";
import { getCardById } from "./library";
import type { Piece, Side } from "../types";
import type { ZoneBoardContext } from "../overlays/zoneBuffs";

function withPieces(map: Record<string, Piece>): BoardContext {
  return {
    pieceAt: (sq) => map[sq] ?? null,
    hasWall: () => false,
    isAttackedBy: (_sq, _by: Side) => false,
    isRooted: () => false,
  };
}

function zoneCtx(map: Record<string, Piece>): ZoneBoardContext {
  return {
    size: { files: 8, ranks: 8 },
    pieceSideAt: (sq) => map[sq]?.side ?? null,
    pieceTypeAt: (sq) => map[sq]?.type ?? null,
  };
}

function twoSquares(first: string, second: string): PlayTarget {
  return { kind: "two-squares", first, second };
}

describe("Race Condition (swap-enemy-pieces)", () => {
  it("swaps two enemy non-king pieces", () => {
    const rng = makeRng(101);
    const card = getCardById("race-condition");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "race-condition");
    const ctx = withPieces({
      a8: { type: "rook", side: "opponent" },
      h8: { type: "rook", side: "opponent" },
      e8: { type: "king", side: "opponent" },
    });

    const r = playCard(st, idx, twoSquares("a8", "h8"), ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "swap-pieces", a: "a8", b: "h8" }]);
    expect(r.state.energy).toBe(10 - card.cost);
  });

  it("rejects same-square pick", () => {
    const rng = makeRng(102);
    const card = getCardById("race-condition");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "race-condition");
    const ctx = withPieces({ a8: { type: "rook", side: "opponent" } });
    const r = playCard(st, idx, twoSquares("a8", "a8"), ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-distinct");
  });

  it("rejects targeting the enemy king", () => {
    const rng = makeRng(103);
    const card = getCardById("race-condition");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "race-condition");
    const ctx = withPieces({
      a8: { type: "rook", side: "opponent" },
      e8: { type: "king", side: "opponent" },
    });
    const r = playCard(st, idx, twoSquares("a8", "e8"), ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-enemy-non-king-piece");
  });

  it("upgrade lowers cost to 1", () => {
    const card = getCardById("race-condition+");
    expect(card.cost).toBe(1);
  });
});

describe("Fork (summon-adjacent)", () => {
  it("base spawns a pawn on an adjacent empty square", () => {
    const rng = makeRng(110);
    const card = getCardById("fork");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "fork");
    const ctx = withPieces({ d4: { type: "knight", side: "player" } });
    const r = playCard(st, idx, twoSquares("d4", "e5"), ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "place-piece", square: "e5", pieceType: "pawn" }]);
  });

  it("upgrade copies the source piece's type", () => {
    const rng = makeRng(111);
    const card = getCardById("fork+");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "fork+");
    const ctx = withPieces({ d4: { type: "knight", side: "player" } });
    const r = playCard(st, idx, twoSquares("d4", "e5"), ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "place-piece", square: "e5", pieceType: "knight" }]);
  });

  it("rejects a non-adjacent spawn square", () => {
    const rng = makeRng(112);
    const card = getCardById("fork");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "fork");
    const ctx = withPieces({ d4: { type: "knight", side: "player" } });
    const r = playCard(st, idx, twoSquares("d4", "f6"), ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-adjacent");
  });

  it("rejects a non-empty spawn square", () => {
    const rng = makeRng(113);
    const card = getCardById("fork");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "fork");
    const ctx = withPieces({
      d4: { type: "knight", side: "player" },
      e5: { type: "pawn", side: "opponent" },
    });
    const r = playCard(st, idx, twoSquares("d4", "e5"), ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-empty");
  });

  it("allows the king as the source piece", () => {
    const rng = makeRng(114);
    const card = getCardById("fork");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "fork");
    const ctx = withPieces({ e1: { type: "king", side: "player" } });
    const r = playCard(st, idx, twoSquares("e1", "e2"), ctx, rng);
    expect(r.ok).toBe(true);
  });
});

describe("Buffer Overflow (sacrifice-blast-action)", () => {
  it("removes the targeted piece and grants Lightning to adjacent friendlies", () => {
    const rng = makeRng(120);
    const card = getCardById("buffer-overflow");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "buffer-overflow");
    // d4 sacrificed; c3, d3, e3, c4, e4, c5, d5, e5 are adjacent. Only e3
    // and c5 hold friendly pieces.
    const ctx = withPieces({
      d4: { type: "pawn", side: "player" },
      e3: { type: "knight", side: "player" },
      c5: { type: "bishop", side: "player" },
      a1: { type: "rook", side: "player" }, // not adjacent
    });
    const r = playCard(st, idx, { kind: "square", square: "d4" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "remove-piece", square: "d4" }]);
    expect(lightningAt(r.state, "e3")?.remaining).toBe(2);
    expect(lightningAt(r.state, "c5")?.remaining).toBe(2);
    expect(lightningAt(r.state, "a1")).toBeNull();
    // Sacrificed piece itself doesn't get lightning.
    expect(lightningAt(r.state, "d4")).toBeNull();
    // Consumed.
    expect(r.state.consumedPile.some((c) => c.id === "buffer-overflow")).toBe(true);
  });

  it("upgrade extends to knight-jump distance", () => {
    const rng = makeRng(121);
    const card = getCardById("buffer-overflow+");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "buffer-overflow+");
    // d4 sacrificed; knight-L squares are b3,b5,c2,c6,e2,e6,f3,f5. b5 has
    // a friendly knight — only reachable via the knight pattern.
    const ctx = withPieces({
      d4: { type: "pawn", side: "player" },
      b5: { type: "knight", side: "player" },
    });
    const r = playCard(st, idx, { kind: "square", square: "d4" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(lightningAt(r.state, "b5")?.remaining).toBe(2);
  });
});

describe("Mutex Lock", () => {
  it("appends a MutexLockStatus on play", () => {
    const rng = makeRng(130);
    const card = getCardById("mutex-lock");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "mutex-lock");
    const ctx = withPieces({ d4: { type: "knight", side: "player" } });
    const r = playCard(st, idx, { kind: "square", square: "d4" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.mutexLocks).toEqual([{ anchor: "d4", side: "player", remainingTurns: 2 }]);
  });

  it("upgrade has remainingTurns 3", () => {
    const rng = makeRng(131);
    const card = getCardById("mutex-lock+");
    let st = startPlayerTurn(createMatchCardState([card], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "mutex-lock+");
    const ctx = withPieces({ d4: { type: "knight", side: "player" } });
    const r = playCard(st, idx, { kind: "square", square: "d4" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.mutexLocks[0].remainingTurns).toBe(3);
  });

  it("relocateStatuses moves the anchor with the locked piece", () => {
    const before = {
      ...createMatchCardState([], makeRng(132)),
      mutexLocks: [{ anchor: "d4", side: "player" as const, remainingTurns: 2 }],
    };
    const after = relocateStatuses(before, "d4", "d6");
    expect(after.mutexLocks).toEqual([{ anchor: "d6", side: "player", remainingTurns: 2 }]);
  });

  it("clearStatusesOn removes a lock anchored to that square (anchor-lost fizzle)", () => {
    const before = {
      ...createMatchCardState([], makeRng(133)),
      mutexLocks: [{ anchor: "d4", side: "player" as const, remainingTurns: 2 }],
    };
    const after = clearStatusesOn(before, "d4");
    expect(after.mutexLocks).toEqual([]);
  });

  it("startPlayerTurn decrements remainingTurns and drops when it hits 0", () => {
    const rng = makeRng(134);
    const base = createMatchCardState([], rng);
    const board = { d4: { type: "knight" as const, side: "player" as const } };
    let st = startPlayerTurn(base, rng, zoneCtx(board)); // turn 1
    st = {
      ...st,
      mutexLocks: [{ anchor: "d4", side: "player", remainingTurns: 2 }],
    };
    st = startPlayerTurn(st, rng, zoneCtx(board)); // turn 2 — decrement to 1
    expect(st.mutexLocks).toEqual([{ anchor: "d4", side: "player", remainingTurns: 1 }]);
    st = startPlayerTurn(st, rng, zoneCtx(board)); // turn 3 — decrement to 0, drop
    expect(st.mutexLocks).toEqual([]);
  });

  it("startPlayerTurn fizzles the lock when the anchor piece is gone", () => {
    const rng = makeRng(135);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = {
      ...st,
      mutexLocks: [{ anchor: "d4", side: "player", remainingTurns: 2 }],
    };
    // No piece at d4 in the zone context → lock fizzles.
    const after = startPlayerTurn(st, rng, zoneCtx({}));
    expect(after.mutexLocks).toEqual([]);
  });
});

describe("Garbage Collect", () => {
  it("emits a garbage-collect side effect with the correct recursive flag", () => {
    const rng = makeRng(140);
    const base = getCardById("garbage-collect");
    let st = startPlayerTurn(createMatchCardState([base], rng), rng);
    st = { ...st, energy: 20 };
    const idx = st.hand.findIndex((s) => s.card.id === "garbage-collect");
    const ctx = withPieces({});
    const r = playCard(st, idx, { kind: "none" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "garbage-collect", recursive: false }]);
    expect(r.state.consumedPile.some((c) => c.id === "garbage-collect")).toBe(true);
  });

  it("upgrade sets recursive = true", () => {
    const rng = makeRng(141);
    const upg = getCardById("garbage-collect+");
    let st = startPlayerTurn(createMatchCardState([upg], rng), rng);
    st = { ...st, energy: 20 };
    const idx = st.hand.findIndex((s) => s.card.id === "garbage-collect+");
    const ctx = withPieces({});
    const r = playCard(st, idx, { kind: "none" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "garbage-collect", recursive: true }]);
  });
});
