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
import type { Artifact, ArtifactEffect, CardArchetype } from "../types";

// Synthetic artifact builder for tests covering effect kinds whose canonical
// artifacts (cold-boot, extra-ram, crypto-miner, etc.) were retired in favour
// of piece-rule-modifier content. The kinds themselves remain valid in the
// schema (boss-pick rewards still emit them), so we exercise the helpers via
// inline fixtures rather than library lookups.
function syntheticArtifact(id: string, ...effects: ArtifactEffect[]): Artifact {
  return {
    id,
    name: id,
    rarity: "common",
    description: "test artifact",
    effects,
  };
}

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
    const a = syntheticArtifact("h1", { kind: "hand-size-bonus", amount: 1 });
    const b = syntheticArtifact("h2", { kind: "hand-size-bonus", amount: 1 });
    expect(effectiveHandSize([a, b])).toBe(HAND_SIZE + 2);
  });

  it("start-energy-bonus and energy-per-turn-bonus both feed effectiveEnergyPerTurn", () => {
    // Banking was removed; both legacy artifact effect kinds raise the same
    // per-turn baseline. Stacked together they add 2.
    const spark = syntheticArtifact("e1", { kind: "start-energy-bonus", amount: 1 });
    const drum = syntheticArtifact("e2", { kind: "energy-per-turn-bonus", amount: 1 });
    expect(effectiveEnergyPerTurn([spark, drum])).toBe(ENERGY_PER_TURN + 2);
  });

  it("gold-on-match-start sums across artifacts", () => {
    const lucky = syntheticArtifact("g1", { kind: "gold-on-match-start", amount: 2 });
    const royal = syntheticArtifact("g2", { kind: "gold-on-match-start", amount: 4 });
    expect(goldOnMatchStart([lucky, royal])).toBe(6);
  });

  it("global card-cost-discount applies to every card and never goes below 0", () => {
    const conduit = syntheticArtifact("d1", { kind: "card-cost-discount", amount: 1 });
    expect(effectiveCardCost(FIREWALL, [conduit])).toBe(FIREWALL.cost - 1);
    // Stack Trace is cost 0; -1 floors at 0.
    const zeroOrLower = effectiveCardCost(STACK_TRACE, [conduit]);
    expect(zeroOrLower).toBeGreaterThanOrEqual(0);
  });

  it("archetype-scoped discount only applies to matching archetypes", () => {
    const bannerArch: CardArchetype = "tempo";
    const banner = syntheticArtifact("d2", {
      kind: "card-cost-discount",
      archetype: bannerArch,
      amount: 1,
    });
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
