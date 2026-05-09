// Integration tests for the Run shell. The Match component is exercised by
// its own suite; here we just drive the run-loop transitions.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Run } from "./Run";

describe("Run — Royal mini-run", () => {
  it("opens on match 1 and surfaces run progress in the ticker", async () => {
    render(<Run mode="royal" onExit={() => {}} rngSeed={1} />);

    // The new top ticker carries the project name + run progress.
    expect(screen.getByRole("banner")).toBeInTheDocument();
    // Act 1, match 1 of 3 — rendered as "ACT 1 M1/3" inside the ticker.
    expect(screen.getByText(/M1\/3/)).toBeInTheDocument();
    // Starter deck = 12 cards. After the initial draw of 5 the draw pile has
    // 7 cards left — we render that count on the DRAW pile button.
    expect(screen.getByLabelText(/draw pile, 7 cards/i)).toBeInTheDocument();
  });

  it("Quit button in the ticker calls onExit", async () => {
    const user = userEvent.setup();
    let exited = false;
    render(<Run mode="royal" onExit={() => (exited = true)} rngSeed={1} />);

    await user.click(screen.getByRole("button", { name: /quit run/i }));
    expect(exited).toBe(true);
  });
});
