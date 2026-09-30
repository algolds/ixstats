import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "@jest/globals";
import type { Ranking } from "~/types/mycountry";

const mockRankings: Ranking[] = [
  {
    category: "Public Approval",
    value: 62.4,
    global: { position: 2, total: 14 },
    regional: { position: 1, total: 4, region: "North" },
    tier: { position: 1, total: 3, tier: "Developed" },
    percentile: 93,
  },
  {
    category: "Debt to GDP",
    value: 55,
    lowerIsBetter: true,
    global: { position: 5, total: 12 },
    regional: { position: 2, total: 4, region: "North" },
    tier: { position: 2, total: 3, tier: "Developed" },
    percentile: 67,
  },
];

jest.mock("~/trpc/react", () => ({
  api: {
    mycountry: {
      getRankings: { useQuery: () => ({ data: mockRankings, isLoading: false }) },
    },
  },
}));

import {
  WorldCensusCard,
  WorldCensusList,
  formatCensusValue,
  sortCensusByRelevance,
} from "~/components/mycountry/shell/WorldCensusCard";
import { DnaLegend } from "~/components/country-profile/CountryDNA";
import { toDnaAxes } from "~/components/country-profile/derive";
import { FacetList } from "~/components/ui/facet-list";

describe("formatCensusValue", () => {
  it("formats each category in its own units", () => {
    expect(formatCensusValue({ category: "GDP Growth", value: 0.034 })).toBe("3.4%");
    expect(formatCensusValue({ category: "Public Approval", value: 61.6 })).toBe("62%");
    expect(formatCensusValue({ category: "Income Equality", value: 0.321 })).toBe("Gini 0.32");
    expect(formatCensusValue({ category: "Stability", value: 71.2 })).toBe("71/100");
    expect(formatCensusValue({ category: "Population", value: 2_500_000 })).toBe("2.50M");
  });
});

describe("World Census UI", () => {
  it("lists every category with its realm rank", () => {
    render(<WorldCensusCard countryId="c1" />);
    expect(screen.getByText("World Census")).toBeTruthy();
    expect(screen.getByText("Public Approval")).toBeTruthy();
    expect(screen.getByText("Debt to GDP")).toBeTruthy();
    expect(screen.getByText("62%")).toBeTruthy();
  });

  it("shows an empty state instead of invented ranks", () => {
    render(<WorldCensusList rankings={[]} />);
    expect(screen.getByText("No census data yet.")).toBeTruthy();
  });

  it("country profile DNA comes from the census, not sample figures", () => {
    // The profile layer's shape (useCountryProfileLayer → world.rankings).
    const axes = toDnaAxes(
      mockRankings.map((r) => ({
        category: r.category,
        rank: r.global.position,
        total: r.global.total,
        value: formatCensusValue(r),
        percentile: r.percentile,
      }))
    );
    const { container } = render(
      <FacetList variant="plain">
        <DnaLegend axes={axes} />
      </FacetList>
    );
    expect(container.textContent).toContain("Public Approval");
    expect(container.textContent).toContain("#2 of 14");
    expect(container.textContent).toContain("Percentile 93");
    // The old hard-coded sample ("$40.2 Trillion", rank 3 of 82) is gone.
    expect(container.textContent).not.toContain("40.2 Trillion");
    expect(axes.map((a) => a.rank)).toEqual([2, 5]);
  });
});

function ranking(category: Ranking["category"], position: number, total: number): Ranking {
  return {
    category,
    value: 50,
    global: { position, total },
    regional: { position: 1, total: 1, region: "North" },
    tier: { position: 1, total: 1, tier: "Developed" },
    percentile: Math.round((1 - (position - 1) / total) * 100),
  };
}

const fullCensus: Ranking[] = [
  ranking("Income Equality", 9, 10), // 20th percentile
  ranking("Population", 4, 10), // 70
  ranking("Stability", 1, 10), // 100
  ranking("GDP Growth", 6, 10), // 50
  ranking("Total GDP", 2, 10), // 90
  ranking("Infrastructure", 2, 10), // 90 — ties Total GDP; the headline measure wins
  ranking("Debt to GDP", 8, 10), // 30
  ranking("Public Approval", 3, 10), // 80
];

describe("World Census relevance and disclosure", () => {
  it("orders by where the nation stands out most, headline measures breaking ties", () => {
    expect(sortCensusByRelevance(fullCensus).map((r) => r.category)).toEqual([
      "Stability",
      "Total GDP",
      "Infrastructure",
      "Public Approval",
      "Population",
      "GDP Growth",
      "Debt to GDP",
      "Income Equality",
    ]);
  });

  it("shows the five most relevant ranks and discloses the rest", () => {
    render(<WorldCensusList rankings={fullCensus} />);
    const list = screen.getByRole("list", { name: "Census ranks" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    expect(within(list).queryByText("Income Equality")).toBeNull();

    const more = screen.getByRole("button", { name: "See 3 more" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(more.getAttribute("aria-controls")).toBe(list.closest("section")?.id);

    fireEvent.click(more);
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(within(list).getByText("Income Equality")).toBeTruthy();
    const less = screen.getByRole("button", { name: "See less" });
    expect(less.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(less);
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  });

  it("has no disclosure when five or fewer ranks exist", () => {
    render(<WorldCensusList rankings={fullCensus.slice(0, 5)} />);
    expect(screen.queryByRole("button", { name: /See/ })).toBeNull();
  });
});
