import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { BottomDock, DockSpacer } from "~/components/thinkpages-forum/shell";

const VAR = "--forum-dock-height";

/** A ResizeObserver the test drives: `fire()` runs the callback as the browser does when the dock changes size. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  disconnected = false;
  constructor(private readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.callback();
  }
}

const originalObserver = globalThis.ResizeObserver;
let height = 190;
const originalRect = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  height = 190;
  FakeResizeObserver.instances = [];
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = function rect() {
    return {
      height,
      width: 300,
      top: 0,
      left: 0,
      right: 300,
      bottom: height,
      x: 0,
      y: 0,
    } as DOMRect;
  };
});

afterEach(() => {
  globalThis.ResizeObserver = originalObserver;
  HTMLElement.prototype.getBoundingClientRect = originalRect;
  document.documentElement.style.removeProperty(VAR);
});

const dockVar = () => document.documentElement.style.getPropertyValue(VAR);

describe("BottomDock", () => {
  it("sits fixed above the tab bar, on the shell's own offset, only while docked", () => {
    const { container, rerender } = render(
      <BottomDock docked slot="board-dock">
        <p>Composer</p>
      </BottomDock>
    );
    const dock = container.querySelector('[data-slot="board-dock"]')!;
    expect(dock).toHaveClass("fixed");
    expect(dock.className).toContain("var(--shell-tabbar-height)");

    rerender(
      <BottomDock docked={false} slot="board-dock">
        <p>Composer</p>
      </BottomDock>
    );
    expect(container.querySelector('[data-slot="board-dock"]')).toBeNull();
    expect(container.firstElementChild).toHaveClass("contents");
  });

  it("reports its real height, follows it as the dock grows, and lets go when undocked", () => {
    const { rerender } = render(
      <BottomDock docked slot="board-dock">
        <p>Composer</p>
      </BottomDock>
    );
    expect(dockVar()).toBe("190px");

    // A reply chip, a persona row or an error Signal makes the dock taller.
    height = 262.4;
    act(() => FakeResizeObserver.instances[0]!.fire());
    expect(dockVar()).toBe("263px");

    rerender(
      <BottomDock docked={false} slot="board-dock">
        <p>Composer</p>
      </BottomDock>
    );
    expect(dockVar()).toBe("");
    expect(FakeResizeObserver.instances[0]!.disconnected).toBe(true);
  });

  it("measures once and does not observe where there is no ResizeObserver", () => {
    // @ts-expect-error a browser without ResizeObserver (a test DOM)
    delete globalThis.ResizeObserver;
    render(
      <BottomDock docked slot="reply-dock">
        <p>Reply</p>
      </BottomDock>
    );
    expect(dockVar()).toBe("190px");
  });

  it("keeps what is inside it, a draft included, when it docks and undocks", () => {
    function Host() {
      const [docked, setDocked] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setDocked((d) => !d)}>
            flip
          </button>
          <BottomDock docked={docked} slot="board-dock">
            <textarea aria-label="Draft" />
          </BottomDock>
        </>
      );
    }
    render(<Host />);
    const draft = screen.getByLabelText("Draft");
    fireEvent.change(draft, { target: { value: "half a message" } });

    fireEvent.click(screen.getByText("flip"));
    expect(screen.getByLabelText("Draft")).toBe(draft);
    expect(draft).toHaveValue("half a message");

    fireEvent.click(screen.getByText("flip"));
    expect(screen.getByLabelText("Draft")).toBe(draft);
    expect(draft).toHaveValue("half a message");
  });
});

describe("DockSpacer", () => {
  it("is as tall as the dock now, plus a gap, and a default before it is measured", () => {
    const { container } = render(<DockSpacer />);
    const spacer = container.querySelector('[data-slot="dock-spacer"]') as HTMLElement;
    expect(spacer).toHaveAttribute("aria-hidden", "true");
    expect(spacer.style.height).toBe("calc(var(--forum-dock-height, 10rem) + 1rem)");
  });
});
