/**
 * A scrollable SegmentedControl keeps its selected segment in view: on a new selection, on focus, and when a segment
 * changes size after first paint (a count badge arriving), unless the row was scrolled by hand.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SegmentedControl } from "~/components/ui/segmented-control";

const OPTIONS = [
  { value: "mine", label: "My packs" },
  { value: "packs", label: "Packs" },
  { value: "cosmetics", label: "Cosmetics" },
  { value: "upgrades", label: "Account upgrades" },
];

/** A ResizeObserver whose callback the test runs, since jsdom has none. */
class MockResizeObserver implements ResizeObserver {
  static instances: MockResizeObserver[] = [];
  readonly observed = new Set<Element>();
  disconnected = false;
  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }
  observe(target: Element) {
    this.observed.add(target);
  }
  unobserve(target: Element) {
    this.observed.delete(target);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
  /** What the browser does after an observed box changes size. */
  fire() {
    act(() => this.callback([], this));
  }
}

const original = globalThis.ResizeObserver;
beforeEach(() => {
  MockResizeObserver.instances = [];
  globalThis.ResizeObserver = MockResizeObserver;
});
afterEach(() => {
  globalThis.ResizeObserver = original;
});

const rect = (left: number, width: number): DOMRect => ({
  left,
  right: left + width,
  x: left,
  width,
  top: 0,
  bottom: 32,
  y: 0,
  height: 32,
  toJSON: () => ({}),
});

/**
 * Lays the track out `trackWidth` wide at x 0 with its segments side by side at `widths`, moved by its scroll
 * position, since jsdom lays nothing out. `widths` stays live, so a test can widen a segment.
 */
function layOut(track: HTMLElement, widths: number[], trackWidth: number) {
  let scroll = 0;
  Object.defineProperty(track, "scrollLeft", {
    configurable: true,
    get: () => scroll,
    set: (next: number) => {
      scroll = next;
    },
  });
  Object.defineProperty(track, "clientWidth", { configurable: true, get: () => trackWidth });
  track.getBoundingClientRect = () => rect(0, trackWidth);
  Array.from(track.children).forEach((item, i) => {
    item.getBoundingClientRect = () =>
      rect(widths.slice(0, i).reduce((sum, w) => sum + w, 0) - scroll, widths[i]!);
  });
  return { scrollLeft: () => scroll };
}

function Strip({ value, scrollable = true }: { value: string; scrollable?: boolean }) {
  return (
    <SegmentedControl
      asTabs
      fullWidth
      scrollable={scrollable}
      aria-label="Sections"
      options={OPTIONS}
      value={value}
    />
  );
}

/** Renders on Packs, lays the strip out 300px wide (the four segments need 450), then selects `value`. */
function renderStrip(value: string, widths = [110, 80, 100, 160]) {
  const view = render(<Strip value="packs" />);
  const track = screen.getByRole("tablist", { name: "Sections" });
  const layout = layOut(track, widths, 300);
  view.rerender(<Strip value={value} />);
  return { ...view, track, widths, ...layout };
}

const observer = () => MockResizeObserver.instances.at(-1)!;

describe("SegmentedControl keep-in-view", () => {
  it("scrolls a newly selected segment past the edge fully into view", () => {
    const { scrollLeft } = renderStrip("upgrades");
    // Account upgrades spans 290 to 450 in a 300px track.
    expect(scrollLeft()).toBe(150);
  });

  it("watches the track and every segment, since a widening segment does not resize the track", () => {
    const { track } = renderStrip("upgrades");
    expect(observer().observed).toEqual(new Set([track, ...Array.from(track.children)]));
  });

  it("keeps the selected segment in view when one before it widens after first paint", () => {
    const { widths, scrollLeft } = renderStrip("upgrades");
    // My packs' count badge arrives and widens it by 35px.
    widths[0] = 145;
    observer().fire();
    expect(scrollLeft()).toBe(185);
  });

  it("leaves the strip where the player scrolled it by hand", () => {
    const { track, widths, scrollLeft } = renderStrip("upgrades");
    fireEvent.pointerDown(track);
    track.scrollLeft = 0;
    widths[0] = 145;
    observer().fire();
    expect(scrollLeft()).toBe(0);
  });

  it("follows the selection again after a scroll by hand", () => {
    const { track, rerender, scrollLeft } = renderStrip("upgrades");
    fireEvent.wheel(track);
    track.scrollLeft = 0;
    rerender(<Strip value="cosmetics" />);
    rerender(<Strip value="upgrades" />);
    expect(scrollLeft()).toBe(150);
  });

  it("scrolls a focused segment into view", () => {
    const { track, scrollLeft } = renderStrip("mine");
    expect(scrollLeft()).toBe(0);
    fireEvent.focusIn(screen.getByRole("tab", { name: "Account upgrades" }));
    expect(scrollLeft()).toBe(150);
    track.scrollLeft = 200;
    fireEvent.focusIn(screen.getByRole("tab", { name: "Packs" }));
    expect(scrollLeft()).toBe(110);
  });

  it("stops watching when it unmounts", () => {
    const { unmount } = renderStrip("upgrades");
    const watching = observer();
    unmount();
    expect(watching.disconnected).toBe(true);
  });

  it("watches nothing and never scrolls when it is not scrollable", () => {
    const view = render(<Strip value="packs" scrollable={false} />);
    const track = screen.getByRole("tablist", { name: "Sections" });
    const { scrollLeft } = layOut(track, [110, 80, 100, 160], 300);
    view.rerender(<Strip value="upgrades" scrollable={false} />);
    fireEvent.focusIn(screen.getByRole("tab", { name: "Account upgrades" }));
    expect(MockResizeObserver.instances).toHaveLength(0);
    expect(scrollLeft()).toBe(0);
  });
});
