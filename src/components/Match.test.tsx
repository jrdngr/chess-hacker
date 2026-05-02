import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Match } from "./Match";
import { StockfishEngine } from "../ai/stockfish";
import { BARRICADE, FROSTBITE, RECONNAISSANCE, SURGE } from "../game/cards/library";
import { makeRng } from "../game/cards/match";

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
 */
function makeFakeAi(moves: string[]): StockfishEngine {
  let idx = 0;
  const fake: Partial<StockfishEngine> = {
    ready: () => Promise.resolve(),
    setPosition: () => {},
    getBestMove: () => Promise.resolve(moves[idx++] ?? ""),
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
      expect(spy).toHaveBeenCalledWith({ depth: 10 });
    });
  });
});

// ---- M3 card system --------------------------------------------------------

const ALL_SURGE_DECK = Array.from({ length: 8 }, () => SURGE);
const ALL_BARRICADE_DECK = Array.from({ length: 8 }, () => BARRICADE);
const ALL_FROSTBITE_DECK = Array.from({ length: 8 }, () => FROSTBITE);
const ALL_RECON_DECK = Array.from({ length: 8 }, () => RECONNAISSANCE);

function findCard(name: string): HTMLElement | undefined {
  return screen
    .queryAllByRole("listitem")
    .find((el) => (el.getAttribute("aria-label") ?? "").startsWith(name));
}

describe("Match (cards — M3)", () => {
  it("starts with a hand of 5 and energy 3", () => {
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_SURGE_DECK}
        rng={makeRng(1)}
      />,
    );

    const hand = screen.getByRole("list", { name: /^hand$/i });
    expect(within(hand).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("3");
  });

  it("Surge increases energy and moves to the discard pile", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_SURGE_DECK}
        rng={makeRng(2)}
      />,
    );

    const surge = findCard("Surge");
    expect(surge).toBeDefined();
    await user.click(surge!);

    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("4");
    expect(screen.getByLabelText(/^discard pile/i)).toHaveTextContent("1");
    const hand = screen.getByRole("list", { name: /^hand$/i });
    expect(within(hand).getAllByRole("listitem")).toHaveLength(4);
  });

  it("Reconnaissance draws 2 — hand grows past the cap", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_RECON_DECK}
        rng={makeRng(3)}
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
      />,
    );

    await user.click(findCard("Frostbite")!);
    expect(screen.getByText(/Pick an enemy piece for Frostbite/i)).toBeInTheDocument();

    await user.click(squareCell("e7")!);

    expect(squareCell("e7")?.getAttribute("aria-label")).toMatch(/frozen/);
    // 1 frostbite spent, energy was 3, now 1
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("1");
  });

  it("plays a card before moving; the move ends the turn and the next turn refreshes energy / hand", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi(["e7e5"]);
    render(
      <Match
        initialMode="vs-ai"
        createAi={() => ai}
        aiMinThinkMs={0}
        initialDeck={ALL_SURGE_DECK}
        rng={makeRng(7)}
      />,
    );

    await user.click(findCard("Surge")!);
    expect(screen.getByLabelText(/^energy:/i)).toHaveTextContent("4");

    // Make a chess move — this ends the turn, AI auto-responds, new turn begins.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    await waitFor(() => {
      expect(squareCell("e5")?.getAttribute("aria-label")).toBe("e5, opponent pawn");
    });

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
        initialDeck={ALL_SURGE_DECK}
        rng={makeRng(10)}
      />,
    );

    // Make a chess move — turn flips to opponent.
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    // Now try to play a card — should be disabled.
    const surge = findCard("Surge")!;
    expect(surge).toBeDisabled();

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
});
