// Tests for the run-history recording/derivation helpers (CH-020). These are
// pure summarizers + formatters over the RunHistoryEvent stream.

import { describe, expect, it } from "vitest";

import { getCardById } from "../../game/cards/library";
import type { Artifact, BoosterPack, ShopOffer } from "../../game/types";

import {
  artifactIds,
  deckIds,
  describeRunEvent,
  serializeRunHistory,
  summarizeOffer,
  summarizePack,
  type RunHistoryEvent,
  type SerializedRunHistory,
} from "./runHistory";

const ARTIFACT: Artifact = {
  id: "bug-bounty",
  name: "Bug Bounty",
  rarity: "common",
  description: "",
  effect: { kind: "energy-on-capture", amount: 1 },
} as unknown as Artifact;

const PACK: BoosterPack = {
  id: "starter-pack",
  contents: [getCardById("firewall"), getCardById("stack-trace")],
} as unknown as BoosterPack;

describe("runHistory — derivation helpers", () => {
  it("deckIds and artifactIds project to id arrays", () => {
    expect(deckIds([getCardById("firewall"), getCardById("stack-trace")])).toEqual([
      "firewall",
      "stack-trace",
    ]);
    expect(artifactIds([ARTIFACT])).toEqual(["bug-bounty"]);
  });

  it("summarizePack flattens a pack to id + content ids", () => {
    expect(summarizePack(PACK)).toEqual({
      packId: "starter-pack",
      contentIds: ["firewall", "stack-trace"],
    });
  });

  it("summarizeOffer flattens each offer kind", () => {
    const cardOffer = {
      kind: "card",
      card: getCardById("firewall"),
      price: 50,
      sold: false,
    } as unknown as ShopOffer;
    expect(summarizeOffer(cardOffer)).toEqual({
      kind: "card",
      cardId: "firewall",
      price: 50,
      sold: false,
    });

    const boosterOffer = {
      kind: "booster",
      pack: PACK,
      price: 75,
      sold: true,
    } as unknown as ShopOffer;
    expect(summarizeOffer(boosterOffer)).toEqual({
      kind: "booster",
      packId: "starter-pack",
      contentIds: ["firewall", "stack-trace"],
      price: 75,
      sold: true,
    });

    const artifactOffer = {
      kind: "artifact",
      artifact: ARTIFACT,
      price: 120,
      sold: false,
    } as unknown as ShopOffer;
    expect(summarizeOffer(artifactOffer)).toEqual({
      kind: "artifact",
      artifactId: "bug-bounty",
      price: 120,
      sold: false,
    });
  });
});

describe("runHistory — serialization", () => {
  it("serializeRunHistory produces a versioned, parseable payload", () => {
    const events: RunHistoryEvent[] = [
      {
        kind: "run-start",
        mode: "royal",
        rngSeed: 42,
        startingDeckIds: ["firewall"],
        startingArtifactIds: [],
      },
    ];
    const json = serializeRunHistory(events);
    const parsed = JSON.parse(json) as SerializedRunHistory;
    expect(parsed.version).toBe(1);
    expect(typeof parsed.exportedAt).toBe("string");
    expect(parsed.events).toEqual(events);
  });
});

describe("runHistory — describeRunEvent", () => {
  const cases: Array<{ ev: RunHistoryEvent; match: RegExp }> = [
    {
      ev: {
        kind: "run-start",
        mode: "royal",
        rngSeed: 7,
        startingDeckIds: ["firewall", "stack-trace"],
        startingArtifactIds: [],
      },
      match: /Run start \(royal, seed 7, deck 2\)/,
    },
    {
      ev: {
        kind: "match-start",
        matchNumber: 1,
        act: 1,
        matchInAct: 1,
        size: { files: 8, ranks: 8 },
        deckIds: ["firewall"],
        artifactIds: [],
        bossId: null,
        goldAtStart: 30,
      },
      match: /Match 1 start \(act 1 #1, 8×8, deck 1, gold 30\)/,
    },
    {
      ev: {
        kind: "match-end",
        matchNumber: 3,
        won: true,
        outcome: { kind: "checkmate", winner: "player" },
        turnsPlayed: 17,
      },
      match: /Match 3 end — won \(checkmate, 17 turns\)/,
    },
    {
      ev: { kind: "match-win-confirmed", matchNumber: 3 },
      match: /Match 3 win confirmed/,
    },
    {
      ev: {
        kind: "boss-pick",
        matchNumber: 3,
        option: { kind: "energy-per-turn-bonus", amount: 1 },
      },
      match: /Boss pick — \+1 energy \/ turn/,
    },
    {
      ev: {
        kind: "shop-enter",
        matchNumber: 1,
        gold: 40,
        offers: [],
        rerollCost: 5,
        removalCost: 20,
        smithCost: 30,
      },
      match: /Shop entered \(gold 40, 0 offers/,
    },
    {
      ev: {
        kind: "shop-buy-card",
        matchNumber: 1,
        offerIndex: 0,
        cardId: "firewall",
        pricePaid: 25,
        goldAfter: 15,
      },
      match: /Shop bought card firewall for 25g \(gold 15\)/,
    },
    {
      ev: { kind: "shop-leave", matchNumber: 1, interest: 4, goldAfter: 44 },
      match: /Shop left \(\+4 interest, gold 44\)/,
    },
    {
      ev: {
        kind: "match-event",
        matchNumber: 2,
        event: {
          kind: "move",
          turn: 5,
          by: "player",
          san: "Nf3",
          from: "g1",
          to: "f3",
          isCapture: false,
        },
      } as RunHistoryEvent,
      match: /M2 · T5 you Nf3 \(g1→f3\)/,
    },
  ];

  for (const { ev, match } of cases) {
    it(`describes ${ev.kind}`, () => {
      expect(describeRunEvent(ev)).toMatch(match);
    });
  }
});
