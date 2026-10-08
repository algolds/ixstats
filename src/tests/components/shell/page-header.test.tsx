import React from "react";
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
  it("renders the large title as the page heading, with subtitle, back and actions", () => {
    render(
      <PageHeader
        title="Help Center"
        subtitle="Plain guides"
        back={{ href: "/dashboard", label: "Home" }}
        actions={<button type="button">Contact</button>}
      />
    );
    const heading = screen.getByRole("heading", { level: 1, name: "Help Center" });
    expect(heading.className).toContain("text-large-title");
    expect(screen.getByText("Plain guides")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("button", { name: "Contact" })).toBeInTheDocument();
    // One heading: the compact toolbar title is a hidden visual copy.
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

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

  it("keeps a toolbar band without actions, so the large title starts clear of Halo", () => {
    const { container } = render(<PageHeader title="Help center" />);
    expect(container.querySelector('[data-slot="page-header-toolbar"]')).toHaveClass("h-14");
  });

  it("keeps the toolbar sticky at the shell's header offset", () => {
    const { container } = render(<PageHeader title="Help Center" />);
    const toolbar = container.querySelector('[data-slot="page-header-toolbar"]')!;
    expect(toolbar.className).toContain("sticky");
    expect(toolbar.className).toContain("top-(--shell-header-top)");
  });
});

describe("PageHeader backdrop", () => {
  it("renders the backdrop behind the expanded header only, clipped to the header box", () => {
    const { container } = render(
      <PageHeader
        title="Pelaxia"
        actions={<button type="button">Go</button>}
        backdrop={<img alt="" src="/banner.png" />}
      />
    );
    const backdrop = container.querySelector('[data-slot="page-header-backdrop"]')!;
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop.className).toContain("overflow-hidden");
    expect(backdrop.className).toContain("rounded-card");
    expect(backdrop.querySelector("img")).toHaveAttribute("src", "/banner.png");
    expect(container.querySelector('[data-slot="page-header-toolbar"]')!.contains(backdrop)).toBe(
      false
    );
  });

  it("does not create a stacking context that would trap the sticky toolbar", () => {
    const { container } = render(
      <PageHeader title="Pelaxia" actions={<button type="button">Go</button>} backdrop={<i />} />
    );
    const header = container.querySelector('[data-slot="page-header"]')!;
    expect(header.className).not.toMatch(/\bisolate\b|\bz-/);
    expect(container.querySelector('[data-slot="page-header-toolbar"]')!.className).toContain(
      "z-sticky"
    );
    expect(container.querySelector('[data-slot="page-header-backdrop"]')!.className).toContain(
      "z-base"
    );
  });

  it("lifts the expanded block above the backdrop, and the sticky toolbar is not inside it", () => {
    const { container } = render(
      <PageHeader title="Pelaxia" actions={<button type="button">Go</button>} backdrop={<i />} />
    );
    const expanded = container.querySelector('[data-slot="page-header-plate"]')!.parentElement!;
    expect(expanded.className).toContain("z-raised");
    expect(expanded.className).not.toContain("z-sticky");
    const toolbar = container.querySelector('[data-slot="page-header-toolbar"]')!;
    expect(expanded.contains(toolbar)).toBe(false);
    expect(toolbar.contains(expanded)).toBe(false);
  });

  it("keeps the backdrop layout but drops the title plate while the art is not visible", () => {
    const { container } = render(
      <PageHeader title="Pelaxia" backdrop={<i />} backdropVisible={false} />
    );
    const plate = container.querySelector('[data-slot="page-header-plate"]')!;
    expect(plate.className).not.toMatch(/bg-grouped/);
    expect(plate.parentElement!.className).toContain("z-raised");
  });

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

  it("is unchanged without a backdrop", () => {
    const { container } = render(<PageHeader title="Help" />);
    expect(container.querySelector('[data-slot="page-header-backdrop"]')).toBeNull();
  });

  it("bleeds by its own inner gutter only when asked", () => {
    const { container, rerender } = render(<PageHeader title="Plain" />);
    const header = () => container.querySelector("header")!;
    expect(header()).not.toHaveClass("-mx-2");
    rerender(<PageHeader title="Plain" bleed />);
    expect(header()).toHaveClass("-mx-2");
  });
});
