// Smoke tests for upgraded card variants (the `+` cards). The library tests
// already validate the data shape; these tests verify that the runtime
// resolver honors the new fields (durationTurns on freeze/disarm/shield;
// keyword toggles; effect-kind swaps for Overclock+ → lightning).

import { describe, expect, it } from "vitest";

import type { PlayTarget } from "./match";
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
import { withPieces } from "./match.testHelpers";

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

  it("Overclock+ upgrades from haste-piece to lightning-piece (removes Disarm)", () => {
    const base = getCardById("overclock");
    const upgraded = getCardById("overclock+");
    expect(base.effect.kind).toBe("haste-piece");
    expect(upgraded.effect.kind).toBe("lightning-piece");
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

  it("Overclock+ swaps haste for lightning (full actions, no Disarm)", () => {
    const rng = makeRng(6);
    const upgraded = getCardById("overclock+");
    let st = startPlayerTurn(createMatchCardState([upgraded], rng), rng);
    st = { ...st, energy: ENERGY_MAX };
    const ctx = withPieces({ e2: { type: "knight", side: "player" } });
    const r = playCard(st, 0, { kind: "square", square: "e2" }, ctx, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Overclock+ uses lightning-piece (2 actions) instead of haste.
    const lightning = lightningAt(r.state, "e2");
    expect(lightning?.remaining).toBe(2);
    // And no haste was added (no Disarm on first move).
    expect(r.state.hastes.find((h) => h.square === "e2")).toBeUndefined();
  });
});
