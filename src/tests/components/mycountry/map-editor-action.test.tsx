import React from "react";
import { render, screen } from "@testing-library/react";

let canUseMapEditor = false;
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
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: { name: "Pelaxia" } }),
}));
jest.mock("~/components/mycountry/shell/ExecutiveHome", () => ({ CooldownTimer: () => null }));

import { UnifiedGlassCommandBar } from "~/components/mycountry/shell/headers/UnifiedGlassCommandBar";

function renderBar() {
  return render(<UnifiedGlassCommandBar mode="home" onChangeMode={() => undefined} />);
}

beforeEach(() => {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

describe("MyCountry header Map editor action", () => {
  it("links to the map editor for users who pass the premium map-editor ability", () => {
    canUseMapEditor = true;
    renderBar();
    expect(screen.getByRole("link", { name: "Open map editor" })).toHaveAttribute(
      "href",
      "/mycountry/map-editor"
    );
    expect(can).toHaveBeenCalledWith("access", "MyCountryFeature", "map-editor");
  });

  it("is absent for everyone else", () => {
    canUseMapEditor = false;
    renderBar();
    expect(screen.queryByRole("link", { name: "Open map editor" })).toBeNull();
    // The other header actions are unaffected.
    expect(screen.getByRole("link", { name: "Open public profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit country" })).toBeInTheDocument();
  });
});
