import { useCallback, useEffect, useState } from "react";

import { freshDesignerState, reseedLibrary } from "./seed";
import type { DesignerState, DesignerStatusEffectEntry, DesignerBossEntry } from "./types";
import { STATUS_EFFECT_DEFS } from "../../game/status/library";

const STORAGE_KEY = "chess-hacker:content-designer:v1";

/**
 * Read+migrate the persisted designer state. We bumped the schema from v1 to
 * v2 when the curse-card system was replaced with status effects: every v1
 * payload had `bosses[*].curses: [{trigger, curseId}]` and no top-level
 * `statusEffects` map. Migration injects a fresh-from-library `statusEffects`
 * map and rewrites each boss's `curses` array into a `statusEffects: string[]`
 * shape using the known-curse mapping.
 */
function load(): DesignerState {
  if (typeof localStorage === "undefined") return freshDesignerState();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return freshDesignerState();
  try {
    const parsed = JSON.parse(raw) as { version?: unknown };
    if (parsed && typeof parsed === "object") {
      if ((parsed as DesignerState).version === 2) {
        return parsed as DesignerState;
      }
      if ((parsed as { version?: number }).version === 1) {
        return migrateV1ToV2(parsed as Record<string, unknown>);
      }
    }
  } catch {
    // fall through
  }
  return freshDesignerState();
}

const KNOWN_CURSE_TO_STATUS: Record<string, string> = {
  throttled: "throttled",
  "memory-leak": "memory-leak",
  hardened: "hardened",
  echo: "echo",
  "bit-rot": "bit-rot",
};

function migrateV1ToV2(raw: Record<string, unknown>): DesignerState {
  const fresh = freshDesignerState();

  if (raw.cards && typeof raw.cards === "object") {
    fresh.cards = { ...fresh.cards };
    for (const [id, entry] of Object.entries(raw.cards as Record<string, unknown>)) {
      if (entry && typeof entry === "object") {
        // Strip the legacy `curse` boolean from the persisted Card.
        const e = entry as { data?: Record<string, unknown> };
        if (e.data && "curse" in e.data) {
          delete (e.data as Record<string, unknown>).curse;
        }
        fresh.cards[id] = entry as (typeof fresh.cards)[string];
      }
    }
  }

  if (raw.artifacts && typeof raw.artifacts === "object") {
    fresh.artifacts = { ...(raw.artifacts as typeof fresh.artifacts) };
  }

  // Bosses: rewrite `curses` to `statusEffects` using the known-curse map.
  if (raw.bosses && typeof raw.bosses === "object") {
    fresh.bosses = { ...fresh.bosses };
    for (const [id, entry] of Object.entries(raw.bosses as Record<string, unknown>)) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as DesignerBossEntry & { data: Record<string, unknown> };
      const data = e.data as Record<string, unknown>;
      const cursesField = data.curses;
      const statusEffects: string[] = [];
      if (Array.isArray(cursesField)) {
        for (const c of cursesField) {
          if (!c || typeof c !== "object") continue;
          const curseId = (c as { curseId?: string }).curseId;
          if (typeof curseId !== "string") continue;
          const mapped = KNOWN_CURSE_TO_STATUS[curseId];
          if (mapped) {
            if (!statusEffects.includes(mapped)) statusEffects.push(mapped);
          } else {
            // Unknown legacy curse id — log and skip.
            // eslint-disable-next-line no-console
            console.warn(
              `[designer] migration v1→v2: dropping unknown curseId '${curseId}' on boss '${id}'`,
            );
          }
        }
      }
      const migrated: DesignerBossEntry = {
        data: { ...(e.data as object), statusEffects } as unknown as DesignerBossEntry["data"],
        source: e.source,
        modified: e.modified,
      };
      delete (migrated.data as { curses?: unknown }).curses;
      if (e.newProperties) migrated.newProperties = e.newProperties;
      fresh.bosses[id] = migrated;
    }
  }

  // Status effects: seed from library; preserve any user-authored entries (none
  // exist in v1, but be defensive).
  fresh.statusEffects = {};
  for (const def of STATUS_EFFECT_DEFS) {
    fresh.statusEffects[def.id] = {
      data: JSON.parse(JSON.stringify(def)) as DesignerStatusEffectEntry["data"],
      source: "library",
      modified: false,
    };
  }

  if (raw.decks && typeof raw.decks === "object") {
    fresh.decks = { ...(raw.decks as typeof fresh.decks) };
  }

  return fresh;
}

function save(state: DesignerState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * The designer's single source of truth. State is held in React and mirrored
 * to localStorage on every change — small enough that JSON.stringify is fine.
 *
 * `update` takes a producer (state in, state out). All editor pages call this
 * to commit edits.
 */
export function useDesignerStore() {
  const [state, setState] = useState<DesignerState>(() => load());

  useEffect(() => {
    save(state);
  }, [state]);

  const update = useCallback((producer: (s: DesignerState) => DesignerState) => {
    setState((prev) => producer(prev));
  }, []);

  const replace = useCallback((next: DesignerState) => {
    setState(next);
  }, []);

  const resetLibrary = useCallback(() => {
    setState((prev) => reseedLibrary(prev));
  }, []);

  return { state, update, replace, resetLibrary } as const;
}
