// JSON-shape validator for status effect definitions.
// Mirrors the boss validator pattern in src/game/bosses/library.ts: pure
// data-shape checks with collected error messages, no engine coupling. The
// embedded `effect` field is loosely validated here (kind is a non-empty
// string); deeper effect-shape checks are owned by the card validator since
// status effects reuse the CardEffect handlers.

import type { StatusEffectDef, StatusTrigger, CardEffect } from "../types";

export const VALID_STATUS_EFFECT_TRIGGER_KINDS = [
  "turn-start",
  "every-n-turns",
  "on-self-capture",
  "on-opponent-capture",
  "on-self-check",
  "on-self-pawn-move",
] as const;

export const VALID_STATUS_EFFECT_FLAVORS = ["curse", "blessing"] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1;
}

function validateTrigger(raw: unknown, errors: string[]): StatusTrigger | null {
  if (!isPlainObject(raw)) {
    errors.push("'trigger' must be an object with a 'kind' field");
    return null;
  }
  const kind = raw.kind;
  if (
    typeof kind !== "string" ||
    !(VALID_STATUS_EFFECT_TRIGGER_KINDS as readonly string[]).includes(kind)
  ) {
    errors.push(`'trigger.kind' must be one of ${VALID_STATUS_EFFECT_TRIGGER_KINDS.join(", ")}`);
    return null;
  }
  switch (kind) {
    case "every-n-turns": {
      if (!isPositiveInt(raw.n)) {
        errors.push("'trigger.n' must be a positive integer for kind 'every-n-turns'");
        return null;
      }
      const trigger: StatusTrigger = { kind: "every-n-turns", n: raw.n };
      if (raw.firstOnTurn !== undefined) {
        if (!isPositiveInt(raw.firstOnTurn)) {
          errors.push("'trigger.firstOnTurn' must be a positive integer if present");
          return null;
        }
        trigger.firstOnTurn = raw.firstOnTurn;
      }
      return trigger;
    }
    case "turn-start":
    case "on-self-capture":
    case "on-opponent-capture":
    case "on-self-check":
    case "on-self-pawn-move":
      return { kind } as StatusTrigger;
  }
  return null;
}

function validateEffect(raw: unknown, errors: string[]): CardEffect | null {
  if (!isPlainObject(raw)) {
    errors.push("'effect' must be an object with a 'kind' field");
    return null;
  }
  if (typeof raw.kind !== "string" || raw.kind.length === 0) {
    errors.push("'effect.kind' must be a non-empty string");
    return null;
  }
  return raw as unknown as CardEffect;
}

export function validateStatusEffectDef(raw: unknown): {
  def?: StatusEffectDef;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isPlainObject(raw)) {
    return { errors: ["status effect JSON must be an object"] };
  }

  const id = raw.id;
  if (typeof id !== "string" || id.length === 0) {
    errors.push("'id' must be a non-empty string");
  }
  const name = raw.name;
  if (typeof name !== "string" || name.length === 0) {
    errors.push("'name' must be a non-empty string");
  }
  const description = raw.description;
  if (typeof description !== "string" || description.length === 0) {
    errors.push("'description' must be a non-empty string");
  }

  const trigger = validateTrigger(raw.trigger, errors);
  const effect = validateEffect(raw.effect, errors);

  let flavor: StatusEffectDef["flavor"];
  if (raw.flavor !== undefined) {
    if (
      typeof raw.flavor !== "string" ||
      !(VALID_STATUS_EFFECT_FLAVORS as readonly string[]).includes(raw.flavor)
    ) {
      errors.push(`'flavor' must be one of ${VALID_STATUS_EFFECT_FLAVORS.join(", ")}`);
    } else {
      flavor = raw.flavor as StatusEffectDef["flavor"];
    }
  }

  if (errors.length > 0 || !trigger || !effect) return { errors };

  const def: StatusEffectDef = {
    id: id as string,
    name: name as string,
    description: description as string,
    trigger,
    effect,
  };
  if (flavor) def.flavor = flavor;
  return { def, errors };
}
