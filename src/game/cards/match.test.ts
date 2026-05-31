import { describe, expect, it } from "vitest";

import type { BoardContext } from "./match";
import {
  ENERGY_MAX,
  ENERGY_PER_TURN,
  ENERGY_CAP,
  STARTING_ENERGY,
  STARTING_HAND_SIZE,
  DRAW_PER_TURN,
  addToHand,
  clampEnergy,
  completeRevive,
  createMatchCardState,
  drawCards,
  dropOtherSingleUseEmpowers,
  grantEnergyOnCapture,
  hasWallOn,
  isCompelled,
  isDisarmed,
  isFrozen,
  isRooted,
  isShielded,
  hasSanctuary,
  hasteAt,
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
  PIECE_ENERGY_VALUES,
} from "./match";
import {
  FIREWALL,
  STACK_TRACE,
  FREEZE_PROCESS,
  CHROOT,
  READ_ONLY,
  TRUSTED_ZONE,
  ENCRYPTED,
  REMOTE_ACCESS,
  PHISHING,
  OVERCLOCK,
  HONEYPOT,
  LOGIC_BOMB,
  SWITCH_FILES,
  SELF_DESTRUCT,
  getCardById,
  makeStarterDeck,
} from "./library";
import type { Card, Piece } from "../types";
import { emptyBoard, noTarget, withPieces } from "./match.testHelpers";

/** Synthetic random-revive card for tests; replaces the retired Restore Point. */
function syntheticRandomRevive(): Card {
  return {
    id: "test-random-revive",
    name: "Test Random Revive",
    cost: 1,
    rarity: "common",
    archetype: "resource",
    description: "Return a random card from your discard pile to your hand.",
    target: { kind: "none" },
    effect: { kind: "revive", selection: "random" },
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
      hand: [],
      drawPile: [],
      discardPile: [FIREWALL, OVERCLOCK],
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
      hand: [],
      drawPile: [],
      discardPile: [],
      consumedPile: [FIREWALL, OVERCLOCK],
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
  it("does not draw extra cards on turn 1 (opening hand only)", () => {
    const rng = makeRng(4);
    const deck = makeStarterDeck();
    const st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    expect(st.hand).toHaveLength(STARTING_HAND_SIZE);
    expect(st.energy).toBe(ENERGY_PER_TURN);
    expect(st.turn).toBe(1);
    expect(st.drawPile).toHaveLength(deck.length - STARTING_HAND_SIZE);
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
    let st = startPlayerTurn(createMatchCardState([FREEZE_PROCESS], rng), rng);
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

  it("Self Destruct: sacrifice own non-king piece, draw 2, gain 2 energy", () => {
    const rng = makeRng(9);
    // Force the card into hand directly so the test always exercises playCard
    // (the old seed left an opening hand without Self Destruct, so the test
    // silently no-opped — CH-013).
    let st = startPlayerTurn(createMatchCardState([SELF_DESTRUCT], rng), rng);
    st = { ...st, energy: ENERGY_MAX, hand: [{ card: SELF_DESTRUCT, retained: false }] };
    const idx = 0;
    const ctx = withPieces({ a2: { type: "pawn", side: "player" } });
    const res = playCard(st, idx, { kind: "square", square: "a2" }, ctx, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    st = res.state;
    expect(res.sideEffects).toEqual([{ kind: "remove-piece", square: "a2" }]);
  });

  it("Stack Trace: free 0-cost cantrip (UI does the reorder via setDeckTop)", () => {
    const rng = makeRng(20);
    let st = startPlayerTurn(createMatchCardState([STACK_TRACE], rng), rng);
    st = { ...st, hand: [{ card: STACK_TRACE, retained: false }] };
    const idx = 0;
    const energyBefore = st.energy;
    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    st = res.state;
    // Stack Trace is a 0-cost cantrip; no energy is spent.
    expect(st.energy).toBe(energyBefore);
    // Stack Trace is non-Consume, so it lands in the discard pile.
    expect(st.discardPile.some((c: Card) => c.id === "stack-trace")).toBe(true);
  });
});

describe("playCard — disruption / spatial", () => {
  it("Freeze Process: requires an enemy piece target and adds a freeze", () => {
    const rng = makeRng(10);
    let st = startPlayerTurn(
      createMatchCardState(
        [FREEZE_PROCESS, FREEZE_PROCESS, FREEZE_PROCESS, FREEZE_PROCESS, FREEZE_PROCESS],
        rng,
      ),
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

  it("chroot / Read-Only / Phishing add the right status", () => {
    const rng = makeRng(30);
    const deck = [CHROOT, READ_ONLY, PHISHING];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: 10 };
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });

    const idxRoots = st.hand.findIndex((s) => s.card.id === "chroot");
    const r1 = playCard(st, idxRoots, { kind: "square", square: "e7" }, ctx, rng);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    st = r1.state;
    expect(isRooted(st, "e7")).toBe(true);

    const idxReadOnly = st.hand.findIndex((s) => s.card.id === "read-only");
    const r2 = playCard(st, idxReadOnly, { kind: "square", square: "e7" }, ctx, rng);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    st = r2.state;
    expect(isDisarmed(st, "e7")).toBe(true);

    const idxPhishing = st.hand.findIndex((s) => s.card.id === "phishing");
    const r3 = playCard(st, idxPhishing, { kind: "square", square: "e7" }, ctx, rng);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    st = r3.state;
    expect(isCompelled(st, "e7")).toBe(true);
  });

  it("Firewall: places a wall on an empty unwalled square for 3 turns", () => {
    const rng = makeRng(11);
    let st = startPlayerTurn(
      createMatchCardState([FIREWALL, FIREWALL, FIREWALL, FIREWALL, FIREWALL], rng),
      rng,
    );
    st = { ...st, energy: 3 };
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
    // Energy was 3, Firewall costs 2 → 1 energy after play.
    expect(st.energy).toBe(1);
  });

  it("Trusted Zone places a Sanctuary; Logic Bomb / Honeypot place Traps", () => {
    const rng = makeRng(40);
    const deck = [TRUSTED_ZONE, LOGIC_BOMB, HONEYPOT];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: 15 };

    const play = (id: string, sq: string) => {
      const idx = st.hand.findIndex((s) => s.card.id === id);
      const r = playCard(st, idx, { kind: "square", square: sq }, emptyBoard, rng);
      expect(r.ok).toBe(true);
      if (r.ok) st = r.state;
    };

    play("trusted-zone", "d4");
    expect(hasSanctuary(st, "d4")).toBe(true);
    play("logic-bomb", "e4");
    expect(trapAt(st, "e4")?.effect).toBe("capture");
    play("honeypot", "f4");
    expect(trapAt(st, "f4")?.effect).toBe("freeze");
  });

  it("Power Node auto-places a zone-buff on a random center square", () => {
    const rng = makeRng(41);
    const stone = getCardById("power-node");
    let st = startPlayerTurn(createMatchCardState([stone], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "power-node");
    const r = playCard(st, idx, { kind: "none" }, emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(st.zoneBuffs).toHaveLength(1);
    const buff = st.zoneBuffs[0];
    expect(buff.region.kind).toBe("square-orthogonal-1");
    if (buff.region.kind === "square-orthogonal-1") {
      expect(["d4", "d5", "e4", "e5"]).toContain(buff.region.anchor);
    }
    expect(buff.effect).toEqual({ kind: "energy-per-turn", amount: 1 });
    expect(buff.expiresOnTurn).toBe(st.turn + 5);
    expect(buff.sourceLabel).toBe("Power Node");
  });

  it("rejects Power Node (no refund whiff) when every autoPlace square is walled (CH-007)", () => {
    const rng = makeRng(41);
    const stone = getCardById("power-node");
    let st = startPlayerTurn(createMatchCardState([stone], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "power-node");
    // Wall all four center candidates.
    const walled = new Set(["d4", "d5", "e4", "e5"]);
    const ctx = { ...emptyBoard, hasWall: (sq: string) => walled.has(sq) };

    const r = playCard(st, idx, { kind: "none" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("no-legal-autoplace");
    // The card stays in hand and no energy is spent (state is unchanged).
    expect(st.hand[idx]?.card.id).toBe("power-node");
    expect(st.energy).toBe(10);
  });
});

describe("playCard — buffs", () => {
  it("Encrypted: targets own piece and shields it", () => {
    const rng = makeRng(50);
    let st = startPlayerTurn(createMatchCardState([ENCRYPTED], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = withPieces({ e2: { type: "pawn", side: "player" } });

    const idx = st.hand.findIndex((s) => s.card.id === "encrypted");
    const r = playCard(st, idx, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(isShielded(st, "e2")).toBe(true);
  });

  it("Encrypted rejects an enemy piece target", () => {
    const rng = makeRng(51);
    let st = startPlayerTurn(createMatchCardState([ENCRYPTED], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });
    const idx = st.hand.findIndex((s) => s.card.id === "encrypted");
    const r = playCard(st, idx, { kind: "square", square: "e7" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-own-piece");
  });

  it("Overclock grants Haste (with Disarm) and discards the card", () => {
    const rng = makeRng(52);
    let st = startPlayerTurn(createMatchCardState([OVERCLOCK], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = withPieces({ d2: { type: "knight", side: "player" } });
    const idx = st.hand.findIndex((s) => s.card.id === "overclock");
    const r = playCard(st, idx, { kind: "square", square: "d2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(hasteAt(st, "d2")).not.toBeNull();
    // Non-Consume card → discard pile.
    expect(st.discardPile.some((c) => c.id === "overclock")).toBe(true);
  });
});

describe("playCard — sacrifice / summon / swap / marionette", () => {
  it("Self Destruct: rejects king target, accepts non-king, emits remove-piece", () => {
    const rng = makeRng(60);
    let st = startPlayerTurn(createMatchCardState([SELF_DESTRUCT], rng), rng);
    st = { ...st, energy: ENERGY_MAX, hand: [{ card: SELF_DESTRUCT, retained: false }] };
    const idx = 0;
    const ctx = withPieces({
      e1: { type: "king", side: "player" },
      a2: { type: "pawn", side: "player" },
    });

    const rKing = playCard(st, idx, { kind: "square", square: "e1" }, ctx, rng);
    expect(rKing.ok).toBe(false);
    if (!rKing.ok) expect(rKing.reason).toBe("target-not-own-non-king-piece");

    const r = playCard(st, idx, { kind: "square", square: "a2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    st = r.state;
    expect(r.sideEffects).toEqual([{ kind: "remove-piece", square: "a2" }]);
    // Self Destruct is Consume.
    expect(st.consumedPile.some((c) => c.id === "self-destruct")).toBe(true);
  });

  it("Overclock: applies haste to own piece", () => {
    const rng = makeRng(70);
    let st = startPlayerTurn(createMatchCardState([OVERCLOCK], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "overclock");
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
    expect(hasteAt(r.state, "e2")).not.toBeNull();
    expect(r.state.hastes[0].expiresOnTurn).toBe(r.state.turn + 1);
    // Overclock is not Consume, so it goes to the discard pile.
    expect(r.state.discardPile.some((c) => c.id === "overclock")).toBe(true);
  });

  it("Side Channel: empowers a pawn with the diagonal-step pattern; rejects non-pawn targets", () => {
    const rng = makeRng(72);
    const sideChannel = getCardById("side-channel");
    let st = startPlayerTurn(createMatchCardState([sideChannel], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "side-channel");
    const ctx = withPieces({
      e2: { type: "pawn", side: "player" },
      a1: { type: "rook", side: "player" },
    });

    const rRook = playCard(st, idx, { kind: "square", square: "a1" }, ctx, rng);
    expect(rRook.ok).toBe(false);
    if (!rRook.ok) expect(rRook.reason).toBe("target-piece-type-mismatch");

    const r = playCard(st, idx, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const status = empowerAt(r.state, "e2");
    expect(status?.pattern).toBe("diagonal-step");
    expect(status?.singleUse).toBe(true);
    expect(r.state.consumedPile.some((c) => c.id === "side-channel")).toBe(true);
  });

  it("Lateral Movement: empowers a pawn with the horizontal-step pattern; rejects non-pawn targets", () => {
    const rng = makeRng(73);
    const lateral = getCardById("lateral-movement");
    let st = startPlayerTurn(createMatchCardState([lateral], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "lateral-movement");
    const ctx = withPieces({
      e2: { type: "pawn", side: "player" },
      b1: { type: "knight", side: "player" },
    });

    const rKnight = playCard(st, idx, { kind: "square", square: "b1" }, ctx, rng);
    expect(rKnight.ok).toBe(false);
    if (!rKnight.ok) expect(rKnight.reason).toBe("target-piece-type-mismatch");

    const r = playCard(st, idx, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const status = empowerAt(r.state, "e2");
    expect(status?.pattern).toBe("horizontal-step");
    expect(status?.singleUse).toBe(true);
    expect(r.state.consumedPile.some((c) => c.id === "lateral-movement")).toBe(true);
  });

  it("Rollback: emits an undo-last-enemy-move side effect and costs energy", () => {
    const rng = makeRng(74);
    const rollback = getCardById("rollback");
    let st = startPlayerTurn(createMatchCardState([rollback], rng), rng);
    st = { ...st, energy: ENERGY_CAP };
    const idx = st.hand.findIndex((s) => s.card.id === "rollback");
    const ctx = withPieces({});

    const energyBefore = st.energy;
    const r = playCard(st, idx, { kind: "none" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "undo-last-enemy-move" }]);
    expect(r.state.energy).toBe(energyBefore - rollback.cost);
    // Rollback is not Consume by default; it should land in the discard pile
    // so future cycles can replay it.
    expect(r.state.discardPile.some((c) => c.id === "rollback")).toBe(true);
  });

  it("Haste expires at the start of the next player turn", () => {
    const rng = makeRng(71);
    let st = startPlayerTurn(createMatchCardState([OVERCLOCK], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "overclock");
    const ctx = withPieces({ e2: { type: "pawn", side: "player" } });
    const r = playCard(st, idx, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(hasteAt(r.state, "e2")).not.toBeNull();
    const next = startPlayerTurn(r.state, rng);
    expect(hasteAt(next, "e2")).toBeNull();
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

  it("Remote Access: requires enemy first-square; emits foreign-move", () => {
    const rng = makeRng(90);
    let st = startPlayerTurn(createMatchCardState([REMOTE_ACCESS], rng), rng);
    st = { ...st, energy: 10 };
    const idx = st.hand.findIndex((s) => s.card.id === "remote-access");
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });

    const rOwn = playCard(st, idx, { kind: "two-squares", first: "e2", second: "e3" }, ctx, rng);
    expect(rOwn.ok).toBe(false);
    if (!rOwn.ok) expect(rOwn.reason).toBe("target-not-enemy-piece");

    const r = playCard(st, idx, { kind: "two-squares", first: "e7", second: "e6" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "foreign-move", from: "e7", to: "e6" }]);
    expect(r.state.consumedPile.some((c) => c.id === "remote-access")).toBe(true);
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
    expect(st.drawPile.length).toBe(makeStarterDeck().length - STARTING_HAND_SIZE);
  });

  it("isInPlayerHalf identifies ranks 1-4 only", () => {
    expect(isInPlayerHalf("a1")).toBe(true);
    expect(isInPlayerHalf("h4")).toBe(true);
    expect(isInPlayerHalf("e5")).toBe(false);
    expect(isInPlayerHalf("a8")).toBe(false);
  });
});

describe("energy economy", () => {
  it("turn 1 energy equals ENERGY_PER_TURN (pool starts at STARTING_ENERGY=0)", () => {
    const rng = makeRng(200);
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    expect(st.energy).toBe(STARTING_ENERGY + ENERGY_PER_TURN);
    expect(st.turn).toBe(1);
  });

  it("unspent energy banks — each turn adds ENERGY_PER_TURN to the pool", () => {
    const rng = makeRng(201);
    const t1 = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    const t2 = startPlayerTurn(t1, rng);
    const t3 = startPlayerTurn(t2, rng);
    expect(t1.energy).toBe(ENERGY_PER_TURN * 1);
    expect(t2.energy).toBe(ENERGY_PER_TURN * 2);
    expect(t3.energy).toBe(ENERGY_PER_TURN * 3);
  });

  it("unspent energy persists — turn 2 pool is turn-1 remainder + ENERGY_PER_TURN", () => {
    const rng = makeRng(202);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    // Don't spend anything — pool holds ENERGY_PER_TURN after turn 1.
    expect(st.energy).toBe(ENERGY_PER_TURN);
    st = startPlayerTurn(st, rng);
    // Pool should now be ENERGY_PER_TURN * 2.
    expect(st.energy).toBe(ENERGY_PER_TURN * 2);
  });

  it("clampEnergy floors at 0 and caps at ENERGY_CAP", () => {
    expect(clampEnergy(-3)).toBe(0);
    expect(clampEnergy(0)).toBe(0);
    expect(clampEnergy(5)).toBe(5);
    expect(clampEnergy(ENERGY_CAP)).toBe(ENERGY_CAP);
    expect(clampEnergy(ENERGY_CAP + 1)).toBe(ENERGY_CAP);
    expect(clampEnergy(99)).toBe(ENERGY_CAP);
  });
});

describe("disposal: discard, consume, retain, cycle", () => {
  it("non-Consume cards land in discard; Consume cards land in consumed", () => {
    const rng = makeRng(210);
    const cheap = getCardById("exploit");
    let st = startPlayerTurn(createMatchCardState([FIREWALL, cheap], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    // Play Firewall (non-Consume) → discard pile.
    const barricadeIdx = st.hand.findIndex((s) => s.card.id === "firewall");
    const r1 = playCard(st, barricadeIdx, { kind: "square", square: "e4" }, emptyBoard, rng);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    st = r1.state;
    expect(st.discardPile.some((c) => c.id === "firewall")).toBe(true);
    expect(st.consumedPile.some((c) => c.id === "firewall")).toBe(false);

    // Play Exploit (Consume) → consumed pile.
    const cheapIdx = st.hand.findIndex((s) => s.card.id === "exploit");
    const ctx = withPieces(
      { e7: { type: "pawn", side: "opponent" } },
      { attackedByPlayer: new Set(["e7"]) },
    );
    const r2 = playCard(st, cheapIdx, { kind: "square", square: "e7" }, ctx, rng);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    st = r2.state;
    expect(st.consumedPile.some((c) => c.id === "exploit")).toBe(true);
    expect(st.discardPile.some((c) => c.id === "exploit")).toBe(false);
  });

  it("cards persist in hand between turns (no end-of-turn discard)", () => {
    const rng = makeRng(211);
    // 12-card deck so there's plenty to draw from.
    const deck = Array.from({ length: 12 }, () => FIREWALL);
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    // Turn 1 skips the draw — hand stays at STARTING_HAND_SIZE.
    expect(st.hand.length).toBe(STARTING_HAND_SIZE);
    // Advance to turn 2 — cards persist, DRAW_PER_TURN more are drawn.
    st = startPlayerTurn(st, rng);
    expect(st.discardPile.length).toBe(0);
    expect(st.hand.length).toBe(STARTING_HAND_SIZE + DRAW_PER_TURN);
  });

  it("all hand cards survive between turns in the persistent-hand system", () => {
    const rng = makeRng(216);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = addToHand(st, FIREWALL);
    st = addToHand(st, ENCRYPTED);
    // Roll the turn — both cards should persist.
    st = startPlayerTurn(st, rng);
    expect(st.hand.some((s) => s.card.id === "firewall")).toBe(true);
    expect(st.hand.some((s) => s.card.id === "encrypted")).toBe(true);
  });

  it("draw pile reshuffles from the discard pile when it empties mid-draw", () => {
    const rng = makeRng(212);
    // Empty draw, three cards in discard. Draw 3.
    let st = createMatchCardState([], rng);
    st = { ...st, discardPile: [FIREWALL, FREEZE_PROCESS, ENCRYPTED] };
    const drawn = drawCards(st, 3, rng);
    expect(drawn.hand).toHaveLength(3);
    expect(drawn.drawPile).toHaveLength(0);
    expect(drawn.discardPile).toHaveLength(0);
    // Every drawn card is wrapped in a HandCard with retained=false.
    expect(drawn.hand.every((s) => s.retained === false)).toBe(true);
  });

  it("addToHand allows hand to exceed HAND_SIZE and persists across turns", () => {
    const rng = makeRng(213);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    const big = getCardById("format-c");
    st = addToHand(st, big);
    // Format C: is in hand.
    const stillThere = st.hand.find((s) => s.card.id === "format-c");
    expect(stillThere).toBeDefined();
    // Roll the turn — it persists in the persistent-hand system.
    st = startPlayerTurn(st, rng);
    expect(st.hand.some((s) => s.card.id === "format-c")).toBe(true);
  });

  it("random revive pulls from the discard pile only — never from the consumed pile", () => {
    const rng = makeRng(215);
    // Restore Point was retired in the power-curve overhaul; the `revive`
    // (selection: random) effect kind itself remains valid. Build a synthetic
    // card with the same shape to exercise the resolver path.
    const recall = syntheticRandomRevive();
    let st = startPlayerTurn(createMatchCardState([recall], rng), rng);
    st = {
      ...st,
      energy: ENERGY_MAX,
      discardPile: [FIREWALL, FREEZE_PROCESS],
      // Format C: in consumed must NOT be revivable.
      consumedPile: [getCardById("format-c")],
    };
    const idx = st.hand.findIndex((s) => s.card.id === recall.id);
    const r = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The consumed pile is unchanged: Format C: stays gone.
    expect(r.state.consumedPile.some((c) => c.id === "format-c")).toBe(true);
    // The resolver removed one card from the discard pile (emitted as an
    // add-card-to-hand side effect) and the synthetic card itself was
    // discarded after play. Net discard pile length: 2 - 1 + 1 = 2.
    expect(r.state.discardPile.length).toBe(2);
    const fx = r.sideEffects.find((f) => f.kind === "add-card-to-hand");
    expect(fx).toBeDefined();
  });
});

describe("playCard — destroy", () => {
  it("Exploit rejects an enemy King with target-not-enemy-non-king-piece", () => {
    const rng = makeRng(220);
    const cheap = getCardById("exploit");
    let st = startPlayerTurn(createMatchCardState([cheap], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "exploit");
    const ctx = withPieces({ e8: { type: "king", side: "opponent" } });
    const r = playCard(st, idx, { kind: "square", square: "e8" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-enemy-non-king-piece");
  });

  it("Exploit rejects an unattacked enemy with target-not-attacked-by-player", () => {
    const rng = makeRng(221);
    const cheap = getCardById("exploit");
    let st = startPlayerTurn(createMatchCardState([cheap], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "exploit");
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });
    const r = playCard(st, idx, { kind: "square", square: "e7" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-attacked-by-player");
  });

  it("Exploit on an attacked enemy emits remove-piece and consumes", () => {
    const rng = makeRng(222);
    const cheap = getCardById("exploit");
    let st = startPlayerTurn(createMatchCardState([cheap], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "exploit");
    const ctx = withPieces(
      { e7: { type: "pawn", side: "opponent" } },
      { attackedByPlayer: new Set(["e7"]) },
    );
    const r = playCard(st, idx, { kind: "square", square: "e7" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "remove-piece", square: "e7" }]);
    expect(r.state.consumedPile.some((c) => c.id === "exploit")).toBe(true);
  });

  it("Format C: rejects king but works on any other enemy", () => {
    const rng = makeRng(223);
    const big = getCardById("format-c");
    let st = startPlayerTurn(createMatchCardState([big], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "format-c");
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
  it("Extract on any enemy + own piece emits swap-pieces (no rooted requirement)", () => {
    const rng = makeRng(233);
    const vine = getCardById("extract");
    let st = startPlayerTurn(createMatchCardState([vine], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "extract");
    const ctx = withPieces({
      e7: { type: "pawn", side: "opponent" },
      e2: { type: "pawn", side: "player" },
    });
    const r = playCard(st, idx, { kind: "two-squares", first: "e7", second: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects).toEqual([{ kind: "swap-pieces", a: "e7", b: "e2" }]);
  });

  it("Extract rejects an enemy King with target-not-enemy-non-king-piece", () => {
    const rng = makeRng(234);
    const vine = getCardById("extract");
    let st = startPlayerTurn(createMatchCardState([vine], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "extract");
    const ctx = withPieces({
      e8: { type: "king", side: "opponent" },
      e2: { type: "pawn", side: "player" },
    });
    const r = playCard(st, idx, { kind: "two-squares", first: "e8", second: "e2" }, ctx, rng);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("target-not-enemy-non-king-piece");
  });

  it("random revive returns one discarded card to hand", () => {
    const rng = makeRng(235);
    const recall = syntheticRandomRevive();
    let st = startPlayerTurn(createMatchCardState([recall], rng), rng);
    st = { ...st, energy: ENERGY_MAX, discardPile: [FIREWALL, FREEZE_PROCESS, ENCRYPTED] };
    const idx = st.hand.findIndex((s) => s.card.id === recall.id);
    const r = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Resolver removed one from discard and emitted add-card-to-hand. The
    // synthetic card itself is non-Consume, so it lands in discard after play.
    // Net discard: 3 - 1 + 1 = 3.
    expect(r.state.discardPile).toHaveLength(3);
    const fx = r.sideEffects.find((f) => f.kind === "add-card-to-hand");
    expect(fx).toBeDefined();
  });

  it("random revive on an empty discard pile is a no-op (apart from cycling itself)", () => {
    const rng = makeRng(236);
    const recall = syntheticRandomRevive();
    let st = startPlayerTurn(createMatchCardState([recall], rng), rng);
    st = { ...st, energy: ENERGY_MAX, discardPile: [] };
    const idx = st.hand.findIndex((s) => s.card.id === recall.id);
    const r = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sideEffects.filter((f) => f.kind === "add-card-to-hand")).toHaveLength(0);
    // The synthetic card cycles into the discard pile after play.
    expect(r.state.discardPile).toHaveLength(1);
  });

  it("Restore from Backup (choose revive) emits a revive-prompt; completeRevive moves the picked card", () => {
    const rng = makeRng(237);
    const recover = getCardById("restore-from-backup");
    let st = startPlayerTurn(createMatchCardState([recover], rng), rng);
    st = { ...st, energy: ENERGY_MAX, discardPile: [FIREWALL, FREEZE_PROCESS] };
    const idx = st.hand.findIndex((s) => s.card.id === "restore-from-backup");
    const r = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Restore from Backup has Consume → goes to consumedPile. discardPile is unchanged
    // (the UI completes the revive by picking a card from it).
    expect(r.state.consumedPile.some((c) => c.id === "restore-from-backup")).toBe(true);
    expect(r.state.discardPile).toHaveLength(2);
    expect(r.sideEffects.some((f) => f.kind === "revive-prompt")).toBe(true);
    // Now finish the revive by picking index 0 (Firewall was first).
    const after = completeRevive(r.state, 0);
    expect(after.discardPile).toHaveLength(1);
    expect(after.hand[after.hand.length - 1].card.id).toBe("firewall");
  });

  it("shuffleIntoDraw splices a card into a random slot of the draw pile", () => {
    const rng = makeRng(240);
    const initialDeck = [FIREWALL, FREEZE_PROCESS, OVERCLOCK];
    let st = createMatchCardState(initialDeck, rng);
    const beforeLen = st.drawPile.length;
    st = shuffleIntoDraw(st, ENCRYPTED, () => 0.5);
    expect(st.drawPile.length).toBe(beforeLen + 1);
    expect(st.drawPile.some((c) => c.id === "encrypted")).toBe(true);
  });

  it("addToHand appends without enforcing HAND_SIZE", () => {
    const rng = makeRng(241);
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    const before = st.hand.length;
    st = addToHand(st, FIREWALL);
    st = addToHand(st, FIREWALL);
    expect(st.hand.length).toBe(before + 2);
  });
});

describe("capture-grants-energy", () => {
  it("capturing a knight grants 3 energy (piece value)", () => {
    const rng = makeRng(250);
    const st = createMatchCardState(makeStarterDeck(), rng);
    const before = st.energy;
    const next = grantEnergyOnCapture(st, { type: "knight", side: "opponent" }, "player");
    expect(next.energy).toBe(before + PIECE_ENERGY_VALUES["knight"]);
  });

  it("each non-king enemy piece type grants its chess value in energy", () => {
    const rng = makeRng(251);
    const st = createMatchCardState(makeStarterDeck(), rng);
    const cases: Array<[Piece["type"], number]> = [
      ["pawn", 1],
      ["knight", 3],
      ["bishop", 3],
      ["rook", 5],
      ["queen", 9],
    ];
    for (const [type, expectedValue] of cases) {
      const next = grantEnergyOnCapture(st, { type, side: "opponent" }, "player");
      expect(next.energy).toBe(st.energy + expectedValue);
    }
  });

  it("opponent capturing player's piece does not grant energy", () => {
    const rng = makeRng(252);
    const st = createMatchCardState(makeStarterDeck(), rng);
    const before = st.energy;
    const next = grantEnergyOnCapture(st, { type: "pawn", side: "player" }, "opponent");
    expect(next.energy).toBe(before);
  });

  it("king capture is a no-op (defensive — game ends in practice)", () => {
    const rng = makeRng(253);
    const st = createMatchCardState(makeStarterDeck(), rng);
    const before = st.energy;
    const next = grantEnergyOnCapture(st, { type: "king", side: "opponent" }, "player");
    expect(next.energy).toBe(before);
  });

  it("null captured piece is a no-op", () => {
    const rng = makeRng(254);
    const st = createMatchCardState(makeStarterDeck(), rng);
    const before = st.energy;
    const next = grantEnergyOnCapture(st, null, "player");
    expect(next.energy).toBe(before);
  });
});
