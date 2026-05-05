import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Match } from "./Match";
import { StockfishEngine } from "../ai/stockfish";
import {
  BARRICADE,
  FORESIGHT,
  FROSTBITE,
  IRON_GUARD,
  RECONNAISSANCE,
  SPIKE_PIT,
} from "../game/cards/library";
import { ENERGY_MAX, makeRng } from "../game/cards/match";

function squareCell(aria: string): HTMLElement | undefined {
  return screen
    .getAllByRole("gridcell")
    .find((el) => (el.getAttribute("aria-label") ?? "").startsWith(aria));
}

/**
 * Simulate an HTML5 drag-and-drop sequence between two squares. We share a
 * single DataTransfer-like object across the events so handlers that read
 * setData/getData see consistent state.
 */
function dragSquare(from: HTMLElement, to: HTMLElement) {
  const data: Record<string, string> = {};
  const types: string[] = [];
  const dataTransfer = {
    effectAllowed: "all",
    dropEffect: "move",
    types,
    setData(format: string, value: string) {
      data[format] = value;
      if (!types.includes(format)) types.push(format);
    },
    getData(format: string) {
      return data[format] ?? "";
    },
    clearData() {
      for (const k of Object.keys(data)) delete data[k];
      types.length = 0;
    },
  } as unknown as DataTransfer;

  fireEvent.dragStart(from, { dataTransfer });
  fireEvent.dragOver(to, { dataTransfer });
  fireEvent.drop(to, { dataTransfer });
  fireEvent.dragEnd(from, { dataTransfer });
}

describe("Match (PvP same-screen)", () => {
  it("starts with white to move and renders 64 squares", () => {
    render(<Match initialMode="local-pvp" />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(64);
    expect(screen.getByText(/^white/i)).toBeInTheDocument();
  });

  it("clicking a player pawn highlights legal targets, then a target click moves it", async () => {
    const user = userEvent.setup();
    render(<Match initialMode="local-pvp" />);

    const e2 = squareCell("e2");
    expect(e2).toBeDefined();
    await user.click(e2!);

    // After selecting e2, e4 should be a labelled "move" target.
    const e4 = squareCell("e4");
    expect(e4?.getAttribute("aria-label")).toMatch(/move/);

    await user.click(e4!);

    // Side to move flipped to black.
    expect(screen.getByText(/^black/i)).toBeInTheDocument();

    // e4 now contains a player pawn (aria-label includes the piece description).
    const e4After = squareCell("e4");
    expect(e4After?.getAttribute("aria-label")).toBe("e4, player pawn");
  });

  it("ignores clicks on opponent pieces while it isn't their turn", async () => {
    const user = userEvent.setup();
    render(<Match initialMode="local-pvp" />);

    const e7 = squareCell("e7");
    await user.click(e7!);

    // No squares should be marked as targets since selection failed.
    const targetCells = screen
      .getAllByRole("gridcell")
      .filter((el) => /move|capture/.test(el.getAttribute("aria-label") ?? ""));
    expect(targetCells).toHaveLength(0);
  });

  it("castles kingside by clicking king then clicking g1 (two squares right)", async () => {
    const user = userEvent.setup();
    render(<Match initialMode="local-pvp" initialFen="r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" />);

    await user.click(squareCell("e1")!);
    // g1 should be highlighted as a legal target.
    expect(squareCell("g1")?.getAttribute("aria-label")).toMatch(/move/);

    await user.click(squareCell("g1")!);

    expect(squareCell("g1")?.getAttribute("aria-label")).toBe("g1, player king");
    expect(squareCell("f1")?.getAttribute("aria-label")).toBe("f1, player rook");
    expect(squareCell("e1")?.getAttribute("aria-label")).toBe("e1");
    expect(squareCell("h1")?.getAttribute("aria-label")).toBe("h1");
  });

  it("castles queenside by clicking king then clicking c1 (two squares left)", async () => {
    const user = userEvent.setup();
    render(<Match initialMode="local-pvp" initialFen="r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" />);

    await user.click(squareCell("e1")!);
    expect(squareCell("c1")?.getAttribute("aria-label")).toMatch(/move/);
    await user.click(squareCell("c1")!);

    expect(squareCell("c1")?.getAttribute("aria-label")).toBe("c1, player king");
    expect(squareCell("d1")?.getAttribute("aria-label")).toBe("d1, player rook");
    expect(squareCell("a1")?.getAttribute("aria-label")).toBe("a1");
  });

  it("castles kingside via drag: dragging the king two squares right (e1 -> g1)", () => {
    render(<Match initialMode="local-pvp" initialFen="r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" />);

    dragSquare(squareCell("e1")!, squareCell("g1")!);

    expect(squareCell("g1")?.getAttribute("aria-label")).toBe("g1, player king");
    expect(squareCell("f1")?.getAttribute("aria-label")).toBe("f1, player rook");
    expect(squareCell("e1")?.getAttribute("aria-label")).toBe("e1");
    expect(squareCell("h1")?.getAttribute("aria-label")).toBe("h1");
  });

  it("dragging the king onto the rook does NOT castle — drop is rejected, board unchanged", () => {
    render(<Match initialMode="local-pvp" initialFen="r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" />);

    dragSquare(squareCell("e1")!, squareCell("h1")!);

    expect(squareCell("e1")?.getAttribute("aria-label")).toBe("e1, player king");
    expect(squareCell("h1")?.getAttribute("aria-label")).toBe("h1, player rook");
  });

  it("clicking the king then clicking a friendly rook does NOT castle — it reselects the rook", async () => {
    const user = userEvent.setup();
    render(<Match initialMode="local-pvp" initialFen="r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" />);

    await user.click(squareCell("e1")!);
    await user.click(squareCell("h1")!);

    // King is still on e1; rook is still on h1.
    expect(squareCell("e1")?.getAttribute("aria-label")).toBe("e1, player king");
    expect(squareCell("h1")?.getAttribute("aria-label")).toMatch(/^h1, player rook/);

    // Rook is now selected: its legal moves are highlighted (h1 has friendly rook
    // moves along its rank and file).
    const rookTargets = screen
      .getAllByRole("gridcell")
      .filter((el) => /move|capture/.test(el.getAttribute("aria-label") ?? ""));
    expect(rookTargets.length).toBeGreaterThan(0);
    // None of the rook's legal moves should be e1 (the king is still there).
    expect(
      rookTargets.find((el) => (el.getAttribute("aria-label") ?? "").startsWith("e1")),
    ).toBeUndefined();
  });
});

/**
 * Build a stub StockfishEngine that resolves a scripted sequence of UCI
 * moves. Each call to getBestMove() returns the next move in the script.
 *
 * `searchMovesLog` is appended to with the searchMoves array passed on each
 * call, so tests can assert the AI was constrained to walled-legal moves.
 */
function makeFakeAi(moves: string[], searchMovesLog?: ReadonlyArray<string>[]): StockfishEngine {
  let idx = 0;
  const fake: Partial<StockfishEngine> = {
    ready: () => Promise.resolve(),
    setVariant: () => {},
    setPosition: () => {},
    getBestMove: (opts) => {
      if (searchMovesLog) searchMovesLog.push(opts.searchMoves ?? []);
      return Promise.resolve(moves[idx++] ?? "");
    },
    stop: () => {},
    destroy: () => {},
  };
  return fake as StockfishEngine;
}

describe("Match (vs AI)", () => {
  it("plays the AI's response immediately after the human moves", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi(["e7e5"]);
    render(<Match initialMode="vs-ai" createAi={() => ai} aiMinThinkMs={0} />);

    // Human plays e2 -> e4
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    // The AI auto-responds — moving a piece ends the player's turn.
    await waitFor(() => {
      const e5After = squareCell("e5");
      expect(e5After?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    });

    // Side to move is back to white.
    expect(screen.getByText(/^white/i)).toBeInTheDocument();
  });

  it("ignores clicks on AI pieces in vs-AI mode", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(<Match initialMode="vs-ai" createAi={() => ai} aiMinThinkMs={0} />);

    // Black pieces (controlled by AI) should not be selectable.
    await user.click(squareCell("e7")!);
    const targetCells = screen
      .getAllByRole("gridcell")
      .filter((el) => /move|capture/.test(el.getAttribute("aria-label") ?? ""));
    expect(targetCells).toHaveLength(0);
  });

  it("waits at least aiMinThinkMs before applying the AI's move", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi(["e7e5"]);
    render(<Match initialMode="vs-ai" createAi={() => ai} aiMinThinkMs={300} />);

    await user.click(squareCell("e2")!);
    const t0 = performance.now();
    await user.click(squareCell("e4")!);

    await waitFor(() => {
      expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    });
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(280); // small slack for timer jitter
  });

  it("difficulty selector lets the user pick a depth", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    const spy = vi.spyOn(ai, "getBestMove");
    render(<Match initialMode="vs-ai" createAi={() => ai} aiMinThinkMs={0} />);

    await user.selectOptions(screen.getByLabelText(/difficulty/i), "hard");

    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
    expect(spy.mock.calls[0][0]).toMatchObject({ depth: 10 });
  });
});

// ---- M3 card system --------------------------------------------------------

const ALL_FORESIGHT_DECK = Array.from({ length: 8 }, () => FORESIGHT);
const ALL_BARRICADE_DECK = Array.from({ length: 8 }, () => BARRICADE);
const ALL_FROSTBITE_DECK = Array.from({ length: 8 }, () => FROSTBITE);
const ALL_RECON_DECK = Array.from({ length: 8 }, () => RECONNAISSANCE);
const ALL_SPIKE_PIT_DECK = Array.from({ length: 8 }, () => SPIKE_PIT);

function findCard(name: string): HTMLElement | undefined {
  return screen
    .queryAllByRole("listitem")
    .find((el) => (el.getAttribute("aria-label") ?? "").startsWith(name));
}

describe("Match (cards — M3)", () => {
  it("starts with a hand of 5 and energy 1 (banking start)", () => {
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(1)}
      />,
    );

    const hand = screen.getByRole("list", { name: /^hand$/i });
    expect(within(hand).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("1");
  });

  it("Foresight costs 1 and moves to the discard pile", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(2)}
      />,
    );

    const foresight = findCard("Foresight");
    expect(foresight).toBeDefined();
    await user.click(foresight!);
    // Foresight opens the scry modal — confirm to dismiss.
    const confirm = await screen.findByRole("button", { name: /confirm/i });
    await user.click(confirm);

    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("0"); // cost 1, starting energy 1
    // Foresight is non-Consume, so it lands in the discard pile.
    expect(screen.getByLabelText(/^discard pile/i)).toHaveTextContent("1");
    const hand = screen.getByRole("list", { name: /^hand$/i });
    expect(within(hand).getAllByRole("listitem")).toHaveLength(4);
  });

  it("Reconnaissance draws 2 — hand grows past the cap", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    // Reconnaissance costs 2 and starting energy is 1 → wait one turn so the
    // ramp covers the cost. The fake AI takes its black move on each request,
    // so a single chess push closes player turn 1; Reconnaissance is then
    // playable on turn 2 with 2 energy.
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_RECON_DECK}
        rng={makeRng(3)}
        // Open the match with the player at full energy so the cost-2 play
        // resolves on turn 1 — keeps the test focused on the draw effect.
        initialEnergy={ENERGY_MAX}
      />,
    );

    const recon = findCard("Reconnaissance");
    await user.click(recon!);

    const hand = screen.getByRole("list", { name: /^hand$/i });
    // 5 - 1 played + 2 drawn = 6
    expect(within(hand).getAllByRole("listitem")).toHaveLength(6);
  });

  it("Barricade enters targeting mode; clicking an empty square places a wall", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_BARRICADE_DECK}
        rng={makeRng(4)}
      />,
    );

    await user.click(findCard("Barricade")!);
    expect(screen.getByText(/Pick an empty square for Barricade/i)).toBeInTheDocument();

    // Click a known-empty square.
    await user.click(squareCell("e4")!);

    // Wall is now on e4 — aria-label should mention "walled".
    expect(squareCell("e4")?.getAttribute("aria-label")).toMatch(/walled/);
  });

  it("Barricade rejects an occupied square and cancels targeting", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_BARRICADE_DECK}
        rng={makeRng(5)}
      />,
    );

    await user.click(findCard("Barricade")!);
    // e2 is the player's pawn — invalid for Barricade.
    await user.click(squareCell("e2")!);

    // No wall placed; targeting cancelled.
    expect(screen.queryByText(/Pick an empty square/i)).toBeNull();
    expect(squareCell("e2")?.getAttribute("aria-label")).not.toMatch(/walled/);
  });

  it("Frostbite freezes an opponent piece on click", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FROSTBITE_DECK}
        rng={makeRng(6)}
        initialEnergy={3}
      />,
    );

    await user.click(findCard("Frostbite")!);
    expect(screen.getByText(/Pick an enemy piece for Frostbite/i)).toBeInTheDocument();

    await user.click(squareCell("e7")!);

    expect(squareCell("e7")?.getAttribute("aria-label")).toMatch(/frozen/);
    // 1 frostbite spent, energy was 3, now 1
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("1");
  });

  it("plays a card before moving; the move ends the turn and the next turn banks +1 energy", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi(["e7e5"]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_BARRICADE_DECK}
        rng={makeRng(7)}
        initialEnergy={3}
      />,
    );

    // Play Barricade on a3 — costs 1 energy, leaves us at 2.
    await user.click(findCard("Barricade")!);
    await user.click(squareCell("a3")!);
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("2");

    // Make a chess move — this ends the turn, AI auto-responds, new turn begins.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    await waitFor(() => {
      expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    });

    // Banking: ended turn 1 at 2 energy, turn 2 adds +1 → 3.
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("3");
    const hand = screen.getByRole("list", { name: /^hand$/i });
    expect(within(hand).getAllByRole("listitem")).toHaveLength(5);
  });

  it("a frozen piece's freeze visual is cleared after the AI has had its turn", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi(["d7d5"]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FROSTBITE_DECK}
        rng={makeRng(8)}
        initialEnergy={3}
      />,
    );

    await user.click(findCard("Frostbite")!);
    await user.click(squareCell("e7")!);
    expect(squareCell("e7")?.getAttribute("aria-label")).toMatch(/frozen/);

    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    await waitFor(() => {
      expect(squareCell("d5")?.getAttribute("aria-label")).toBe("d5, opponent pawn");
    });

    // After the AI's turn, the freeze on e7 should have expired.
    expect(squareCell("e7")?.getAttribute("aria-label") ?? "").not.toMatch(/frozen/);
  });

  it("once the player has moved a piece, cards are no longer playable that turn", async () => {
    const user = userEvent.setup();
    // AI never moves so we stay paused on the AI's turn after the player moves.
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_BARRICADE_DECK}
        rng={makeRng(10)}
        initialEnergy={3}
      />,
    );

    // Make a chess move — turn flips to opponent.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    // Now try to play a card — should be disabled.
    const card = findCard("Barricade")!;
    expect(card).toBeDisabled();

    // Energy is unchanged.
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("3");
  });

  it("clicking the same selected card again cancels targeting", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_BARRICADE_DECK}
        rng={makeRng(9)}
      />,
    );

    const card = findCard("Barricade")!;
    await user.click(card);
    expect(screen.getByText(/Pick an empty square/i)).toBeInTheDocument();

    await user.click(card);
    expect(screen.queryByText(/Pick an empty square/i)).toBeNull();
  });

  it("local-pvp mode does not render the hand", () => {
    render(<Match initialMode="local-pvp" />);
    expect(screen.queryByRole("list", { name: /^hand$/i })).toBeNull();
  });

  // ---- M4: AI respects walls / freezes via searchmoves ---------------------

  it("the AI is given UCI searchmoves restricted to our walled-legal set", async () => {
    const user = userEvent.setup();
    const calls: ReadonlyArray<string>[] = [];
    // AI happens to play e7e5 — but the test only cares about the searchMoves
    // it was given, not the move itself.
    const ai = makeFakeAi(["e7e5"], calls);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_BARRICADE_DECK}
        rng={makeRng(20)}
      />,
    );

    // Drop a wall on e3 — this would cut off any black move that tries to slide
    // through e3 (none exist immediately, but the wall is on the board).
    await user.click(findCard("Barricade")!);
    await user.click(squareCell("e3")!);

    // Make a move so the AI gets a turn.
    await user.click(squareCell("d2")!);
    await user.click(squareCell("d4")!);

    await waitFor(() => {
      expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    });

    expect(calls).toHaveLength(1);
    const offered = calls[0];
    // We should have offered the AI a non-trivial set (>=20 plain opening moves).
    expect(offered.length).toBeGreaterThan(15);
    // None of the offered moves may LAND on the walled square.
    for (const uci of offered) {
      expect(uci.slice(2, 4)).not.toBe("e3");
    }
  });

  it("a frozen enemy piece is excluded from the AI's searchmoves", async () => {
    const user = userEvent.setup();
    const calls: ReadonlyArray<string>[] = [];
    const ai = makeFakeAi(["d7d5"], calls);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FROSTBITE_DECK}
        rng={makeRng(21)}
        initialEnergy={3}
      />,
    );

    // Freeze the black knight on g8.
    await user.click(findCard("Frostbite")!);
    await user.click(squareCell("g8")!);

    // Make a move to give the AI its turn.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    await waitFor(() => {
      expect(squareCell("d5")?.getAttribute("aria-label")).toBe("d5, opponent pawn");
    });

    expect(calls).toHaveLength(1);
    const offered = calls[0];
    // No move from g8 (frozen knight) should appear in the offered set.
    expect(offered.some((uci) => uci.startsWith("g8"))).toBe(false);
    // Plenty of other moves should still be on offer.
    expect(offered.length).toBeGreaterThan(10);
  });

  // Regression: Iron Guard cast on a piece that then captures must follow the
  // piece to its destination square. Bug was that we were clearing the captured
  // piece's statuses AFTER relocating, which wiped the freshly-relocated shield.
  it("Iron Guard on a piece that then captures still shields it after the capture", async () => {
    const user = userEvent.setup();
    const calls: ReadonlyArray<string>[] = [];
    // Knight c3 about to capture rook on d5; black knight on e7 could recapture.
    // White king h1, black king h8; otherwise empty.
    const ai = makeFakeAi(["e7c6"], calls);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={Array.from({ length: 8 }, () => IRON_GUARD)}
        rng={makeRng(99)}
        initialFen="7k/4n3/8/3r4/8/2N5/8/7K w - - 0 1"
        initialEnergy={3}
      />,
    );

    // Cast Iron Guard on the c3 knight.
    await user.click(findCard("Iron Guard")!);
    await user.click(squareCell("c3")!);

    // Knight captures rook on d5.
    await user.click(squareCell("c3")!);
    await user.click(squareCell("d5")!);

    // AI got a chance to think. Its searchmoves must NOT include the e7→d5
    // recapture — the shield followed our knight to d5.
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(0);
    });
    const offered = calls[0];
    expect(offered).not.toContain("e7d5");
    // Sanity: the AI was offered some moves (otherwise the assertion is vacuous).
    expect(offered.length).toBeGreaterThan(0);
  });
});

describe("Match — trap mechanics", () => {
  it("a Spike Pit captures an enemy sliding piece passing THROUGH the trap square", async () => {
    const user = userEvent.setup();
    // FEN: black queen on h7, otherwise sparse so the queen has a long ray.
    // Player king on h1, white pawn on a2 to give white a non-relevant move.
    // Black to move scenario after white plays its turn — we'll script the AI
    // to slide the queen across an armed Spike Pit on c3.
    // Actually: after white's e2-e4, black plays Qa7-a3 sliding through... no,
    // simpler: opponent rook on h8 sliding down the h-file, trap on h4.
    const ai = makeFakeAi(["h8h4"]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_SPIKE_PIT_DECK}
        rng={makeRng(100)}
        initialFen="r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"
        initialEnergy={3}
      />,
    );

    // Place a Spike Pit on h4 so the rook would slide through it on its way down.
    await user.click(findCard("Spike Pit")!);
    await user.click(squareCell("h4")!);
    expect(squareCell("h4")?.getAttribute("aria-label")).toMatch(/trap/);

    // Make any white move to let black respond.
    await user.click(squareCell("a1")!);
    await user.click(squareCell("a2")!);

    await waitFor(() => {
      // Rook attempted h8 -> h4 (or further). Either way it should be captured
      // by the trap and removed from the board.
      expect(squareCell("h8")?.getAttribute("aria-label")).toBe("h8");
    });
    // The rook never made it anywhere — trap captured it on h4.
    for (const r of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sq = `h${r}`;
      const label = squareCell(sq)?.getAttribute("aria-label") ?? "";
      expect(label).not.toMatch(/opponent rook/);
    }
  });

  it("a Spike Pit also captures one of the player's own pieces", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_SPIKE_PIT_DECK}
        rng={makeRng(101)}
        initialEnergy={3}
      />,
    );

    // Place a Spike Pit on e4.
    await user.click(findCard("Spike Pit")!);
    await user.click(squareCell("e4")!);

    // Now move the white pawn e2 -> e4 — pawn lands on the trap and is captured.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    // The pawn is gone (captured by the trap).
    expect(squareCell("e4")?.getAttribute("aria-label")).not.toMatch(/pawn/);
    expect(squareCell("e2")?.getAttribute("aria-label")).toBe("e2");
  });
});

describe("Match — undo", () => {
  it("undoes the previous player+AI turn cycle", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi(["e7e5"]);
    render(
      <Match
        runMode="dev"
        initialDevAiOn
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(200)}
      />,
    );

    // Initially undo is disabled — no completed turn yet.
    expect(screen.getByRole("button", { name: /undo turn/i })).toBeDisabled();

    // Player plays e2 -> e4; AI replies e7 -> e5.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);
    await waitFor(() => {
      expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    });

    // Undo the turn — both moves should be reverted.
    const undoBtn = screen.getByRole("button", { name: /undo turn/i });
    expect(undoBtn).not.toBeDisabled();
    await user.click(undoBtn);

    expect(squareCell("e2")?.getAttribute("aria-label")).toBe("e2, player pawn");
    expect(squareCell("e4")?.getAttribute("aria-label")).toBe("e4");
    expect(squareCell("e7")?.getAttribute("aria-label")).toBe("e7, opponent pawn");
    expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5");
    // Back to white's turn.
    expect(screen.getByLabelText(/^side to move:/i)).toHaveTextContent(/white/i);
  });

  it("undo can rewind multiple turns in a row (no per-turn cap)", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi(["e7e5", "d7d5", "g8f6"]);
    render(
      <Match
        runMode="dev"
        initialDevAiOn
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(201)}
      />,
    );

    // Play three full turns: e4/e5, d4/d5, Nc3/Nf6.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);
    await waitFor(() => {
      expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    });
    await user.click(squareCell("d2")!);
    await user.click(squareCell("d4")!);
    await waitFor(() => {
      expect(squareCell("d5")?.getAttribute("aria-label")).toBe("d5, opponent pawn");
    });
    await user.click(squareCell("b1")!);
    await user.click(squareCell("c3")!);
    await waitFor(() => {
      expect(squareCell("f6")?.getAttribute("aria-label")).toBe("f6, opponent knight");
    });

    const undoBtn = screen.getByRole("button", { name: /undo turn/i });
    // Undo three times — back to the starting position.
    await user.click(undoBtn);
    await user.click(undoBtn);
    await user.click(undoBtn);

    expect(squareCell("e2")?.getAttribute("aria-label")).toBe("e2, player pawn");
    expect(squareCell("d2")?.getAttribute("aria-label")).toBe("d2, player pawn");
    expect(squareCell("b1")?.getAttribute("aria-label")).toBe("b1, player knight");
    expect(squareCell("e4")?.getAttribute("aria-label")).toBe("e4");
    // No more turns to undo at the very start.
    expect(undoBtn).toBeDisabled();
  });

  it("redo replays an undone turn; new moves invalidate the redo stack", async () => {
    const user = userEvent.setup();
    // Need 2 AI moves: one for the initial line, one for the divergence.
    const ai = makeFakeAi(["e7e5", "c7c5"]);
    render(
      <Match
        runMode="dev"
        initialDevAiOn
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(202)}
      />,
    );

    const redoBtn = screen.getByRole("button", { name: /redo turn/i });
    expect(redoBtn).toBeDisabled(); // nothing to redo yet

    // Play e4; AI replies e5.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);
    await waitFor(() => {
      expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    });

    // Undo: back to start. Redo should now be enabled.
    await user.click(screen.getByRole("button", { name: /undo turn/i }));
    expect(squareCell("e4")?.getAttribute("aria-label")).toBe("e4");
    expect(redoBtn).not.toBeDisabled();

    // Redo: e4/e5 reapply.
    await user.click(redoBtn);
    expect(squareCell("e4")?.getAttribute("aria-label")).toBe("e4, player pawn");
    expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    expect(redoBtn).toBeDisabled();

    // Undo and play a different move: redo should be cleared once the AI replies.
    await user.click(screen.getByRole("button", { name: /undo turn/i }));
    expect(redoBtn).not.toBeDisabled();
    await user.click(squareCell("d2")!);
    await user.click(squareCell("d4")!);
    await waitFor(() => {
      expect(squareCell("c5")?.getAttribute("aria-label")).toBe("c5, opponent pawn");
    });
    expect(redoBtn).toBeDisabled();
  });

  it("undo restores the exact hand the player held at the start of that turn", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi(["e7e5"]);
    render(
      <Match
        runMode="dev"
        initialDevAiOn
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(203)}
        initialEnergy={3}
      />,
    );

    const hand = () => screen.getByRole("list", { name: /^hand$/i });
    const handSizeBefore = within(hand()).getAllByRole("listitem").length;
    expect(handSizeBefore).toBe(5);

    // Play a Foresight and dismiss the modal — that moves a card from hand
    // to discard, taking the hand size to 4.
    await user.click(findCard("Foresight")!);
    const confirm = await screen.findByRole("button", { name: /confirm/i });
    await user.click(confirm);
    expect(within(hand()).getAllByRole("listitem")).toHaveLength(4);

    // Make a chess move to end the turn.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);
    await waitFor(() => {
      expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    });
    // Next turn refilled the hand back to 5.
    expect(within(hand()).getAllByRole("listitem")).toHaveLength(5);

    // Undo: hand goes back to 5 (start of turn 1, before the Foresight play).
    await user.click(screen.getByRole("button", { name: /undo turn/i }));
    expect(within(hand()).getAllByRole("listitem")).toHaveLength(5);
    // And energy is the start-of-turn value (full).
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("3");
  });
});

// ---- Dev mode --------------------------------------------------------------

describe("Match — dev mode", () => {
  it("editor places a piece on an empty square; clear board removes it", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        runMode="dev"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(300)}
      />,
    );

    // Pick the player rook brush — the editor is always active in sandbox.
    await user.click(screen.getByRole("button", { name: /pick player rook/i }));

    // e4 is empty in the standard start.
    await user.click(squareCell("e4")!);
    expect(squareCell("e4")?.getAttribute("aria-label")).toBe("e4, player rook");

    // Brush is consumed by the placement: a second click on a different empty
    // square must NOT place another rook (it just selects normally / no-ops).
    await user.click(squareCell("d4")!);
    expect(squareCell("d4")?.getAttribute("aria-label")).toBe("d4");

    // Clear board wipes all pieces (including the one we just placed).
    await user.click(screen.getByRole("button", { name: /clear board/i }));
    expect(squareCell("e4")?.getAttribute("aria-label")).toBe("e4");
    expect(squareCell("e1")?.getAttribute("aria-label")).toBe("e1");
  });

  it("dragging a palette piece places it and clears the brush", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        runMode="dev"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(309)}
      />,
    );

    const rookBrush = screen.getByRole("button", { name: /pick player rook/i });
    const e4 = squareCell("e4")!;
    const d4 = squareCell("d4")!;

    // Drag the rook brush onto e4.
    const data: Record<string, string> = {};
    const types: string[] = [];
    const dt = {
      effectAllowed: "all",
      dropEffect: "move",
      types,
      setData(format: string, value: string) {
        data[format] = value;
        if (!types.includes(format)) types.push(format);
      },
      getData(format: string) {
        return data[format] ?? "";
      },
      clearData() {
        for (const k of Object.keys(data)) delete data[k];
        types.length = 0;
      },
    } as unknown as DataTransfer;

    fireEvent.dragStart(rookBrush, { dataTransfer: dt });
    fireEvent.dragOver(e4, { dataTransfer: dt });
    fireEvent.drop(e4, { dataTransfer: dt });
    fireEvent.dragEnd(rookBrush, { dataTransfer: dt });

    expect(squareCell("e4")?.getAttribute("aria-label")).toBe("e4, player rook");

    // After the drag, the rook brush should be deselected — clicking another
    // empty square must NOT place a second piece.
    await user.click(d4);
    expect(squareCell("d4")?.getAttribute("aria-label")).toBe("d4");
  });

  it("side-to-move toggle flips the engine turn", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        runMode="dev"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(301)}
      />,
    );

    expect(screen.getByLabelText(/^side to move:/i)).toHaveTextContent(/white/i);

    const sideGroup = screen.getByRole("radiogroup", { name: /side to move/i });
    await user.click(within(sideGroup).getByRole("radio", { name: /^black$/i }));

    expect(screen.getByLabelText(/^side to move:/i)).toHaveTextContent(/black/i);
  });

  it("library no-target card plays free — energy unchanged, discard pile unchanged", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        runMode="dev"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(302)}
        initialEnergy={3}
      />,
    );

    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("3");
    expect(screen.getByLabelText(/^discard pile/i)).toHaveTextContent("0");

    // Library lives behind a button in sandbox; open the overlay first.
    await user.click(screen.getByRole("button", { name: /^library$/i }));

    // Reconnaissance is no-target. Click the library entry (data-card-id is set
    // on the dev panel button to disambiguate from the same card in hand).
    const libraryCard = document.querySelector(
      'aside button[data-card-id="reconnaissance"]',
    ) as HTMLElement | null;
    expect(libraryCard).toBeTruthy();
    await user.click(libraryCard!);

    // Energy and the discard pile are unchanged after a free library play.
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("3");
    expect(screen.getByLabelText(/^discard pile/i)).toHaveTextContent("0");
  });

  it("library targeted card freezes a target without charging energy", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        runMode="dev"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(303)}
        initialEnergy={3}
      />,
    );

    // Library lives behind a button in sandbox; open the overlay first.
    await user.click(screen.getByRole("button", { name: /^library$/i }));

    const frostbite = document.querySelector(
      'aside button[data-card-id="frostbite"]',
    ) as HTMLElement | null;
    expect(frostbite).toBeTruthy();
    await user.click(frostbite!);

    // Targeting prompt is now showing for Frostbite.
    expect(screen.getByText(/Pick an enemy piece for Frostbite/i)).toBeInTheDocument();

    // Pick e7 — a Black pawn.
    await user.click(squareCell("e7")!);

    expect(squareCell("e7")?.getAttribute("aria-label")).toMatch(/frozen/);
    // Energy unchanged.
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("3");
  });

  it("hand card played in dev still costs energy", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        runMode="dev"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FROSTBITE_DECK}
        rng={makeRng(304)}
        initialEnergy={3}
      />,
    );

    // Playing Frostbite from the hand: cost 2 → energy goes from 3 to 1.
    await user.click(findCard("Frostbite")!);
    await user.click(squareCell("e7")!);

    expect(squareCell("e7")?.getAttribute("aria-label")).toMatch(/frozen/);
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("1");
  });

  it("+1 energy bumps the count and undo rewinds it", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        runMode="dev"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(305)}
        initialEnergy={3}
      />,
    );

    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("3");

    await user.click(screen.getByRole("button", { name: /\+1 energy/i }));
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("4");

    await user.click(screen.getByRole("button", { name: /undo turn/i }));
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("3");
  });

  it("AI single-move button plays one Black move and stops", async () => {
    const user = userEvent.setup();
    // Only one move scripted — if the loop fires twice the second call returns
    // empty and nothing changes, but the loop shouldn't fire at all once the
    // single-shot completes.
    const ai = makeFakeAi(["e7e5"]);
    render(
      <Match
        runMode="dev"
        initialDevAiOn={false}
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(306)}
      />,
    );

    // Move a White pawn first so it's Black's turn.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    // No auto-AI: e7 is still a Black pawn.
    expect(squareCell("e7")?.getAttribute("aria-label")).toBe("e7, opponent pawn");

    // Trigger the single-move button.
    await user.click(screen.getByRole("button", { name: /^AI Move$/i }));

    await waitFor(() => {
      expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    });
    // Side flipped back to white.
    expect(screen.getByLabelText(/^side to move:/i)).toHaveTextContent(/white/i);
  });

  it("human-driven Black move triggers turn rollover (energy ramps, hand refills)", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        runMode="dev"
        initialDevAiOn={false}
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(307)}
        initialEnergy={2}
      />,
    );

    // Play Foresight (cost 1) and dismiss the modal so hand size is 4.
    await user.click(findCard("Foresight")!);
    await user.click(await screen.findByRole("button", { name: /confirm/i }));

    const hand = () => screen.getByRole("list", { name: /^hand$/i });
    expect(within(hand()).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("1");

    // White move ends the player turn.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);
    expect(screen.getByLabelText(/^side to move:/i)).toHaveTextContent(/black/i);

    // Drive Black manually (no AI in dev). After this move, the rollover fires.
    await user.click(squareCell("e7")!);
    await user.click(squareCell("e5")!);

    // Turn 2 begins: previous hand discards, new hand draws to 5, energy
    // ramps to 1 + 1 = 2.
    expect(within(hand()).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("2");
  });

  it("Soul fix: Black capture in dev does NOT add a Soul card to the draw pile", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    // Position: White pawn on e4, Black pawn on d5 — Black can capture by exd4.
    render(
      <Match
        runMode="dev"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_FORESIGHT_DECK}
        rng={makeRng(308)}
        initialFen="4k3/8/8/3p4/4P3/8/8/4K3 b - - 0 1"
      />,
    );

    // Initial deck has 8 Foresights → drawPile starts at 3 (5 dealt to hand).
    const drawPileText = () => screen.getByLabelText(/^draw pile/i).textContent ?? "";
    expect(drawPileText()).toContain("3");

    // Black captures the e4 pawn.
    await user.click(squareCell("d5")!);
    await user.click(squareCell("e4")!);

    // Verify capture happened.
    expect(squareCell("e4")?.getAttribute("aria-label")).toBe("e4, opponent pawn");

    // Draw pile size is unchanged — no Soul granted (it's the player's enemy
    // capturing). If we had passed the wrong side, the helper would have
    // shuffled a Pawn Soul into the draw pile, bumping the count.
    expect(drawPileText()).toContain("3");
  });
});
