// Power cards (Slay-the-Spire-style match-scoped passives) and Cache Warmup.
// Each Power lands on `MatchCardState.activePowers` and stays for the rest of
// the match; the per-turn budget reads them off at start-of-turn. Cache Warmup
// queues a one-shot `+N energy` onto the next turn-start.

import { describe, expect, it } from "vitest";

import {
  HAND_SIZE,
  STARTING_ENERGY,
  createMatchCardState,
  makeRng,
  playCard,
  startPlayerTurn,
  type BoardContext,
} from "./match";
import { getCardById } from "./library";
import type { Card } from "../types";

const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
  isAttackedBy: () => false,
  isRooted: () => false,
};

const noTarget = { kind: "none" } as const;

// Synthetic Power-card builder for tests covering the legacy power kinds
// (energy-per-turn / draw-per-turn / extra-chess-move-per-turn). The original
// cards (Daemon Process, tail -f, Fork Process) were retired in the
// power-curve overhaul, but the kinds themselves remain valid in the schema.
function syntheticPower(
  id: string,
  inner: {
    kind: "energy-per-turn" | "draw-per-turn" | "extra-chess-move-per-turn";
    amount: number;
  },
): Card {
  return {
    id,
    name: id,
    cost: 4,
    rarity: "rare",
    archetype: "power",
    consume: true,
    description: `Synthetic Power: ${inner.kind}.`,
    target: { kind: "none" },
    effect: { kind: "play-power", effect: inner },
  };
}

describe("Cache Warmup", () => {
  it("queues +2 energy onto the next start-of-turn and clears after applying", () => {
    const rng = makeRng(1);
    const cache = getCardById("cache-warmup");
    let st = startPlayerTurn(createMatchCardState([cache], rng), rng);
    const idx = st.hand.findIndex((s) => s.card.id === "cache-warmup");
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.pendingEnergyNextTurn).toBe(2);
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(STARTING_ENERGY + 2);
    expect(st.pendingEnergyNextTurn).toBe(0);
    // No carryover into turn 3.
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(STARTING_ENERGY);
  });

  it("two Cache Warmups in one turn stack", () => {
    const rng = makeRng(2);
    const cache = getCardById("cache-warmup");
    let st = startPlayerTurn(createMatchCardState([cache, cache], rng), rng);
    st = { ...st, energy: 99 };
    // Find both copies and play sequentially.
    const i1 = st.hand.findIndex((s) => s.card.id === "cache-warmup");
    const r1 = playCard(st, i1, noTarget, emptyBoard, rng);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    st = r1.state;
    const i2 = st.hand.findIndex((s) => s.card.id === "cache-warmup");
    const r2 = playCard(st, i2, noTarget, emptyBoard, rng);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    st = r2.state;
    expect(st.pendingEnergyNextTurn).toBe(4);
  });
});

describe("Power: synthetic energy-per-turn", () => {
  it("appends to activePowers and raises the per-turn baseline", () => {
    const rng = makeRng(3);
    const power = syntheticPower("test-power-energy", { kind: "energy-per-turn", amount: 1 });
    let st = startPlayerTurn(createMatchCardState([power], rng), rng);
    st = { ...st, energy: 99 };
    const idx = st.hand.findIndex((s) => s.card.id === power.id);
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    // Power card itself is consumed.
    expect(st.consumedPile.some((c) => c.id === power.id)).toBe(true);
    expect(st.activePowers).toEqual([{ kind: "energy-per-turn", amount: 1 }]);
    // Next turn baseline is 4, not 3.
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(STARTING_ENERGY + 1);
    // And every subsequent turn.
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(STARTING_ENERGY + 1);
  });
});

describe("Power: synthetic draw-per-turn", () => {
  it("inflates the start-of-turn refill by 1", () => {
    const rng = makeRng(4);
    const power = syntheticPower("test-power-draw", { kind: "draw-per-turn", amount: 1 });
    // 20-card deck so refills don't fizzle.
    const deck = [power, ...Array.from({ length: 19 }, () => getCardById("firewall"))];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: 99 };
    const idx = st.hand.findIndex((s) => s.card.id === power.id);
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.activePowers).toEqual([{ kind: "draw-per-turn", amount: 1 }]);
    st = startPlayerTurn(st, rng);
    expect(st.hand.length).toBe(HAND_SIZE + 1);
  });
});

describe("Power: synthetic extra-chess-move-per-turn", () => {
  it("re-arms playerExtraMovesRemaining at every start-of-turn", () => {
    const rng = makeRng(5);
    const power = syntheticPower("test-power-extra", {
      kind: "extra-chess-move-per-turn",
      amount: 1,
    });
    let st = startPlayerTurn(createMatchCardState([power], rng), rng);
    st = { ...st, energy: 99 };
    const idx = st.hand.findIndex((s) => s.card.id === power.id);
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.activePowers).toEqual([{ kind: "extra-chess-move-per-turn", amount: 1 }]);
    // The next start-of-turn should set the budget to 1.
    st = startPlayerTurn(st, rng);
    expect(st.playerExtraMovesRemaining).toBe(1);
    // And re-arm again on turn 3, even after the previous turn would have
    // decremented it (Match.tsx does that bookkeeping).
    st = { ...st, playerExtraMovesRemaining: 0 };
    st = startPlayerTurn(st, rng);
    expect(st.playerExtraMovesRemaining).toBe(1);
  });
});

describe("Power stacking", () => {
  it("two energy-per-turn powers give +2 energy/turn", () => {
    const rng = makeRng(6);
    const power = syntheticPower("test-power-energy", { kind: "energy-per-turn", amount: 1 });
    let st = startPlayerTurn(createMatchCardState([power, power], rng), rng);
    st = { ...st, energy: 99 };
    const i1 = st.hand.findIndex((s) => s.card.id === power.id);
    let r = playCard(st, i1, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    const i2 = st.hand.findIndex((s) => s.card.id === power.id);
    r = playCard(st, i2, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.activePowers).toHaveLength(2);
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(STARTING_ENERGY + 2);
  });

  it("createMatchCardState initialises activePowers to []", () => {
    const rng = makeRng(7);
    const st = createMatchCardState([], rng);
    expect(st.activePowers).toEqual([]);
  });
});

describe("Power: Pawn Storm Power (haste-pawns-per-turn)", () => {
  it("appends to activePowers and hastes every player pawn at start-of-turn", () => {
    const rng = makeRng(8);
    const power = getCardById("pawn-storm-power");
    let st = startPlayerTurn(createMatchCardState([power], rng), rng);
    st = { ...st, energy: 99 };
    const idx = st.hand.findIndex((s) => s.card.id === "pawn-storm-power");
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.activePowers).toEqual([{ kind: "haste-pawns-per-turn", amount: 1 }]);
    // Build a board context with two player pawns and one player rook.
    const pieces: Record<string, { side: "player" | "opponent"; type: string }> = {
      d2: { side: "player", type: "pawn" },
      e2: { side: "player", type: "pawn" },
      a1: { side: "player", type: "rook" },
    };
    const ctx = {
      size: { files: 8, ranks: 8 },
      pieceSideAt: (sq: string) => pieces[sq]?.side ?? null,
      pieceTypeAt: (sq: string) => (pieces[sq]?.type ?? null) as never,
    };
    st = startPlayerTurn(st, rng, ctx);
    const hastedSquares = new Set(st.hastes.map((h) => h.square));
    expect(hastedSquares.has("d2")).toBe(true);
    expect(hastedSquares.has("e2")).toBe(true);
    expect(hastedSquares.has("a1")).toBe(false);
  });
});

describe("Power: Garrison Mode (shield-back-rank-per-turn, king excluded)", () => {
  it("shields rank-1 player pieces except the king at start-of-turn", () => {
    const rng = makeRng(9);
    const power = getCardById("garrison-mode");
    let st = startPlayerTurn(createMatchCardState([power], rng), rng);
    st = { ...st, energy: 99 };
    const idx = st.hand.findIndex((s) => s.card.id === "garrison-mode");
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    const pieces: Record<string, { side: "player" | "opponent"; type: string }> = {
      e1: { side: "player", type: "king" },
      a1: { side: "player", type: "rook" },
      h1: { side: "player", type: "rook" },
      d2: { side: "player", type: "pawn" }, // not on rank 1, no shield
    };
    const ctx = {
      size: { files: 8, ranks: 8 },
      pieceSideAt: (sq: string) => pieces[sq]?.side ?? null,
      pieceTypeAt: (sq: string) => (pieces[sq]?.type ?? null) as never,
    };
    st = startPlayerTurn(st, rng, ctx);
    const shielded = new Set(st.shields.map((s) => s.square));
    expect(shielded.has("a1")).toBe(true);
    expect(shielded.has("h1")).toBe(true);
    expect(shielded.has("e1")).toBe(false); // king excluded
    expect(shielded.has("d2")).toBe(false); // not on rank 1
  });
});
