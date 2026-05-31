// Card-effect handlers: the body of `applyEffect`, extracted from match.ts.
//
// Pure functions: each handler takes the current MatchCardState (plus context)
// and returns a new state + a list of board-side effects for the React layer
// to apply. Grouped by domain — status / overlay / card-manip / movement /
// misc — but exported as a single dispatcher (`applyEffect`) so the call site
// in `playCard` doesn't have to dispatch.

import type {
  AlgebraicSquare,
  BackdoorMarker,
  Card,
  CardEffect,
  EmpowerStatus,
  LightningStatus,
  MatchCardState,
  MutexLockStatus,
  PieceStatus,
  PieceType,
  PowerEffect,
  Side,
  ZoneBuff,
} from "../types";
import {
  clampEnergy,
  drawCards,
  type BoardContext,
  type CardSideEffect,
  type PlayTarget,
  type Rng,
} from "./match";
import { getCardById } from "./library";
import { FILES, KING_OFFSETS, fileOf, kingAdjacentSquares, rankNumberOf } from "../chess/coords";

function opposite(s: Side): Side {
  return s === "player" ? "opponent" : "player";
}

export type EffectResult = { state: MatchCardState; sideEffects: CardSideEffect[] };

/**
 * Apply a single card effect against the match state. Pure — returns a new
 * state plus side effects. Compound effects fan out recursively. Validation
 * (target, cost, forbidden-by-rules) happens in `playCard` before this is
 * called, so handlers may assume the effect's preconditions are met.
 */
export function applyEffect(
  effect: CardEffect,
  state: MatchCardState,
  target: PlayTarget,
  ctx: BoardContext,
  rng: Rng,
  source: Card,
  playingIndex: number,
  side: Side = "player",
): EffectResult {
  switch (effect.kind) {
    // ---- Card / resource manipulation --------------------------------------
    case "gain-energy":
      return {
        state: { ...state, energy: clampEnergy(state.energy + effect.amount) },
        sideEffects: [],
      };
    case "draw":
      return { state: drawCards(state, effect.count, rng), sideEffects: [] };
    case "scry":
      // Scry: peek at the top N cards of the deck. The actual reordering UI
      // is owned by the React layer; the resolver can't know the new order
      // here. We surface the deck untouched and let the UI replace the top
      // N via `setDeckTop` in MatchCardState directly. For data purposes
      // the effect is a no-op at this layer; the UI layer handles the prompt.
      return { state, sideEffects: [] };
    case "add-card-to-draw": {
      const card =
        effect.source === "self"
          ? cloneCardDef(source)
          : effect.cardId
            ? cloneCardDef(getCardById(effect.cardId))
            : null;
      if (!card) return { state, sideEffects: [] };
      return { state, sideEffects: [{ kind: "add-card-to-draw", card }] };
    }
    case "revive": {
      // Revivers pull from the discard pile only — Consume cards are gone for
      // the match and cannot be returned.
      if (effect.selection === "random") {
        if (state.discardPile.length === 0) return { state, sideEffects: [] };
        const idx = Math.floor(rng() * state.discardPile.length);
        const picked = state.discardPile[idx];
        const discardPile = state.discardPile
          .slice(0, idx)
          .concat(state.discardPile.slice(idx + 1));
        return {
          state: { ...state, discardPile },
          sideEffects: [{ kind: "add-card-to-hand", card: picked }],
        };
      }
      // "choose": defer to UI prompt; the UI calls `completeRevive` once the
      // player picks a card from the discard pile.
      return { state, sideEffects: [{ kind: "revive-prompt" }] };
    }
    case "apply-retain-to-hand-card": {
      // Bookmark. Validation already ensured the index is in range, not the
      // playing slot, not a curse, and not already retained.
      if (target.kind !== "hand-card") return { state, sideEffects: [] };
      const hand = state.hand.map((slot, i) =>
        i === target.index ? { card: slot.card, retained: true } : slot,
      );
      return { state: { ...state, hand }, sideEffects: [] };
    }
    case "pending-energy-next-turn": {
      return {
        state: {
          ...state,
          pendingEnergyNextTurn: (state.pendingEnergyNextTurn ?? 0) + effect.amount,
        },
        sideEffects: [],
      };
    }

    // ---- Status (per-piece buffs/debuffs) ----------------------------------
    case "freeze-piece":
      return {
        state: addStatus(
          state,
          "freezes",
          squareTarget(target),
          state.turn + (effect.durationTurns ?? 1),
          opposite(side),
        ),
        sideEffects: [],
      };
    case "root-piece":
      return {
        state: addStatus(
          state,
          "roots",
          squareTarget(target),
          state.turn + (effect.durationTurns ?? 1),
          opposite(side),
        ),
        sideEffects: [],
      };
    case "disarm-piece":
      return {
        state: addStatus(
          state,
          "disarms",
          squareTarget(target),
          state.turn + (effect.durationTurns ?? 1),
          opposite(side),
        ),
        sideEffects: [],
      };
    case "compel-piece":
      return {
        state: addStatus(state, "compels", squareTarget(target), state.turn + 1, opposite(side)),
        sideEffects: [],
      };
    case "shield-piece": {
      // In a compound (e.g. Git Revert+), the target may be two-squares where
      // the second square is where the piece was placed — shield that one.
      const shieldSq = target.kind === "two-squares" ? target.second : squareTarget(target);
      return {
        state: addStatus(
          state,
          "shields",
          shieldSq,
          state.turn + (effect.durationTurns ?? 1),
          side,
        ),
        sideEffects: [],
      };
    }
    case "haste-piece": {
      const dur = effect.durationTurns ?? 1;
      return {
        state: addStatus(state, "hastes", squareTarget(target), state.turn + dur, side),
        sideEffects: [],
      };
    }
    case "empower-piece": {
      const sq = squareTarget(target);
      // Both regular and single-use empowers expire at the start of the next
      // player turn. Single-use additionally drops as soon as the player moves
      // a different piece (handled by `dropOtherSingleUseEmpowers`).
      const dur = effect.durationTurns ?? 1;
      const status: EmpowerStatus = {
        square: sq,
        side,
        expiresOnTurn: state.turn + dur,
        pattern: effect.pattern,
      };
      if (effect.singleUse) status.singleUse = true;
      // Stack patterns: keep one entry per (square, pattern). If the same
      // pattern is applied twice, prefer the strictest variant — a non-single-
      // use empower wins over a single-use one.
      const existing = state.empowers.find((e) => e.square === sq && e.pattern === effect.pattern);
      if (existing && !existing.singleUse) status.singleUse = false;
      if (status.singleUse === false) delete (status as { singleUse?: boolean }).singleUse;
      return {
        state: {
          ...state,
          empowers: [
            ...state.empowers.filter((e) => !(e.square === sq && e.pattern === effect.pattern)),
            status,
          ],
        },
        sideEffects: [],
      };
    }
    case "lightning-piece": {
      const sq = squareTarget(target);
      const status: LightningStatus = {
        square: sq,
        side,
        expiresOnTurn: state.turn + 1,
        remaining: effect.actions,
      };
      return {
        state: {
          ...state,
          lightnings: [...state.lightnings.filter((l) => l.square !== sq), status],
        },
        sideEffects: [],
      };
    }

    // ---- Overlays (square-anchored) ----------------------------------------
    case "place-wall": {
      const sq = squareTarget(target);
      return {
        state: {
          ...state,
          walls: [
            ...state.walls.filter((w) => w.square !== sq),
            { square: sq, expiresOnTurn: state.turn + effect.durationTurns },
          ],
        },
        sideEffects: [],
      };
    }
    case "place-sanctuary": {
      const sq = squareTarget(target);
      return {
        state: {
          ...state,
          sanctuaries: [
            ...state.sanctuaries.filter((s) => s.square !== sq),
            { square: sq, expiresOnTurn: state.turn + effect.durationTurns },
          ],
        },
        sideEffects: [],
      };
    }
    case "place-trap": {
      const sq = squareTarget(target);
      return {
        state: {
          ...state,
          traps: [
            ...state.traps.filter((t) => t.square !== sq),
            {
              square: sq,
              effect: effect.trapEffect,
              expiresOnTurn: state.turn + effect.durationTurns,
            },
          ],
        },
        sideEffects: [],
      };
    }
    case "place-zone-buff": {
      let sq: AlgebraicSquare;
      if (effect.autoPlace) {
        const candidates = effect.autoPlace.filter(
          (s) => !ctx.hasWall(s as AlgebraicSquare),
        ) as AlgebraicSquare[];
        if (candidates.length === 0) return { state, sideEffects: [] };
        sq = candidates[Math.floor(rng() * candidates.length)];
      } else {
        sq = squareTarget(target);
      }
      const buff: ZoneBuff = {
        region: { kind: effect.pattern, anchor: sq },
        effect: effect.buff,
        side,
        expiresOnTurn: state.turn + effect.durationTurns,
        sourceLabel: effect.sourceLabel,
      };
      // Only one zone-buff per anchor square — placing on the same square
      // overwrites the existing buff (mirrors sanctuary/wall stacking).
      return {
        state: {
          ...state,
          zoneBuffs: [
            ...(state.zoneBuffs ?? []).filter(
              (b) => !(b.region.kind === effect.pattern && anchorOf(b) === sq),
            ),
            buff,
          ],
        },
        sideEffects: [],
      };
    }

    // ---- Movement / board side-effects -------------------------------------
    case "swap-own-pieces":
    case "swap-rooted-with-own":
    case "swap-with-enemy":
    case "swap-enemy-pieces": {
      if (target.kind !== "two-squares") return { state, sideEffects: [] };
      return {
        state,
        sideEffects: [{ kind: "swap-pieces", a: target.first, b: target.second }],
      };
    }
    case "summon-piece": {
      const sq = squareTarget(target);
      return {
        state,
        sideEffects: [{ kind: "place-piece", square: sq, pieceType: effect.pieceType }],
      };
    }
    case "summon-adjacent": {
      // Fork: target is { kind: "two-squares", first: source, second: spawn }.
      // The source piece's type is read live for `copy-of-source` (Fork+).
      if (target.kind !== "two-squares") return { state, sideEffects: [] };
      let pieceType: PieceType;
      if (effect.pieceType === "copy-of-source") {
        const source = ctx.pieceAt(target.first);
        // King is excluded so Fork+ cannot summon a second king.
        if (!source || source.side !== "player" || source.type === "king") {
          return { state, sideEffects: [] };
        }
        pieceType = source.type;
      } else {
        pieceType = effect.pieceType;
      }
      return {
        state,
        sideEffects: [{ kind: "place-piece", square: target.second, pieceType }],
      };
    }
    case "sacrifice-piece": {
      const sq = squareTarget(target);
      let next = drawCards(state, effect.drawCount, rng);
      next = { ...next, energy: clampEnergy(next.energy + effect.energyGain) };
      return {
        state: next,
        sideEffects: [{ kind: "remove-piece", square: sq }],
      };
    }
    case "sacrifice-blast-action": {
      // Buffer Overflow: destroy the targeted own piece, then grant each
      // friendly piece in the blast pattern N Overclock-style free actions.
      const sq = squareTarget(target);
      const files = ctx.boardFiles ?? 8;
      const ranks = ctx.boardRanks ?? 8;
      const friendlySquares = friendlySquaresInBlast(sq, effect.pattern, files, ranks, ctx, sq);
      // Lightning's `remaining: actions + 1` matches Overclock's encoding:
      // one of the actions is consumed by the chess-move-flip itself, so
      // `actions: 1` requires `remaining: 2`.
      const expires = state.turn + 1;
      let nextLightnings: LightningStatus[] = state.lightnings.slice();
      for (const fsq of friendlySquares) {
        nextLightnings = nextLightnings.filter((l) => l.square !== fsq);
        nextLightnings.push({
          square: fsq,
          side,
          expiresOnTurn: expires,
          remaining: effect.actions + 1,
        });
      }
      return {
        state: { ...state, lightnings: nextLightnings },
        sideEffects: [{ kind: "remove-piece", square: sq }],
      };
    }
    case "mutex-lock": {
      const sq = squareTarget(target);
      const lock: MutexLockStatus = {
        anchor: sq,
        side,
        remainingTurns: effect.durationTurns,
      };
      return {
        state: {
          ...state,
          mutexLocks: [...(state.mutexLocks ?? []).filter((l) => l.anchor !== sq), lock],
        },
        sideEffects: [],
      };
    }
    case "garbage-collect": {
      // The actual sweep happens against the engine in sideEffects.ts because
      // recursive destruction needs to recompute attacks against an updated
      // board, which the pure resolver cannot do. We just emit the side
      // effect.
      return {
        state,
        sideEffects: [{ kind: "garbage-collect", recursive: effect.recursive }],
      };
    }
    case "marionette": {
      if (target.kind !== "two-squares") return { state, sideEffects: [] };
      return {
        state,
        sideEffects: [{ kind: "foreign-move", from: target.first, to: target.second }],
      };
    }
    case "destroy-piece": {
      const sq = squareTarget(target);
      return { state, sideEffects: [{ kind: "remove-piece", square: sq }] };
    }
    case "capture-random-own-minor": {
      // Bit Rot (Boss C). Pick a random own minor piece (knight or bishop).
      // The actual board removal is wired up by Match.tsx via the
      // `remove-piece` side effect — playCard is pure and only sees the
      // BoardContext, so we delegate the random choice through a side effect
      // that Match resolves with full board access.
      return { state, sideEffects: [{ kind: "remove-random-own-minor" }] };
    }
    case "undo-last-enemy-move": {
      // Rollback. The actual unwind happens against the engine in
      // sideEffects.ts — playCard is pure and can't peek at the engine's
      // history, so we just emit the side effect.
      return { state, sideEffects: [{ kind: "undo-last-enemy-move" }] };
    }

    // ---- Misc state flags --------------------------------------------------
    case "next-move-constraint": {
      // Currently the only constraint is `must-not-check`; the chess-move
      // path (Match.tsx) reads this flag and filters legal moves.
      return {
        state: { ...state, mustNotCheckNextMove: true },
        sideEffects: [],
      };
    }
    case "pending-energy-loss-on-no-capture": {
      // Memory Leak (Boss B). If no capture happens before the next turn starts,
      // -1 energy at start-of-turn. The amount is folded into the flag's
      // single-turn lifetime; multiple Memory Leak plays in one turn are no-ops
      // beyond the first since the flag is binary. Acceptable: Boss B's
      // schedule (every 4 turns) prevents stacking in practice.
      return {
        state: {
          ...state,
          pendingEnergyLossOnNoCapture: Math.max(
            state.pendingEnergyLossOnNoCapture ?? 0,
            effect.amount,
          ),
        },
        sideEffects: [],
      };
    }
    case "forbid-zero-cost-this-turn": {
      return { state: { ...state, noZeroCostCardsThisTurn: true }, sideEffects: [] };
    }
    case "boss-extra-move": {
      const current = state.bossExtraMoves ?? 0;
      return {
        state: { ...state, bossExtraMoves: current + effect.count },
        sideEffects: [],
      };
    }
    case "play-power": {
      // Append the power to the match-scoped active list. Card itself goes to
      // the consumed pile via the `consume: true` flag on the JSON definition,
      // handled by playCard's disposal step.
      return {
        state: {
          ...state,
          activePowers: [...(state.activePowers ?? []), { ...effect.effect } as PowerEffect],
        },
        sideEffects: [],
      };
    }

    // ---- New cards (batch 2) -----------------------------------------------

    case "sudo-piece": {
      const sq = squareTarget(target);
      return {
        state: { ...state, sudoSquare: sq },
        sideEffects: [],
      };
    }
    case "hot-swap": {
      const sq = squareTarget(target);
      return {
        state: {
          ...state,
          pendingHotSwap: {
            canCapture: effect.canCapture ?? false,
            excludeSquare: sq,
          },
        },
        sideEffects: [],
      };
    }
    case "downgrade-piece": {
      const sq = squareTarget(target);
      const expires = state.turn + effect.durationTurns;
      const status: PieceStatus = { square: sq, side: opposite(side), expiresOnTurn: expires };
      return {
        state: {
          ...state,
          downgrades: [...(state.downgrades ?? []).filter((d) => d.square !== sq), status],
        },
        sideEffects: [],
      };
    }
    case "convert-piece": {
      const sq = squareTarget(target);
      return {
        state,
        sideEffects: [{ kind: "convert-piece", square: sq }],
      };
    }
    case "transform-piece-up": {
      const sq = squareTarget(target);
      const piece = ctx.pieceAt(sq);
      if (!piece || piece.side !== "player") return { state, sideEffects: [] };
      switch (piece.type) {
        case "pawn":
          return {
            state,
            sideEffects: [
              { kind: "transform-choice-prompt", square: sq, options: ["knight", "bishop"] },
            ],
          };
        case "knight":
        case "bishop":
          return {
            state,
            sideEffects: [{ kind: "transform-piece", square: sq, newType: "rook" }],
          };
        case "rook":
          return {
            state,
            sideEffects: [{ kind: "transform-piece", square: sq, newType: "queen" }],
          };
        default:
          return { state, sideEffects: [] };
      }
    }
    case "sacrifice-detonate": {
      const sq = squareTarget(target);
      const files = ctx.boardFiles ?? 8;
      const ranks = ctx.boardRanks ?? 8;
      const sideEffects: CardSideEffect[] = [{ kind: "remove-piece", square: sq }];
      // Destroy adjacent enemy non-King pieces
      for (const adjSq of kingAdjacentSquares(sq, { files, ranks })) {
        const p = ctx.pieceAt(adjSq);
        if (p && p.side === "opponent" && p.type !== "king") {
          sideEffects.push({ kind: "remove-piece", square: adjSq });
        }
      }
      let next = state;
      if (effect.drawCount && effect.drawCount > 0) {
        next = drawCards(next, effect.drawCount, rng);
      }
      return { state: next, sideEffects };
    }
    case "gain-energy-per-capture": {
      const captures = state.playerCaptureCount ?? 0;
      return {
        state: { ...state, energy: clampEnergy(state.energy + captures) },
        sideEffects: [],
      };
    }
    case "place-backdoor": {
      const sq = squareTarget(target);
      const marker: BackdoorMarker = { square: sq, side };
      return {
        state: {
          ...state,
          backdoors: [...(state.backdoors ?? []), marker],
        },
        sideEffects: [],
      };
    }
    case "teleport-piece": {
      if (target.kind !== "two-squares") return { state, sideEffects: [] };
      // SSH Tunnel relocates the player's own piece. Use a dedicated
      // move-piece side effect so the piece is not recorded as destroyed and
      // its statuses (Shield/Haste/Empower/...) travel with it.
      return {
        state,
        sideEffects: [{ kind: "move-piece", from: target.first, to: target.second }],
      };
    }
    case "insert-probe": {
      return {
        state: {
          ...state,
          probeExpiresOnTurn: Math.max(
            state.probeExpiresOnTurn ?? 0,
            state.turn + effect.durationTurns,
          ),
        },
        sideEffects: [],
      };
    }
    case "resurrect-piece": {
      if (target.kind !== "two-squares") return { state, sideEffects: [] };
      const all = state.capturedPieces ?? [];
      const captured = all.filter((p) => p.side === "player");
      // `chosenCapturedIndex` is an index into the player-filtered list (the UI
      // shows player-side captures only). Map it back to a position in the
      // unfiltered array so the right entry is removed even when non-player
      // entries are interleaved (CH-004).
      const idx = state.chosenCapturedIndex ?? captured.length - 1;
      if (idx < 0 || idx >= captured.length) return { state, sideEffects: [] };
      const entry = captured[idx];
      let seenPlayer = -1;
      const removeAt = all.findIndex((p) => {
        if (p.side === "player") seenPlayer += 1;
        return p.side === "player" && seenPlayer === idx;
      });
      return {
        state: {
          ...state,
          capturedPieces: all.filter((_, i) => i !== removeAt),
          chosenCapturedIndex: undefined,
        },
        sideEffects: [{ kind: "place-piece", square: target.second, pieceType: entry.type }],
      };
    }

    case "compound": {
      let next = state;
      const sideEffects: CardSideEffect[] = [];
      for (const child of effect.effects) {
        const r = applyEffect(child, next, target, ctx, rng, source, playingIndex, side);
        next = r.state;
        sideEffects.push(...r.sideEffects);
      }
      return { state: next, sideEffects };
    }
  }
}

// ---- Internal helpers -------------------------------------------------------

type StatusKey = "freezes" | "roots" | "disarms" | "compels" | "shields" | "hastes";

function addStatus(
  state: MatchCardState,
  key: StatusKey,
  square: AlgebraicSquare,
  expiresOnTurn: number,
  side: "player" | "opponent",
): MatchCardState {
  const status: PieceStatus = { square, side, expiresOnTurn };
  return {
    ...state,
    [key]: [...state[key].filter((s) => s.square !== square), status],
  };
}

function squareTarget(t: PlayTarget): AlgebraicSquare {
  if (t.kind === "square") return t.square;
  if (t.kind === "two-squares") return t.first;
  throw new Error(`expected square target, got ${t.kind}`);
}

/**
 * Collect player-controlled squares inside the blast pattern centered on
 * `center`, on a `files`×`ranks` board. The center itself is excluded — the
 * sacrificed piece doesn't propagate the free action to itself. `excludeSq`
 * filters out an additional square (the sacrificed-piece square, in case the
 * player has a friendly piece on it via some future stacking).
 */
function friendlySquaresInBlast(
  center: AlgebraicSquare,
  pattern: "king-step" | "king-step-and-knight",
  files: number,
  ranks: number,
  ctx: BoardContext,
  excludeSq: AlgebraicSquare,
): AlgebraicSquare[] {
  const cf = fileOf(center);
  const cr = rankNumberOf(center);
  const knightSteps: ReadonlyArray<readonly [number, number]> = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  const offsets = pattern === "king-step" ? KING_OFFSETS : [...KING_OFFSETS, ...knightSteps];
  const out: AlgebraicSquare[] = [];
  for (const [df, dr] of offsets) {
    const f = cf + df;
    const r = cr + dr;
    if (f < 0 || f >= files) continue;
    if (r < 1 || r > ranks) continue;
    const sq = FILES[f] + String(r);
    if (sq === excludeSq) continue;
    const piece = ctx.pieceAt(sq);
    if (!piece || piece.side !== "player") continue;
    out.push(sq);
  }
  return out;
}

function anchorOf(buff: ZoneBuff): AlgebraicSquare | null {
  if (buff.region.kind === "rank" || buff.region.kind === "center") return null;
  return buff.region.anchor;
}

/**
 * Returns a fresh `Card` value with the same definition. Cards are stored as
 * structurally-equal records, but we shallow-clone so any future per-instance
 * fields (e.g., upgrade markers) don't bleed across copies.
 */
export function cloneCardDef(card: Card): Card {
  return { ...card, target: { ...card.target }, effect: cloneEffect(card.effect) };
}

function cloneEffect(effect: CardEffect): CardEffect {
  if (effect.kind === "compound") {
    return { kind: "compound", effects: effect.effects.map(cloneEffect) };
  }
  return { ...effect };
}
