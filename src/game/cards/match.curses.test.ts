// Curse-specific behaviour layered on top of the standard playCard / refill
// flows. Per docs/design/bosses.md: curses are bonus beyond the hand-size
// cap, vanish on play, and can be blocked from play by match modifiers.

import { describe, expect, it } from "vitest";

import {
  HAND_SIZE,
  createMatchCardState,
  insertCurseIntoHand,
  isCardEffectForbidden,
  makeRng,
  playCard,
  refillHand,
  startPlayerTurn,
  type BoardContext,
  type MatchRules,
  type PlayTarget,
} from "./match";
import { BARRICADE, getCardById, makeStarterDeck } from "./library";

const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
  isAttackedBy: () => false,
  isRooted: () => false,
};

function noTarget(): PlayTarget {
  return { kind: "none" };
}

describe("curses", () => {
  it("vanish on play — do not enter the consumed pile", () => {
    const rng = makeRng(1);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    const stalwart = getCardById("stalwart");
    expect(stalwart.curse).toBe(true);
    st = insertCurseIntoHand(st, stalwart);
    const before = st.consumedPile.length;

    const idx = st.hand.findIndex((c) => c.id === "stalwart");
    expect(idx).toBeGreaterThanOrEqual(0);

    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.consumedPile.length).toBe(before); // no growth.
    expect(res.state.hand.find((c) => c.id === "stalwart")).toBeUndefined();
  });

  it("Stalwart play sets the must-not-check flag for the next chess move", () => {
    const rng = makeRng(2);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = insertCurseIntoHand(st, getCardById("stalwart"));
    const idx = st.hand.findIndex((c) => c.id === "stalwart");
    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.mustNotCheckNextMove).toBe(true);
  });

  it("do not count toward the hand-size cap when refilling", () => {
    const rng = makeRng(3);
    // Starter deck (~20 cards) → first refill hits the HAND_SIZE cap.
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng), rng);
    expect(st.hand.length).toBe(HAND_SIZE);
    // Insert two curses — hand goes from 5 to 7 (curses are bonus).
    st = insertCurseIntoHand(st, getCardById("stalwart"));
    st = insertCurseIntoHand(st, getCardById("stalwart"));
    expect(st.hand.length).toBe(HAND_SIZE + 2);
    // Drop one non-curse card so a follow-up refill has work to do.
    st = { ...st, hand: st.hand.filter((_, i) => i !== st.hand.findIndex((c) => !c.curse)) };
    expect(st.hand.length).toBe(HAND_SIZE + 1); // 4 non-curse + 2 curses
    st = refillHand(st, rng);
    // Refill brings non-curse count back up to HAND_SIZE; curses still ride.
    expect(st.hand.filter((c) => !c.curse).length).toBe(HAND_SIZE);
    expect(st.hand.filter((c) => c.curse).length).toBe(2);
  });
});

describe("match modifier — forbiddenCardEffectKinds", () => {
  const rules: MatchRules = {
    forbiddenCardEffectKinds: new Set(["place-wall"]),
  };

  it("rejects play of a forbidden card", () => {
    const rng = makeRng(4);
    const st = startPlayerTurn(createMatchCardState([BARRICADE], rng), rng);
    // Cost 1; energy starts at 1. Spendable.
    const res = playCard(st, 0, { kind: "square", square: "d4" }, emptyBoard, rng, rules);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("effect-forbidden-by-modifier");
  });

  it("isCardEffectForbidden flags top-level + compound child effects", () => {
    const direct = isCardEffectForbidden({ kind: "place-wall", durationTurns: 3 }, rules);
    expect(direct).toBe(true);

    const wrapped = isCardEffectForbidden(
      {
        kind: "compound",
        effects: [
          { kind: "draw", count: 1 },
          { kind: "place-wall", durationTurns: 3 },
        ],
      },
      rules,
    );
    expect(wrapped).toBe(true);

    const allowed = isCardEffectForbidden({ kind: "draw", count: 1 }, rules);
    expect(allowed).toBe(false);
  });
});
