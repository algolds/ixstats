import React from "react";
import { hydrateRoot } from "react-dom/client";
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { Inspector } from "~/components/ui/inspector";

// A controllable viewport, so the real useMediaQuery runs (its first client read matters here).
const originalMatchMedia = window.matchMedia;
let listeners = new Set<(event: { matches: boolean }) => void>();
let viewportWide = false;

function installMatchMedia(wide: boolean) {
  viewportWide = wide;
  listeners = new Set();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === "(min-width: 1280px)" ? viewportWide : false;
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

function resizeTo(wide: boolean) {
  viewportWide = wide;
  act(() => listeners.forEach((fn) => fn({ matches: wide })));
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

let mounts = 0;
function Probe() {
  React.useEffect(() => {
    mounts += 1;
    return () => {
      mounts -= 1;
    };
  }, []);
  return <span>probe</span>;
}

describe("Inspector", () => {
  it("is in the server HTML as a CSS-gated aside, so it never pops in after hydration", () => {
    const html = renderToString(
      <Inspector title="Contents" open={false} onOpenChange={() => {}}>
        <span>toc</span>
      </Inspector>
    );
    expect(html).toMatch(
      /<aside[^>]*aria-label="Contents"[^>]*class="[^"]*\bhidden\b[^"]*\bxl:block\b/
    );
    expect(html).toContain("toc");
  });

  it("mounts its children once: in the aside while wide, in the sheet only while it is open below xl", () => {
    installMatchMedia(true);
    mounts = 0;
    const wideRender = render(
      <Inspector title="Contents" open={false} onOpenChange={() => {}}>
        <Probe />
      </Inspector>
    );
    expect(mounts).toBe(1);
    wideRender.unmount();

    installMatchMedia(false);
    mounts = 0;
    const { rerender } = render(
      <Inspector title="Contents" open={false} onOpenChange={() => {}}>
        <Probe />
      </Inspector>
    );
    // Narrow and closed: nothing mounted, so a phone fetches nothing for a hidden column.
    expect(mounts).toBe(0);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <Inspector title="Contents" open onOpenChange={() => {}}>
        <Probe />
      </Inspector>
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("probe");
    expect(screen.getAllByText("probe")).toHaveLength(1);
    expect(mounts).toBe(1);
  });

  it("never has its children mounted in the aside and the sheet at once, including while the sheet closes", () => {
    installMatchMedia(false);
    let peak = 0;
    let live = 0;
    function Counting() {
      React.useEffect(() => {
        live += 1;
        peak = Math.max(peak, live);
        return () => {
          live -= 1;
        };
      }, []);
      return <span>counting</span>;
    }
    const { rerender } = render(
      <Inspector title="Contents" open onOpenChange={() => {}}>
        <Counting />
      </Inspector>
    );
    rerender(
      <Inspector title="Contents" open={false} onOpenChange={() => {}}>
        <Counting />
      </Inspector>
    );
    expect(peak).toBe(1);
    expect(document.querySelector('[data-slot="inspector"]')).toBeEmptyDOMElement();
  });

  it("keeps the aside's content from the server HTML while hydrating a wide viewport, with no remount", () => {
    installMatchMedia(true);
    const tree = (
      <Inspector title="Contents" open onOpenChange={() => {}}>
        <Probe />
      </Inspector>
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToString(tree);
    mounts = 0;
    let root!: ReturnType<typeof hydrateRoot>;
    act(() => {
      root = hydrateRoot(container, tree);
    });
    expect(container.querySelector('[data-slot="inspector"]')).toHaveTextContent("probe");
    expect(mounts).toBe(1);
    act(() => root.unmount());
    container.remove();
  });

  it("asks its owner to close the sheet when the viewport grows to xl", () => {
    installMatchMedia(false);
    const onOpenChange = jest.fn();
    render(
      <Inspector title="Contents" open onOpenChange={onOpenChange}>
        toc
      </Inspector>
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    resizeTo(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not touch the owner's state when it starts wide or the sheet is closed", () => {
    const onOpenChange = jest.fn();
    installMatchMedia(true);
    render(
      <Inspector title="Contents" open onOpenChange={onOpenChange}>
        toc
      </Inspector>
    );
    expect(onOpenChange).not.toHaveBeenCalled();

    installMatchMedia(false);
    render(
      <Inspector title="Other" open={false} onOpenChange={onOpenChange}>
        toc
      </Inspector>
    );
    resizeTo(true);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not read hydration (server snapshot, then the real wide viewport) as a crossing", () => {
    installMatchMedia(true);
    const onOpenChange = jest.fn();
    const tree = (
      <Inspector title="Contents" open onOpenChange={onOpenChange}>
        toc
      </Inspector>
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToString(tree);
    let root!: ReturnType<typeof hydrateRoot>;
    act(() => {
      root = hydrateRoot(container, tree);
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });

  it("leaves the sheet's state alone on widening when resetSheetOnWiden is false", () => {
    installMatchMedia(false);
    const onOpenChange = jest.fn();
    render(
      <Inspector title="Contents" open onOpenChange={onOpenChange} resetSheetOnWiden={false}>
        toc
      </Inspector>
    );
    resizeTo(true);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(document.querySelector('[data-slot="inspector"]')).toHaveTextContent("toc");
  });
});
