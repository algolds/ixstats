import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

let canUseMapEditor = false;
let betaTester = false;
const can = jest.fn((action: string, subject: string, field?: string) => {
  return action === "access" && subject === "MyCountryFeature" && field === "map-editor"
    ? canUseMapEditor
    : false;
});

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
jest.mock("~/components/providers/AbilityProvider", () => ({
  useAbility: () => ({ can, cannot: (...args: Parameters<typeof can>) => !can(...args) }),
}));
jest.mock("~/hooks/usePermissions", () => ({ useIsBetaTester: () => betaTester }));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: { name: "Pelaxia" } }),
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

beforeEach(() => {
  betaTester = false;
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

/** Premium users reach the map editor by opening the Edit pill. */
function openEditPill() {
  fireEvent.click(screen.getByRole("button", { name: "Edit country or map" }));
}

describe("MyCountry header Map editor action", () => {
  it("opens the Edit pill into country and map editors for premium users", () => {
    canUseMapEditor = true;
    renderBar();
    openEditPill();
    expect(screen.getByRole("link", { name: "Country editor" })).toHaveAttribute(
      "href",
      "/mycountry/editor#identity"
    );
    expect(screen.getByRole("link", { name: "Map editor" })).toHaveAttribute(
      "href",
      "/mycountry/map-editor"
    );
    expect(can).toHaveBeenCalledWith("access", "MyCountryFeature", "map-editor");
  });

  it("moves keyboard focus into the open pill and closes it on Escape", () => {
    canUseMapEditor = true;
    renderBar();
    openEditPill();
    expect(screen.getByRole("link", { name: "Country editor" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Edit country or map" })).toHaveFocus();
  });

  it("offers the map editor to a beta tester without premium", () => {
    canUseMapEditor = false;
    betaTester = true;
    renderBar();
    openEditPill();
    expect(screen.getByRole("link", { name: "Map editor" })).toHaveAttribute(
      "href",
      "/mycountry/map-editor"
    );
  });

  it("is a plain Edit link for everyone else", () => {
    canUseMapEditor = false;
    renderBar();
    expect(screen.queryByRole("button", { name: "Edit country or map" })).toBeNull();
    expect(screen.getByRole("link", { name: "Edit country" })).toHaveAttribute(
      "href",
      "/mycountry/editor#identity"
    );
    expect(screen.getByRole("link", { name: "Open public profile" })).toBeInTheDocument();
  });
});
