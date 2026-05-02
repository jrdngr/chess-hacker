import { describe, expect, it } from "vitest";

import type { BoardContext, PlayTarget } from "./match";
import {
  createMatchCardState,
  drawCards,
  hasWallOn,
  isCompelled,
  isDisarmed,
  isFrozen,
  isRooted,
  isShielded,
  hasSanctuary,
  hasteAt,
  lightningAt,
  empowerAt,
  trapAt,
  isInPlayerHalf,
  makeRng,
  playCard,
  refillHand,
  relocateStatuses,
  clearStatusesOn,
  setDeckTop,
  consumeHaste,
  shuffle,
  startPlayerTurn,
} from "./match";
import {
  BARRICADE,
  CONJURE_KNIGHT,
  CROOKED_PATH,
  FORESIGHT,
  FROSTBITE,
  FROZEN_ROOTS,
  FUMBLE,
  HALLOWED_GROUND,
  IRON_GUARD,
  LIGHTNING_STRIKE,
  MARIONETTE,
  MARTYRS_GIFT,
  PROVOKE,
  QUICKSTEP,
  RECONNAISSANCE,
  SNARE,
  SPIKE_PIT,
  SPRING_TRAP,
  SWITCH_FILES,
  makeStarterDeck,
} from "./library";
import type { Piece } from "../types";

const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
};

function noTarget(): PlayTarget {
  return { kind: "none" };
}

function withPieces(map: Record<string, Piece>): BoardContext {
  return {
    pieceAt: (sq) => map[sq] ?? null,
    hasWall: () => false,
  };
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
    st = {
      ...st,
      drawPile: [],
      discardPile: [BARRICADE, RECONNAISSANCE],
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

  it("expires walls, freezes, and other timed statuses whose expiresOnTurn <= the new turn", () => {
    const rng = makeRng(5);
    const base = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    const seeded = {
      ...base,
      walls: [
        { square: "e4", expiresOnTurn: 2 },
        { square: "d4", expiresOnTurn: 3 },
      ],
      freezes: [{ square: "e7", side: "opponent" as const, expiresOnTurn: 2 }],
      roots: [{ square: "d7", side: "opponent" as const, expiresOnTurn: 2 }],
      shields: [{ square: "e2", side: "player" as const, expiresOnTurn: 2 }],
      hastes: [{ square: "f1", side: "player" as const, expiresOnTurn: 2 }],
      sanctuaries: [{ square: "c4", expiresOnTurn: 3 }],
      traps: [{ square: "b4", effect: "freeze" as const, expiresOnTurn: 2 }],
    };
    const next = startPlayerTurn(seeded, rng); // turn -> 2
    expect(next.turn).toBe(2);
    expect(next.walls.map((w) => w.square)).toEqual(["d4"]);
    expect(next.freezes).toEqual([]);
    expect(next.roots).toEqual([]);
    expect(next.shields).toEqual([]);
    expect(next.hastes).toEqual([]);
    expect(next.sanctuaries.map((s) => s.square)).toEqual(["c4"]);
    expect(next.traps).toEqual([]);
  });

  it("refillHand never trims an oversized hand", () => {
    const rng = makeRng(6);
    let st = createMatchCardState(makeStarterDeck(), rng);
    st = { ...st, hand: makeStarterDeck().slice(0, 7) };
    const refilled = refillHand(st, rng);
    expect(refilled.hand).toHaveLength(7);
  });
});

describe("playCard — resource", () => {
  it("rejects a card the player can't afford", () => {
    const rng = makeRng(7);
    let st = startPlayerTurn(createMatchCardState([FROSTBITE], rng), rng);
    st = { ...st, energy: 1 };
    const res = playCard(
      st,
      0,
      { kind: "square", square: "e7" },
      withPieces({ e7: { type: "pawn", side: "opponent" } }),
      rng,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not-enough-energy");
  });

  it("Reconnaissance: draws 2 cards (hand can exceed HAND_SIZE)", () => {
    const rng = makeRng(9);
    const deck = [
      RECONNAISSANCE,
      BARRICADE,
      BARRICADE,
      BARRICADE,
      BARRICADE,
      BARRICADE,
      BARRICADE,
      BARRICADE,
    ];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    const reconIdx = st.hand.findIndex((c) => c.id === "reconnaissance");
    if (reconIdx === -1) {
      expect(st.drawPile.some((c) => c.id === "reconnaissance")).toBe(true);
      return;
    }
    const res = playCard(st, reconIdx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    st = res.state;
    expect(st.hand).toHaveLength(6);
  });

  it("Foresight: pays 0 energy and discards (UI does the reorder via setDeckTop)", () => {
    const rng = makeRng(20);
    const deck = [FORESIGHT, BARRICADE, BARRICADE, BARRICADE, BARRICADE, BARRICADE];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    const idx = st.hand.findIndex((c) => c.id === "foresight");
    if (idx === -1) return;
    const energyBefore = st.energy;
    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    st = res.state;
    expect(st.energy).toBe(energyBefore); // 0-cost
    expect(st.discardPile.some((c) => c.id === "foresight")).toBe(true);
  });
});

describe("playCard — disruption / spatial", () => {
  it("Frostbite: requires an enemy piece target and adds a freeze", () => {
    const rng = makeRng(10);
    let st = startPlayerTurn(
      createMatchCardState([FROSTBITE, FROSTBITE, FROSTBITE, FROSTBITE, FROSTBITE], rng),
      rng,
    );
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });

    const r1 = playCard(st, 0, noTarget(), ctx, rng);
    expect(r1.ok).toBe(false);

    const r2 = playCard(st, 0, { kind: "square", square: "e4" }, ctx, rng);
    expect(r2.ok).toBe(false);

    const r3 = playCard(st, 0, { kind: "square", square: "e7" }, ctx, rng);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    st = r3.state;
    expect(isFrozen(st, "e7")).toBe(true);
    expect(st.freezes[0].expiresOnTurn).toBe(2);
  });

  it("Frozen Roots / Fumble / Provoke add the right status", () => {
    const rng = makeRng(30);
    const deck = [FROZEN_ROOTS, FUMBLE, PROVOKE];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: 10 };
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });

    const idxRoots = st.hand.findIndex((c) => c.id === "frozen-roots");
    const r1 = playCard(st, idxRoots, { kind: "square", square: "e7" }, ctx, rng);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    st = r1.state;
    expect(isRooted(st, "e7")).toBe(true);

    const idxFumble = st.hand.findIndex((c) => c.id === "fumble");
    const r2 = playCard(st, idxFumble, { kind: "square", square: "e7" }, ctx, rng);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    st = r2.state;
    expect(isDisarmed(st, "e7")).toBe(true);

    const idxProvoke = st.hand.findIndex((c) => c.id === "provoke");
    const r3 = playCard(st, idxProvoke, { kind: "square", square: "e7" }, ctx, rng);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    st = r3.state;
    expect(isCompelled(st, "e7")).toBe(true);
  });

  it("Barricade: places a wall on an empty unwalled square for 3 turns", () => {
    const rng = makeRng(11);
    let st = startPlayerTurn(
      createMatchCardState([BARRICADE, BARRICADE, BARRICADE, BARRICADE, BARRICADE], rng),
      rng,
    );
    const ctx: BoardContext = {
      pieceAt: (sq) => (sq === "e2" ? { type: "pawn", side: "player" } : null),
      hasWall: () => false,
    };

    const r1 = playCard(st, 0, { kind: "square", square: "e2" }, ctx, rng);
    expect(r1.ok).toBe(false);

    const r2 = playCard(st, 0, { kind: "square", square: "e4" }, ctx, rng);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    st = r2.state;
    expect(hasWallOn(st, "e4")).toBe(true);
    expect(st.walls[0].expiresOnTurn).toBe(4);
    expect(st.energy).toBe(2);
  });

  it("Hallowed Ground places a Sanctuary; Spike Pit / Snare / Spring Trap place Traps", () => {
    const rng = makeRng(40);
    const deck = [HALLOWED_GROUND, SPIKE_PIT, SNARE, SPRING_TRAP];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: 10 };

    const play = (id: string, sq: string) => {
      const idx = st.hand.findIndex((c) => c.id === id);
      const r = playCard(st, idx, { kind: "square", square: sq }, emptyBoard, rng);
      expect(r.ok).toBe(true);
      if (r.ok) st = r.state;
    };

    play("hallowed-ground", "d4");
    expect(hasSanctuary(st, "d4")).toBe(true);
    play("spike-pit", "e4");
    expect(trapAt(st, "e4")?.effect).toBe("capture");
    play("snare", "f4");
    expect(trapAt(st, "f4")?.effect).toBe("freeze");
    play("spring-trap", "g4");
    expect(trapAt(st, "g4")?.effect).toBe("push");
  });
});

describe("playCard — buffs", () => {
  it("Iron Guard: targets own piece and shields it", () => {
    const rng = makeRng(50);
    let st = startPlayerTurn(createMatchCardState([IRON_GUARD], rng), rng);
    const ctx = withPieces({ e2: { type: "pawn", side: "player" } });

    const idx = st.hand.findIndex((c) => c.id === "iron-guard");
    const r = playCard(st, idx, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(isShielded(st, "e2")).toBe(true);
  });

  it("Iron Guard rejects an enemy piece target", () => {
    const rng = makeRng(51);
    const st = startPlayerTurn(createMatchCardState([IRON_GUARD], rng), rng);
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });
    const idx = st.hand.findIndex((c) => c.id === "iron-guard");
    const r = playCard(st, idx, { kind: "square", square: "e7" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-own-piece");
  });

  it("Quickstep applies Haste on an own piece", () => {
    const rng = makeRng(52);
    let st = startPlayerTurn(createMatchCardState([QUICKSTEP], rng), rng);
    const ctx = withPieces({ d2: { type: "knight", side: "player" } });
    const idx = st.hand.findIndex((c) => c.id === "quickstep");
    const r = playCard(st, idx, { kind: "square", square: "d2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(hasteAt(st, "d2")).not.toBeNull();
  });

  it("Lightning Strike grants 2 actions and consumes the card", () => {
    const rng = makeRng(53);
    let st = startPlayerTurn(createMatchCardState([LIGHTNING_STRIKE], rng), rng);
    st = { ...st, energy: 10 };
    const ctx = withPieces({ e1: { type: "queen", side: "player" } });
    const idx = st.hand.findIndex((c) => c.id === "lightning-strike");
    const r = playCard(st, idx, { kind: "square", square: "e1" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(lightningAt(st, "e1")?.remaining).toBe(2);
    expect(st.consumedPile.some((c) => c.id === "lightning-strike")).toBe(true);
  });

  it("Crooked Path applies Empower with knight pattern", () => {
    const rng = makeRng(54);
    let st = startPlayerTurn(createMatchCardState([CROOKED_PATH], rng), rng);
    const ctx = withPieces({ a1: { type: "rook", side: "player" } });
    const idx = st.hand.findIndex((c) => c.id === "crooked-path");
    const r = playCard(st, idx, { kind: "square", square: "a1" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(empowerAt(st, "a1")?.pattern).toBe("knight");
  });
});

describe("playCard — sacrifice / summon / swap / marionette", () => {
  it("Martyr's Gift: rejects king target, accepts non-king, draws + gains energy", () => {
    const rng = makeRng(60);
    const deck = [
      MARTYRS_GIFT,
      BARRICADE,
      BARRICADE,
      BARRICADE,
      BARRICADE,
      BARRICADE,
      BARRICADE,
      BARRICADE,
    ];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    const idx = st.hand.findIndex((c) => c.id === "martyrs-gift");
    if (idx === -1) return;
    const ctx = withPieces({
      e1: { type: "king", side: "player" },
      a2: { type: "pawn", side: "player" },
    });

    const rKing = playCard(st, idx, { kind: "square", square: "e1" }, ctx, rng);
    expect(rKing.ok).toBe(false);
    if (!rKing.ok) expect(rKing.reason).toBe("target-not-own-non-king-piece");

    const energyBefore = st.energy;
    const handBefore = st.hand.length;
    const r = playCard(st, idx, { kind: "square", square: "a2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.energy).toBe(energyBefore - 1 + 1); // -1 cost, +1 energyGain
    // -1 played + 2 drawn = +1 hand
    expect(st.hand.length).toBe(handBefore - 1 + 2);
    expect(r.sideEffects).toEqual([{ kind: "remove-piece", square: "a2" }]);
  });

  it("Conjure Knight: rejects squares outside own half, accepts ranks 1-4, emits place-piece", () => {
    const rng = makeRng(70);
    let st = startPlayerTurn(createMatchCardState([CONJURE_KNIGHT], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((c) => c.id === "conjure-knight");

    const rOpp = playCard(st, idx, { kind: "square", square: "e5" }, emptyBoard, rng);
    expect(rOpp.ok).toBe(false);
    if (!rOpp.ok) expect(rOpp.reason).toBe("target-not-in-own-half");

    const r = playCard(st, idx, { kind: "square", square: "e3" }, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "place-piece", square: "e3", pieceType: "knight" }]);
    expect(r.state.consumedPile.some((c) => c.id === "conjure-knight")).toBe(true);
  });

  it("Switch Files: requires two distinct own-piece squares; emits swap-pieces", () => {
    const rng = makeRng(80);
    let st = startPlayerTurn(createMatchCardState([SWITCH_FILES], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((c) => c.id === "switch-files");
    const ctx = withPieces({
      a1: { type: "rook", side: "player" },
      h1: { type: "rook", side: "player" },
    });

    const rDup = playCard(st, idx, { kind: "two-squares", first: "a1", second: "a1" }, ctx, rng);
    expect(rDup.ok).toBe(false);
    if (!rDup.ok) expect(rDup.reason).toBe("target-not-distinct");

    const r = playCard(st, idx, { kind: "two-squares", first: "a1", second: "h1" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "swap-pieces", a: "a1", b: "h1" }]);
  });

  it("Marionette: requires enemy first-square; emits foreign-move", () => {
    const rng = makeRng(90);
    let st = startPlayerTurn(createMatchCardState([MARIONETTE], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((c) => c.id === "marionette");
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });

    const rOwn = playCard(st, idx, { kind: "two-squares", first: "e2", second: "e3" }, ctx, rng);
    expect(rOwn.ok).toBe(false);
    if (!rOwn.ok) expect(rOwn.reason).toBe("target-not-enemy-piece");

    const r = playCard(st, idx, { kind: "two-squares", first: "e7", second: "e6" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "foreign-move", from: "e7", to: "e6" }]);
    expect(r.state.consumedPile.some((c) => c.id === "marionette")).toBe(true);
  });
});

describe("status helpers", () => {
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

  it("relocateStatuses moves statuses with their piece", () => {
    const rng = makeRng(100);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    st = {
      ...st,
      shields: [{ square: "e2", side: "player", expiresOnTurn: 99 }],
      hastes: [{ square: "e2", side: "player", expiresOnTurn: 99 }],
    };
    st = relocateStatuses(st, "e2", "e4");
    expect(isShielded(st, "e2")).toBe(false);
    expect(isShielded(st, "e4")).toBe(true);
    expect(hasteAt(st, "e4")).not.toBeNull();
  });

  it("clearStatusesOn drops all statuses on a square", () => {
    const rng = makeRng(101);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    st = {
      ...st,
      freezes: [{ square: "e7", side: "opponent", expiresOnTurn: 99 }],
      shields: [{ square: "e7", side: "player", expiresOnTurn: 99 }],
    };
    st = clearStatusesOn(st, "e7");
    expect(st.freezes).toEqual([]);
    expect(st.shields).toEqual([]);
  });

  it("consumeHaste removes the status", () => {
    const rng = makeRng(102);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    st = {
      ...st,
      hastes: [{ square: "e2", side: "player", expiresOnTurn: 99 }],
    };
    expect(hasteAt(st, "e2")).not.toBeNull();
    st = consumeHaste(st, "e2");
    expect(hasteAt(st, "e2")).toBeNull();
  });

  it("setDeckTop replaces the top of the draw pile with a custom order", () => {
    const rng = makeRng(103);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    const top3 = st.drawPile.slice(0, 3);
    const reordered = [top3[2], top3[0], top3[1]];
    st = setDeckTop(st, reordered);
    expect(st.drawPile.slice(0, 3)).toEqual(reordered);
    expect(st.drawPile.length).toBe(makeStarterDeck().length - 5);
  });

  it("isInPlayerHalf identifies ranks 1-4 only", () => {
    expect(isInPlayerHalf("a1")).toBe(true);
    expect(isInPlayerHalf("h4")).toBe(true);
    expect(isInPlayerHalf("e5")).toBe(false);
    expect(isInPlayerHalf("a8")).toBe(false);
  });
});
