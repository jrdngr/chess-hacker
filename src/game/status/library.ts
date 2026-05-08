// Status-effect library, loaded from JSON. Replaces the curse-card data files
// under src/game/cards/data/. See docs/design/status-effects.md.
//
// Each definition lives in `./data/<id>.json`; this module loads them at
// startup, validates each, and exposes a typed lookup. The shape mirrors the
// boss library at `src/game/bosses/library.ts`.

import type { StatusEffectDef, StatusEffectId } from "../types";

import { validateStatusEffectDef } from "./validate";

function basenameNoExt(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.json$/, "");
}

function loadStatusEffectLibrary(): StatusEffectDef[] {
  const modules = import.meta.glob<unknown>("./data/*.json", {
    eager: true,
    import: "default",
  });

  const out: StatusEffectDef[] = [];
  const seen = new Set<string>();
  const allErrors: string[] = [];

  const paths = Object.keys(modules).sort();
  for (const path of paths) {
    const raw = modules[path];
    const { def, errors } = validateStatusEffectDef(raw);
    if (errors.length > 0) {
      allErrors.push(`${path}:\n  - ${errors.join("\n  - ")}`);
      continue;
    }
    if (!def) continue;

    const expectedId = basenameNoExt(path);
    if (def.id !== expectedId) {
      allErrors.push(
        `${path}: filename '${expectedId}.json' does not match status id '${def.id}'.`,
      );
      continue;
    }
    if (seen.has(def.id)) {
      allErrors.push(`${path}: duplicate status effect id '${def.id}'`);
      continue;
    }
    seen.add(def.id);
    out.push(def);
  }

  if (allErrors.length > 0) {
    throw new Error(
      `Failed to load status effect library — fix the following ${allErrors.length === 1 ? "issue" : "issues"} in src/game/status/data/:\n\n${allErrors.join("\n\n")}`,
    );
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export const STATUS_EFFECT_DEFS: ReadonlyArray<StatusEffectDef> = loadStatusEffectLibrary();

const LIBRARY: Map<StatusEffectId, StatusEffectDef> = new Map(
  STATUS_EFFECT_DEFS.map((d) => [d.id, d]),
);

export function getStatusEffectById(id: StatusEffectId): StatusEffectDef {
  const d = LIBRARY.get(id);
  if (!d) throw new Error(`Unknown status effect id '${id}'`);
  return d;
}

export function hasStatusEffect(id: StatusEffectId): boolean {
  return LIBRARY.has(id);
}
