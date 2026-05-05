// Pure derivations of MatchCardState for the Match render path. Each helper
// returns a fresh structure; React wraps with `useMemo` for stability.
//
// Pure TS — no React, no DOM. Tests can call these directly with a fabricated
// MatchCardState and assert the output.

import type { ExtraOverlays } from "../../game/chess/engine";
import type { EffectInfo, SquareEffects } from "../Board/Board";
import type { AlgebraicSquare, EmpowerPattern, MatchCardState, Side } from "../../game/types";

/**
 * Wall, freeze, root, disarm, compel, shield, sanctuary, trap, empower —
 * the nine overlay shapes the chess engine and the Board UI consume.
 */
export type OverlaySets = {
  walledSet: ReadonlySet<AlgebraicSquare>;
  frozenSet: ReadonlySet<AlgebraicSquare>;
  rootedSet: ReadonlySet<AlgebraicSquare>;
  disarmedSet: ReadonlySet<AlgebraicSquare>;
  compelledSet: ReadonlySet<AlgebraicSquare>;
  shieldedSet: ReadonlySet<AlgebraicSquare>;
  sanctuarySet: ReadonlySet<AlgebraicSquare>;
  trapSet: ReadonlySet<AlgebraicSquare>;
  hastedSet: ReadonlySet<AlgebraicSquare>;
  empowerMap: ReadonlyMap<AlgebraicSquare, ReadonlySet<EmpowerPattern>>;
};

/** Build all overlay sets from a MatchCardState in one pass. */
export function deriveOverlaySets(state: MatchCardState): OverlaySets {
  const empowerMap = new Map<AlgebraicSquare, Set<EmpowerPattern>>();
  for (const e of state.empowers) {
    let set = empowerMap.get(e.square);
    if (!set) {
      set = new Set();
      empowerMap.set(e.square, set);
    }
    set.add(e.pattern);
  }
  return {
    walledSet: new Set(state.walls.map((w) => w.square)),
    frozenSet: new Set(state.freezes.map((f) => f.square)),
    rootedSet: new Set(state.roots.map((r) => r.square)),
    disarmedSet: new Set(state.disarms.map((d) => d.square)),
    compelledSet: new Set(state.compels.map((c) => c.square)),
    shieldedSet: new Set(state.shields.map((s) => s.square)),
    sanctuarySet: new Set(state.sanctuaries.map((s) => s.square)),
    trapSet: new Set(state.traps.map((t) => t.square)),
    hastedSet: new Set(state.hastes.map((h) => h.square)),
    empowerMap,
  };
}

/** Pack the rule-layer's "extra overlays" struct from the derived sets. */
export function buildExtraOverlays(o: OverlaySets): ExtraOverlays {
  // Haste shares Disarm's "may move, may not capture" rule at the move-gen
  // layer (see docs/cards/keywords.md). Union them so a hasted piece cannot
  // capture on either of its two moves.
  const disarms =
    o.hastedSet.size === 0
      ? o.disarmedSet
      : new Set<AlgebraicSquare>([...o.disarmedSet, ...o.hastedSet]);
  return {
    roots: o.rootedSet,
    disarms,
    compels: o.compelledSet,
    shields: o.shieldedSet,
    sanctuaries: o.sanctuarySet,
    empowers: o.empowerMap,
  };
}

/**
 * Per-square badges shown on top of pieces — root / disarm / compel / shield /
 * haste / lightning / empower. A single square can carry multiple statuses
 * (e.g. shielded + empowered); they're concatenated with ", ".
 */
export function derivePieceBadges(state: MatchCardState): ReadonlyMap<AlgebraicSquare, string> {
  const m = new Map<AlgebraicSquare, string>();
  for (const r of state.roots) m.set(r.square, "rooted");
  for (const d of state.disarms) m.set(d.square, "disarmed");
  for (const c of state.compels) m.set(c.square, "compelled");
  for (const s of state.shields) m.set(s.square, "shielded");
  for (const h of state.hastes) m.set(h.square, "haste");
  for (const l of state.lightnings) m.set(l.square, "lightning");
  for (const e of state.empowers) {
    const existing = m.get(e.square);
    m.set(e.square, existing ? `${existing}, empowered` : "empowered");
  }
  return m;
}

/**
 * Per-square hover-tooltip data, split into piece-applied vs. square-applied
 * effects so the tooltip can render two sections when both exist on the same
 * square. Remaining turns = expiresOnTurn − currentTurn (an effect with
 * expiresOnTurn === turn+1 has 1 turn left).
 */
export function deriveSquareEffects(
  state: MatchCardState,
): ReadonlyMap<AlgebraicSquare, SquareEffects> {
  const m = new Map<AlgebraicSquare, SquareEffects>();
  const get = (sq: AlgebraicSquare): SquareEffects => {
    let entry = m.get(sq);
    if (!entry) {
      entry = { piece: [], square: [] };
      m.set(sq, entry);
    }
    return entry;
  };
  const t = state.turn;
  const remaining = (expiresOnTurn: number) => Math.max(0, expiresOnTurn - t);
  const pushPiece = (sq: AlgebraicSquare, fx: EffectInfo) => get(sq).piece.push(fx);
  const pushSquare = (sq: AlgebraicSquare, fx: EffectInfo) => get(sq).square.push(fx);

  for (const f of state.freezes) {
    pushPiece(f.square, { label: "Frozen", remaining: remaining(f.expiresOnTurn) });
  }
  for (const r of state.roots) {
    pushPiece(r.square, { label: "Rooted", remaining: remaining(r.expiresOnTurn) });
  }
  for (const d of state.disarms) {
    pushPiece(d.square, { label: "Disarmed", remaining: remaining(d.expiresOnTurn) });
  }
  for (const c of state.compels) {
    pushPiece(c.square, { label: "Compelled", remaining: remaining(c.expiresOnTurn) });
  }
  for (const s of state.shields) {
    pushPiece(s.square, { label: "Shielded", remaining: remaining(s.expiresOnTurn) });
  }
  for (const h of state.hastes) {
    pushPiece(h.square, { label: "Haste", remaining: remaining(h.expiresOnTurn) });
  }
  for (const l of state.lightnings) {
    pushPiece(l.square, {
      label: "Lightning",
      remaining: l.remaining,
      unit: l.remaining === 1 ? "action" : "actions",
    });
  }
  for (const e of state.empowers) {
    // Soul-card empowers are "use it or lose it" — they last the current
    // turn only (and drop early if the player moves any other piece).
    // Showing "1 turn" is accurate enough; the early-drop nuance lives in
    // the card text.
    pushPiece(e.square, {
      label: `Empowered (${e.pattern})`,
      remaining: remaining(e.expiresOnTurn),
    });
  }
  for (const w of state.walls) {
    if (w.permanent) {
      pushSquare(w.square, { label: "Wall (permanent)" });
    } else {
      pushSquare(w.square, { label: "Wall", remaining: remaining(w.expiresOnTurn) });
    }
  }
  for (const s of state.sanctuaries) {
    pushSquare(s.square, { label: "Sanctuary", remaining: remaining(s.expiresOnTurn) });
  }
  for (const tr of state.traps) {
    pushSquare(tr.square, {
      label: `Trap (${tr.effect})`,
      remaining: remaining(tr.expiresOnTurn),
    });
  }
  // Zone-buffs: only the anchor square gets a hover description (the radiating
  // squares are visualised by the aura overlay). Artifact-granted buffs have
  // no anchor and no expiry, so they're skipped here — they show in the
  // sidebar instead.
  for (const b of state.zoneBuffs ?? []) {
    if (b.region.kind === "rank") continue;
    const label = `${b.sourceLabel} (${describeZoneBuffEffect(b.effect)})`;
    if (b.expiresOnTurn === undefined) {
      pushSquare(b.region.anchor, { label });
    } else {
      pushSquare(b.region.anchor, { label, remaining: remaining(b.expiresOnTurn) });
    }
  }
  return m;
}

function describeZoneBuffEffect(fx: MatchCardState["zoneBuffs"][number]["effect"]): string {
  if (fx.kind === "energy-per-turn") return `+${fx.amount} energy/turn`;
  return `+${fx.amount} hand size`;
}

/**
 * The set of sides the human is allowed to click / drag right now.
 *
 *  - "local-pvp": both colors (human drives both).
 *  - "vs-ai" + "dev" runMode: both colors (the AI is optional via the dev toggle).
 *  - "vs-ai" + "prototype" runMode: player only.
 */
export function deriveControllableSides(
  mode: "local-pvp" | "vs-ai",
  runMode: "prototype" | "dev" | "run",
): ReadonlySet<Side> {
  if (mode === "local-pvp") return new Set<Side>(["player", "opponent"]);
  if (runMode === "dev") return new Set<Side>(["player", "opponent"]);
  return new Set<Side>(["player"]);
}
