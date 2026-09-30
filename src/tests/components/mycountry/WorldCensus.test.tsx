import React from "react";
import { render, screen } from "@testing-library/react";
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
} from "~/components/mycountry/shell/WorldCensusCard";
import {
  GlobalPositionRankings,
  toRankingItems,
} from "~/app/countries/[slug]/_components/shared/GlobalPositionRankings";

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

  it("country profile rankings come from the census, not sample figures", () => {
    const { container } = render(<GlobalPositionRankings countryName="Testland" countryId="c1" />);
    expect(container.textContent).toContain("Public Approval");
    expect(container.textContent).toContain("#2/14");
    // The old hard-coded sample ("$40.2 Trillion", rank 3 of 82) is gone.
    expect(container.textContent).not.toContain("40.2 Trillion");
    expect(toRankingItems(mockRankings).map((i) => i.rank)).toEqual([2, 5]);
  });
});
