/**
 * Owner decision 2026-10-28: the public factbook shows a blank debt or inflation as its estimate from the economy,
 * marked in plain words, never a bare 0%.
 */
import "react";
import { render, screen } from "@testing-library/react";
import { GovernmentFiscalSection } from "~/components/mycountry/shared/tabs/GovernmentFiscalSection";
import { mapCountryToEconomyData } from "~/lib/economy/data-mapper";
import { economyVitals } from "~/components/country-profile/vitals";

function economy(estimated: boolean) {
  return mapCountryToEconomyData({
    currentPopulation: 1e6,
    currentGdpPerCapita: 30_000,
    effectiveFigures: {
      inflationRate: { value: 3.4, estimated },
      unemploymentRate: { value: 6.2, estimated },
      totalDebtGDPRatio: { value: 58.5, estimated },
    },
    ...(estimated ? {} : { inflationRate: 3.4, totalDebtGDPRatio: 58.5 }),
  });
}

it("marks the estimated debt and inflation and shows the estimate, not 0%", () => {
  render(
    <GovernmentFiscalSection
      isExpanded
      onToggle={jest.fn()}
      economyData={economy(true)}
      currency="USD"
    />
  );
  expect(screen.getAllByText("Estimated from the economy")).toHaveLength(2);
  expect(screen.getByText(/58\.5%/)).toBeInTheDocument();
  expect(screen.getByText("Annual inflation rate, estimated from the economy")).toBeInTheDocument();
});

it("leaves recorded figures unmarked", () => {
  render(
    <GovernmentFiscalSection
      isExpanded
      onToggle={jest.fn()}
      economyData={economy(false)}
      currency="USD"
    />
  );
  expect(screen.queryByText("Estimated from the economy")).toBeNull();
  expect(screen.getByText("Relative to economic size")).toBeInTheDocument();
});

it("names an estimated unemployment or inflation in the Economy & people readings", () => {
  const vitals = {
    gdpGrowth: 0.01,
    unemployment: 5.8,
    unemploymentEstimated: true,
    inflation: 2.5,
    inflationEstimated: false,
  };
  expect(economyVitals(vitals as never).map((r) => `${r.label}: ${r.value}`)).toEqual([
    "Real growth: +1.0%",
    "Unemployment (estimated): 5.8%",
    "Inflation: 2.5%",
  ]);
});
