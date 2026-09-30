import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, jest } from "@jest/globals";
import type { CountryCardData } from "~/components/mycountry/dossier/CountryFocusCard";
import { ECONOMIC_TIERS } from "~/lib/economic-tier-filter";

// Keep the grid/stats out of the way: list the filtered nation names only.
jest.mock("~/app/countries/_components/CountriesFocusGridModular", () => ({
  CountriesFocusGridModular: ({ countries }: { countries: CountryCardData[] }) => (
    <ul data-testid="grid">
      {countries.map((c) => (
        <li key={c.id}>{c.name}</li>
      ))}
    </ul>
  ),
}));
jest.mock("~/app/countries/_components/CountriesStats", () => ({
  CountriesStats: () => null,
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

import { CountriesPageModular } from "~/app/countries/_components/CountriesPageModular";
import CountriesFilterSidebar from "~/app/countries/_components/CountriesFilterSidebar";

const nations: CountryCardData[] = ECONOMIC_TIERS.flatMap((tier) =>
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

describe("/countries economic tier filter", () => {
  it("lets every real tier be selected and shows only that tier's nations", () => {
    render(<CountriesPageModular countries={nations} />);
    const group = screen.getByRole("radiogroup", { name: /economic tier/i });
    const labels = within(group)
      .getAllByRole("radio")
      .map((r) => r.textContent);
    expect(labels).toEqual(["All Tiers", ...ECONOMIC_TIERS]);

    for (const tier of ECONOMIC_TIERS) {
      fireEvent.click(within(group).getByRole("radio", { name: tier }));
      expect(within(group).getByRole("radio", { name: tier })).toHaveAttribute(
        "aria-checked",
        "true"
      );
      const shown = within(screen.getByTestId("grid"))
        .getAllByRole("listitem")
        .map((li) => li.textContent)
        .sort();
      expect(shown).toEqual([`${tier} Nation 1`, `${tier} Nation 2`]);
    }

    fireEvent.click(within(group).getByRole("radio", { name: "All Tiers" }));
    expect(within(screen.getByTestId("grid")).getAllByRole("listitem")).toHaveLength(
      nations.length
    );
  });
});

describe("/explore filter sidebar", () => {
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
