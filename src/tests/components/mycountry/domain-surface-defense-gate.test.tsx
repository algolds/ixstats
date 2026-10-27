import React from "react";
import { render, screen } from "@testing-library/react";

let premiumAbility = false;
let betaTester = false;

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const Stub = () => <div data-testid="defense-panel" />;
    return Stub;
  },
}));
jest.mock("~/components/providers/AbilityProvider", () => ({
  useAbility: () => ({
    can: (action: string, subject: string) =>
      premiumAbility && action === "access" && subject === "MyCountryFeature",
  }),
}));
jest.mock("~/hooks/usePermissions", () => ({ useIsBetaTester: () => betaTester }));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  PremiumPreviewFrame: ({ locked, children }: { locked: boolean; children: React.ReactNode }) => (
    <div data-testid="premium-frame" data-locked={String(locked)}>
      {children}
    </div>
  ),
}));
jest.mock("~/components/mycountry/shell/PoliticsDrillDown", () => ({
  PoliticsDrillDown: () => null,
}));
jest.mock("~/components/mycountry/shell/EconomyDrillDown", () => ({
  EconomyDrillDown: () => null,
}));
jest.mock("~/components/mycountry/shell/DomainContextRail", () => ({
  DomainContextRail: () => null,
}));

import { DomainSurface } from "~/components/mycountry/shell/DomainSurface";

const locked = () => screen.getByTestId("premium-frame").getAttribute("data-locked");

beforeEach(() => {
  premiumAbility = false;
  betaTester = false;
});

describe("DomainSurface Defense lock", () => {
  it("locks Defense for a plain user", () => {
    render(<DomainSurface countryId="c1" section="defense" />);
    expect(locked()).toBe("true");
  });

  it("unlocks Defense for a premium user", () => {
    premiumAbility = true;
    render(<DomainSurface countryId="c1" section="defense" />);
    expect(locked()).toBe("false");
  });

  it("unlocks Defense for a beta tester without premium", () => {
    betaTester = true;
    render(<DomainSurface countryId="c1" section="defense" />);
    expect(locked()).toBe("false");
  });
});
