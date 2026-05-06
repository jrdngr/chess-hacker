// Boss-reward 3-pick (Monster-Train-style). Verifies each option produces the
// expected state delta. The Reward UI / phase wiring is exercised by the Run
// component test suite; these tests cover the pure run-state helpers.

import { describe, expect, it } from "vitest";

import { consumeBossDeleteCharge, createRun, generateBossPickOffer, pickBossOption } from "./run";
import { FIREWALL, FREEZE_PROCESS, STACK_TRACE } from "../cards/library";

describe("generateBossPickOffer", () => {
  it("returns the fixed three-option offer", () => {
    const offer = generateBossPickOffer();
    expect(offer.options).toHaveLength(3);
    const kinds = offer.options.map((o) => o.kind).sort();
    expect(kinds).toEqual(["delete-cards", "draw-per-turn-bonus", "energy-per-turn-bonus"]);
  });
});

describe("pickBossOption", () => {
  it("energy-per-turn-bonus appends a synthetic artifact with energy-per-turn-bonus", () => {
    const run = createRun({ mode: "standard", rngSeed: 1 });
    const next = pickBossOption(run, { kind: "energy-per-turn-bonus", amount: 1 });
    expect(next.artifacts).toHaveLength(run.artifacts.length + 1);
    const added = next.artifacts[next.artifacts.length - 1];
    expect(added.effects).toEqual([{ kind: "energy-per-turn-bonus", amount: 1 }]);
  });

  it("draw-per-turn-bonus appends a synthetic artifact with hand-size-bonus", () => {
    const run = createRun({ mode: "standard", rngSeed: 1 });
    const next = pickBossOption(run, { kind: "draw-per-turn-bonus", amount: 1 });
    const added = next.artifacts[next.artifacts.length - 1];
    expect(added.effects).toEqual([{ kind: "hand-size-bonus", amount: 1 }]);
  });

  it("delete-cards sets bossDeleteCharges to 2 without touching artifacts", () => {
    const run = createRun({ mode: "standard", rngSeed: 1 });
    const next = pickBossOption(run, { kind: "delete-cards", count: 2 });
    expect(next.bossDeleteCharges).toBe(2);
    expect(next.artifacts).toEqual(run.artifacts);
  });
});

describe("consumeBossDeleteCharge", () => {
  it("removes the indexed card and decrements the charge counter", () => {
    const run = createRun({
      mode: "standard",
      rngSeed: 1,
      startingDeck: [FIREWALL, FREEZE_PROCESS, STACK_TRACE],
    });
    const withCharges = pickBossOption(run, { kind: "delete-cards", count: 2 });
    const after = consumeBossDeleteCharge(withCharges, 1);
    expect(after).not.toBeNull();
    if (!after) return;
    expect(after.deck.map((c) => c.id)).toEqual(["firewall", "stack-trace"]);
    expect(after.bossDeleteCharges).toBe(1);
  });

  it("clears the charges field when the last charge is consumed", () => {
    const run = createRun({
      mode: "standard",
      rngSeed: 1,
      startingDeck: [FIREWALL, FREEZE_PROCESS],
    });
    let st = pickBossOption(run, { kind: "delete-cards", count: 2 });
    st = consumeBossDeleteCharge(st, 0)!;
    st = consumeBossDeleteCharge(st, 0)!;
    expect(st.bossDeleteCharges).toBeUndefined();
    expect(st.deck).toEqual([]);
  });

  it("returns null when no charges remain or the index is out of range", () => {
    const run = createRun({
      mode: "standard",
      rngSeed: 1,
      startingDeck: [FIREWALL],
    });
    expect(consumeBossDeleteCharge(run, 0)).toBeNull(); // no charges
    const withCharges = pickBossOption(run, { kind: "delete-cards", count: 2 });
    expect(consumeBossDeleteCharge(withCharges, 5)).toBeNull(); // out of range
  });
});
