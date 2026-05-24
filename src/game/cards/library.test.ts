import { describe, expect, it } from "vitest";

import {
  baseLibraryCards,
  CARD_LIBRARY,
  getUpgradedCard,
  isUpgraded,
  UPGRADE_SUFFIX,
} from "./library";

describe("upgrade expansion", () => {
  it("every base card defines an upgrade block", () => {
    const missing = baseLibraryCards().filter((c) => !c.upgrade);
    expect(missing.map((c) => c.id)).toEqual([]);
  });

  it("every base card has a registered `+` variant", () => {
    for (const base of baseLibraryCards()) {
      const upgraded = CARD_LIBRARY[base.id + UPGRADE_SUFFIX];
      expect(upgraded, `missing upgraded variant for ${base.id}`).toBeDefined();
    }
  });

  it("upgraded variants preserve archetype and lack their own `upgrade` field", () => {
    for (const base of baseLibraryCards()) {
      const upgraded = CARD_LIBRARY[base.id + UPGRADE_SUFFIX];
      expect(upgraded.archetype).toBe(base.archetype);
      expect(upgraded.upgrade).toBeUndefined();
    }
  });

  it("upgraded variant ids and names end in `+`", () => {
    for (const base of baseLibraryCards()) {
      const upgraded = CARD_LIBRARY[base.id + UPGRADE_SUFFIX];
      expect(upgraded.id).toBe(base.id + "+");
      expect(upgraded.name).toBe(base.name + "+");
    }
  });

  it("getUpgradedCard returns the `+` variant for a base card", () => {
    const base = CARD_LIBRARY["freeze-process"];
    const upgraded = getUpgradedCard(base);
    expect(upgraded?.id).toBe("freeze-process+");
  });

  it("getUpgradedCard returns null for an already-upgraded card", () => {
    const upgraded = CARD_LIBRARY["freeze-process+"];
    expect(getUpgradedCard(upgraded)).toBeNull();
  });

  it("isUpgraded agrees with the `+` id suffix", () => {
    for (const card of Object.values(CARD_LIBRARY)) {
      expect(isUpgraded(card)).toBe(card.id.endsWith("+"));
    }
  });

  it("baseLibraryCards excludes `+` variants", () => {
    for (const card of baseLibraryCards()) {
      expect(card.id.endsWith("+")).toBe(false);
    }
    // Sanity: roughly half the library is base cards, the other half upgraded.
    expect(baseLibraryCards().length).toBe(Object.values(CARD_LIBRARY).length / 2);
  });

  it("Freeze Process+ adds durationTurns 2", () => {
    const upgraded = CARD_LIBRARY["freeze-process+"];
    expect(upgraded.effect.kind).toBe("freeze-piece");
    expect((upgraded.effect as { durationTurns?: number }).durationTurns).toBe(2);
  });

  it("Lateral Movement+ removes Consume", () => {
    const base = CARD_LIBRARY["lateral-movement"];
    const upgraded = CARD_LIBRARY["lateral-movement+"];
    expect(base.consume).toBe(true);
    expect(upgraded.consume).toBe(false);
  });

  it("Sprint+ swaps haste-piece for lightning-piece (captures allowed)", () => {
    const upgraded = CARD_LIBRARY["sprint+"];
    expect(upgraded.effect.kind).toBe("lightning-piece");
    expect((upgraded.effect as { actions?: number }).actions).toBe(2);
  });
});
