// Integration tests for the Run shell. The Match component is exercised by
// its own suite; here we just drive the run-loop transitions.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Run } from "./Run";

describe("Run — Standard boss preview", () => {
  it("opens on the boss-preview screen and dismisses to match on Continue", async () => {
    const user = userEvent.setup();
    render(<Run mode="standard" onExit={() => {}} rngSeed={1} />);

    // The preview panel announces itself with its `aria-label`.
    expect(screen.getByLabelText(/boss preview/i)).toBeInTheDocument();
    expect(screen.getByText(/the iron garrison/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot place walls/i)).toBeInTheDocument();
    // Hazard squares + Stalwart curse description appear in the spec list.
    expect(screen.getByText(/c3, c4/)).toBeInTheDocument();
    expect(screen.getByText(/Stalwart/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue/i }));
    // Match phase rendered the dev-toggle (run-mode side button).
    expect(screen.queryByLabelText(/boss preview/i)).not.toBeInTheDocument();
  });
});

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
