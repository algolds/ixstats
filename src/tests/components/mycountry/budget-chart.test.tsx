/**
 * R1 budget chart and fiscal balance. The allocation chart labels each slice with its share of the total budget
 * (0-100, never rescaled ×100 by the chart), draws each slice in its own theme chart colour, and keeps to eight
 * slices. The Fiscal health rail shows a deficit as a negative balance, not as a positive figure.
 */
import "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    government: {
      getFullByCountryId: {
        useQuery: () => ({
          // A past budget year, so it is the budget in effect whatever today's IxTime year is
          data: { budgetAllocations: [{ budgetYear: 2000, allocatedAmount: 30e9 }] },
        }),
      },
    },
  },
}));
jest.mock("~/components/ui/number-flow", () => ({
  PercentageFlow: ({ value }: { value: number }) => <span>{`${value.toFixed(1)}%`}</span>,
}));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({
    country: { currentTotalGdp: 1.5e11, governmentRevenueTotal: 6e9 },
  }),
}));

import { buildDepartmentChartData } from "~/components/mycountry/domains/government/budget/budgetSummaries";
import { FiscalPolicyInsights } from "~/components/mycountry/shell/fiscal/FiscalPolicyInsights";

const departments = Array.from({ length: 10 }, (_, i) => ({
  id: `d${i}`,
  name: `Ministry ${i}`,
  shortName: i === 0 ? "Education" : `Dept ${i}`,
  color: "#6366f1",
}));
const shares = [18, 13, 12, 11, 10, 9, 8, 7, 6, 6];
const allocations = shares.map((allocatedPercent, i) => ({
  departmentId: `d${i}`,
  budgetYear: 2042,
  allocatedPercent,
  allocatedAmount: (30e9 * allocatedPercent) / 100,
}));

describe("the budget allocation chart", () => {
  const slices = buildDepartmentChartData(allocations as never, departments as never);

  it("labels a slice with its share of the budget, not the share times 100", () => {
    expect(slices[0]).toMatchObject({ name: "Education", label: "Education 18.0%" });
    // No `percent` field: it overrode the chart's own 0-1 share and printed "1800.0%"
    expect(slices[0]).not.toHaveProperty("percent");
  });

  it("gives each slice its own theme chart colour and keeps to eight slices", () => {
    expect(slices).toHaveLength(8);
    expect(new Set(slices.map((s) => s.color)).size).toBe(8);
    expect(slices[0]!.color).toBe("var(--color-chart-1)");
  });
});

describe("the fiscal health balance", () => {
  it("shows a deficit as a negative balance", () => {
    // Revenue 6.0B against 30.0B allocated: (6 - 30) / 6 = -400%
    render(<FiscalPolicyInsights countryId="testland" />);
    expect(screen.getByText("-400.0%")).toBeTruthy();
    expect(screen.queryByText("400.0%")).toBeNull();
  });
});
