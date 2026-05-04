import { describe, expect, it } from "vitest";

import {
  drawOnCapture,
  drawOnCheck,
  effectiveCardCost,
  effectiveEnergyPerTurn,
  effectiveHandSize,
  effectiveStartingEnergy,
  energyOnCapture,
  goldOnMatchStart,
} from "./effects";
import { ENERGY_PER_TURN, HAND_SIZE, STARTING_ENERGY } from "../cards/match";
import { getArtifactById } from "./library";
import { BARRICADE, FORESIGHT } from "../cards/library";

describe("artifact effect helpers", () => {
  it("an empty artifact list yields the base values", () => {
    expect(effectiveHandSize([])).toBe(HAND_SIZE);
    expect(effectiveStartingEnergy([])).toBe(STARTING_ENERGY);
    expect(effectiveEnergyPerTurn([])).toBe(ENERGY_PER_TURN);
    expect(goldOnMatchStart([])).toBe(0);
    expect(drawOnCapture([])).toBe(0);
    expect(energyOnCapture([])).toBe(0);
    expect(drawOnCheck([])).toBe(0);
  });

  it("hand-size bonuses stack additively", () => {
    const a = getArtifactById("stone-hourglass"); // +1
    const b = getArtifactById("royal-patronage"); // +1, +4 gold
    expect(effectiveHandSize([a, b])).toBe(HAND_SIZE + 2);
  });

  it("start energy + per-turn energy sum bonuses", () => {
    const spark = getArtifactById("spark-coil"); // +1 start
    const drum = getArtifactById("war-drum"); // +1/turn
    expect(effectiveStartingEnergy([spark, drum])).toBe(STARTING_ENERGY + 1);
    expect(effectiveEnergyPerTurn([spark, drum])).toBe(ENERGY_PER_TURN + 1);
  });

  it("gold-on-match-start sums across artifacts", () => {
    const lucky = getArtifactById("lucky-coin"); // +2
    const royal = getArtifactById("royal-patronage"); // +4
    expect(goldOnMatchStart([lucky, royal])).toBe(6);
  });

  it("global card-cost-discount applies to every card and never goes below 0", () => {
    const conduit = getArtifactById("power-conduit"); // -1 all
    expect(effectiveCardCost(BARRICADE, [conduit])).toBe(BARRICADE.cost - 1);
    // Foresight is already cost 1; -1 floors at 0.
    const zeroOrLower = effectiveCardCost(FORESIGHT, [conduit]);
    expect(zeroOrLower).toBeGreaterThanOrEqual(0);
  });

  it("archetype-scoped discount only applies to matching archetypes", () => {
    const banner = getArtifactById("rallying-banner"); // tempo -1
    const sigil = getArtifactById("cunning-sigil"); // spatial -1
    // Barricade is "spatial" — sigil should drop its cost, banner should not.
    const justBanner = effectiveCardCost(BARRICADE, [banner]);
    const justSigil = effectiveCardCost(BARRICADE, [sigil]);
    expect(justBanner).toBe(BARRICADE.cost);
    expect(justSigil).toBe(Math.max(0, BARRICADE.cost - 1));
  });

  it("capture / check triggers sum counts across artifacts", () => {
    const charm = getArtifactById("vampiric-charm"); // draw 1 on cap
    const edge = getArtifactById("hunters-edge"); // +1 energy on cap
    const eye = getArtifactById("tacticians-eye"); // draw 1 on check
    expect(drawOnCapture([charm, edge, eye])).toBe(1);
    expect(energyOnCapture([charm, edge])).toBe(1);
    expect(drawOnCheck([charm, eye])).toBe(1);
  });
});
