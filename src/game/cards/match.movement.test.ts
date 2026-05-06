// Resolver tests for the new movement / haste cards introduced by the
// power-curve overhaul: Sprint, Vanguard, Blitz, Reinforce.

import { describe, expect, it } from "vitest";

import {
  ENERGY_MAX,
  createMatchCardState,
  makeRng,
  playCard,
  startPlayerTurn,
  type BoardContext,
} from "./match";
import { getCardById } from "./library";

const noTarget = { kind: "none" } as const;

function ctxFrom(pieces: Record<string, { side: "player" | "opponent"; type: string }>) {
  const ctx: BoardContext = {
    pieceAt: (sq) => {
      const p = pieces[sq];
      if (!p) return null;
      return { side: p.side, type: p.type as never };
    },
    hasWall: () => false,
    isAttackedBy: () => false,
    isRooted: () => false,
    boardRanks: 8,
    boardFiles: 8,
  };
  return ctx;
}

describe("Sprint", () => {
  it("applies Haste to a friendly piece (1-turn)", () => {
    const rng = makeRng(1);
    const sprint = getCardById("sprint");
    let st = startPlayerTurn(createMatchCardState([sprint], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = ctxFrom({ d4: { side: "player", type: "knight" } });
    const idx = st.hand.findIndex((s) => s.card.id === "sprint");
    const r = playCard(st, idx, { kind: "square", square: "d4" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.hastes.find((h) => h.square === "d4")).toBeTruthy();
    // Default duration = 1 turn → expires next turn-start.
    expect(r.state.hastes[0].expiresOnTurn).toBe(st.turn + 1);
  });
});

describe("Vanguard (pawn-only Overclock)", () => {
  it("rejects a non-pawn target", () => {
    const rng = makeRng(2);
    const vanguard = getCardById("vanguard");
    let st = startPlayerTurn(createMatchCardState([vanguard], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = ctxFrom({ b1: { side: "player", type: "knight" } });
    const idx = st.hand.findIndex((s) => s.card.id === "vanguard");
    const r = playCard(st, idx, { kind: "square", square: "b1" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-piece-type-mismatch");
  });

  it("grants Lightning (2 actions) to a player pawn", () => {
    const rng = makeRng(3);
    const vanguard = getCardById("vanguard");
    let st = startPlayerTurn(createMatchCardState([vanguard], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = ctxFrom({ d2: { side: "player", type: "pawn" } });
    const idx = st.hand.findIndex((s) => s.card.id === "vanguard");
    const r = playCard(st, idx, { kind: "square", square: "d2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lightning = r.state.lightnings.find((l) => l.square === "d2");
    expect(lightning).toBeDefined();
    expect(lightning?.remaining).toBe(2);
  });
});

describe("Blitz (haste-all-of-type pawn, 3 turns)", () => {
  it("hastes every player pawn on the board", () => {
    const rng = makeRng(4);
    const blitz = getCardById("blitz");
    let st = startPlayerTurn(createMatchCardState([blitz], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = ctxFrom({
      a2: { side: "player", type: "pawn" },
      d2: { side: "player", type: "pawn" },
      g7: { side: "opponent", type: "pawn" }, // not affected
      e1: { side: "player", type: "king" }, // not a pawn
    });
    const idx = st.hand.findIndex((s) => s.card.id === "blitz");
    const r = playCard(st, idx, noTarget, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const hasted = new Set(r.state.hastes.map((h) => h.square));
    expect(hasted.has("a2")).toBe(true);
    expect(hasted.has("d2")).toBe(true);
    expect(hasted.has("g7")).toBe(false);
    expect(hasted.has("e1")).toBe(false);
    // Duration is 3 turns → expiresOnTurn = state.turn + 3.
    for (const h of r.state.hastes) {
      expect(h.expiresOnTurn).toBe(st.turn + 3);
    }
  });
});

describe("Reinforce", () => {
  it("emits a place-piece(pawn) on an empty player-half square", () => {
    const rng = makeRng(5);
    const reinforce = getCardById("reinforce");
    let st = startPlayerTurn(createMatchCardState([reinforce], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = ctxFrom({}); // empty board
    const idx = st.hand.findIndex((s) => s.card.id === "reinforce");
    const r = playCard(st, idx, { kind: "square", square: "d3" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "place-piece", square: "d3", pieceType: "pawn" }]);
  });

  it("rejects a square in the opponent's half", () => {
    const rng = makeRng(6);
    const reinforce = getCardById("reinforce");
    let st = startPlayerTurn(createMatchCardState([reinforce], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = ctxFrom({});
    const idx = st.hand.findIndex((s) => s.card.id === "reinforce");
    const r = playCard(st, idx, { kind: "square", square: "d6" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-in-own-half");
  });
});
