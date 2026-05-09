// App-level palette + vision state.
//
// `palette` swaps the active CSS variable block via the `data-palette`
// attribute on <html>. `vision` is the board-vision toggle pulled up out of
// Match so the ticker can drive it. Both persist to localStorage so the
// player's choice survives a reload.

export type PaletteId = "amber" | "terminal" | "hexbloom" | "blueprint";

export const PALETTES: ReadonlyArray<{
  id: PaletteId;
  name: string;
  tag: string;
  swatches: ReadonlyArray<string>;
}> = [
  {
    id: "terminal",
    name: "TERMINAL.SH",
    tag: "green phosphor",
    swatches: ["#7fffaa", "#34d27a", "#ff5d6c", "#ffc857"],
  },
  {
    id: "hexbloom",
    name: "HEX_BLOOM",
    tag: "magenta + cyan",
    swatches: ["#1befff", "#ff2bd6", "#c9ff3a", "#7c3aed"],
  },
  {
    id: "amber",
    name: "AMBER_TT",
    tag: "vintage amber",
    swatches: ["#ffb627", "#e6932c", "#ff4d3a", "#9bd96b"],
  },
  {
    id: "blueprint",
    name: "BLUEPRINT",
    tag: "drafting paper",
    swatches: ["#f5f7ff", "#4fd1c5", "#ff5d5d", "#ffd166"],
  },
];

export const DEFAULT_PALETTE: PaletteId = "amber";

const PALETTE_KEY = "choss:palette";
const VISION_KEY = "choss:vision";
const THREATS_KEY = "choss:threats";

export function loadPalette(): PaletteId {
  try {
    const v = window.localStorage.getItem(PALETTE_KEY);
    if (v === "amber" || v === "terminal" || v === "hexbloom" || v === "blueprint") return v;
  } catch {
    // Ignore — private mode / quota errors shouldn't break the menu.
  }
  return DEFAULT_PALETTE;
}

export function savePalette(p: PaletteId): void {
  try {
    window.localStorage.setItem(PALETTE_KEY, p);
  } catch {
    // Ignore.
  }
}

export function loadVision(): boolean {
  try {
    return window.localStorage.getItem(VISION_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveVision(on: boolean): void {
  try {
    window.localStorage.setItem(VISION_KEY, on ? "true" : "false");
  } catch {
    // Ignore.
  }
}

export function loadThreats(): boolean {
  try {
    return window.localStorage.getItem(THREATS_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveThreats(on: boolean): void {
  try {
    window.localStorage.setItem(THREATS_KEY, on ? "true" : "false");
  } catch {
    // Ignore.
  }
}
