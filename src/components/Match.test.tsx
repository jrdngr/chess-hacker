import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Match } from "./Match";
import { StockfishEngine } from "../ai/stockfish";

function squareCell(aria: string): HTMLElement | undefined {
  return screen
    .getAllByRole("gridcell")
    .find((el) => (el.getAttribute("aria-label") ?? "").startsWith(aria));
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
  it("plays the AI's response after the human moves", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi(["e7e5"]);
    render(<Match initialMode="vs-ai" createAi={() => ai} />);

    // Human plays e2 -> e4
    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    // AI's reply should land on e5 (player turn returns).
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
    render(<Match initialMode="vs-ai" createAi={() => ai} />);

    // Black pieces (controlled by AI) should not be selectable.
    await user.click(squareCell("e7")!);
    const targetCells = screen
      .getAllByRole("gridcell")
      .filter((el) => /move|capture/.test(el.getAttribute("aria-label") ?? ""));
    expect(targetCells).toHaveLength(0);
  });

  it("difficulty selector lets the user pick a depth", async () => {
    const user = userEvent.setup();
    const ai = makeFakeAi([]);
    const spy = vi.spyOn(ai, "getBestMove");
    render(<Match initialMode="vs-ai" createAi={() => ai} />);

    await user.selectOptions(screen.getByLabelText(/difficulty/i), "hard");

    await user.click(squareCell("e2")!);
    await user.click(squareCell("e4")!);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ depth: 10 });
    });
  });
});
