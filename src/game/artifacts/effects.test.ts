import { describe, expect, it } from "vitest";

import {
  drawOnCapture,
  drawOnCheck,
  effectiveCardCost,
  effectiveEnergyPerTurn,
  effectiveHandSize,
  energyOnCapture,
  goldOnMatchStart,
} from "./effects";
import { ENERGY_PER_TURN, HAND_SIZE } from "../cards/match";
import { getArtifactById } from "./library";
import { FIREWALL, STACK_TRACE } from "../cards/library";

describe("artifact effect helpers", () => {
  it("an empty artifact list yields the base values", () => {
    expect(effectiveHandSize([])).toBe(HAND_SIZE);
    expect(effectiveEnergyPerTurn([])).toBe(ENERGY_PER_TURN);
    expect(goldOnMatchStart([])).toBe(0);
    expect(drawOnCapture([])).toBe(0);
    expect(energyOnCapture([])).toBe(0);
    expect(drawOnCheck([])).toBe(0);
  });

  it("hand-size bonuses stack additively", () => {
    const a = getArtifactById("extra-ram"); // +1
    const b = getArtifactById("vc-funding"); // +1, +4 gold
    expect(effectiveHandSize([a, b])).toBe(HAND_SIZE + 2);
  });

  it("start-energy-bonus and energy-per-turn-bonus both feed effectiveEnergyPerTurn", () => {
    // Banking was removed; both legacy artifacts now raise the same per-turn
    // baseline. Stacked together they add 2 to the baseline.
    const spark = getArtifactById("cold-boot"); // +1 (legacy start)
    const drum = getArtifactById("crypto-miner"); // +1/turn
    expect(effectiveEnergyPerTurn([spark, drum])).toBe(ENERGY_PER_TURN + 2);
  });

  it("gold-on-match-start sums across artifacts", () => {
    const lucky = getArtifactById("crypto-wallet"); // +2
    const royal = getArtifactById("vc-funding"); // +4
    expect(goldOnMatchStart([lucky, royal])).toBe(6);
  });

  it("global card-cost-discount applies to every card and never goes below 0", () => {
    const conduit = getArtifactById("overclocked-cpu"); // -1 all
    expect(effectiveCardCost(FIREWALL, [conduit])).toBe(FIREWALL.cost - 1);
    // Stack Trace is cost 0; -1 floors at 0.
    const zeroOrLower = effectiveCardCost(STACK_TRACE, [conduit]);
    expect(zeroOrLower).toBeGreaterThanOrEqual(0);
  });

  it("archetype-scoped discount only applies to matching archetypes", () => {
    const banner = getArtifactById("speed-hack"); // tempo -1
    const sigil = getArtifactById("map-editor"); // spatial -1
    // Firewall is "spatial" — sigil should drop its cost, banner should not.
    const justBanner = effectiveCardCost(FIREWALL, [banner]);
    const justSigil = effectiveCardCost(FIREWALL, [sigil]);
    expect(justBanner).toBe(FIREWALL.cost);
    expect(justSigil).toBe(Math.max(0, FIREWALL.cost - 1));
  });

  it("capture / check triggers sum counts across artifacts", () => {
    const charm = getArtifactById("keylogger"); // draw 1 on cap
    const edge = getArtifactById("bug-bounty"); // +1 energy on cap
    const eye = getArtifactById("threat-detector"); // draw 1 on check
    expect(drawOnCapture([charm, edge, eye])).toBe(1);
    expect(energyOnCapture([charm, edge])).toBe(1);
    expect(drawOnCheck([charm, eye])).toBe(1);
  });
});
