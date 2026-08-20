import { render, screen } from "@testing-library/react";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { BorderThreatPanel } from "~/components/mycountry/domains/defense/BorderThreatPanel";

jest.mock("~/trpc/react", () => ({
  api: {
    security: {
      getBorderSecurity: {
        useQuery: jest.fn(),
      },
    },
    useUtils: jest.fn(() => ({ invalidate: jest.fn() })),
  },
}));

const mockedApi = jest.requireMock("~/trpc/react").api as {
  security: { getBorderSecurity: { useQuery: jest.Mock } };
};

const mockBorderData = {
  id: "border-1",
  countryId: "country-1",
  overallSecurityLevel: 72,
  securityStatus: "strong",
  borderLength: 2840,
  landBorders: 3,
  maritimeBorders: 2,
  checkpoints: 14,
  surveillanceSystems: 8,
  neighborThreats: [
    {
      id: "threat-1",
      neighborName: "Eastland",
      borderType: "land",
      threatLevel: "high",
      threatScore: 78,
      militaryThreat: 85,
      terrorismRisk: 40,
      smugglingRisk: 60,
      refugeeFlow: 35,
      politicalStability: 45,
      diplomaticRelations: "tense",
      borderLength: 1240,
      notes: "Arms buildup observed along the eastern frontier.",
    },
    {
      id: "threat-2",
      neighborName: "Westmere",
      borderType: "maritime",
      threatLevel: "low",
      threatScore: 22,
      militaryThreat: 15,
      terrorismRisk: 10,
      smugglingRisk: 30,
      refugeeFlow: 20,
      politicalStability: 80,
      diplomaticRelations: "friendly",
      borderLength: 450,
      notes: null,
    },
  ],
};

function renderPanel() {
  return render(<BorderThreatPanel countryId="country-1" />);
}

describe("BorderThreatPanel", () => {
  beforeEach(() => {
    mockedApi.security.getBorderSecurity.useQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
      isSuccess: false,
      status: "pending" as const,
    });
  });

  it("renders a loading skeleton while loading", () => {
    mockedApi.security.getBorderSecurity.useQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isFetching: true,
      isSuccess: false,
      status: "pending" as const,
    });

    const { container } = renderPanel();

    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it("renders overview stats and neighbor threat rows when data returns", () => {
    mockedApi.security.getBorderSecurity.useQuery.mockReturnValue({
      data: mockBorderData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
      isSuccess: true,
      status: "success" as const,
    });

    const { container } = renderPanel();

    expect(screen.getByText("Border Security Overview")).toBeInTheDocument();
    expect(screen.getByText("Neighbor Threats")).toBeInTheDocument();
    expect(container.textContent).toContain("72/100");
    expect(screen.getByText("strong")).toBeInTheDocument();
    expect(screen.getByText("2,840 km")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();

    expect(screen.getByText("Eastland")).toBeInTheDocument();
    expect(screen.getByText("Westmere")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(container.textContent).toContain("78/100");
    expect(
      screen.getByText("Arms buildup observed along the eastern frontier.")
    ).toBeInTheDocument();
  });

  it("renders empty state when neighborThreats is empty", () => {
    mockedApi.security.getBorderSecurity.useQuery.mockReturnValue({
      data: {
        ...mockBorderData,
        neighborThreats: [],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
      isSuccess: true,
      status: "success" as const,
    });

    renderPanel();

    expect(screen.getByText("No neighbor threat assessments recorded yet.")).toBeInTheDocument();
    expect(screen.queryByText("Eastland")).not.toBeInTheDocument();
  });
});
