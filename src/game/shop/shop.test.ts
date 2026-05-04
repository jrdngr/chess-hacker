import { describe, expect, it } from "vitest";

import {
  addPickedPackCard,
  applyInterest,
  buyArtifactOffer,
  buyCardOffer,
  generateShop,
  interestFor,
  openBoosterOffer,
  removalCostFor,
  removeCard,
  rerollCostFor,
  rerollShop,
  REROLL_COST_BASE,
  REROLL_COST_STEP,
  REMOVAL_COST_BASE,
  REMOVAL_COST_STEP,
  SHOP_ARTIFACTS,
  SHOP_CARDS,
  SHOP_PACKS,
} from "./shop";
import { allArtifacts, getArtifactById } from "../artifacts/library";
import { ARTIFACT_SLOT_CAP } from "../types";
import { createRun } from "../progression/run";
import { FROSTBITE } from "../cards/library";

describe("pricing helpers", () => {
  it("rerollCostFor scales linearly per shop visit", () => {
    expect(rerollCostFor(0)).toBe(REROLL_COST_BASE);
    expect(rerollCostFor(1)).toBe(REROLL_COST_BASE + REROLL_COST_STEP);
    expect(rerollCostFor(3)).toBe(REROLL_COST_BASE + REROLL_COST_STEP * 3);
  });

  it("removalCostFor scales linearly per use", () => {
    expect(removalCostFor(0)).toBe(REMOVAL_COST_BASE);
    expect(removalCostFor(2)).toBe(REMOVAL_COST_BASE + REMOVAL_COST_STEP * 2);
  });
});

describe("interest", () => {
  it("+1 per 5 saved gold, capped at +5", () => {
    expect(interestFor(0)).toBe(0);
    expect(interestFor(4)).toBe(0);
    expect(interestFor(5)).toBe(1);
    expect(interestFor(9)).toBe(1);
    expect(interestFor(25)).toBe(5);
    expect(interestFor(50)).toBe(5); // capped
  });

  it("applyInterest pays out and includes the new gold in the returned state", () => {
    const run = { ...createRun({ mode: "royal", rngSeed: 1 }), gold: 25 };
    const { state, interest } = applyInterest(run);
    expect(interest).toBe(5);
    expect(state.gold).toBe(30);
  });
});

describe("generateShop", () => {
  it("produces SHOP_CARDS card offers + SHOP_PACKS pack offers + SHOP_ARTIFACTS artifact offers", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    const { shop } = generateShop(run);
    const cards = shop.offers.filter((o) => o.kind === "card");
    const packs = shop.offers.filter((o) => o.kind === "booster");
    const artifacts = shop.offers.filter((o) => o.kind === "artifact");
    expect(cards.length).toBe(SHOP_CARDS);
    expect(packs.length).toBe(SHOP_PACKS);
    expect(artifacts.length).toBe(SHOP_ARTIFACTS);
  });

  it("never offers artifacts the player already owns", () => {
    const owned = getArtifactById("stone-hourglass");
    const baseRun = createRun({ mode: "royal", rngSeed: 9 });
    const run = { ...baseRun, artifacts: [owned] };
    for (let seed = 0; seed < 20; seed++) {
      const { shop } = generateShop({ ...run, rngSeed: seed });
      for (const offer of shop.offers) {
        if (offer.kind === "artifact") expect(offer.artifact.id).not.toBe(owned.id);
      }
    }
  });

  it("seeds the rerollCost / rerollsUsed at zero", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    const { shop } = generateShop(run);
    expect(shop.rerollsUsed).toBe(0);
    expect(shop.rerollCost).toBe(rerollCostFor(0));
  });

  it("removalCost reflects the run's removalsUsed", () => {
    const run = { ...createRun({ mode: "royal", rngSeed: 1 }), removalsUsed: 2 };
    const { shop } = generateShop(run);
    expect(shop.removalCost).toBe(removalCostFor(2));
  });
});

describe("buyCardOffer", () => {
  it("deducts gold and adds the card to the deck on success", () => {
    const baseRun = createRun({ mode: "royal", rngSeed: 1 });
    const run = { ...baseRun, gold: 100 };
    const gen = generateShop(run);
    const cardOffer = gen.shop.offers.find((o) => o.kind === "card")!;
    const cardOfferIndex = gen.shop.offers.indexOf(cardOffer);
    const result = buyCardOffer(gen.next, gen.shop, cardOfferIndex)!;
    expect(result.state.gold).toBe(100 - cardOffer.price);
    expect(result.state.deck.length).toBe(run.deck.length + 1);
    const updatedOffer = result.shop.offers[cardOfferIndex];
    expect(updatedOffer.kind === "card" && updatedOffer.sold).toBe(true);
  });

  it("returns null when the player can't afford the offer", () => {
    const run = { ...createRun({ mode: "royal", rngSeed: 1 }), gold: 0 };
    const gen = generateShop(run);
    const idx = gen.shop.offers.findIndex((o) => o.kind === "card");
    expect(buyCardOffer(gen.next, gen.shop, idx)).toBeNull();
  });

  it("rejects buying a sold offer", () => {
    const run = { ...createRun({ mode: "royal", rngSeed: 1 }), gold: 100 };
    const gen = generateShop(run);
    const idx = gen.shop.offers.findIndex((o) => o.kind === "card");
    const first = buyCardOffer(gen.next, gen.shop, idx)!;
    const second = buyCardOffer(first.state, first.shop, idx);
    expect(second).toBeNull();
  });
});

describe("rerollShop", () => {
  it("regenerates offers, charges gold, and bumps the next reroll cost", () => {
    const run = { ...createRun({ mode: "royal", rngSeed: 1 }), gold: 100 };
    const gen = generateShop(run);
    const before = gen.shop.offers.map((o) =>
      o.kind === "card" ? o.card.id : o.kind === "booster" ? o.pack.id : "",
    );
    const result = rerollShop(gen.next, gen.shop)!;
    expect(result.state.gold).toBe(100 - gen.shop.rerollCost);
    expect(result.shop.rerollsUsed).toBe(1);
    expect(result.shop.rerollCost).toBe(gen.shop.rerollCost + REROLL_COST_STEP);
    const after = result.shop.offers.map((o) =>
      o.kind === "card" ? o.card.id : o.kind === "booster" ? o.pack.id : "",
    );
    // Different RNG cursor → the offer set should differ for at least one slot.
    expect(after.join(",")).not.toEqual(before.join(","));
  });

  it("returns null when the player can't afford the reroll", () => {
    const run = { ...createRun({ mode: "royal", rngSeed: 1 }), gold: 0 };
    const gen = generateShop(run);
    expect(rerollShop(gen.next, gen.shop)).toBeNull();
  });
});

describe("removeCard", () => {
  it("removes the chosen deck card and bumps the run's removal counter", () => {
    const run = {
      ...createRun({ mode: "royal", rngSeed: 1 }),
      gold: 200,
    };
    const gen = generateShop(run);
    const startingDeckSize = gen.next.deck.length;
    const result = removeCard(gen.next, gen.shop, 0)!;
    expect(result.state.deck.length).toBe(startingDeckSize - 1);
    expect(result.state.removalsUsed).toBe(1);
    expect(result.state.gold).toBe(200 - gen.shop.removalCost);
    expect(result.shop.removalCost).toBe(removalCostFor(1));
  });

  it("returns null when out of gold or the deck index is invalid", () => {
    const run = { ...createRun({ mode: "royal", rngSeed: 1 }), gold: 0 };
    const gen = generateShop(run);
    expect(removeCard(gen.next, gen.shop, 0)).toBeNull();
    expect(removeCard({ ...gen.next, gold: 200 }, gen.shop, -1)).toBeNull();
    expect(removeCard({ ...gen.next, gold: 200 }, gen.shop, gen.next.deck.length + 5)).toBeNull();
  });
});

describe("buyArtifactOffer", () => {
  function shopWithArtifact(seed: number, gold: number) {
    const baseRun = createRun({ mode: "royal", rngSeed: seed });
    const run = { ...baseRun, gold };
    const gen = generateShop(run);
    const idx = gen.shop.offers.findIndex((o) => o.kind === "artifact");
    return { run: gen.next, shop: gen.shop, idx };
  }

  it("deducts gold, marks the offer sold, and adds the artifact to the run", () => {
    const { run, shop, idx } = shopWithArtifact(3, 100);
    const offer = shop.offers[idx];
    if (offer.kind !== "artifact") throw new Error("expected artifact offer");
    const result = buyArtifactOffer(run, shop, idx)!;
    expect(result.state.gold).toBe(100 - offer.price);
    expect(result.state.artifacts.map((a) => a.id)).toContain(offer.artifact.id);
    const updated = result.shop.offers[idx];
    expect(updated.kind === "artifact" && updated.sold).toBe(true);
  });

  it("returns null when the player can't afford the artifact", () => {
    const { run, shop, idx } = shopWithArtifact(1, 0);
    expect(buyArtifactOffer(run, shop, idx)).toBeNull();
  });

  it("returns null when the player is at the artifact slot cap", () => {
    const filler = allArtifacts().slice(0, ARTIFACT_SLOT_CAP);
    const baseRun = createRun({ mode: "royal", rngSeed: 5 });
    const run = { ...baseRun, gold: 1000, artifacts: filler };
    const gen = generateShop(run);
    const idx = gen.shop.offers.findIndex((o) => o.kind === "artifact");
    if (idx === -1) return; // pool may be exhausted by the owned set; skip
    expect(buyArtifactOffer(gen.next, gen.shop, idx)).toBeNull();
  });

  it("rejects buying a sold artifact offer", () => {
    const { run, shop, idx } = shopWithArtifact(2, 200);
    const first = buyArtifactOffer(run, shop, idx)!;
    const second = buyArtifactOffer(first.state, first.shop, idx);
    expect(second).toBeNull();
  });
});

describe("booster packs", () => {
  it("opening a pack charges gold and yields its contents", () => {
    const run = { ...createRun({ mode: "royal", rngSeed: 1 }), gold: 100 };
    const gen = generateShop(run);
    const idx = gen.shop.offers.findIndex((o) => o.kind === "booster");
    const offer = gen.shop.offers[idx];
    if (offer.kind !== "booster") throw new Error("expected booster offer");
    const result = openBoosterOffer(gen.next, gen.shop, idx)!;
    expect(result.state.gold).toBe(100 - offer.price);
    expect(result.pack.contents.length).toBeGreaterThan(0);
    const updated = result.shop.offers[idx];
    expect(updated.kind === "booster" && updated.sold).toBe(true);
  });

  it("addPickedPackCard appends the chosen card to the run deck", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    const next = addPickedPackCard(run, FROSTBITE);
    expect(next.deck.length).toBe(run.deck.length + 1);
    expect(next.deck[next.deck.length - 1].id).toBe(FROSTBITE.id);
  });
});
