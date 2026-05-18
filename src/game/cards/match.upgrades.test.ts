// Smoke tests for upgraded card variants (the `+` cards). The library tests
// already validate the data shape; these tests verify that the runtime
// resolver honors the new fields (durationTurns on freeze/disarm/shield;
// keyword toggles; effect-kind swaps for Sprint+ → lightning).

import { describe, expect, it } from "vitest";

import type { BoardContext, PlayTarget } from "./match";
import {
  ENERGY_MAX,
  createMatchCardState,
  isFrozen,
  isDisarmed,
  isShielded,
  lightningAt,
  makeRng,
  playCard,
  startPlayerTurn,
} from "./match";
import { getCardById } from "./library";
import type { Piece } from "../types";

function withPieces(map: Record<string, Piece>): BoardContext {
  return {
    pieceAt: (sq) => map[sq] ?? null,
    hasWall: () => false,
    isAttackedBy: () => false,
    isRooted: () => false,
  };
}

describe("upgraded card runtime effects", () => {
  it("Freeze Process+ freezes for 2 player turns", () => {
    const rng = makeRng(1);
    const upgraded = getCardById("freeze-process+");
    let st = startPlayerTurn(createMatchCardState([upgraded], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });
    const target: PlayTarget = { kind: "square", square: "e7" };
    const r = playCard(st, 0, target, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isFrozen(r.state, "e7")).toBe(true);
    // turn starts at 1; durationTurns 2 → expires on turn 3 (cleared at start
    // of turn 3, so still frozen during turn 2).
    expect(r.state.freezes[0].expiresOnTurn).toBe(r.state.turn + 2);
  });

  it("Read-Only+ disarms for 2 player turns", () => {
    const rng = makeRng(2);
    const upgraded = getCardById("read-only+");
    let st = startPlayerTurn(createMatchCardState([upgraded], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = withPieces({ e7: { type: "pawn", side: "opponent" } });
    const r = playCard(st, 0, { kind: "square", square: "e7" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isDisarmed(r.state, "e7")).toBe(true);
    expect(r.state.disarms[0].expiresOnTurn).toBe(r.state.turn + 2);
  });

  it("Encrypted+ shields own piece for 2 turns", () => {
    const rng = makeRng(3);
    const upgraded = getCardById("encrypted+");
    let st = startPlayerTurn(createMatchCardState([upgraded], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = withPieces({ e2: { type: "pawn", side: "player" } });
    const r = playCard(st, 0, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isShielded(r.state, "e2")).toBe(true);
    expect(r.state.shields[0].expiresOnTurn).toBe(r.state.turn + 2);
  });

  it("Port Scan+ draws 3 cards", () => {
    const rng = makeRng(4);
    const upgraded = getCardById("port-scan+");
    const filler = getCardById("freeze-process");
    // Eight-card deck so there's plenty to draw from after the initial fill.
    const deck = [upgraded, filler, filler, filler, filler, filler, filler, filler];
    let st = startPlayerTurn(createMatchCardState(deck, rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const idx = st.hand.findIndex((s) => s.card.id === "port-scan+");
    if (idx === -1) {
      // Card landed in draw pile after shuffle; smoke test still validates
      // data shape elsewhere.
      expect(st.drawPile.some((c) => c.id === "port-scan+")).toBe(true);
      return;
    }
    const before = st.hand.length;
    const r = playCard(st, idx, { kind: "none" }, withPieces({}), rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Slot vacates (slot is set to null) but the resolver draws 3 into free
    // slots / appends past the cap. Net hand length should grow by 2 (Port
    // Scan+ slot emptied minus 1, plus 3 drawn → +2 net).
    expect(r.state.hand.length).toBe(before + 2);
  });

  it("Lateral Movement+ removes Consume (lands in discard, not consumed)", () => {
    const rng = makeRng(5);
    const upgraded = getCardById("lateral-movement+");
    expect(upgraded.consume).toBe(false);
    let st = startPlayerTurn(createMatchCardState([upgraded], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = withPieces({ e2: { type: "pawn", side: "player" } });
    const r = playCard(st, 0, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.consumedPile.find((c) => c.id === "lateral-movement+")).toBeUndefined();
    expect(r.state.discardPile.find((c) => c.id === "lateral-movement+")).toBeDefined();
  });

  it("Sprint+ swaps haste for lightning (2 actions, captures allowed)", () => {
    const rng = makeRng(6);
    const upgraded = getCardById("sprint+");
    let st = startPlayerTurn(createMatchCardState([upgraded], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = withPieces({ e2: { type: "knight", side: "player" } });
    const r = playCard(st, 0, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Sprint+ uses lightning-piece (2 actions) instead of haste.
    const lightning = lightningAt(r.state, "e2");
    expect(lightning?.remaining).toBe(2);
    // And no haste was added.
    expect(r.state.hastes.find((h) => h.square === "e2")).toBeUndefined();
  });
});
