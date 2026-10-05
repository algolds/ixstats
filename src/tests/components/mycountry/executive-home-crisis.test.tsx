import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock("~/trpc/react", () => ({
  api: { mycountry: { getCanonFeed: { useQuery: () => ({ data: [], isLoading: false }) } } },
}));
// A function declaration, so it is hoisted above the (hoisted) mock factories.
function stub(name: string) {
  return () => <div data-testid={name} />;
}
jest.mock("~/components/mycountry/shell/CrisisSignal", () => ({ CrisisSignal: stub("crisis") }));
jest.mock("~/components/mycountry/shell/ExecutiveOpportunityHero", () => ({
  ExecutiveOpportunityHero: stub("hero"),
}));
jest.mock("~/components/mycountry/shell/ExecutiveAgenda", () => ({
  ExecutiveAgenda: stub("agenda"),
}));
jest.mock("~/components/mycountry/shell/StandingBands", () => ({ StandingBands: stub("bands") }));
jest.mock("~/components/mycountry/shell/WorldCensusCard", () => ({
  WorldCensusCard: stub("census"),
}));
jest.mock("~/components/mycountry/shell/TerritoryMapWidget", () => ({
  TerritoryMapWidget: stub("territory"),
}));
jest.mock("~/components/mycountry/shell/ExecutiveRecordFeed", () => ({
  ExecutiveRecordFeed: stub("record"),
}));
jest.mock("~/components/mycountry/shell/DomainPeeksCard", () => ({
  DomainPeeksCard: stub("peeks"),
}));
jest.mock("~/components/mycountry/shell/IntelligenceAlertsCard", () => ({
  IntelligenceAlertsCard: stub("alerts"),
}));

import { ExecutiveHome } from "~/components/mycountry/shell/ExecutiveHome";

describe("ExecutiveHome", () => {
  it("puts the crisis signal above everything else on the Overview", () => {
    render(
      <ExecutiveHome
        countryId="c1"
        onDeclare={() => undefined}
        onOpenDrill={() => undefined}
        onOpenIntent={() => undefined}
      />
    );
    const crisis = screen.getByTestId("crisis");
    const hero = screen.getByTestId("hero");
    expect(crisis.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(crisis.parentElement?.firstElementChild).toBe(crisis);
  });

  it("tops the rail with the intelligence alerts card (MC-17)", () => {
    render(
      <ExecutiveHome
        countryId="c1"
        onDeclare={() => undefined}
        onOpenDrill={() => undefined}
        onOpenIntent={() => undefined}
      />
    );
    const alerts = screen.getByTestId("alerts");
    expect(alerts.parentElement?.tagName).toBe("ASIDE");
    expect(alerts.parentElement?.firstElementChild).toBe(alerts);
  });
});
