import { describe, expect, it } from "vitest";

import {
  applyMatchOutcome,
  consumeRng,
  createRun,
  enterShop,
  generateDraftOffer,
  leaveShop,
  pickDraftCard,
  skipDraft,
  totalMatches,
  WIN_BONUS_NORMAL,
} from "./run";
import { FORESIGHT, FROSTBITE, RECONNAISSANCE } from "../cards/library";
import type { RunMatchOutcome } from "../types";

const MOCK_OUTCOME_WIN: RunMatchOutcome = {
  won: true,
  outcome: { kind: "checkmate", winner: "player" },
  turnsPlayed: 12,
};

const MOCK_OUTCOME_LOSS: RunMatchOutcome = {
  won: false,
  outcome: { kind: "checkmate", winner: "opponent" },
  turnsPlayed: 22,
};

describe("createRun", () => {
  it("starts a Royal mini-run on match 1, gold 0, default config", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    expect(run.mode).toBe("royal");
    expect(run.act).toBe(1);
    expect(run.matchInAct).toBe(1);
    expect(run.matchNumber).toBe(1);
    expect(run.gold).toBe(0);
    expect(run.phase).toBe("match");
    expect(run.deck.length).toBeGreaterThan(0);
    expect(totalMatches(run)).toBe(3);
  });

  it("uses a deterministic seed for reproducible drafts", () => {
    const a = createRun({ mode: "royal", rngSeed: 42 });
    const b = createRun({ mode: "royal", rngSeed: 42 });
    expect(generateDraftOffer(a).offer.cards.map((c) => c.id)).toEqual(
      generateDraftOffer(b).offer.cards.map((c) => c.id),
    );
  });
});

describe("applyMatchOutcome", () => {
  it("a win advances to reward and pays the normal win bonus", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    const next = applyMatchOutcome(run, MOCK_OUTCOME_WIN);
    expect(next.phase).toBe("reward");
    expect(next.gold).toBe(WIN_BONUS_NORMAL);
    expect(next.matchNumber).toBe(1); // doesn't advance until shop closes
  });

  it("a loss transitions to the lost phase and keeps gold intact", () => {
    const start = { ...createRun({ mode: "royal", rngSeed: 1 }), gold: 10 };
    const next = applyMatchOutcome(start, MOCK_OUTCOME_LOSS);
    expect(next.phase).toBe("lost");
    expect(next.gold).toBe(10);
  });
});

describe("draft", () => {
  it("draft offer returns DRAFT_CARD_COUNT cards by default", () => {
    const run = createRun({ mode: "royal", rngSeed: 7 });
    const { offer } = generateDraftOffer(run);
    expect(offer.cards.length).toBe(3);
    expect(offer.skipGold).toBeGreaterThan(0);
  });

  it("offer cards are distinct", () => {
    const run = createRun({ mode: "royal", rngSeed: 7 });
    const { offer } = generateDraftOffer(run);
    const ids = offer.cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never offers Soul or Shiv cards or curse cards", () => {
    // Sweep many seeds — none should ever surface the excluded ids.
    for (let seed = 1; seed < 50; seed++) {
      const run = createRun({ mode: "royal", rngSeed: seed });
      const { offer } = generateDraftOffer(run);
      for (const c of offer.cards) {
        expect(c.curse).toBeFalsy();
        expect(c.id.endsWith("-soul")).toBe(false);
        expect(c.id.startsWith("shiv-")).toBe(false);
      }
    }
  });

  it("picking a draft card adds it to the deck", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    const startingSize = run.deck.length;
    const next = pickDraftCard(run, FROSTBITE);
    expect(next.deck.length).toBe(startingSize + 1);
    expect(next.deck[next.deck.length - 1].id).toBe(FROSTBITE.id);
  });

  it("skipping a draft pays the offered skip gold", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    const next = skipDraft(run, 5);
    expect(next.gold).toBe(5);
    expect(next.deck.length).toBe(run.deck.length);
  });
});

describe("phase transitions: reward → shop → next match", () => {
  it("enterShop moves into the shop phase", () => {
    const run = applyMatchOutcome(createRun({ mode: "royal", rngSeed: 1 }), MOCK_OUTCOME_WIN);
    const next = enterShop(run);
    expect(next.phase).toBe("shop");
  });

  it("leaveShop advances the match number until totalMatches, then wins", () => {
    let run = createRun({ mode: "royal", rngSeed: 1 });

    // Matches 1 + 2: full reward → shop → next loop.
    for (let i = 0; i < 2; i++) {
      run = applyMatchOutcome(run, MOCK_OUTCOME_WIN);
      expect(run.phase).toBe("reward");
      run = enterShop(pickDraftCard(run, RECONNAISSANCE));
      expect(run.phase).toBe("shop");
      run = leaveShop(run);
    }

    // Match 3: enterShop short-circuits to "won" because there's no next match.
    run = applyMatchOutcome(run, MOCK_OUTCOME_WIN);
    expect(run.phase).toBe("reward");
    run = enterShop(pickDraftCard(run, RECONNAISSANCE));
    expect(run.phase).toBe("won");
    expect(run.matchNumber).toBe(3);
  });

  it("a loss anywhere ends the run", () => {
    let run = createRun({ mode: "royal", rngSeed: 1 });
    run = applyMatchOutcome(run, MOCK_OUTCOME_WIN);
    run = enterShop(pickDraftCard(run, FORESIGHT));
    run = leaveShop(run);
    expect(run.phase).toBe("match");
    expect(run.matchNumber).toBe(2);

    run = applyMatchOutcome(run, MOCK_OUTCOME_LOSS);
    expect(run.phase).toBe("lost");
  });
});

describe("consumeRng", () => {
  it("returns the same RNG sequence for the same cursor", () => {
    const run = createRun({ mode: "royal", rngSeed: 99 });
    const a = consumeRng(run);
    const b = consumeRng(run);
    expect(a.rng()).toEqual(b.rng());
    expect(a.next.rngCursor).toBe(b.next.rngCursor);
  });

  it("advances the cursor so consecutive draws differ", () => {
    const run = createRun({ mode: "royal", rngSeed: 99 });
    const first = consumeRng(run);
    const second = consumeRng(first.next);
    expect(first.next.rngCursor).toBe(1);
    expect(second.next.rngCursor).toBe(2);
    // Sequences should differ — extremely unlikely to coincide on first draw.
    expect(first.rng()).not.toEqual(second.rng());
  });
});
