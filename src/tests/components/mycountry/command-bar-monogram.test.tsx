import React from "react";
import { fireEvent, render } from "@testing-library/react";

const mockUseCountryData = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    intent: { getStatus: { useQuery: () => ({ data: undefined }) } },
  },
}));
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
jest.mock("~/components/providers/AbilityProvider", () => ({
  useAbility: () => ({ can: () => false, cannot: () => true }),
}));
jest.mock("~/hooks/usePermissions", () => ({ useIsBetaTester: () => false }));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => mockUseCountryData(),
}));
jest.mock("~/components/achievements/FloatingRibbonRack", () => ({
  CountryOwnerRibbonRack: () => null,
}));
jest.mock("~/components/country-profile/CountryIdentityStrip", () => ({
  CountryIdentityStrip: () => null,
}));
jest.mock("~/components/realms/NationDateLine", () => ({
  NationDateLine: () => null,
}));

import { UnifiedGlassCommandBar } from "~/components/mycountry/shell/headers/UnifiedGlassCommandBar";

describe("UnifiedGlassCommandBar monogram fallback", () => {
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

  it("shows the MyCountry monogram behind the title when the country has no flag", () => {
    mockUseCountryData.mockReturnValue({
      country: { name: "Caphiria", flagUrl: null },
    });
    const { container } = render(
      <UnifiedGlassCommandBar mode="home" onChangeMode={() => undefined} />
    );
    expect(container.querySelector('[data-slot="monogram-banner"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="page-header-plate"]')).toHaveAttribute(
      "data-layer",
      "lens"
    );
  });

  it("falls back to the monogram when the flag fails to load", () => {
    mockUseCountryData.mockReturnValue({
      country: { name: "Caphiria", flagUrl: "/flags/caphiria.png" },
    });
    const { container } = render(
      <UnifiedGlassCommandBar mode="home" onChangeMode={() => undefined} />
    );
    const bannerImg = container.querySelector('[data-slot="page-header-backdrop"] img');
    expect(bannerImg).not.toBeNull();
    fireEvent.error(bannerImg!);
    expect(container.querySelector('[data-slot="monogram-banner"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="page-header-plate"]')).toHaveAttribute(
      "data-layer",
      "lens"
    );
  });
});

