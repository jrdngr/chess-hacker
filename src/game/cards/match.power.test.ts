// Power cards (Slay-the-Spire-style match-scoped passives).
// Each Power lands on `MatchCardState.activePowers` and stays for the rest of
// the match; the per-turn budget reads them off at start-of-turn.

import { describe, expect, it } from "vitest";

import {
  ENERGY_PER_TURN,
  DRAW_PER_TURN,
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

describe("Power: synthetic energy-per-turn", () => {
  it("appends to activePowers and raises the per-turn baseline", () => {
    const rng = makeRng(3);
    const power = syntheticPower("test-power-energy", { kind: "energy-per-turn", amount: 1 });
    let st = startPlayerTurn(createMatchCardState([power], rng), rng);
    st = { ...st, energy: 20 };
    const idx = st.hand.findIndex((s) => s.card.id === power.id);
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.consumedPile.some((c) => c.id === power.id)).toBe(true);
    expect(st.activePowers).toEqual([{ kind: "energy-per-turn", amount: 1 }]);
    // Next turn adds ENERGY_PER_TURN (1) + power bonus (1) = 2 to the pool.
    // Previous energy was 20 - 4 (power cost) = 16, clamped to 16.
    const prevEnergy = st.energy;
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(prevEnergy + ENERGY_PER_TURN + 1);
  });
});

describe("Power: synthetic draw-per-turn", () => {
  it("inflates the start-of-turn draw by 1", () => {
    const rng = makeRng(4);
    const power = syntheticPower("test-power-draw", { kind: "draw-per-turn", amount: 1 });
    const deck = [power, ...Array.from({ length: 19 }, () => getCardById("firewall"))];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: 20 };
    const idx = st.hand.findIndex((s) => s.card.id === power.id);
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.activePowers).toEqual([{ kind: "draw-per-turn", amount: 1 }]);
    // Next turn draws DRAW_PER_TURN (2) + 1 = 3 cards
    const handAfterPlay = st.hand.length;
    st = startPlayerTurn(st, rng);
    expect(st.hand.length).toBe(handAfterPlay + DRAW_PER_TURN + 1);
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
    st = { ...st, energy: 20 };
    const idx = st.hand.findIndex((s) => s.card.id === power.id);
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.activePowers).toEqual([{ kind: "extra-chess-move-per-turn", amount: 1 }]);
    st = startPlayerTurn(st, rng);
    expect(st.playerExtraMovesRemaining).toBe(1);
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
    st = { ...st, energy: 20 };
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
    const prevEnergy = st.energy;
    st = startPlayerTurn(st, rng);
    // Adds ENERGY_PER_TURN (1) + 2 power bonuses = 3
    expect(st.energy).toBe(prevEnergy + ENERGY_PER_TURN + 2);
  });

  it("createMatchCardState initialises activePowers to []", () => {
    const rng = makeRng(7);
    const st = createMatchCardState([], rng);
    expect(st.activePowers).toEqual([]);
  });
});

describe("Power: Garrison Mode (shield-back-rank-per-turn, king excluded)", () => {
  it("shields rank-1 player pieces except the king at start-of-turn", () => {
    const rng = makeRng(9);
    const power = getCardById("garrison-mode");
    let st = startPlayerTurn(createMatchCardState([power], rng), rng);
    st = { ...st, energy: 20 };
    const idx = st.hand.findIndex((s) => s.card.id === "garrison-mode");
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    const pieces: Record<string, { side: "player" | "opponent"; type: string }> = {
      e1: { side: "player", type: "king" },
      a1: { side: "player", type: "rook" },
      h1: { side: "player", type: "rook" },
      d2: { side: "player", type: "pawn" },
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
    expect(shielded.has("e1")).toBe(false);
    expect(shielded.has("d2")).toBe(false);
  });
});
