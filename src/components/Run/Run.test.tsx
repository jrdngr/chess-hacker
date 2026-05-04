// Integration tests for the Run shell. The Match component is exercised by
// its own suite; here we just drive the run-loop transitions.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Run } from "./Run";

describe("Run — Royal mini-run", () => {
  it("opens on match 1 with the run banner showing the deck size", async () => {
    render(<Run mode="royal" onExit={() => {}} rngSeed={1} />);

    expect(screen.getByLabelText(/run progress/i)).toBeInTheDocument();
    // Match 1 of 3.
    expect(screen.getByText(/^1 \/ 3$/)).toBeInTheDocument();
    // Starter deck is 20 cards (2 + 2 + 16 × 1) — see decks/starter.json.
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("Quit run button calls onExit", async () => {
    const user = userEvent.setup();
    let exited = false;
    render(<Run mode="royal" onExit={() => (exited = true)} rngSeed={1} />);

    await user.click(screen.getByRole("button", { name: /quit run/i }));
    expect(exited).toBe(true);
  });
});
