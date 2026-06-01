import { describe, expect, it } from "vitest";

import {
  BOSS_DEFS,
  VALID_BOSS_MODIFIER_KINDS,
  bossForAct,
  bossForMatch,
  bossesForMatch,
} from "./library";
import { getStatusEffectById } from "../status/library";

describe("boss library", () => {
  it("every boss has a modifier with a recognized kind", () => {
    for (const boss of BOSS_DEFS) {
      expect(
        VALID_BOSS_MODIFIER_KINDS.includes(boss.modifier.kind as never),
        `${boss.id}: modifier kind '${boss.modifier.kind}' not in VALID_BOSS_MODIFIER_KINDS`,
      ).toBe(true);
    }
  });

  it("every boss's statusEffects resolve and have curse flavor", () => {
    for (const boss of BOSS_DEFS) {
      for (const seId of boss.statusEffects) {
        const def = getStatusEffectById(seId);
        expect(def, `${boss.id}: status effect '${seId}' not found`).toBeDefined();
        expect(def.flavor, `${boss.id}: status '${seId}' should be a curse`).toBe("curse");
      }
    }
  });

  it("every boss is in its act's pool, and the act pool is non-empty", () => {
    for (const boss of BOSS_DEFS) {
      const pool = bossesForMatch(boss.matchNumber).map((b) => b.id);
      expect(pool, `${boss.id} should be in its match pool`).toContain(boss.id);
      const act = (boss.matchNumber / 3) as 1 | 2 | 3;
      // bossForAct/bossForMatch return the canonical first-of-pool boss.
      expect(bossForAct(act)?.id).toBe(bossForMatch(boss.matchNumber)?.id);
      expect(bossesForMatch(boss.matchNumber).length).toBeGreaterThan(0);
    }
  });

  it("every boss defines at least one game mechanic", () => {
    for (const boss of BOSS_DEFS) {
      const hasMechanic =
        boss.modifier.kind !== undefined ||
        (boss.hazardWalls?.length ?? 0) > 0 ||
        (boss.voidSquares?.length ?? 0) > 0 ||
        boss.statusEffects.length > 0;
      expect(hasMechanic, `${boss.id}: defines no game mechanics`).toBe(true);
    }
  });

  it("hazardWalls and voidSquares use valid algebraic notation", () => {
    const algebraic = /^[a-h][1-8]$/;
    for (const boss of BOSS_DEFS) {
      for (const sq of boss.hazardWalls ?? []) {
        expect(sq, `${boss.id}: invalid hazard wall '${sq}'`).toMatch(algebraic);
      }
      for (const sq of boss.voidSquares ?? []) {
        expect(sq, `${boss.id}: invalid void square '${sq}'`).toMatch(algebraic);
      }
    }
  });

  it("returns null for matches without a defined boss", () => {
    const bossMatches = new Set<number>(BOSS_DEFS.map((b) => b.matchNumber));
    for (let m = 1; m <= 12; m++) {
      if (!bossMatches.has(m)) {
        expect(bossForMatch(m), `match ${m} should not have a boss`).toBeNull();
      }
    }
  });
});
