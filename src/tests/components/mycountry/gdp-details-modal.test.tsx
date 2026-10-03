import { render, screen } from "@testing-library/react";

const query = (data: unknown) => ({ data, isLoading: false, refetch: jest.fn() });
const countryQuery = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      getByIdWithEconomicData: { useQuery: (...args: unknown[]) => countryQuery(...args) },
      getGlobalStats: { useQuery: () => query(undefined) },
    },
    historical: { getCountryHistory: { useQuery: () => query([]) } },
  },
}));
jest.mock("~/components/mycountry/shared/modals/metric-details/BaseMetricDetailsModal", () => ({
  BaseMetricDetailsModal: ({
    children,
  }: {
    children: (tab: string, range: string, chart: string) => React.ReactNode;
  }) => (
    <>
      <section data-testid="overview">{children("overview", "5y", "line")}</section>
      <section data-testid="comparison">{children("comparison", "5y", "line")}</section>
    </>
  ),
}));
jest.mock("~/components/ui/chart", () => ({
  ChartContainer: () => null,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));
jest.mock("~/components/ui/number-flow", () => ({ NumberFlowDisplay: () => null }));

import { GdpDetailsModal } from "~/components/mycountry/shared/modals/metric-details/GdpDetailsModal";

describe("GdpDetailsModal when the country record is missing", () => {
  it("says the country data is unavailable instead of rendering an empty tab", () => {
    countryQuery.mockReturnValue(query(null));
    render(<GdpDetailsModal isOpen onClose={jest.fn()} countryId="c1" />);
    expect(screen.getAllByText("Country data unavailable")).toHaveLength(2);
  });
});
