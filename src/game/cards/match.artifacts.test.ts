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
import { BARRICADE, makeStarterDeck } from "./library";
import { getArtifactById } from "../artifacts/library";

const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
  isAttackedBy: () => false,
  isRooted: () => false,
};

describe("artifact-driven match state", () => {
  it("hand-size-bonus increases the start-of-turn refill target", () => {
    const rng = makeRng(1);
    const hourglass = getArtifactById("stone-hourglass"); // +1
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng, [hourglass]), rng);
    expect(st.hand.length).toBe(HAND_SIZE + 1);
  });

  it("start-energy-bonus stacks with STARTING_ENERGY on turn 1", () => {
    const rng = makeRng(1);
    const spark = getArtifactById("spark-coil"); // +1 turn 1
    const st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng, [spark]), rng);
    expect(st.turn).toBe(1);
    expect(st.energy).toBe(STARTING_ENERGY + 1);
  });

  it("energy-per-turn-bonus adds to the turn-rollover energy gain", () => {
    const rng = makeRng(1);
    const drum = getArtifactById("war-drum"); // +1/turn
    let st = startPlayerTurn(createMatchCardState(makeStarterDeck(), rng, [drum]), rng);
    const t1Energy = st.energy;
    st = startPlayerTurn(st, rng);
    expect(st.turn).toBe(2);
    expect(st.energy).toBe(t1Energy + ENERGY_PER_TURN + 1);
  });

  it("card-cost-discount lets the player play cards they couldn't otherwise afford", () => {
    const rng = makeRng(1);
    const sigil = getArtifactById("cunning-sigil"); // -1 spatial
    // Force-feed Barricade (cost 1, spatial) onto a hand with 0 energy. Without
    // the discount this throws "not-enough-energy"; with it the play succeeds.
    const base = createMatchCardState([BARRICADE], rng, [sigil]);
    const st = { ...base, hand: [BARRICADE], drawPile: [], energy: 0, turn: 1 };
    const result = playCard(st, 0, { kind: "square", square: "e4" }, emptyBoard, rng);
    expect(result.ok).toBe(true);
  });
});
