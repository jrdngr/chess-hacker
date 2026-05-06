import { describe, expect, it } from "vitest";

import {
  ARTIFACT_LIBRARY,
  allArtifacts,
  getArtifactById,
  getArtifactsByRarity,
  pickRandomArtifacts,
} from "./library";
import { makeRng } from "../cards/match";

describe("artifact library", () => {
  it("contains at least 10 artifacts spanning all rarities", () => {
    const all = allArtifacts();
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(getArtifactsByRarity("common").length).toBeGreaterThan(0);
    expect(getArtifactsByRarity("uncommon").length).toBeGreaterThan(0);
    expect(getArtifactsByRarity("rare").length).toBeGreaterThan(0);
  });

  it("artifact ids are unique and findable", () => {
    for (const a of allArtifacts()) {
      expect(ARTIFACT_LIBRARY[a.id]).toBe(a);
      expect(getArtifactById(a.id)).toBe(a);
    }
  });

  it("getArtifactById throws on unknown id", () => {
    expect(() => getArtifactById("not-real")).toThrow();
  });

  it("every artifact has at least one effect", () => {
    for (const a of allArtifacts()) {
      expect(a.effects.length).toBeGreaterThan(0);
    }
  });

  it("the pool covers the active effect domains", () => {
    const kinds = new Set<string>();
    for (const a of allArtifacts()) for (const fx of a.effects) kinds.add(fx.kind);
    // Conditional triggers (capture / check), card-related (cost discount on
    // spatial via Map Editor), the new piece-rule-modifier domain, and at
    // least one zone-buff (Foothold center-square). Resource artifacts
    // (hand-size / energy / gold) are out of the prototype pool — boss-pick
    // rewards still synthesise them at runtime, but no library entries
    // declare them after the M-power-curve overhaul.
    expect(kinds.has("card-cost-discount")).toBe(true);
    expect(kinds.has("draw-on-capture") || kinds.has("draw-on-check")).toBe(true);
    expect(kinds.has("piece-rule-modifier")).toBe(true);
    expect(kinds.has("zone-buff")).toBe(true);
  });
});

describe("pickRandomArtifacts", () => {
  it("returns `count` distinct artifacts", () => {
    const rng = makeRng(7);
    const picks = pickRandomArtifacts(3, rng);
    expect(picks.length).toBe(3);
    expect(new Set(picks.map((p) => p.id)).size).toBe(3);
  });

  it("respects excludeIds", () => {
    const rng = makeRng(1);
    const exclude = new Set(allArtifacts().map((a) => a.id));
    expect(pickRandomArtifacts(2, rng, exclude)).toEqual([]);
  });

  it("never returns artifacts in excludeIds", () => {
    const rng = makeRng(11);
    const exclude = new Set(["keylogger"]);
    for (let seed = 0; seed < 20; seed++) {
      const picks = pickRandomArtifacts(allArtifacts().length, makeRng(seed), exclude);
      for (const p of picks) expect(p.id).not.toBe("keylogger");
    }
    void rng;
  });
});
