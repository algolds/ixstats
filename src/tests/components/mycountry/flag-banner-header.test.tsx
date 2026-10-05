import React from "react";
import fs from "fs";
import path from "path";
import { render, screen, act } from "@testing-library/react";

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
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("~/trpc/react", () => ({
  api: { intent: { getStatus: { useQuery: () => ({ data: undefined }) } } },
}));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: mockCountry }),
}));
jest.mock("~/components/mycountry/shell/ExecutiveHome", () => ({ CooldownTimer: () => null }));

import { UnifiedGlassCommandBar } from "~/components/mycountry/shell/headers/UnifiedGlassCommandBar";

function renderBar() {
  return render(<UnifiedGlassCommandBar mode="home" onChangeMode={() => undefined} />);
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

  it("renders the flag as a cover image behind the header, with a scrim over it", () => {
    const { container } = renderBar();
    const backdrop = container.querySelector('[data-slot="page-header-backdrop"]');
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveAttribute("aria-hidden", "true");

    const img = backdrop!.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.test/flags/pelaxia.svg");
    expect(img).toHaveAttribute("alt", "");
    expect(img!.className).toContain("object-cover");

    const scrim = backdrop!.querySelector('[data-slot="flag-banner-scrim"]');
    expect(scrim).not.toBeNull();
    expect(scrim!.className).toContain("shell-banner-scrim");
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

  it("renders no banner when the country has no flag", () => {
    mockCountry = { name: "Pelaxia" };
    const { container } = renderBar();
    expect(container.querySelector('[data-slot="page-header-backdrop"]')).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Pelaxia" })).toBeInTheDocument();
  });

  it("keeps Declare Directive and the title readable (still rendered in the header)", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Declare Directive" })).toBeInTheDocument();
  });
});

describe("flag banner scrim CSS", () => {
  const css = fs
    .readFileSync(path.resolve(__dirname, "../../../styles/facet/shell.css"), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("uses colour roles only, never a hex value", () => {
    const rule = css.match(/\.shell-banner-scrim \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain("var(--color-background-grouped)");
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("is effectively opaque under Reduce Transparency and Increase Contrast", () => {
    expect(css).toMatch(
      /prefers-reduced-transparency: reduce\) \{[^}]*\.shell-banner-scrim \{[^}]*--scrim-text: 100%;[^}]*--scrim-bar: 100%;/
    );
    expect(css).toMatch(
      /prefers-contrast: more\) \{[^}]*\.shell-banner-scrim \{[^}]*--scrim-text: 100%;[^}]*--scrim-bar: 100%;/
    );
    expect(css).toMatch(
      /\[data-transparency="reduced"\][^{]*\.shell-banner-scrim \{[^}]*--scrim-text: 100%;/
    );
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
