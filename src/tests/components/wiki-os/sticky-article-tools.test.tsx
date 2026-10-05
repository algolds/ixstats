/**
 * Long articles keep the article views and page tools in reach: the tabs row is sticky under the
 * shell's Halo band (`--shell-top-offset`), below the page header's own sticky toolbar so the two
 * never overlap, and it takes chrome (a floating pill) only while it is actually stuck.
 */
import { act, render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ usePathname: () => "/wiki/Aurelia" }));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import { WikiOSContentWrapper } from "~/components/wiki-os/shared/WikiOSContentWrapper";

type Entry = Partial<IntersectionObserverEntry>;
let observe: ((entries: Entry[]) => void) | undefined;
let options: IntersectionObserverInit | undefined;
const originalObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  observe = undefined;
  globalThis.IntersectionObserver = class {
    constructor(cb: (entries: Entry[]) => void, opts?: IntersectionObserverInit) {
      observe = cb;
      options = opts;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  globalThis.IntersectionObserver = originalObserver;
});

const tabs = <div role="tablist">tabs</div>;
const rowOf = (el: HTMLElement) => el.closest("[data-slot='wiki-article-tools']") as HTMLElement;
const surfaceOf = (row: HTMLElement) =>
  row.querySelector("[data-slot='wiki-article-tools-surface']") as HTMLElement;

function setStuck(stuck: boolean) {
  act(() => {
    observe?.([
      {
        isIntersecting: !stuck,
        boundingClientRect: { bottom: stuck ? 10 : 400 } as DOMRectReadOnly,
        rootBounds: { top: 72 } as DOMRectReadOnly,
      },
    ]);
  });
}

describe("WikiOS article tools row", () => {
  it.each([
    ["with a page header", "Aurelia"],
    ["without one", undefined],
  ])("is sticky under the shell top offset, in the raised layer %s", (_label, title) => {
    render(
      <WikiOSContentWrapper title={title} tabs={tabs} actions={<button>New page</button>}>
        <p>body</p>
      </WikiOSContentWrapper>
    );
    const row = rowOf(screen.getByRole("tablist"));
    expect(row).toHaveClass("sticky", "top-(--shell-top-offset)", "z-raised", "px-2");
    // Below the page header's z-sticky toolbar, so the compact title always paints above it.
    expect(row).not.toHaveClass("z-sticky");
  });

  it("is a plain row at rest and a chrome pill only while stuck, toggling data-stuck", () => {
    render(
      <WikiOSContentWrapper title="Aurelia" tabs={tabs}>
        <p>body</p>
      </WikiOSContentWrapper>
    );
    const row = rowOf(screen.getByRole("tablist"));
    expect(options?.rootMargin).toMatch(/^-\d+px 0px 0px 0px$/);
    expect(row).not.toHaveAttribute("data-stuck");
    expect(surfaceOf(row)).not.toHaveClass("facet-chrome");

    setStuck(true);
    expect(row).toHaveAttribute("data-stuck");
    expect(surfaceOf(row)).toHaveClass("facet-chrome", "rounded-card");

    setStuck(false);
    expect(row).not.toHaveAttribute("data-stuck");
    expect(surfaceOf(row)).not.toHaveClass("facet-chrome");
  });

  it("keeps the sticky row a direct child of main, so nothing short wraps it", () => {
    const { container } = render(
      <WikiOSContentWrapper tabs={tabs} actions={<button>New page</button>}>
        <p>body</p>
      </WikiOSContentWrapper>
    );
    const row = rowOf(screen.getByRole("tablist"));
    expect(row.parentElement).toBe(container.querySelector("main"));
  });

  it("renders no tools row without tabs", () => {
    const { container } = render(
      <WikiOSContentWrapper title="Aurelia">
        <p>body</p>
      </WikiOSContentWrapper>
    );
    expect(container.querySelector("[data-slot='wiki-article-tools']")).toBeNull();
  });
});
