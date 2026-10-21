/**
 * Facet overlays: how a Sheet presents by width and props (detents work without drag under reduced motion),
 * virtual-anchor popovers that never take focus and report Escape, a hover card that is no dialog, and a Tooltip
 * that never switches between controlled and uncontrolled.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SHEET_SIDE_BREAKPOINT_QUERY,
} from "~/components/ui/sheet";
import { Popover, PopoverContent, PopoverVirtualAnchor, VirtualAnchorPopover } from "~/components/ui/popover";
import { VirtualAnchorHoverCard } from "~/components/ui/hover-card";
import { Tooltip } from "~/components/ui/tooltip";

// Radix only warns under the "development" export condition, which Jest does not set.
jest.mock("@radix-ui/primitive/is-development", () => ({ IS_DEVELOPMENT: true }));

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

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.documentElement.removeAttribute("data-motion");
});

describe("Sheet presentation", () => {
  it.each([
    { at: "390px", width: 390, props: {}, presentation: "bottom-detent", side: "bottom", detent: "medium" },
    { at: "1280px", width: 1280, props: {}, presentation: "side", side: "right", detent: null },
    { at: "390px with side=left", width: 390, props: { side: "left" as const }, presentation: "side", side: "left", detent: null },
    { at: "390px with detents=[large]", width: 390, props: { detents: ["large" as const] }, presentation: "bottom-detent", side: "bottom", detent: "large" },
    {
      at: "1280px as an explicit bottom sheet with detents",
      width: 1280,
      props: { side: "bottom" as const, detents: ["medium" as const, "large" as const], defaultDetent: "large" as const },
      presentation: "bottom-detent",
      side: "bottom",
      detent: "large",
    },
  ])("at $at it is $presentation on the $side, detent $detent", ({ width, props, presentation, side, detent }) => {
    mockViewportWidth(width);
    render(
      <Sheet open>
        <SheetContent {...props}>
          <SheetTitle>Details</SheetTitle>
          <SheetDescription>Sheet body</SheetDescription>
        </SheetContent>
      </Sheet>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-presentation", presentation);
    expect(dialog).toHaveAttribute("data-side", side);
    if (detent) expect(dialog).toHaveAttribute("data-detent", detent);
    else expect(dialog).not.toHaveAttribute("data-detent");
  });

  it.each([
    ["with full motion", false],
    ["under reduced motion", true],
  ])("switches detents from the grabber button %s", (_label, reduced) => {
    mockViewportWidth(390);
    if (reduced) document.documentElement.setAttribute("data-motion", "reduced");
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Details</SheetTitle>
          <SheetDescription>Sheet body</SheetDescription>
        </SheetContent>
      </Sheet>
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Expand sheet" }));
    expect(dialog).toHaveAttribute("data-detent", "large");
    expect(screen.getByRole("button", { name: "Collapse sheet" })).toBeInTheDocument();
  });
});

describe("virtual-anchor overlays", () => {
  const anchorEl = (tag = "a") => document.body.appendChild(document.createElement(tag));

  it("a VirtualAnchorPopover opens with an anchor, closes without one, and never takes focus", () => {
    const link = anchorEl();
    const before = document.body.appendChild(document.createElement("button"));
    before.focus();
    const ui = (anchor: Element | null) => (
      <VirtualAnchorPopover anchor={anchor} role="toolbar" aria-label="Selection actions">
        <button type="button">Discuss</button>
      </VirtualAnchorPopover>
    );
    const { rerender } = render(ui(link));
    expect(screen.getByRole("toolbar", { name: "Selection actions" })).toBeInTheDocument();
    expect(before).toHaveFocus();
    rerender(ui(null));
    expect(screen.queryByRole("toolbar")).toBeNull();
    link.remove();
    before.remove();
  });

  it("reports an Escape dismissal through onOpenChange", () => {
    const el = anchorEl("span");
    const onOpenChange = jest.fn();
    render(
      <VirtualAnchorPopover anchor={el} onOpenChange={onOpenChange} role="toolbar" aria-label="T">
        <button type="button">Copy</button>
      </VirtualAnchorPopover>
    );
    fireEvent.keyDown(screen.getByRole("toolbar"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    el.remove();
  });

  it("PopoverVirtualAnchor positions a Popover without an element of its own; a hover card is no dialog", () => {
    const el = anchorEl();
    const { container } = render(
      <>
        <Popover open>
          <PopoverVirtualAnchor anchor={el} />
          <PopoverContent>Anchored</PopoverContent>
        </Popover>
        <VirtualAnchorHoverCard anchor={el} data-testid="card">
          Preview
        </VirtualAnchorHoverCard>
      </>
    );
    expect(screen.getByText("Anchored")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="popover-virtual-anchor"]')).toBeNull();
    expect(screen.getByTestId("card")).not.toHaveAttribute("role");
    el.remove();
  });
});

test("toggling a Tooltip's `disabled` never switches it between controlled and uncontrolled", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const ui = (disabled: boolean) => (
    <Tooltip content="Label" disabled={disabled}>
      <button type="button">Trigger</button>
    </Tooltip>
  );
  const { rerender } = render(ui(false));
  rerender(ui(true));
  rerender(ui(false));
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});
