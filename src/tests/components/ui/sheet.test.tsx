/**
 * Facet overlays: a Sheet's detents work from a button without drag (reduced motion), virtual-anchor popovers never
 * take focus and report Escape, a hover card is no dialog, a Tooltip never switches between controlled and
 * uncontrolled, and an Inspector mounts its content once (aside while wide, sheet only while open below xl) and asks
 * its owner to close the sheet when the viewport grows. Folds inspector.test.tsx.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SHEET_SIDE_BREAKPOINT_QUERY,
} from "~/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverVirtualAnchor,
  VirtualAnchorPopover,
} from "~/components/ui/popover";
import { VirtualAnchorHoverCard } from "~/components/ui/hover-card";
import { Tooltip } from "~/components/ui/tooltip";
import { Inspector } from "~/components/ui/inspector";

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

describe("Sheet detents", () => {
  it("switch from the grabber button, with no drag, under reduced motion", () => {
    mockViewportWidth(390);
    document.documentElement.setAttribute("data-motion", "reduced");
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

describe("Inspector", () => {
  let listeners = new Set<(event: { matches: boolean }) => void>();
  let wide = false;
  /** A viewport the real useMediaQuery reads, wide at xl (1280px). */
  function viewport(isWide: boolean) {
    wide = isWide;
    listeners = new Set();
    window.matchMedia = ((query: string) => ({
      get matches() {
        return query === "(min-width: 1280px)" ? wide : false;
      },
      media: query,
      addEventListener: (_: string, fn: (event: { matches: boolean }) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (event: { matches: boolean }) => void) =>
        listeners.delete(fn),
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  let live = 0;
  let peak = 0;
  function Probe() {
    React.useEffect(() => {
      live += 1;
      peak = Math.max(peak, live);
      return () => {
        live -= 1;
      };
    }, []);
    return <span>probe</span>;
  }
  const ui = (open: boolean, onOpenChange: (open: boolean) => void = () => {}) => (
    <Inspector title="Contents" open={open} onOpenChange={onOpenChange}>
      <Probe />
    </Inspector>
  );
  beforeEach(() => {
    live = 0;
    peak = 0;
  });

  it("mounts its content once: in the aside while wide, in the sheet only while it is open, never in both", () => {
    viewport(true);
    render(ui(false)).unmount();
    expect(peak).toBe(1);

    viewport(false);
    peak = 0;
    const { rerender } = render(ui(false));
    expect(live).toBe(0);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(ui(true));
    expect(screen.getByRole("dialog")).toHaveTextContent("probe");
    rerender(ui(false));
    expect(peak).toBe(1);
  });

  it("asks its owner to close the sheet when the viewport grows to xl", () => {
    viewport(false);
    const onOpenChange = jest.fn();
    render(ui(true, onOpenChange));
    expect(onOpenChange).not.toHaveBeenCalled();
    wide = true;
    act(() => listeners.forEach((fn) => fn({ matches: true })));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
