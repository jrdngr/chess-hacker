import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Match } from "./Match";

function squareCell(aria: string): HTMLElement | undefined {
  return screen
    .getAllByRole("gridcell")
    .find((el) => (el.getAttribute("aria-label") ?? "").startsWith(aria));
}

describe("Match (PvP same-screen)", () => {
  it("starts with white to move and renders 64 squares", () => {
    render(<Match />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(64);
    expect(screen.getByText(/white/i)).toBeInTheDocument();
  });

  it("clicking a player pawn highlights legal targets, then a target click moves it", async () => {
    const user = userEvent.setup();
    render(<Match />);

    const e2 = squareCell("e2");
    expect(e2).toBeDefined();
    await user.click(e2!);

    // After selecting e2, e4 should be a labelled "move" target.
    const e4 = squareCell("e4");
    expect(e4?.getAttribute("aria-label")).toMatch(/move/);

    await user.click(e4!);

    // Side to move flipped to black.
    expect(screen.getByText(/black/i)).toBeInTheDocument();

    // e4 now contains a player pawn (aria-label includes the piece description).
    const e4After = squareCell("e4");
    expect(e4After?.getAttribute("aria-label")).toBe("e4, player pawn");
  });

  it("ignores clicks on opponent pieces while it isn't their turn", async () => {
    const user = userEvent.setup();
    render(<Match />);

    const e7 = squareCell("e7");
    await user.click(e7!);

    // No squares should be marked as targets since selection failed.
    const targetCells = screen
      .getAllByRole("gridcell")
      .filter((el) => /move|capture/.test(el.getAttribute("aria-label") ?? ""));
    expect(targetCells).toHaveLength(0);
  });
});
