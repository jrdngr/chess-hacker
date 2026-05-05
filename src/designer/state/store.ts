import { useCallback, useEffect, useState } from "react";

import { freshDesignerState, reseedLibrary } from "./seed";
import type { DesignerState } from "./types";

const STORAGE_KEY = "choss:content-designer:v1";

function load(): DesignerState {
  if (typeof localStorage === "undefined") return freshDesignerState();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return freshDesignerState();
  try {
    const parsed = JSON.parse(raw) as DesignerState;
    if (parsed && parsed.version === 1) return parsed;
  } catch {
    // fall through
  }
  return freshDesignerState();
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
