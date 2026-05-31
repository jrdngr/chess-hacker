// Run history — a chronological, JSON-serializable log of every event that
// happens across an entire run. Powers the "Log" modal in the run banner and
// its export button so a player (or a debugging session) can paste the log
// into a bug report and reproduce the run.
//
// Run-level events cover the run-shell transitions (run-start with seed,
// match-start, match-end, shop transactions, reward picks, boss preview).
// Match-level events (chess moves, card plays, turn rollovers) are forwarded
// from the active <Match> via its `onAppendHistory` callback and stored as
// `match-event` entries so the full log lives in a single stream.

import type { HistoryEvent } from "../Match/history";
import type {
  Artifact,
  BoardSize,
  BoosterPack,
  BossPickOption,
  Card,
  CardId,
  RunMatchOutcome,
  RunMode,
  ShopOffer,
} from "../../game/types";

export type RunHistoryEvent =
  | {
      kind: "run-start";
      mode: RunMode;
      rngSeed: number;
      startingDeckIds: CardId[];
      startingArtifactIds: string[];
    }
  | {
      kind: "match-start";
      matchNumber: number;
      act: 1 | 2 | 3;
      matchInAct: 1 | 2 | 3;
      fen?: string;
      size: BoardSize;
      deckIds: CardId[];
      artifactIds: string[];
      bossId: string | null;
      goldAtStart: number;
    }
  | {
      kind: "match-event";
      matchNumber: number;
      event: HistoryEvent;
    }
  | {
      kind: "match-end";
      matchNumber: number;
      won: boolean;
      outcome: RunMatchOutcome["outcome"];
      turnsPlayed: number;
    }
  | {
      kind: "match-win-confirmed";
      matchNumber: number;
    }
  | {
      kind: "revert-match-end";
      matchNumber: number;
    }
  | {
      kind: "boss-pick";
      matchNumber: number;
      option: BossPickOption;
    }
  | {
      kind: "boss-delete-card";
      matchNumber: number;
      deckIndex: number;
      cardId: CardId;
      chargesRemaining: number;
    }
  | {
      kind: "boss-artifact-pick";
      matchNumber: number;
      artifactId: string;
    }
  | {
      kind: "boss-artifact-skip";
      matchNumber: number;
      skipGold: number;
    }
  | {
      kind: "shop-enter";
      matchNumber: number;
      gold: number;
      offers: SerializableShopOffer[];
      rerollCost: number;
      removalCost: number;
      smithCost: number;
    }
  | {
      kind: "shop-buy-card";
      matchNumber: number;
      offerIndex: number;
      cardId: CardId;
      pricePaid: number;
      goldAfter: number;
    }
  | {
      kind: "shop-open-pack";
      matchNumber: number;
      offerIndex: number;
      packId: string;
      contentIds: CardId[];
      pricePaid: number;
      goldAfter: number;
    }
  | {
      kind: "shop-pick-pack-card";
      matchNumber: number;
      cardId: CardId;
    }
  | {
      kind: "shop-buy-artifact";
      matchNumber: number;
      offerIndex: number;
      artifactId: string;
      pricePaid: number;
      goldAfter: number;
    }
  | {
      kind: "shop-reroll";
      matchNumber: number;
      cost: number;
      goldAfter: number;
      offers: SerializableShopOffer[];
    }
  | {
      kind: "shop-remove-card";
      matchNumber: number;
      deckIndex: number;
      cardId: CardId;
      pricePaid: number;
      goldAfter: number;
    }
  | {
      kind: "shop-smith-card";
      matchNumber: number;
      deckIndex: number;
      fromCardId: CardId;
      toCardId: CardId;
      pricePaid: number;
      goldAfter: number;
    }
  | {
      kind: "shop-leave";
      matchNumber: number;
      interest: number;
      goldAfter: number;
    };

/**
 * A flattened, JSON-friendly view of a `ShopOffer`. We strip non-serializable
 * derived data and keep just the ids + price + sold flag — enough to know
 * which offers a player saw on a given shop visit.
 */
export type SerializableShopOffer =
  | { kind: "card"; cardId: CardId; price: number; sold: boolean }
  | { kind: "booster"; packId: string; contentIds: CardId[]; price: number; sold: boolean }
  | { kind: "artifact"; artifactId: string; price: number; sold: boolean };

export function summarizeOffer(offer: ShopOffer): SerializableShopOffer {
  if (offer.kind === "card") {
    return { kind: "card", cardId: offer.card.id, price: offer.price, sold: offer.sold === true };
  }
  if (offer.kind === "booster") {
    return {
      kind: "booster",
      packId: offer.pack.id,
      contentIds: offer.pack.contents.map((c) => c.id),
      price: offer.price,
      sold: offer.sold === true,
    };
  }
  return {
    kind: "artifact",
    artifactId: offer.artifact.id,
    price: offer.price,
    sold: offer.sold === true,
  };
}

export function summarizePack(pack: BoosterPack): { packId: string; contentIds: CardId[] } {
  return { packId: pack.id, contentIds: pack.contents.map((c) => c.id) };
}

export function deckIds(deck: ReadonlyArray<Card>): CardId[] {
  return deck.map((c) => c.id);
}

export function artifactIds(artifacts: ReadonlyArray<Artifact>): string[] {
  return artifacts.map((a) => a.id);
}

export type SerializedRunHistory = {
  version: 1;
  exportedAt: string;
  events: RunHistoryEvent[];
};

export function serializeRunHistory(events: ReadonlyArray<RunHistoryEvent>): string {
  const payload: SerializedRunHistory = {
    version: 1,
    exportedAt: new Date().toISOString(),
    events: events.slice(),
  };
  return JSON.stringify(payload, null, 2);
}

export function describeRunEvent(ev: RunHistoryEvent): string {
  switch (ev.kind) {
    case "run-start":
      return `Run start (${ev.mode}, seed ${ev.rngSeed}, deck ${ev.startingDeckIds.length})`;
    case "match-start": {
      const boss = ev.bossId ? ` · boss ${ev.bossId}` : "";
      return `Match ${ev.matchNumber} start (act ${ev.act} #${ev.matchInAct}, ${ev.size.files}×${ev.size.ranks}, deck ${ev.deckIds.length}, gold ${ev.goldAtStart})${boss}`;
    }
    case "match-event":
      return `M${ev.matchNumber} · ${describeMatchEvent(ev.event)}`;
    case "match-end":
      return `Match ${ev.matchNumber} end — ${ev.won ? "won" : "lost"} (${ev.outcome.kind}, ${ev.turnsPlayed} turns)`;
    case "match-win-confirmed":
      return `Match ${ev.matchNumber} win confirmed (Continue)`;
    case "revert-match-end":
      return `Match ${ev.matchNumber} end reverted via dev panel undo`;
    case "boss-pick":
      return `Boss pick — ${describeBossOption(ev.option)}`;
    case "boss-delete-card":
      return `Boss delete card #${ev.deckIndex} (${ev.cardId}); ${ev.chargesRemaining} charge(s) left`;
    case "boss-artifact-pick":
      return `Boss artifact picked: ${ev.artifactId}`;
    case "boss-artifact-skip":
      return `Boss artifact skipped (+${ev.skipGold} gold)`;
    case "shop-enter":
      return `Shop entered (gold ${ev.gold}, ${ev.offers.length} offers, reroll ${ev.rerollCost}g, removal ${ev.removalCost}g, smith ${ev.smithCost}g)`;
    case "shop-buy-card":
      return `Shop bought card ${ev.cardId} for ${ev.pricePaid}g (gold ${ev.goldAfter})`;
    case "shop-open-pack":
      return `Shop opened pack ${ev.packId} for ${ev.pricePaid}g (contents: ${ev.contentIds.join(", ")})`;
    case "shop-pick-pack-card":
      return `Shop pack pick: ${ev.cardId}`;
    case "shop-buy-artifact":
      return `Shop bought artifact ${ev.artifactId} for ${ev.pricePaid}g (gold ${ev.goldAfter})`;
    case "shop-reroll":
      return `Shop reroll for ${ev.cost}g (gold ${ev.goldAfter})`;
    case "shop-remove-card":
      return `Shop removed card #${ev.deckIndex} (${ev.cardId}) for ${ev.pricePaid}g (gold ${ev.goldAfter})`;
    case "shop-smith-card":
      return `Shop upgraded card #${ev.deckIndex} (${ev.fromCardId} → ${ev.toCardId}) for ${ev.pricePaid}g (gold ${ev.goldAfter})`;
    case "shop-leave":
      return `Shop left (+${ev.interest} interest, gold ${ev.goldAfter})`;
  }
}

function describeBossOption(opt: BossPickOption): string {
  switch (opt.kind) {
    case "energy-per-turn-bonus":
      return `+${opt.amount} energy / turn`;
    case "draw-per-turn-bonus":
      return `+${opt.amount} draw / turn`;
    case "delete-cards":
      return `delete ${opt.count} cards`;
  }
}

/**
 * Plain-English one-liner for a per-match event. Mirrors the formatter in
 * `Match/history.ts` (which is private to the match modal); keeping a copy
 * here avoids a cross-module dep just for prefix purposes.
 */
function describeMatchEvent(ev: HistoryEvent): string {
  switch (ev.kind) {
    case "match-start":
      return `match-start (${ev.size.files}×${ev.size.ranks}, ${ev.mode})`;
    case "turn-start": {
      const who = ev.side === "player" ? "your" : "opponent's";
      return `turn ${ev.turn} ${who} start — energy ${ev.energy}, hand ${ev.handIds.length}`;
    }
    case "card-played": {
      const t = ev.target;
      let where = "";
      if (t.kind === "square") where = ` on ${t.square}`;
      else if (t.kind === "two-squares") where = ` on ${t.first} → ${t.second}`;
      return `T${ev.turn} played ${ev.cardName}${where} (cost ${ev.cost}, energy ${ev.energyAfter})`;
    }
    case "move": {
      const who = ev.by === "player" ? "you" : "opp";
      const cap = ev.isCapture
        ? ` x ${ev.capturedSide === "player" ? "your" : "their"} ${ev.capturedType ?? "piece"}`
        : "";
      return `T${ev.turn} ${who} ${ev.san} (${ev.from}→${ev.to})${cap}`;
    }
    case "editor-edit":
      if (ev.action === "erase") return `T${ev.turn} editor erase ${ev.square}`;
      return `T${ev.turn} editor place ${ev.side ?? ""} ${ev.pieceType ?? ""} on ${ev.square}`;
    case "energy-bump":
      return `T${ev.turn} energy ${ev.delta >= 0 ? "+" : ""}${ev.delta} (${ev.energyAfter})`;
    case "scry-reorder":
      return `T${ev.turn} scry reorder (${ev.newTopIds.length})`;
  }
}
