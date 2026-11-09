import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const { createMockQuery } = jest.requireActual("../../../../jest-mocks/trpc-react");
  return {
    api: {
      countries: {
        getActivityRingsData: { useQuery: jest.fn(() => createMockQuery()) },
      },
      mycountry: {
        getCountryDashboard: { useQuery: jest.fn(() => createMockQuery()) },
      },
    },
  };
});

import { CountryHeroCard } from "~/components/shared/country-hero/CountryHeroCard";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

beforeAll(stubResizeObserver);

const stats = {
  countryName: "Caphiria",
  continent: "",
  governmentType: "",
  slug: "caphiria",
  gdpPerCapita: 0,
  population: 0,
  currentTotalGdp: 0,
};

describe("CountryHeroCard lens layout", () => {
  it("floats the identity panel over the media as a frosted lens", () => {
    const { container } = render(
      <CountryHeroCard
        countryId="caphiria"
        countryName="Caphiria"
        flagUrl={null}
        stats={stats}
        media={(ctx) => <div data-testid="media" data-inset={ctx.insetRight} />}
        identity={<span>Caphiria</span>}
      />
    );
    const lens = container.querySelector('[data-layer="lens"]');
    expect(lens).not.toBeNull();
    expect(lens).toHaveClass("facet-lens-frosted");
    expect(screen.getByTestId("media").parentElement).toHaveClass("md:col-span-5");
  });

  it("gives the media its covered width", () => {
    render(
      <CountryHeroCard
        countryId="caphiria"
        countryName="Caphiria"
        flagUrl={null}
        stats={stats}
        media={(ctx) => <div data-testid="media" data-inset={ctx.insetRight} />}
        identity={<span>Caphiria</span>}
      />
    );
    expect(screen.getByTestId("media")).toHaveAttribute("data-inset", "0");
  });

  it("keeps the lens when the media slot is empty (no map, no cover)", () => {
    const { container } = render(
      <CountryHeroCard
        countryId="caphiria"
        countryName="Caphiria"
        flagUrl={null}
        stats={stats}
        media={() => null}
        identity={<span>Caphiria</span>}
      />
    );
    expect(container.querySelector('[data-layer="lens"]')).not.toBeNull();
  });

  it("frameless (the country page) renders no card of its own but keeps the lens", () => {
    const { container } = render(
      <CountryHeroCard
        frameless
        countryId="caphiria"
        countryName="Caphiria"
        flagUrl={null}
        stats={stats}
        media={() => null}
        identity={<span>Caphiria</span>}
      />
    );
    expect(container.querySelector('[data-slot="card"]')).toBeNull();
    expect(container.querySelector('[data-layer="lens"]')).not.toBeNull();
  });
});
