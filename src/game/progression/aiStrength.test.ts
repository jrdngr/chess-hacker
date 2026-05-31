import { describe, expect, it } from "vitest";

import { aiStrengthForMatch } from "./aiStrength";

describe("aiStrengthForMatch", () => {
  it("climbs across the run, with each new act resetting below the prior boss", () => {
    const skill = (m: number) => aiStrengthForMatch(m).skillLevel ?? 0;
    // Non-boss matches (skipping the boss spikes at 3/6/9) climb monotonically.
    const nonBoss = [1, 2, 4, 5, 7, 8].map(skill);
    for (let i = 1; i < nonBoss.length; i++) {
      expect(nonBoss[i]).toBeGreaterThan(nonBoss[i - 1]!);
    }
    expect(skill(1)).toBeLessThan(skill(9)); // M1 weaker than the finale
    expect(skill(9)).toBe(20); // finale = full strength
  });

  it("keeps boss skill at or above both neighbouring matches", () => {
    const skill = (m: number) => aiStrengthForMatch(m).skillLevel ?? 0;
    for (const boss of [3, 6, 9]) {
      expect(skill(boss)).toBeGreaterThanOrEqual(skill(boss - 1));
      if (boss < 9) expect(skill(boss)).toBeGreaterThanOrEqual(skill(boss + 1));
    }
    // Boss A in particular resets the act-2 baseline below itself.
    expect(skill(3)).toBeGreaterThan(skill(4));
  });

  it("starts the run beatably weak (low skill, shallow-ish depth)", () => {
    const m1 = aiStrengthForMatch(1);
    expect(m1.skillLevel).toBeLessThanOrEqual(5);
    expect(m1.depth).toBeLessThanOrEqual(8);
  });

  it("bumps boss matches above the depth of their non-boss neighbours", () => {
    expect(aiStrengthForMatch(3).depth!).toBeGreaterThan(aiStrengthForMatch(2).depth!);
    expect(aiStrengthForMatch(6).depth!).toBeGreaterThan(aiStrengthForMatch(5).depth!);
    expect(aiStrengthForMatch(9).depth!).toBeGreaterThan(aiStrengthForMatch(8).depth!);
  });

  it("falls back to the finale entry for out-of-range match numbers", () => {
    expect(aiStrengthForMatch(99)).toEqual(aiStrengthForMatch(9));
  });
});
