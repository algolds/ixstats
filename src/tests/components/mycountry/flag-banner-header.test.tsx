import React from "react";
import fs from "fs";
import path from "path";
import { render, screen, act, fireEvent } from "@testing-library/react";

let observerCallback: ((entries: Partial<IntersectionObserverEntry>[]) => void) | undefined;
const originalObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  observerCallback = undefined;
  globalThis.IntersectionObserver = class {
    constructor(callback: typeof observerCallback) {
      observerCallback = callback;
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

let mockCountry: Record<string, unknown> | null = null;

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: { children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
jest.mock("~/trpc/react", () => ({
  api: { intent: { getStatus: { useQuery: () => ({ data: undefined }) } } },
}));
jest.mock("~/hooks/useHasMycountryPremium", () => ({ useHasMycountryPremium: () => false }));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: mockCountry }),
}));
jest.mock("~/components/achievements/FloatingRibbonRack", () => ({
  CountryOwnerRibbonRack: () => null,
}));
jest.mock("~/components/country-profile/CountryIdentityStrip", () => ({
  CountryIdentityStrip: () => null,
}));

import { UnifiedGlassCommandBar } from "~/components/mycountry/shell/headers/UnifiedGlassCommandBar";

function renderBar() {
  return render(<UnifiedGlassCommandBar mode="home" onChangeMode={() => undefined} />);
}

/** The cover art; the flag tile beside the title is a second image. */
function bannerImg(container: HTMLElement) {
  return container.querySelector('[data-slot="page-header-backdrop"] img');
}

function scrollTitleUnderToolbar() {
  act(() => {
    observerCallback?.([
      {
        isIntersecting: false,
        boundingClientRect: { bottom: 10 } as DOMRectReadOnly,
        rootBounds: { top: 56 } as DOMRectReadOnly,
      },
    ]);
  });
}

describe("MyCountry header flag banner", () => {
  beforeEach(() => {
    mockCountry = { name: "Pelaxia", flagUrl: "https://example.test/flags/pelaxia.svg" };
  });

  it("renders the flag as cover art that fades into the canvas, with no scrim over it", () => {
    const { container } = renderBar();
    const backdrop = container.querySelector('[data-slot="page-header-backdrop"]');
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveAttribute("aria-hidden", "true");

    const img = backdrop!.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.test/flags/pelaxia.svg");
    expect(img).toHaveAttribute("alt", "");
    expect(img!.className).toContain("object-cover");

    // The flag stays vivid: its edges are masked into the canvas, with no scrim over the art.
    expect(img!.className).toContain("mask-b-from-30%");
    expect(backdrop!.querySelectorAll("div")).toHaveLength(0);
    expect(img!.className).toContain("object-[center_35%]");
  });

  it("keeps the banner out of the compact sticky bar", () => {
    const { container } = renderBar();
    const toolbar = container.querySelector('[data-slot="page-header-toolbar"]')!;
    expect(toolbar.querySelector("img")).toBeNull();
    expect(toolbar.querySelector('[data-slot="page-header-backdrop"]')).toBeNull();
  });

  it("fades the banner out when the header collapses", () => {
    const { container } = renderBar();
    const backdrop = container.querySelector('[data-slot="page-header-backdrop"]')!;
    expect(backdrop.className).toContain("opacity-100");
    scrollTitleUnderToolbar();
    expect(backdrop.className).toContain("opacity-0");
  });

  it("renders no image when the country has no flag, with the same header padding", () => {
    const { container: withFlag } = renderBar();
    const flagged = withFlag.querySelector('[data-slot="page-header-plate"]')!.parentElement!
      .className;
    mockCountry = { name: "Pelaxia" };
    const { container } = renderBar();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1, name: "Pelaxia" }).length).toBeGreaterThan(0);
    expect(
      container.querySelector('[data-slot="page-header-plate"]')!.parentElement!.className
    ).toBe(flagged);
  });

  it("puts the title, motto and government on a page-background plate, opaque when transparency is reduced", () => {
    mockCountry = {
      name: "Pelaxia",
      leader: "Ana",
      economicTier: "ADVANCED",
      governmentType: "CONSTITUTIONAL_MONARCHY",
      nationalIdentity: { motto: "Ever onward" },
      flagUrl: "https://example.test/f.svg",
    };
    const { container } = renderBar();
    const plate = container.querySelector('[data-slot="page-header-plate"]')!;
    expect(plate.contains(screen.getByRole("heading", { level: 1, name: "Pelaxia" }))).toBe(true);
    expect(plate.textContent).toContain("Ever onward");
    expect(plate.textContent).toContain("Constitutional monarchy");
    // The leader and economic tier are not part of the header.
    expect(plate.textContent).not.toContain("Ana");
    expect(plate.textContent).not.toMatch(/advanced/i);
    expect(plate.className).toMatch(/\bbg-grouped\/90\b/);
    expect(plate.className).toContain("transparency-reduced:bg-grouped");
    expect(plate.className).toContain("contrast-more:bg-grouped");
    expect(plate.className).toContain("rounded-card");
  });

  it("gives the ghost actions their own pill plate; Declare Directive stays filled", () => {
    const { container } = renderBar();
    for (const name of ["Open public profile", "Edit country"]) {
      const action = container.querySelector(`[aria-label="${name}"]`)!;
      expect(action.className).toMatch(/\bbg-grouped\/90\b/);
      expect(action.className).toContain("transparency-reduced:bg-grouped");
      expect(action.className).toContain("rounded-full");
      expect(action.className).not.toContain("bg-transparent");
    }
    const declare = screen.getByRole("button", { name: "Declare Directive" });
    expect(declare.className).toContain("bg-primary-fill");
  });

  it("drops the title plate and the action pills when there is no flag", () => {
    mockCountry = { name: "Pelaxia" };
    const { container } = renderBar();
    expect(container.querySelector('[data-slot="page-header-plate"]')!.className).not.toMatch(
      /bg-grouped/
    );
    for (const name of ["Open public profile", "Edit country"]) {
      const action = container.querySelector(`[aria-label="${name}"]`)!;
      expect(action.className).not.toMatch(/bg-grouped/);
      expect(action.className).not.toContain("rounded-full");
    }
  });

  it("drops the plates once the flag image fails, and brings them back for a new flag", () => {
    const { container, rerender } = renderBar();
    const plate = () => container.querySelector('[data-slot="page-header-plate"]')!;
    expect(plate().className).toMatch(/bg-grouped/);
    fireEvent.error(bannerImg(container)!);
    expect(plate().className).not.toMatch(/bg-grouped/);
    expect(container.querySelector('[aria-label="Edit country"]')!.className).not.toMatch(
      /bg-grouped/
    );
    mockCountry = { name: "Pelaxia", flagUrl: "https://example.test/flags/new.svg" };
    rerender(<UnifiedGlassCommandBar mode="home" onChangeMode={() => undefined} />);
    expect(plate().className).toMatch(/bg-grouped/);
  });

  it("uses plain ghost actions in the compact sticky bar, pills again when expanded", () => {
    const { container } = renderBar();
    const edit = () => container.querySelector('[aria-label="Edit country"]')!;
    expect(edit().className).toMatch(/bg-grouped\/90/);
    scrollTitleUnderToolbar();
    expect(edit().className).not.toMatch(/bg-grouped/);
    expect(edit().className).not.toContain("rounded-full");
    expect(edit().className).toContain("text-label-secondary");
  });

  it("resets a failed flag load when the flag changes", () => {
    const { container, rerender } = renderBar();
    fireEvent.error(bannerImg(container)!);
    expect(bannerImg(container)).toBeNull();
    mockCountry = { name: "Pelaxia", flagUrl: "https://example.test/flags/new.svg" };
    rerender(<UnifiedGlassCommandBar mode="home" onChangeMode={() => undefined} />);
    expect(bannerImg(container)).toHaveAttribute("src", "https://example.test/flags/new.svg");
  });
});

describe("ExecutiveOpportunityHero", () => {
  it("no longer draws the flag watermark (the header banner is the identity art)", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../../components/mycountry/shell/ExecutiveOpportunityHero.tsx"),
      "utf-8"
    );
    expect(source).not.toMatch(/FlagWatermark/);
  });
});
