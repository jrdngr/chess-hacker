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

const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
  isAttackedBy: () => false,
  isRooted: () => false,
};

const noTarget = { kind: "none" } as const;

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

describe("Power: Daemon Process (+1 energy per turn)", () => {
  it("appends to activePowers and raises the per-turn baseline", () => {
    const rng = makeRng(3);
    const power = getCardById("daemon-process");
    let st = startPlayerTurn(createMatchCardState([power], rng), rng);
    st = { ...st, energy: 99 };
    const idx = st.hand.findIndex((s) => s.card.id === "daemon-process");
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    // Power card itself is consumed.
    expect(st.consumedPile.some((c) => c.id === "daemon-process")).toBe(true);
    expect(st.activePowers).toEqual([{ kind: "energy-per-turn", amount: 1 }]);
    // Next turn baseline is 4, not 3.
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(STARTING_ENERGY + 1);
    // And every subsequent turn.
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(STARTING_ENERGY + 1);
  });
});

describe("Power: tail -f (+1 draw per turn)", () => {
  it("inflates the start-of-turn refill by 1", () => {
    const rng = makeRng(4);
    const power = getCardById("tail-f");
    // 20-card deck so refills don't fizzle.
    const deck = [power, ...Array.from({ length: 19 }, () => getCardById("firewall"))];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: 99 };
    const idx = st.hand.findIndex((s) => s.card.id === "tail-f");
    const r = playCard(st, idx, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.activePowers).toEqual([{ kind: "draw-per-turn", amount: 1 }]);
    st = startPlayerTurn(st, rng);
    expect(st.hand.length).toBe(HAND_SIZE + 1);
  });
});

describe("Power: Fork Process (+1 chess move per turn)", () => {
  it("re-arms playerExtraMovesRemaining at every start-of-turn", () => {
    const rng = makeRng(5);
    const power = getCardById("fork-process");
    let st = startPlayerTurn(createMatchCardState([power], rng), rng);
    st = { ...st, energy: 99 };
    const idx = st.hand.findIndex((s) => s.card.id === "fork-process");
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
  it("two Daemon Processes give +2 energy/turn", () => {
    const rng = makeRng(6);
    const power = getCardById("daemon-process");
    let st = startPlayerTurn(createMatchCardState([power, power], rng), rng);
    st = { ...st, energy: 99 };
    const i1 = st.hand.findIndex((s) => s.card.id === "daemon-process");
    let r = playCard(st, i1, noTarget, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    const i2 = st.hand.findIndex((s) => s.card.id === "daemon-process");
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
