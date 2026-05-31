// Direct acceptance/rejection tests for validateCard — the gatekeeper that
// turns raw JSON into typed Cards (run over the whole library at load and on
// every synthesized upgrade). Pins each top-level enum allow-list and the
// target/effect compatibility check.

import { describe, expect, it } from "vitest";

import { validateCard } from "./cardValidator";

// A minimal valid card (mirrors firewall.json): place-wall on an empty square.
const VALID_CARD = {
  id: "test-card",
  name: "Test Card",
  cost: 2,
  rarity: "common",
  archetype: "spatial",
  description: "Wall on a square.",
  target: { kind: "empty-square" },
  effect: { kind: "place-wall", durationTurns: 3 },
};

describe("validateCard — acceptance", () => {
  it("accepts a minimal valid card", () => {
    const { card, errors } = validateCard(VALID_CARD);
    expect(errors).toEqual([]);
    expect(card?.id).toBe("test-card");
    expect(card?.effect.kind).toBe("place-wall");
  });

  it("accepts optional consume/retain booleans", () => {
    const { card, errors } = validateCard({ ...VALID_CARD, consume: true, retain: false });
    expect(errors).toEqual([]);
    expect(card?.consume).toBe(true);
  });

  it("accepts a none-target resource card (gain-energy)", () => {
    const { card, errors } = validateCard({
      ...VALID_CARD,
      archetype: "resource",
      target: { kind: "none" },
      effect: { kind: "gain-energy", amount: 2 },
    });
    expect(errors).toEqual([]);
    expect(card?.effect.kind).toBe("gain-energy");
  });
});

describe("validateCard — rejection", () => {
  const cases: Array<{ name: string; raw: unknown }> = [
    { name: "non-object input", raw: 42 },
    { name: "empty id", raw: { ...VALID_CARD, id: "" } },
    { name: "missing name", raw: { ...VALID_CARD, name: undefined } },
    { name: "out-of-set cost", raw: { ...VALID_CARD, cost: 99 } },
    { name: "non-numeric cost", raw: { ...VALID_CARD, cost: "free" } },
    { name: "out-of-set rarity", raw: { ...VALID_CARD, rarity: "legendary" } },
    { name: "out-of-set archetype", raw: { ...VALID_CARD, archetype: "wizardry" } },
    { name: "non-boolean consume", raw: { ...VALID_CARD, consume: "yes" } },
    { name: "non-string description", raw: { ...VALID_CARD, description: 5 } },
    { name: "unknown target kind", raw: { ...VALID_CARD, target: { kind: "teleporter" } } },
    { name: "unknown effect kind", raw: { ...VALID_CARD, effect: { kind: "summon-dragon" } } },
    {
      name: "missing required effect field (place-wall durationTurns)",
      raw: { ...VALID_CARD, effect: { kind: "place-wall" } },
    },
    {
      name: "target/effect mismatch (place-wall with none target)",
      raw: { ...VALID_CARD, target: { kind: "none" } },
    },
    {
      name: "invalid zone-buff pattern",
      raw: {
        ...VALID_CARD,
        target: { kind: "none" },
        effect: {
          kind: "place-zone-buff",
          pattern: "square-radius-99",
          buff: { kind: "energy-per-turn", amount: 1 },
          durationTurns: 5,
          autoPlace: ["d4"],
        },
      },
    },
  ];

  for (const { name, raw } of cases) {
    it(`rejects: ${name}`, () => {
      const { card, errors } = validateCard(raw);
      expect(errors.length).toBeGreaterThan(0);
      expect(card).toBeNull();
    });
  }
});
