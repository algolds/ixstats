import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "@jest/globals";
import { ECONOMIC_TIERS } from "~/lib/economic-tier-filter";

// My realm (/countries) lists a realm's nations: the API returns them; the grid lists the filtered names only.
let mockNations: unknown[] = [];
jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      getAll: {
        useQuery: (input: unknown) => {
          mockQueryInput = input;
          return { data: { countries: mockNations }, isLoading: false, error: null };
        },
      },
    },
  },
}));
let mockQueryInput: unknown;
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("~/hooks/useCountryComparison", () => ({
  useCountryComparison: () => ({ getAvailableCountries: () => [] }),
}));
jest.mock("~/app/countries/_components/CountriesGrid", () => ({
  CountriesGrid: ({ countries }: { countries: Array<{ id: string; name: string }> }) => (
    <ul data-testid="grid">
      {countries.map((c) => (
        <li key={c.id}>{c.name}</li>
      ))}
    </ul>
  ),
}));
jest.mock("~/app/countries/_components/CountriesPageHeader", () => ({
  CountriesPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock("~/app/countries/_components/CountryComparisonModal", () => ({
  CountryComparisonModal: () => null,
}));

// Radix Select doesn't render its options in jsdom; swap in a native <select>.
jest.mock("~/components/ui/select", () => {
  const SelectCtx = React.createContext<{
    value?: string;
    onValueChange?: (v: string) => void;
  }>({});
  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (v: string) => void;
      children: React.ReactNode;
    }) => <SelectCtx.Provider value={{ value, onValueChange }}>{children}</SelectCtx.Provider>,
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const { value, onValueChange } = React.useContext(SelectCtx);
      return (
        <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
          {children}
        </select>
      );
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

import { CountriesDirectory } from "~/app/countries/_components/CountriesDirectory";
import CountriesFilterSidebar from "~/app/countries/_components/CountriesFilterSidebar";

const nations = ECONOMIC_TIERS.flatMap((tier) =>
  [1, 2].map((n) => ({
    id: `${tier}-${n}`,
    name: `${tier} Nation ${n}`,
    slug: `${tier}_Nation_${n}`,
    currentPopulation: 1_000_000,
    currentGdpPerCapita: 10_000,
    currentTotalGdp: 1e10,
    economicTier: tier,
    populationTier: "1",
  }))
);

describe("My realm (/countries) economic tier filter", () => {
  it("shows only the chosen tier's nations, and asks for the realm it was given", () => {
    mockNations = nations;
    render(<CountriesDirectory realm="eurth" title="Realm nations" />);
    expect(mockQueryInput).toMatchObject({ realm: "eurth" });
    expect(screen.getByRole("heading", { name: "Realm nations" })).toBeTruthy();

    // The filter sidebar renders twice (rail and phone sheet); use the first tier select.
    const tierSelect = screen.getAllByRole("option", { name: "All Tiers" })[0]!.closest("select")!;
    for (const tier of ECONOMIC_TIERS) {
      fireEvent.change(tierSelect, { target: { value: tier } });
      const shown = within(screen.getByTestId("grid"))
        .getAllByRole("listitem")
        .map((li) => li.textContent)
        .sort();
      expect(shown).toEqual([`${tier} Nation 1`, `${tier} Nation 2`]);
    }
  });
});

describe("My realm filter sidebar", () => {
  it("offers every real tier and reports the selected one", () => {
    const onTierFilterChange = jest.fn();
    render(
      <CountriesFilterSidebar
        searchTerm=""
        onSearchChange={jest.fn()}
        tierFilter="all"
        onTierFilterChange={onTierFilterChange}
        continentFilter="all"
        onContinentFilterChange={jest.fn()}
        regionFilter="all"
        onRegionFilterChange={jest.fn()}
        populationRange={{}}
        onPopulationRangeChange={jest.fn()}
        availableContinents={[]}
        availableRegions={[]}
        onClearAll={jest.fn()}
      />
    );
    const tierSelect = screen.getByRole("option", { name: "All Tiers" }).closest("select")!;
    const values = within(tierSelect)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(["all", ...ECONOMIC_TIERS]);

    for (const tier of ECONOMIC_TIERS) {
      fireEvent.change(tierSelect, { target: { value: tier } });
      expect(onTierFilterChange).toHaveBeenLastCalledWith(tier);
    }
  });
});
