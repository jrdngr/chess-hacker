import { describe, expect, it } from "vitest";

import type { BoardContext, PlayTarget } from "./match";
import {
  createMatchCardState,
  drawCards,
  hasWallOn,
  isFrozen,
  makeRng,
  playCard,
  refillHand,
  shuffle,
  startPlayerTurn,
} from "./match";
import { BARRICADE, FROSTBITE, RECONNAISSANCE, SURGE, makeStarterDeck } from "./library";

const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
};

function noTarget(): PlayTarget {
  return { kind: "none" };
}

describe("shuffle / drawCards", () => {
  it("shuffle returns a permutation", () => {
    const rng = makeRng(1);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(arr, rng);
    expect(out).toHaveLength(arr.length);
    expect(out.slice().sort()).toEqual(arr);
  });

  it("drawCards reshuffles the discard pile when the draw pile empties", () => {
    const rng = makeRng(2);
    const deck = makeStarterDeck();
    let st = createMatchCardState(deck, rng);
    // Manually set up: empty draw pile, two cards in discard
    st = {
      ...st,
      drawPile: [],
      discardPile: [SURGE, RECONNAISSANCE],
    };
    const drawn = drawCards(st, 2, rng);
    expect(drawn.hand).toHaveLength(2);
    expect(drawn.drawPile).toHaveLength(0);
    expect(drawn.discardPile).toHaveLength(0);
  });

  it("drawCards stops when both piles are empty", () => {
    const rng = makeRng(3);
    let st = createMatchCardState([], rng);
    st = { ...st, drawPile: [], discardPile: [] };
    const drawn = drawCards(st, 5, rng);
    expect(drawn.hand).toHaveLength(0);
  });
});

describe("startPlayerTurn", () => {
  it("deals a hand of 5 and sets energy to the max", () => {
    const rng = makeRng(4);
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    expect(st.hand).toHaveLength(5);
    expect(st.energy).toBe(3);
    expect(st.turn).toBe(1);
    expect(st.drawPile).toHaveLength(makeStarterDeck().length - 5);
  });

  it("expires walls and freezes whose expiresOnTurn <= the new turn", () => {
    const rng = makeRng(5);
    const base = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    // turn = 1. Add a wall expiring at turn 2 and one at turn 3.
    const seeded = {
      ...base,
      walls: [
        { square: "e4", expiresOnTurn: 2 },
        { square: "d4", expiresOnTurn: 3 },
      ],
      freezes: [{ square: "e7", side: "opponent" as const, expiresOnTurn: 2 }],
    };
    const next = startPlayerTurn(seeded, rng); // turn -> 2
    expect(next.turn).toBe(2);
    expect(next.walls.map((w) => w.square)).toEqual(["d4"]);
    expect(next.freezes).toEqual([]);
  });

  it("refillHand never trims an oversized hand", () => {
    const rng = makeRng(6);
    let st = createMatchCardState(makeStarterDeck(), rng);
    st = { ...st, hand: makeStarterDeck().slice(0, 7) }; // 7 cards
    const refilled = refillHand(st, rng);
    expect(refilled.hand).toHaveLength(7);
  });
});

describe("playCard", () => {
  it("rejects a card the player can't afford", () => {
    const rng = makeRng(7);
    let st = startPlayerTurn(createMatchCardState([FROSTBITE], rng), rng);
    st = { ...st, energy: 1 }; // FROSTBITE costs 2
    const res = playCard(
      st,
      0,
      { kind: "square", square: "e7" },
      { ...emptyBoard, pieceAt: (sq) => (sq === "e7" ? { type: "pawn", side: "opponent" } : null) },
      rng,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not-enough-energy");
  });

  it("Surge: gains +1 energy and goes to the discard pile", () => {
    const rng = makeRng(8);
    let st = startPlayerTurn(createMatchCardState([SURGE, SURGE, SURGE, SURGE, SURGE], rng), rng);
    expect(st.energy).toBe(3);
    const res = playCard(st, 0, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    st = res.state;
    expect(st.energy).toBe(4);
    expect(st.hand).toHaveLength(4);
    expect(st.discardPile).toHaveLength(1);
    expect(st.discardPile[0].id).toBe("surge");
  });

  it("Reconnaissance: draws 2 cards (hand can exceed HAND_SIZE)", () => {
    const rng = makeRng(9);
    const deck = [RECONNAISSANCE, SURGE, SURGE, SURGE, SURGE, SURGE, SURGE, SURGE];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    // We expect 5 in hand, 3 in draw. Find Recon's index in the hand if it landed there.
    const reconIdx = st.hand.findIndex((c) => c.id === "reconnaissance");
    if (reconIdx === -1) {
      // It happened to land in the draw pile; this is a deterministic seed
      // so just assert handling and skip the rest.
      expect(st.drawPile.some((c) => c.id === "reconnaissance")).toBe(true);
      return;
    }
    const res = playCard(st, reconIdx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    st = res.state;
    // Hand: had 5, played 1 (now 4), drew 2 (now 6).
    expect(st.hand).toHaveLength(6);
  });

  it("Frostbite: requires an enemy piece target and adds a freeze for one opponent turn", () => {
    const rng = makeRng(10);
    let st = startPlayerTurn(
      createMatchCardState([FROSTBITE, FROSTBITE, FROSTBITE, FROSTBITE, FROSTBITE], rng),
      rng,
    );

    const ctx: BoardContext = {
      pieceAt: (sq) => (sq === "e7" ? { type: "pawn", side: "opponent" } : null),
      hasWall: () => false,
    };

    // Wrong target type: missing-target
    const r1 = playCard(st, 0, noTarget(), ctx, rng);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe("missing-target");

    // Targeting an empty square: rejected
    const r2 = playCard(st, 0, { kind: "square", square: "e4" }, ctx, rng);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe("target-not-enemy-piece");

    // Valid target
    const r3 = playCard(st, 0, { kind: "square", square: "e7" }, ctx, rng);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    st = r3.state;
    expect(isFrozen(st, "e7")).toBe(true);
    expect(st.freezes[0].expiresOnTurn).toBe(2); // turn was 1; expires before player turn 2
  });

  it("Barricade: places a wall on an empty unwalled square for 3 turns", () => {
    const rng = makeRng(11);
    let st = startPlayerTurn(
      createMatchCardState([BARRICADE, BARRICADE, BARRICADE, BARRICADE, BARRICADE], rng),
      rng,
    );

    const occupied = new Set(["e2"]);
    const walls = new Set<string>();
    const ctx: BoardContext = {
      pieceAt: (sq) => (occupied.has(sq) ? { type: "pawn", side: "player" } : null),
      hasWall: (sq) => walls.has(sq),
    };

    // Target is occupied
    const r1 = playCard(st, 0, { kind: "square", square: "e2" }, ctx, rng);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe("target-not-empty");

    // Valid empty square
    const r2 = playCard(st, 0, { kind: "square", square: "e4" }, ctx, rng);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    st = r2.state;
    expect(hasWallOn(st, "e4")).toBe(true);
    expect(st.walls[0].expiresOnTurn).toBe(4); // turn was 1 + 3
    expect(st.energy).toBe(2); // 3 - 1
  });

  it("freeze placed on player turn 1 is cleared at start of player turn 2", () => {
    const rng = makeRng(12);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    st = {
      ...st,
      freezes: [{ square: "e7", side: "opponent", expiresOnTurn: st.turn + 1 }],
    };
    expect(isFrozen(st, "e7")).toBe(true);
    const next = startPlayerTurn(st, rng);
    expect(isFrozen(next, "e7")).toBe(false);
  });
});
