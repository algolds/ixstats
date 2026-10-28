import { act, fireEvent, render, screen } from "@testing-library/react";
import { HaloTourTooltip } from "~/components/halo/HaloTourTooltip";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as never;

function startTour() {
  render(
    <>
      <div id="command-palette" data-testid="halo" />
      <HaloTourTooltip />
    </>
  );
  act(() => {
    window.dispatchEvent(
      new CustomEvent("ix:halo-tour-step", { detail: { step: 1, active: true } })
    );
  });
}

describe("Halo walkthrough", () => {
  it("is a popover overlay with a plain step line", () => {
    startTour();
    const dialog = screen.getByRole("dialog", { name: "Halo walkthrough" });
    expect(dialog).toHaveAttribute("data-slot", "virtual-anchor-popover");
    expect(dialog.className).toEqual(expect.stringContaining("z-popover"));
    expect(dialog.className).toEqual(expect.stringContaining("facet-overlay"));
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(document.querySelector(".text-eyebrow")).toBeNull();
  });

  it("survives a click on Halo and ends on Escape", async () => {
    const skip = jest.fn();
    window.addEventListener("ix:tour-skip", skip);
    startTour();
    // Radix attaches its outside-press listener on the next tick; wait for it so the check is real.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    fireEvent.pointerDown(screen.getByTestId("halo"));
    expect(skip).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(skip).toHaveBeenCalledTimes(1);
    window.removeEventListener("ix:tour-skip", skip);
  });
});
