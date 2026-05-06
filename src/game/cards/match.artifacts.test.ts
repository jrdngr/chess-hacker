// Match-state behavior under artifacts. Covers the resource / match-rule
// effects (hand size, starting energy, energy per turn, card-cost discount).
// Capture / check triggers are wired up in Match.tsx — those are exercised
// via the Match component test suite.

import { describe, expect, it } from "vitest";

import {
  HAND_SIZE,
  STARTING_ENERGY,
  ENERGY_PER_TURN,
  createMatchCardState,
  makeRng,
  playCard,
  startPlayerTurn,
  type BoardContext,
} from "./match";
import { FIREWALL, makeStarterDeck } from "./library";
import { getArtifactById } from "../artifacts/library";
import type { Artifact, ArtifactEffect } from "../types";

const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
  isAttackedBy: () => false,
  isRooted: () => false,
};

// Synthetic artifact builder for resource-effect tests; the canonical resource
// artifacts (cold-boot, extra-ram, crypto-miner, etc.) were retired in the
// power-curve overhaul, but the underlying effect kinds remain valid in the
// schema (boss-pick rewards still emit them).
function syntheticArtifact(id: string, ...effects: ArtifactEffect[]): Artifact {
  return { id, name: id, rarity: "common", description: "test artifact", effects };
}

describe("artifact-driven match state", () => {
  it("hand-size-bonus increases the start-of-turn refill target", () => {
    const rng = makeRng(1);
    const hourglass = syntheticArtifact("hourglass", { kind: "hand-size-bonus", amount: 1 });
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng, [hourglass]), rng);
    expect(st.hand.length).toBe(HAND_SIZE + 1);
  });

  it("start-energy-bonus folds into the per-turn baseline (banking removed)", () => {
    const rng = makeRng(1);
    const spark = syntheticArtifact("spark", { kind: "start-energy-bonus", amount: 1 });
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng, [spark]), rng);
    expect(st.turn).toBe(1);
    expect(st.energy).toBe(STARTING_ENERGY + 1);
    // Without banking, every subsequent turn lands on the same elevated baseline.
    st = startPlayerTurn(st, rng);
    expect(st.energy).toBe(STARTING_ENERGY + 1);
  });

  it("energy-per-turn-bonus raises every turn's baseline (no carryover)", () => {
    const rng = makeRng(1);
    const drum = syntheticArtifact("drum", { kind: "energy-per-turn-bonus", amount: 1 });
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng, [drum]), rng);
    expect(st.energy).toBe(ENERGY_PER_TURN + 1);
    st = startPlayerTurn(st, rng);
    expect(st.turn).toBe(2);
    expect(st.energy).toBe(ENERGY_PER_TURN + 1);
  });

  it("card-cost-discount lets the player play cards they couldn't otherwise afford", () => {
    const rng = makeRng(1);
    const sigil = getArtifactById("map-editor"); // -1 spatial
    // Force-feed Firewall (cost 1, spatial) onto a hand with 0 energy. Without
    // the discount this throws "not-enough-energy"; with it the play succeeds.
    const base = createMatchCardState([FIREWALL], rng, [sigil]);
    const st = {
      ...base,
      hand: [{ card: FIREWALL, retained: false }],
      drawPile: [],
      energy: 0,
      turn: 1,
    };
    const result = playCard(st, 0, { kind: "square", square: "e4" }, emptyBoard, rng);
    expect(result.ok).toBe(true);
  });

  it("a zone-buff artifact materialises into MatchCardState.zoneBuffs", () => {
    const rng = makeRng(1);
    const banner = getArtifactById("foothold"); // hand-size +1 on the central squares
    const st = createMatchCardState(makeStarterDeck(), rng, [banner]);
    expect(st.zoneBuffs).toHaveLength(1);
    expect(st.zoneBuffs[0].region).toEqual({ kind: "center" });
    expect(st.zoneBuffs[0].effect).toEqual({ kind: "hand-size", amount: 1 });
    expect(st.zoneBuffs[0].expiresOnTurn).toBeUndefined();
  });

  it("an active zone-buff hand-size bonus inflates the start-of-turn refill", () => {
    const rng = makeRng(1);
    const banner = getArtifactById("foothold");
    // Foothold's center region on 8×8 = d4/e4/d5/e5; placing a player piece on
    // d4 activates the buff.
    const ctx = {
      size: { files: 8, ranks: 8 },
      pieceSideAt: (sq: string) => (sq === "d4" ? ("player" as const) : null),
    };
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng, [banner]), rng, ctx);
    expect(st.hand.length).toBe(HAND_SIZE + 1);
  });

  it("an inactive zone-buff (region uncontrolled) doesn't grant its bonus", () => {
    const rng = makeRng(1);
    const banner = getArtifactById("foothold");
    // No piece on a center square → buff inactive.
    const ctx = { size: { files: 8, ranks: 8 }, pieceSideAt: () => null };
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng, [banner]), rng, ctx);
    expect(st.hand.length).toBe(HAND_SIZE);
  });
});

describe("artifact-driven match state — piece-rule-modifier (start-of-turn)", () => {
  it("piece-empower-all (Cavalry Doctrine) re-applies a knight-step empower each turn", () => {
    const rng = makeRng(1);
    const cavalry = getArtifactById("cavalry-doctrine"); // knight + king-step
    const pieces: Record<string, { side: "player" | "opponent"; type: string }> = {
      b1: { side: "player", type: "knight" },
      g1: { side: "player", type: "knight" },
    };
    const ctx = {
      size: { files: 8, ranks: 8 },
      pieceSideAt: (sq: string) => pieces[sq]?.side ?? null,
      pieceTypeAt: (sq: string) => (pieces[sq]?.type ?? null) as never,
    };
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng, [cavalry]), rng, ctx);
    const empoweredSquares = new Set(st.empowers.map((e) => e.square));
    expect(empoweredSquares.has("b1")).toBe(true);
    expect(empoweredSquares.has("g1")).toBe(true);
    // Pattern is king-step.
    expect(st.empowers.every((e) => e.pattern === "king-step")).toBe(true);
  });

  it("phalanx-adjacent-shield shields friendly pieces with friendly orth-neighbours", () => {
    const rng = makeRng(2);
    const phalanx = getArtifactById("phalanx");
    // d4 + e4 (adjacent friends) and a far-off h8 (alone).
    const pieces: Record<string, { side: "player" | "opponent"; type: string }> = {
      d4: { side: "player", type: "pawn" },
      e4: { side: "player", type: "pawn" },
      h8: { side: "player", type: "rook" },
    };
    const ctx = {
      size: { files: 8, ranks: 8 },
      pieceSideAt: (sq: string) => pieces[sq]?.side ?? null,
      pieceTypeAt: (sq: string) => (pieces[sq]?.type ?? null) as never,
    };
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng, [phalanx]), rng, ctx);
    const shielded = new Set(st.shields.map((s) => s.square));
    expect(shielded.has("d4")).toBe(true);
    expect(shielded.has("e4")).toBe(true);
    expect(shielded.has("h8")).toBe(false);
  });
});
