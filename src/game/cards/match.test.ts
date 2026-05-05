import { describe, expect, it } from "vitest";

import type { BoardContext, PlayTarget } from "./match";
import {
  ENERGY_MAX,
  STARTING_ENERGY,
  addToHand,
  clampEnergy,
  completeRevive,
  createMatchCardState,
  drawCards,
  dropOtherSingleUseEmpowers,
  grantSoulOnCapture,
  hasWallOn,
  insertCurseIntoHand,
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
  shuffleIntoDraw,
  startPlayerTurn,
} from "./match";
import {
  BARRICADE,
  KNIGHT_SOUL,
  FORESIGHT,
  FROSTBITE,
  TANGLED_ROOTS,
  FUMBLE,
  HALLOWED_GROUND,
  IRON_GUARD,
  MARIONETTE,
  MARTYRS_GIFT,
  PROVOKE,
  QUICKSTEP,
  RECONNAISSANCE,
  SNARE,
  SPIKE_PIT,
  SPRING_TRAP,
  SWITCH_FILES,
  getCardById,
  makeStarterDeck,
} from "./library";
import type { Card, Piece, Side } from "../types";

const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
  isAttackedBy: () => false,
  isRooted: () => false,
};

function noTarget(): PlayTarget {
  return { kind: "none" };
}

type WithPiecesOptions = {
  attackedByPlayer?: ReadonlySet<string>;
  rooted?: ReadonlySet<string>;
};

function withPieces(map: Record<string, Piece>, opts: WithPiecesOptions = {}): BoardContext {
  const attacked = opts.attackedByPlayer ?? new Set<string>();
  const rooted = opts.rooted ?? new Set<string>();
  return {
    pieceAt: (sq) => map[sq] ?? null,
    hasWall: () => false,
    isAttackedBy: (sq, by: Side) => by === "player" && attacked.has(sq),
    isRooted: (sq) => rooted.has(sq),
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

  it("drawCards reshuffles the discard pile into draw when draw is empty mid-draw", () => {
    const rng = makeRng(2);
    let st = createMatchCardState([], rng);
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

  it("drawCards leaves the consumed pile untouched (Consume cards do not cycle)", () => {
    const rng = makeRng(3);
    let st = createMatchCardState([], rng);
    st = {
      ...st,
      drawPile: [],
      discardPile: [],
      consumedPile: [BARRICADE, RECONNAISSANCE],
    };
    const drawn = drawCards(st, 2, rng);
    expect(drawn.hand).toHaveLength(0);
    expect(drawn.consumedPile).toHaveLength(2);
  });

  it("drawCards stops when both piles are empty", () => {
    const rng = makeRng(4);
    const st = createMatchCardState([], rng);
    const drawn = drawCards(st, 5, rng);
    expect(drawn.hand).toHaveLength(0);
  });
});

describe("startPlayerTurn", () => {
  it("deals a hand of 5 and sets energy to STARTING_ENERGY on turn 1", () => {
    const rng = makeRng(4);
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    expect(st.hand).toHaveLength(5);
    expect(st.energy).toBe(STARTING_ENERGY);
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
    st = {
      ...st,
      hand: makeStarterDeck()
        .slice(0, 7)
        .map((card) => ({ card, retained: false })),
    };
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
    st = { ...st, energy: ENERGY_MAX };
    const reconIdx = st.hand.findIndex((s) => s.card.id === "reconnaissance");
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

  it("Foresight: pays 1 energy and discards (UI does the reorder via setDeckTop)", () => {
    const rng = makeRng(20);
    const deck = [FORESIGHT, BARRICADE, BARRICADE, BARRICADE, BARRICADE, BARRICADE];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "foresight");
    if (idx === -1) return;
    const energyBefore = st.energy;
    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    st = res.state;
    expect(st.energy).toBe(energyBefore - 1);
    // Foresight is non-Consume, so it lands in the discard pile.
    expect(st.discardPile.some((c: Card) => c.id === "foresight")).toBe(true);
  });
});

describe("playCard — disruption / spatial", () => {
  it("Frostbite: requires an enemy piece target and adds a freeze", () => {
    const rng = makeRng(10);
    let st = startPlayerTurn(
      createMatchCardState([FROSTBITE, FROSTBITE, FROSTBITE, FROSTBITE, FROSTBITE], rng),
      rng,
    );
    st = { ...st, energy: ENERGY_MAX };
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

  it("Tangled Roots / Fumble / Provoke add the right status", () => {
    const rng = makeRng(30);
    const deck = [TANGLED_ROOTS, FUMBLE, PROVOKE];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: 10 };
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });

    const idxRoots = st.hand.findIndex((s) => s.card.id === "tangled-roots");
    const r1 = playCard(st, idxRoots, { kind: "square", square: "e7" }, ctx, rng);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    st = r1.state;
    expect(isRooted(st, "e7")).toBe(true);

    const idxFumble = st.hand.findIndex((s) => s.card.id === "fumble");
    const r2 = playCard(st, idxFumble, { kind: "square", square: "e7" }, ctx, rng);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    st = r2.state;
    expect(isDisarmed(st, "e7")).toBe(true);

    const idxProvoke = st.hand.findIndex((s) => s.card.id === "provoke");
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
      isAttackedBy: () => false,
      isRooted: () => false,
    };

    const r1 = playCard(st, 0, { kind: "square", square: "e2" }, ctx, rng);
    expect(r1.ok).toBe(false);

    const r2 = playCard(st, 0, { kind: "square", square: "e4" }, ctx, rng);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    st = r2.state;
    expect(hasWallOn(st, "e4")).toBe(true);
    expect(st.walls[0].expiresOnTurn).toBe(4);
    // STARTING_ENERGY is 1, Barricade costs 1 → 0 energy after play.
    expect(st.energy).toBe(0);
  });

  it("Hallowed Ground places a Sanctuary; Spike Pit / Snare / Spring Trap place Traps", () => {
    const rng = makeRng(40);
    const deck = [HALLOWED_GROUND, SPIKE_PIT, SNARE, SPRING_TRAP];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: 10 };

    const play = (id: string, sq: string) => {
      const idx = st.hand.findIndex((s) => s.card.id === id);
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

  it("Standing Stone places a zone-buff anchored at the targeted square", () => {
    const rng = makeRng(41);
    const stone = getCardById("standing-stone");
    let st = startPlayerTurn(createMatchCardState([stone], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "standing-stone");
    const r = playCard(st, idx, { kind: "square", square: "e4" }, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.zoneBuffs).toHaveLength(1);
    const buff = st.zoneBuffs[0];
    expect(buff.region).toEqual({ kind: "square-orthogonal-1", anchor: "e4" });
    expect(buff.effect).toEqual({ kind: "energy-per-turn", amount: 1 });
    expect(buff.expiresOnTurn).toBe(st.turn + 4);
    expect(buff.sourceLabel).toBe("Standing Stone");
  });
});

describe("playCard — buffs", () => {
  it("Iron Guard: targets own piece and shields it", () => {
    const rng = makeRng(50);
    let st = startPlayerTurn(createMatchCardState([IRON_GUARD], rng), rng);
    const ctx = withPieces({ e2: { type: "pawn", side: "player" } });

    const idx = st.hand.findIndex((s) => s.card.id === "iron-guard");
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
    const idx = st.hand.findIndex((s) => s.card.id === "iron-guard");
    const r = playCard(st, idx, { kind: "square", square: "e7" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-own-piece");
  });

  it("Quickstep grants 2 actions and discards the card", () => {
    const rng = makeRng(52);
    let st = startPlayerTurn(createMatchCardState([QUICKSTEP], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = withPieces({ d2: { type: "knight", side: "player" } });
    const idx = st.hand.findIndex((s) => s.card.id === "quickstep");
    const r = playCard(st, idx, { kind: "square", square: "d2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(lightningAt(st, "d2")?.remaining).toBe(2);
    // Non-Consume card → discard pile.
    expect(st.discardPile.some((c) => c.id === "quickstep")).toBe(true);
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
    const idx = st.hand.findIndex((s) => s.card.id === "martyrs-gift");
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

  it("Knight Soul: empowers an own piece with the knight pattern (single-use, this turn) and consumes", () => {
    const rng = makeRng(70);
    let st = startPlayerTurn(createMatchCardState([KNIGHT_SOUL], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "knight-soul");
    const ctx = withPieces({
      e2: { type: "pawn", side: "player" },
      e7: { type: "pawn", side: "opponent" },
    });

    const rEnemy = playCard(st, idx, { kind: "square", square: "e7" }, ctx, rng);
    expect(rEnemy.ok).toBe(false);
    if (!rEnemy.ok) expect(rEnemy.reason).toBe("target-not-own-piece");

    const r = playCard(st, idx, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([]);
    const status = empowerAt(r.state, "e2");
    expect(status?.pattern).toBe("knight");
    expect(status?.singleUse).toBe(true);
    expect(status?.expiresOnTurn).toBe(r.state.turn + 1);
    expect(r.state.consumedPile.some((c) => c.id === "knight-soul")).toBe(true);
  });

  it("Soul empowers expire at the start of the next player turn", () => {
    const rng = makeRng(71);
    let st = startPlayerTurn(createMatchCardState([KNIGHT_SOUL], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "knight-soul");
    const ctx = withPieces({ e2: { type: "pawn", side: "player" } });
    const r = playCard(st, idx, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const next = startPlayerTurn(r.state, rng);
    expect(empowerAt(next, "e2")).toBeNull();
  });

  it("Switch Files: requires two distinct own-piece squares; emits swap-pieces", () => {
    const rng = makeRng(80);
    let st = startPlayerTurn(createMatchCardState([SWITCH_FILES], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "switch-files");
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
    const idx = st.hand.findIndex((s) => s.card.id === "marionette");
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

  it("dropOtherSingleUseEmpowers keeps the moved piece's empower and drops everyone else's", () => {
    const rng = makeRng(110);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    st = {
      ...st,
      empowers: [
        { square: "e2", side: "player", expiresOnTurn: 99, pattern: "knight", singleUse: true },
        { square: "d2", side: "player", expiresOnTurn: 99, pattern: "knight", singleUse: true },
        { square: "f1", side: "player", expiresOnTurn: 99, pattern: "knight" }, // non-singleUse
      ],
    };
    const next = dropOtherSingleUseEmpowers(st, "e2");
    const squares = next.empowers.map((e) => e.square).sort();
    expect(squares).toEqual(["e2", "f1"]);
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

describe("energy economy", () => {
  it("starting energy is 1 on the first player turn", () => {
    const rng = makeRng(200);
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    expect(st.energy).toBe(1);
    expect(st.turn).toBe(1);
  });

  it("second turn adds +1 energy on top of any carryover", () => {
    const rng = makeRng(201);
    const t1 = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    const t2 = startPlayerTurn(t1, rng); // 1 → 2
    expect(t2.energy).toBe(2);
    expect(t2.turn).toBe(2);
  });

  it("unspent energy banks across turns: 4 + 1 → 5", () => {
    const rng = makeRng(202);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    st = { ...st, energy: 4 };
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(5);
  });

  it("natural gain caps at ENERGY_MAX", () => {
    const rng = makeRng(203);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(ENERGY_MAX);
  });

  it("clampEnergy floors at 0 and caps at ENERGY_MAX", () => {
    expect(clampEnergy(-3)).toBe(0);
    expect(clampEnergy(0)).toBe(0);
    expect(clampEnergy(5)).toBe(5);
    expect(clampEnergy(11)).toBe(ENERGY_MAX);
  });

  it("Martyr's Gift respects the energy cap", () => {
    const rng = makeRng(204);
    let st = startPlayerTurn(createMatchCardState([MARTYRS_GIFT], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "martyrs-gift");
    const ctx = withPieces({ a2: { type: "pawn", side: "player" } });
    const r = playCard(st, idx, { kind: "square", square: "a2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // -1 cost + 1 energyGain, but cap stays in force.
    expect(r.state.energy).toBeLessThanOrEqual(ENERGY_MAX);
  });
});

describe("disposal: discard, consume, retain, cycle", () => {
  it("non-Consume cards land in discard; Consume cards land in consumed", () => {
    const rng = makeRng(210);
    const cheap = getCardById("cheap-destroy");
    let st = startPlayerTurn(createMatchCardState([BARRICADE, cheap], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    // Play Barricade (non-Consume) → discard pile.
    const barricadeIdx = st.hand.findIndex((s) => s.card.id === "barricade");
    const r1 = playCard(st, barricadeIdx, { kind: "square", square: "e4" }, emptyBoard, rng);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    st = r1.state;
    expect(st.discardPile.some((c) => c.id === "barricade")).toBe(true);
    expect(st.consumedPile.some((c) => c.id === "barricade")).toBe(false);

    // Play Cheap Destroy (Consume) → consumed pile.
    const cheapIdx = st.hand.findIndex((s) => s.card.id === "cheap-destroy");
    const ctx = withPieces(
      { e7: { type: "pawn", side: "opponent" } },
      { attackedByPlayer: new Set(["e7"]) },
    );
    const r2 = playCard(st, cheapIdx, { kind: "square", square: "e7" }, ctx, rng);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    st = r2.state;
    expect(st.consumedPile.some((c) => c.id === "cheap-destroy")).toBe(true);
    expect(st.discardPile.some((c) => c.id === "cheap-destroy")).toBe(false);
  });

  it("end-of-turn discards every non-curse, non-retained hand card", () => {
    const rng = makeRng(211);
    // 12-card deck so the second start-of-turn refill still finds enough in
    // the draw pile and doesn't need to reshuffle the freshly-discarded hand.
    const deck = Array.from({ length: 12 }, () => BARRICADE);
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    expect(st.hand.length).toBe(5);
    // Advance to next turn — every card in hand should move to the discard
    // pile (none are retained, none are curses). The second refill draws from
    // the remaining draw pile and leaves the discard intact.
    st = startPlayerTurn(st, rng);
    expect(st.discardPile.length).toBe(5);
    expect(st.hand.length).toBe(5);
  });

  it("retained hand cards survive end-of-turn", () => {
    const rng = makeRng(216);
    const stash = getCardById("stash");
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = addToHand(st, BARRICADE);
    st = addToHand(st, stash);
    st = { ...st, energy: ENERGY_MAX };
    const stashIdx = st.hand.findIndex((s) => s.card.id === "stash");
    const targetIdx = st.hand.findIndex((s) => s.card.id === "barricade");
    const r = playCard(st, stashIdx, { kind: "hand-card", index: targetIdx }, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    // Stash itself was discarded; Barricade is retained.
    expect(st.discardPile.some((c) => c.id === "stash")).toBe(true);
    expect(st.hand.find((s) => s.card.id === "barricade")?.retained).toBe(true);
    // Roll the turn — Barricade stays.
    st = startPlayerTurn(st, rng);
    expect(st.hand.some((s) => s.card.id === "barricade")).toBe(true);
  });

  it("draw pile reshuffles from the discard pile when it empties mid-draw", () => {
    const rng = makeRng(212);
    // Empty draw, three cards in discard. Draw 3.
    let st = createMatchCardState([], rng);
    st = { ...st, discardPile: [BARRICADE, FROSTBITE, IRON_GUARD] };
    const drawn = drawCards(st, 3, rng);
    expect(drawn.hand).toHaveLength(3);
    expect(drawn.drawPile).toHaveLength(0);
    expect(drawn.discardPile).toHaveLength(0);
    // Every drawn card is wrapped in a HandCard with retained=false.
    expect(drawn.hand.every((s) => s.retained === false)).toBe(true);
  });

  it("Stash applies Retain to a chosen hand card; the card survives end-of-turn", () => {
    const rng = makeRng(213);
    const stash = getCardById("stash");
    // Hand: stash + big-destroy. Stash applies Retain to big-destroy.
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    const big = getCardById("big-destroy");
    st = addToHand(st, big);
    st = addToHand(st, stash);
    st = { ...st, energy: ENERGY_MAX };
    const stashIdx = st.hand.findIndex((s) => s.card.id === "stash");
    const targetIdx = st.hand.findIndex((s) => s.card.id === "big-destroy");
    const r = playCard(st, stashIdx, { kind: "hand-card", index: targetIdx }, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    // After playing Stash, the targeted slot now has retained=true and Stash
    // has left hand. Index of Big Destroy may have shifted; find by id.
    const stillThere = st.hand.find((s) => s.card.id === "big-destroy");
    expect(stillThere?.retained).toBe(true);

    // Roll the turn — retained Big Destroy stays.
    st = startPlayerTurn(st, rng);
    expect(st.hand.some((s) => s.card.id === "big-destroy")).toBe(true);
    expect(st.hand.find((s) => s.card.id === "big-destroy")?.retained).toBe(true);
  });

  it("Stash rejects targeting itself, an already-retained slot, or a curse", () => {
    const rng = makeRng(214);
    const stash = getCardById("stash");
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = addToHand(st, stash);
    st = addToHand(st, BARRICADE);
    st = insertCurseIntoHand(st, getCardById("stalwart"));
    st = { ...st, energy: ENERGY_MAX };
    const stashIdx = st.hand.findIndex((s) => s.card.id === "stash");
    // Self-target → rejected.
    const rSelf = playCard(st, stashIdx, { kind: "hand-card", index: stashIdx }, emptyBoard, rng);
    expect(rSelf.ok).toBe(false);
    if (!rSelf.ok) expect(rSelf.reason).toBe("target-hand-card-self");
    // Curse target → rejected.
    const curseIdx = st.hand.findIndex((s) => s.card.id === "stalwart");
    const rCurse = playCard(st, stashIdx, { kind: "hand-card", index: curseIdx }, emptyBoard, rng);
    expect(rCurse.ok).toBe(false);
    if (!rCurse.ok) expect(rCurse.reason).toBe("target-hand-card-curse");
  });

  it("Recall pulls from the discard pile only — never from the consumed pile", () => {
    const rng = makeRng(215);
    const recall = getCardById("recall");
    let st = startPlayerTurn(createMatchCardState([recall], rng), rng);
    st = {
      ...st,
      energy: ENERGY_MAX,
      discardPile: [BARRICADE, FROSTBITE],
      // Big Destroy in consumed must NOT be revivable.
      consumedPile: [getCardById("big-destroy")],
    };
    const idx = st.hand.findIndex((s) => s.card.id === "recall");
    const r = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The consumed pile is unchanged: Big Destroy stays gone.
    expect(r.state.consumedPile.some((c) => c.id === "big-destroy")).toBe(true);
    // The resolver removed one card from the discard pile (emitted as an
    // add-card-to-hand side effect) and Recall itself was discarded after
    // play. Net discard pile length: 2 - 1 + 1 = 2.
    expect(r.state.discardPile.length).toBe(2);
    const fx = r.sideEffects.find((f) => f.kind === "add-card-to-hand");
    expect(fx).toBeDefined();
  });
});

describe("playCard — destroy", () => {
  it("Cheap Destroy rejects an enemy King with target-not-enemy-non-king-piece", () => {
    const rng = makeRng(220);
    const cheap = getCardById("cheap-destroy");
    let st = startPlayerTurn(createMatchCardState([cheap], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "cheap-destroy");
    const ctx = withPieces({ e8: { type: "king", side: "opponent" } });
    const r = playCard(st, idx, { kind: "square", square: "e8" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-enemy-non-king-piece");
  });

  it("Cheap Destroy rejects an unattacked enemy with target-not-attacked-by-player", () => {
    const rng = makeRng(221);
    const cheap = getCardById("cheap-destroy");
    let st = startPlayerTurn(createMatchCardState([cheap], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "cheap-destroy");
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });
    const r = playCard(st, idx, { kind: "square", square: "e7" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-attacked-by-player");
  });

  it("Cheap Destroy on an attacked enemy emits remove-piece and consumes", () => {
    const rng = makeRng(222);
    const cheap = getCardById("cheap-destroy");
    let st = startPlayerTurn(createMatchCardState([cheap], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "cheap-destroy");
    const ctx = withPieces(
      { e7: { type: "pawn", side: "opponent" } },
      { attackedByPlayer: new Set(["e7"]) },
    );
    const r = playCard(st, idx, { kind: "square", square: "e7" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "remove-piece", square: "e7" }]);
    expect(r.state.consumedPile.some((c) => c.id === "cheap-destroy")).toBe(true);
  });

  it("Big Destroy rejects king but works on any other enemy", () => {
    const rng = makeRng(223);
    const big = getCardById("big-destroy");
    let st = startPlayerTurn(createMatchCardState([big], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "big-destroy");
    const ctx = withPieces({
      e7: { type: "queen", side: "opponent" },
      e8: { type: "king", side: "opponent" },
    });
    const rKing = playCard(st, idx, { kind: "square", square: "e8" }, ctx, rng);
    expect(rKing.ok).toBe(false);
    if (!rKing.ok) expect(rKing.reason).toBe("target-not-enemy-non-king-piece");
    const r = playCard(st, idx, { kind: "square", square: "e7" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "remove-piece", square: "e7" }]);
  });
});

describe("card-economy effects", () => {
  it("Vine Pull rejects a non-rooted enemy with target-not-rooted", () => {
    const rng = makeRng(233);
    const vine = getCardById("vine-pull");
    let st = startPlayerTurn(createMatchCardState([vine], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "vine-pull");
    const ctx = withPieces({
      e7: { type: "pawn", side: "opponent" },
      e2: { type: "pawn", side: "player" },
    });
    const r = playCard(st, idx, { kind: "two-squares", first: "e7", second: "e2" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-rooted");
  });

  it("Vine Pull on a rooted enemy + own piece emits swap-pieces", () => {
    const rng = makeRng(234);
    const vine = getCardById("vine-pull");
    let st = startPlayerTurn(createMatchCardState([vine], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "vine-pull");
    const ctx = withPieces(
      {
        e7: { type: "pawn", side: "opponent" },
        e2: { type: "pawn", side: "player" },
      },
      { rooted: new Set(["e7"]) },
    );
    const r = playCard(st, idx, { kind: "two-squares", first: "e7", second: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "swap-pieces", a: "e7", b: "e2" }]);
  });

  it("Recall (random revive) returns one discarded card to hand", () => {
    const rng = makeRng(235);
    const recall = getCardById("recall");
    let st = startPlayerTurn(createMatchCardState([recall], rng), rng);
    st = { ...st, energy: ENERGY_MAX, discardPile: [BARRICADE, FROSTBITE, IRON_GUARD] };
    const idx = st.hand.findIndex((s) => s.card.id === "recall");
    const r = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Resolver removed one from discard and emitted add-card-to-hand. Recall
    // itself is non-Consume, so it lands in discard after play. Net discard:
    // 3 - 1 + 1 = 3.
    expect(r.state.discardPile).toHaveLength(3);
    const fx = r.sideEffects.find((f) => f.kind === "add-card-to-hand");
    expect(fx).toBeDefined();
  });

  it("Recall on an empty discard pile is a no-op (apart from cycling itself)", () => {
    const rng = makeRng(236);
    const recall = getCardById("recall");
    let st = startPlayerTurn(createMatchCardState([recall], rng), rng);
    st = { ...st, energy: ENERGY_MAX, discardPile: [] };
    const idx = st.hand.findIndex((s) => s.card.id === "recall");
    const r = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects.filter((f) => f.kind === "add-card-to-hand")).toHaveLength(0);
    // Recall itself cycles into the discard pile.
    expect(r.state.discardPile).toHaveLength(1);
  });

  it("Recover (choose revive) emits a revive-prompt; completeRevive moves the picked card", () => {
    const rng = makeRng(237);
    const recover = getCardById("recover");
    let st = startPlayerTurn(createMatchCardState([recover], rng), rng);
    st = { ...st, energy: ENERGY_MAX, discardPile: [BARRICADE, FROSTBITE] };
    const idx = st.hand.findIndex((s) => s.card.id === "recover");
    const r = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Recover has Consume → goes to consumedPile. discardPile is unchanged
    // (the UI completes the revive by picking a card from it).
    expect(r.state.consumedPile.some((c) => c.id === "recover")).toBe(true);
    expect(r.state.discardPile).toHaveLength(2);
    expect(r.sideEffects.some((f) => f.kind === "revive-prompt")).toBe(true);
    // Now finish the revive by picking index 0 (Barricade was first).
    const after = completeRevive(r.state, 0);
    expect(after.discardPile).toHaveLength(1);
    expect(after.hand[after.hand.length - 1].card.id).toBe("barricade");
  });

  it("shuffleIntoDraw splices a card into a random slot of the draw pile", () => {
    const rng = makeRng(240);
    const initialDeck = [BARRICADE, FROSTBITE, RECONNAISSANCE];
    let st = createMatchCardState(initialDeck, rng);
    const beforeLen = st.drawPile.length;
    st = shuffleIntoDraw(st, IRON_GUARD, () => 0.5);
    expect(st.drawPile.length).toBe(beforeLen + 1);
    expect(st.drawPile.some((c) => c.id === "iron-guard")).toBe(true);
  });

  it("addToHand appends without enforcing HAND_SIZE", () => {
    const rng = makeRng(241);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    const before = st.hand.length;
    st = addToHand(st, BARRICADE);
    st = addToHand(st, BARRICADE);
    expect(st.hand.length).toBe(before + 2);
  });
});

describe("capture-grants-soul", () => {
  const seedRng: () => number = () => 0;

  it("granting a Knight Soul on knight capture: drawPile +1 with knight-soul", () => {
    const rng = makeRng(250);
    const st = createMatchCardState(makeStarterDeck(), rng);
    const before = st.drawPile.length;
    const next = grantSoulOnCapture(st, { type: "knight", side: "opponent" }, "player", seedRng);
    expect(next.drawPile.length).toBe(before + 1);
    expect(next.drawPile.some((c) => c.id === "knight-soul")).toBe(true);
  });

  it("each non-king enemy piece type maps to its matching soul", () => {
    const rng = makeRng(251);
    const st = createMatchCardState(makeStarterDeck(), rng);
    const cases: Array<[Piece["type"], string]> = [
      ["pawn", "pawn-soul"],
      ["knight", "knight-soul"],
      ["bishop", "bishop-soul"],
      ["rook", "rook-soul"],
      ["queen", "queen-soul"],
    ];
    for (const [type, soulId] of cases) {
      const next = grantSoulOnCapture(st, { type, side: "opponent" }, "player", seedRng);
      expect(next.drawPile.some((c) => c.id === soulId)).toBe(true);
    }
  });

  it("opponent capturing player's piece does not grant", () => {
    const rng = makeRng(252);
    const st = createMatchCardState(makeStarterDeck(), rng);
    const before = st.drawPile.length;
    const next = grantSoulOnCapture(st, { type: "pawn", side: "player" }, "opponent", seedRng);
    expect(next.drawPile.length).toBe(before);
  });

  it("king capture is a no-op (defensive — game ends in practice)", () => {
    const rng = makeRng(253);
    const st = createMatchCardState(makeStarterDeck(), rng);
    const before = st.drawPile.length;
    const next = grantSoulOnCapture(st, { type: "king", side: "opponent" }, "player", seedRng);
    expect(next.drawPile.length).toBe(before);
  });

  it("null captured piece is a no-op", () => {
    const rng = makeRng(254);
    const st = createMatchCardState(makeStarterDeck(), rng);
    const before = st.drawPile.length;
    const next = grantSoulOnCapture(st, null, "player", seedRng);
    expect(next.drawPile.length).toBe(before);
  });
});
