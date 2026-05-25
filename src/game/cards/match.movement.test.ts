// Resolver tests for movement / haste cards: Overclock, Vanguard, Reinforce.

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

describe("Overclock (Haste + Disarm)", () => {
  it("applies Haste to a friendly piece (1-turn)", () => {
    const rng = makeRng(1);
    const overclock = getCardById("overclock");
    let st = startPlayerTurn(createMatchCardState([overclock], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = ctxFrom({ d4: { side: "player", type: "knight" } });
    const idx = st.hand.findIndex((s) => s.card.id === "overclock");
    const r = playCard(st, idx, { kind: "square", square: "d4" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.hastes.find((h) => h.square === "d4")).toBeTruthy();
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
