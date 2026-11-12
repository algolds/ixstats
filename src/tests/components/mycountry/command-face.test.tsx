/**
 * The MyCountry command face: the ribbon is the app's section navigation (Defense only for
 * premium players), the territory map leads the face with the monogram and a way to draw the
 * territory when there is none, and the command bar's one Declare Directive button.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/dynamic", () => ({
  __esModule: true,
  // The map embed has no geometry in these tests: it shows the fallback it is handed.
  default: () =>
    function CountryMapEmbedStub({ emptyFallback }: { emptyFallback?: React.ReactNode }) {
      return <>{emptyFallback}</>;
    },
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: { children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: { id: "c1", name: "Caphiria", slug: "caphiria" } }),
}));
jest.mock("~/components/providers/AbilityProvider", () => ({
  useAbility: () => ({ can: () => false, cannot: () => true }),
}));
jest.mock("~/hooks/usePermissions", () => ({ useIsBetaTester: () => false }));

import { CommandMedia } from "~/components/mycountry/shell/face/CommandMedia";
import {
  CommandActions,
  UnifiedGlassCommandBar,
} from "~/components/mycountry/shell/headers/UnifiedGlassCommandBar";
import {
  MYCOUNTRY_TABS,
  tabForSection,
  visibleTabs,
} from "~/components/mycountry/shell/mycountry-tabs";

beforeAll(() => {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly scrollMargin = "0px";
    readonly thresholds = [0];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver = MockIntersectionObserver;
});

describe("the command ribbon's sections", () => {
  it("lists the sidebar's old sections in the same order", () => {
    expect(MYCOUNTRY_TABS.map((t) => t.label)).toEqual([
      "Overview",
      "Directives",
      "Economy",
      "Diplomacy",
      "Politics",
      "Defense",
    ]);
  });

  it("shows Defense only to premium players and beta testers", () => {
    expect(visibleTabs(false).map((t) => t.id)).not.toContain("defense");
    expect(visibleTabs(true).map((t) => t.id)).toContain("defense");
  });

  it("keeps Defense highlighted on the Intelligence address, and Overview for the rest", () => {
    expect(tabForSection("intelligence")).toBe("defense");
    expect(tabForSection("economy")).toBe("economy");
    expect(tabForSection("map-editor")).toBe("overview");
  });
});

describe("the command face's territory stage", () => {
  it("shows the MyCountry monogram and a way to draw the territory when there is none", () => {
    const { container } = render(<CommandMedia countryId="c1" insetRight={0} />);
    expect(container.querySelector('[data-slot="command-media-empty"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: /Draw your territory/ })).toHaveAttribute(
      "href",
      "/mycountry/map-editor"
    );
  });

  it("keeps the owner's two map tools on the stage", () => {
    render(<CommandMedia countryId="c1" insetRight={0} />);
    expect(screen.getByRole("link", { name: "Edit territory" })).toHaveAttribute(
      "href",
      "/mycountry/map-editor"
    );
    expect(screen.getByRole("link", { name: "Open world maps" })).toHaveAttribute("href", "/maps");
  });
});

describe("the command bar and ribbon actions", () => {
  it("has one Declare Directive button on the ribbon actions, which declares", () => {
    const onDeclare = jest.fn();
    render(<CommandActions section="economy" onDeclare={onDeclare} />);
    const declare = screen.getAllByRole("button", { name: /Declare Directive/ });
    expect(declare).toHaveLength(1);
    expect(declare[0]).toHaveAttribute("title", expect.stringMatching(/economy/i));
    fireEvent.click(declare[0]!);
    expect(onDeclare).toHaveBeenCalledTimes(1);
  });

  it("stays zero-height and unmounted while the command face title is on screen", () => {
    render(<UnifiedGlassCommandBar section="overview" collapseOn={null} />);
    expect(screen.queryByRole("button", { name: /Declare Directive/ })).toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("leaves the page's one h1 to the command face when standalone", () => {
    render(<UnifiedGlassCommandBar section="overview" />);
    expect(screen.getAllByRole("button", { name: /Declare Directive/ })).toHaveLength(1);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});
