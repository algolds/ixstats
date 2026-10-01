import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach } from "@jest/globals";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SHEET_SIDE_BREAKPOINT_QUERY,
} from "~/components/ui/sheet";

const originalMatchMedia = window.matchMedia;

/** Pretend the viewport is `width` px wide for the sheet's breakpoint query. */
function mockViewportWidth(width: number) {
  window.matchMedia = ((query: string) => ({
    matches: query === SHEET_SIDE_BREAKPOINT_QUERY ? width >= 768 : false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderSheet(props: React.ComponentProps<typeof SheetContent> = {}) {
  return render(
    <Sheet open>
      <SheetContent {...props}>
        <SheetTitle>Details</SheetTitle>
        <SheetDescription>Sheet body</SheetDescription>
      </SheetContent>
    </Sheet>
  );
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.documentElement.removeAttribute("data-motion");
});

describe("Sheet presentation", () => {
  it("is a bottom sheet with medium/large detents and a grabber below 768px", () => {
    mockViewportWidth(390);
    renderSheet();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-presentation", "bottom-detent");
    expect(dialog).toHaveAttribute("data-side", "bottom");
    expect(dialog).toHaveAttribute("data-detent", "medium");
    expect(dialog.className).toContain("rounded-t-sheet");

    // The grabber switches detents.
    const grabber = screen.getByRole("button", { name: "Expand sheet" });
    fireEvent.click(grabber);
    expect(dialog).toHaveAttribute("data-detent", "large");
    expect(screen.getByRole("button", { name: "Collapse sheet" })).toBeInTheDocument();
  });

  it("is a right side sheet at 768px and above", () => {
    mockViewportWidth(1280);
    renderSheet();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-presentation", "side");
    expect(dialog).toHaveAttribute("data-side", "right");
    expect(dialog).not.toHaveAttribute("data-detent");
    expect(screen.queryByRole("button", { name: /sheet$/ })).not.toBeInTheDocument();
  });

  it("keeps an explicit side at every width (pre-Facet 3 API)", () => {
    mockViewportWidth(390);
    renderSheet({ side: "left" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-presentation", "side");
    expect(dialog).toHaveAttribute("data-side", "left");
  });

  it("opens at the requested detent and only offers configured detents", () => {
    mockViewportWidth(390);
    renderSheet({ detents: ["large"] });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-detent", "large");
    // One detent: the grabber is a drag handle, not a button.
    expect(screen.queryByRole("button", { name: /sheet$/ })).not.toBeInTheDocument();
  });

  it("opts an explicit bottom sheet into detents when detents are passed", () => {
    mockViewportWidth(1280);
    renderSheet({ side: "bottom", detents: ["medium", "large"], defaultDetent: "large" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-presentation", "bottom-detent");
    expect(dialog).toHaveAttribute("data-detent", "large");
  });

  it("switches detents without drag under reduced motion", () => {
    mockViewportWidth(390);
    document.documentElement.setAttribute("data-motion", "reduced");
    renderSheet();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Expand sheet" }));
    expect(dialog).toHaveAttribute("data-detent", "large");
  });

  it("keeps the default side-sheet width (3/4 up to 24rem)", () => {
    mockViewportWidth(1280);
    renderSheet();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-size", "default");
    expect(dialog.className).toContain("w-3/4");
    expect(dialog.className).toContain("sm:max-w-sm");
  });

  it("offers a wide (~48rem) side sheet for two-column detail views", () => {
    mockViewportWidth(1280);
    renderSheet({ size: "wide" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-presentation", "side");
    expect(dialog).toHaveAttribute("data-size", "wide");
    expect(dialog.className).toContain("sm:max-w-3xl");
    expect(dialog.className).toContain("w-full");
    expect(dialog.className).not.toContain("sm:max-w-sm");
    expect(dialog.className).not.toContain("w-3/4");
  });

  it("leaves bottom sheets full width when size is wide", () => {
    mockViewportWidth(390);
    renderSheet({ size: "wide" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-presentation", "bottom-detent");
    expect(dialog.className).not.toContain("max-w-3xl");
  });
});
