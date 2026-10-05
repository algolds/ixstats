import React from "react";
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

  it("mounts its children once: in the aside while closed, in the sheet only while it is open below xl", () => {
    installMatchMedia(false);
    mounts = 0;
    const { rerender } = render(
      <Inspector title="Contents" open={false} onOpenChange={() => {}}>
        <Probe />
      </Inspector>
    );
    expect(mounts).toBe(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <Inspector title="Contents" open onOpenChange={() => {}}>
        <Probe />
      </Inspector>
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("probe");
    expect(screen.getAllByText("probe")).toHaveLength(1);
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
});
