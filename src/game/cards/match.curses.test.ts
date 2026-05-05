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
import { FIREWALL, getCardById, makeStarterDeck } from "./library";

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
    const throttled = getCardById("throttled");
    expect(throttled.curse).toBe(true);
    st = insertCurseIntoHand(st, throttled);
    const before = st.consumedPile.length;

    const idx = st.hand.findIndex((s) => s.card.id === "throttled");
    expect(idx).toBeGreaterThanOrEqual(0);

    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.consumedPile.length).toBe(before); // no growth.
    expect(res.state.hand.find((s) => s.card.id === "throttled")).toBeUndefined();
  });

  it("Throttled play sets the must-not-check flag for the next chess move", () => {
    const rng = makeRng(2);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = insertCurseIntoHand(st, getCardById("throttled"));
    const idx = st.hand.findIndex((s) => s.card.id === "throttled");
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
    st = insertCurseIntoHand(st, getCardById("throttled"));
    st = insertCurseIntoHand(st, getCardById("throttled"));
    expect(st.hand.length).toBe(HAND_SIZE + 2);
    // Drop one non-curse card so a follow-up refill has work to do.
    st = { ...st, hand: st.hand.filter((_, i) => i !== st.hand.findIndex((s) => !s.card.curse)) };
    expect(st.hand.length).toBe(HAND_SIZE + 1); // 4 non-curse + 2 curses
    st = refillHand(st, rng);
    // Refill brings non-curse count back up to HAND_SIZE; curses still ride.
    expect(st.hand.filter((s) => !s.card.curse).length).toBe(HAND_SIZE);
    expect(st.hand.filter((s) => s.card.curse).length).toBe(2);
  });
});

describe("match modifier — forbiddenCardEffectKinds", () => {
  const rules: MatchRules = {
    forbiddenCardEffectKinds: new Set(["place-wall"]),
  };

  it("rejects play of a forbidden card", () => {
    const rng = makeRng(4);
    const st = startPlayerTurn(createMatchCardState([FIREWALL], rng), rng);
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

describe("Boss B — Memory Leak curse", () => {
  it("playing Memory Leak sets pendingEnergyLossOnNoCapture", () => {
    const rng = makeRng(11);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = insertCurseIntoHand(st, getCardById("memory-leak"));
    const idx = st.hand.findIndex((s) => s.card.id === "memory-leak");
    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.pendingEnergyLossOnNoCapture).toBe(true);
  });

  it("Memory Leak penalty fires at next start-of-turn if no capture happened", () => {
    const rng = makeRng(12);
    const init = startPlayerTurn(createMatchCardState([], rng), rng);
    const flagged = { ...init, pendingEnergyLossOnNoCapture: true, energy: 5 };
    const next = startPlayerTurn(flagged, rng);
    expect(next.energy).toBe(5 + 1 - 1); // +1 per-turn ramp − 1 Memory Leak penalty
    expect(next.pendingEnergyLossOnNoCapture).toBe(false);
  });

  it("Memory Leak penalty is suppressed when capturedThisTurn is true", () => {
    const rng = makeRng(13);
    const init = startPlayerTurn(createMatchCardState([], rng), rng);
    const flagged = {
      ...init,
      pendingEnergyLossOnNoCapture: true,
      capturedThisTurn: true,
      energy: 5,
    };
    const next = startPlayerTurn(flagged, rng);
    expect(next.energy).toBe(5 + 1); // ramp only — no penalty
    expect(next.pendingEnergyLossOnNoCapture).toBe(false);
    expect(next.capturedThisTurn).toBe(false);
  });
});

describe("Boss B — captures-grant-captured-energy modifier", () => {
  it("queued energy on previous turn lands at next start-of-turn", () => {
    const rng = makeRng(14);
    const init = startPlayerTurn(createMatchCardState([], rng), rng);
    const queued = { ...init, pendingPlayerEnergyOnTurnStart: 2, energy: 3 };
    const next = startPlayerTurn(queued, rng);
    expect(next.energy).toBe(3 + 1 + 2); // ramp + queued
    expect(next.pendingPlayerEnergyOnTurnStart).toBe(0);
  });
});

describe("Boss C — Hardened curse", () => {
  it("playing Hardened sets noZeroCostCardsThisTurn", () => {
    const rng = makeRng(21);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = insertCurseIntoHand(st, getCardById("hardened"));
    const idx = st.hand.findIndex((s) => s.card.id === "hardened");
    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.noZeroCostCardsThisTurn).toBe(true);
  });

  it("blocks subsequent 0-cost non-curse plays this turn", () => {
    const rng = makeRng(22);
    // No card defines cost 0 in the current pool, so synthesize a
    // 0-cost non-curse card inline to validate the gate.
    const zeroCost = { ...getCardById("stack-trace"), cost: 0 as const };
    let st = startPlayerTurn(createMatchCardState([zeroCost], rng), rng);
    st = { ...st, noZeroCostCardsThisTurn: true };
    const idx = st.hand.findIndex((s) => s.card.id === zeroCost.id);
    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("effect-forbidden-by-modifier");
  });

  it("noZeroCostCardsThisTurn does not block curse plays (curses can't be discarded)", () => {
    const rng = makeRng(23);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = { ...st, noZeroCostCardsThisTurn: true };
    st = insertCurseIntoHand(st, getCardById("memory-leak"));
    const idx = st.hand.findIndex((s) => s.card.id === "memory-leak");
    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
  });

  it("noZeroCostCardsThisTurn resets at start of next turn", () => {
    const rng = makeRng(24);
    const init = startPlayerTurn(createMatchCardState([], rng), rng);
    const next = startPlayerTurn({ ...init, noZeroCostCardsThisTurn: true }, rng);
    expect(next.noZeroCostCardsThisTurn).toBe(false);
  });
});

describe("Boss C — Echo curse", () => {
  it("playing Echo increments bossExtraMoves", () => {
    const rng = makeRng(31);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = insertCurseIntoHand(st, getCardById("echo"));
    const idx = st.hand.findIndex((s) => s.card.id === "echo");
    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.bossExtraMoves).toBe(1);
  });
});

describe("Boss C — Bit Rot curse", () => {
  it("playing Bit Rot emits a remove-random-own-minor side effect", () => {
    const rng = makeRng(41);
    let st = startPlayerTurn(createMatchCardState([], rng), rng);
    st = insertCurseIntoHand(st, getCardById("bit-rot"));
    const idx = st.hand.findIndex((s) => s.card.id === "bit-rot");
    const res = playCard(st, idx, noTarget(), emptyBoard, rng);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sideEffects.some((fx) => fx.kind === "remove-random-own-minor")).toBe(true);
  });
});
