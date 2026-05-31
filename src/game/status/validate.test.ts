// Rejection/acceptance tests for the status-effect JSON validator. Mirrors the
// gatekeeper role of cardValidator: a too-permissive regression here would let
// a malformed status def load silently.

import { describe, expect, it } from "vitest";

import { validateStatusEffectDef } from "./validate";

const VALID = {
  id: "test-status",
  name: "Test Status",
  description: "A test status.",
  trigger: { kind: "on-self-check" },
  effect: { kind: "next-move-constraint", constraint: "must-not-check" },
};

describe("validateStatusEffectDef — acceptance", () => {
  it("accepts a valid minimal def", () => {
    const { def, errors } = validateStatusEffectDef(VALID);
    expect(errors).toEqual([]);
    expect(def?.id).toBe("test-status");
    expect(def?.trigger.kind).toBe("on-self-check");
  });

  it("accepts every-n-turns with n (and optional firstOnTurn)", () => {
    const { def, errors } = validateStatusEffectDef({
      ...VALID,
      trigger: { kind: "every-n-turns", n: 4, firstOnTurn: 2 },
    });
    expect(errors).toEqual([]);
    expect(def?.trigger).toEqual({ kind: "every-n-turns", n: 4, firstOnTurn: 2 });
  });

  it("accepts an optional flavor", () => {
    const { def, errors } = validateStatusEffectDef({ ...VALID, flavor: "blessing" });
    expect(errors).toEqual([]);
    expect(def?.flavor).toBe("blessing");
  });
});

describe("validateStatusEffectDef — rejection", () => {
  const cases: Array<{ name: string; raw: unknown }> = [
    { name: "non-object input", raw: 42 },
    { name: "null input", raw: null },
    { name: "missing id", raw: { ...VALID, id: undefined } },
    { name: "empty id", raw: { ...VALID, id: "" } },
    { name: "missing name", raw: { ...VALID, name: undefined } },
    { name: "missing description", raw: { ...VALID, description: undefined } },
    { name: "missing trigger", raw: { ...VALID, trigger: undefined } },
    { name: "unknown trigger kind", raw: { ...VALID, trigger: { kind: "on-self-bananas" } } },
    { name: "every-n-turns without n", raw: { ...VALID, trigger: { kind: "every-n-turns" } } },
    {
      name: "every-n-turns with non-positive n",
      raw: { ...VALID, trigger: { kind: "every-n-turns", n: 0 } },
    },
    {
      name: "every-n-turns with non-integer firstOnTurn",
      raw: { ...VALID, trigger: { kind: "every-n-turns", n: 4, firstOnTurn: 1.5 } },
    },
    { name: "missing effect", raw: { ...VALID, effect: undefined } },
    { name: "effect without kind", raw: { ...VALID, effect: {} } },
    { name: "effect with empty kind", raw: { ...VALID, effect: { kind: "" } } },
    { name: "invalid flavor", raw: { ...VALID, flavor: "neutral" } },
  ];

  for (const { name, raw } of cases) {
    it(`rejects: ${name}`, () => {
      const { def, errors } = validateStatusEffectDef(raw);
      expect(errors.length).toBeGreaterThan(0);
      expect(def).toBeUndefined();
    });
  }
});
