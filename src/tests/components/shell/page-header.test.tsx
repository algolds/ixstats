import "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { PageHeader } from "~/components/shell/PageHeader";

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

let observerCallback: ObserverCallback | undefined;
let observerOptions: IntersectionObserverInit | undefined;
const originalObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  observerCallback = undefined;
  globalThis.IntersectionObserver = class {
    constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
      observerCallback = callback;
      observerOptions = options;
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

function scrollTitle(bottom: number, isIntersecting: boolean) {
  act(() => {
    observerCallback?.([
      {
        isIntersecting,
        boundingClientRect: { bottom } as DOMRectReadOnly,
        rootBounds: { top: 56 } as DOMRectReadOnly,
      },
    ]);
  });
}

describe("PageHeader", () => {
  it("collapses the large title into the toolbar once it scrolls under it", () => {
    const { container } = render(<PageHeader title="Help Center" />);
    const header = container.querySelector('[data-slot="page-header"]')!;
    const compact = container.querySelector('[data-slot="page-header-compact-title"]')!;
    expect(observerOptions?.rootMargin).toMatch(/^-\d+px 0px 0px 0px$/);
    expect(header).not.toHaveAttribute("data-collapsed");
    expect(compact.className).toContain("opacity-0");

    scrollTitle(20, false);
    expect(header).toHaveAttribute("data-collapsed");
    expect(compact.className).toContain("opacity-100");

    scrollTitle(200, true);
    expect(header).not.toHaveAttribute("data-collapsed");
  });

  it("does not collapse when the title is below the viewport", () => {
    const { container } = render(<PageHeader title="Help Center" />);
    scrollTitle(2000, false);
    expect(container.querySelector('[data-slot="page-header"]')).not.toHaveAttribute(
      "data-collapsed"
    );
  });
});

describe("PageHeader backdrop", () => {
  it("passes the collapsed state to a function as actions", () => {
    render(
      <PageHeader
        title="Pelaxia"
        actions={({ collapsed }) => (
          <button type="button">{collapsed ? "compact" : "expanded"}</button>
        )}
      />
    );
    expect(screen.getByRole("button", { name: "expanded" })).toBeInTheDocument();
    scrollTitle(20, false);
    expect(screen.getByRole("button", { name: "compact" })).toBeInTheDocument();
  });
});
