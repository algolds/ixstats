/**
 * Economy drill-down telemetry & Corporate ₷ treasury console:
 * - Report, Budget, Taxes and Trade render read-only telemetry with deep-links into `/mycountry/editor`;
 * - Budget passes the single national revenue figure and `isReadOnly` to `BudgetManagementDashboard`;
 * - Legacy `?tab=` ids open the renamed tabs, and Corporations keeps live B2G tender operations.
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockState: { tab: string | null; country: object | null } = { tab: null, country: null };
const mockCreateTender = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => mockState.tab }),
}));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub(props: {
      revenue?: { total: number | null };
      isReadOnly?: boolean;
      onDeclareDirective?: unknown;
    }) {
      if (props.revenue) {
        return (
          <div
            data-testid="budget-dashboard"
            data-revenue={String(props.revenue.total)}
            data-readonly={String(Boolean(props.isReadOnly))}
          />
        );
      }
      if ("onDeclareDirective" in props) {
        return <div data-testid="infra-card" data-declare={typeof props.onDeclareDirective} />;
      }
      return <div data-testid="console" />;
    },
}));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: mockState.country }),
}));
jest.mock("~/components/ui/number-flow", () => ({
  CurrencyFlow: ({ value }: { value: number }) => <span>{value}</span>,
  PercentageFlow: ({ value }: { value: number }) => <span>{value}</span>,
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      exchange: {
        getTreasury: { invalidate: jest.fn() },
        getRealmCorporateSummary: { invalidate: jest.fn() },
      },
    }),
    diplomaticCore: {
      getRelationships: { useQuery: () => ({ data: [] }) },
    },
    mycountry: {
      getCountryDashboard: {
        useQuery: () => ({ data: { economicVitality: 70, governmentalEfficiency: 60 } }),
      },
    },
    exchange: {
      getTreasury: {
        useQuery: () => ({
          isLoading: false,
          data: {
            balance: 14_250,
            cap: 50_000,
            dailyStipend: 150,
            lifetimeStipend: 4_500,
            lifetimeTaxEarned: 6_200,
            lifetimeTariffEarned: 2_300,
            lifetimeInterestEarned: 1_250,
            lifetimeSpent: 3_000,
            lastStipendIxTime: 1000,
            recent: [
              {
                id: "ent-1",
                type: "TAX",
                amount: 420,
                balanceAfter: 14_250,
                source: "CORP_TAX:comp-1",
                ixTime: 1000,
                createdAt: new Date("2026-11-01T00:00:00Z"),
              },
            ],
          },
        }),
      },
      getRealmCorporateSummary: {
        useQuery: () => ({
          isLoading: false,
          data: {
            countryId: "c1",
            realmId: "default",
            companies: [
              {
                id: "comp-1",
                name: "Valdris Logistics Corp",
                sectorKey: "services",
                subIndustryKey: "logistics",
                status: "ACTIVE",
                fairValue: 18_500,
                capital: 9_000,
                standing: 8,
                creditDrawn: 1_200,
                creditLimit: 6_400,
                creditRating: "AA",
                lastTickRevenue: 950,
                lastTickExpenses: 620,
                lastTickTax: 66,
                lastTickNetIncome: 264,
                distressedSinceIxTime: null,
                founderId: "u1",
              },
            ],
            totals: {
              companyCount: 1,
              distressedCount: 0,
              totalFairValue: 18_500,
              totalCapital: 9_000,
              totalCreditDrawn: 1_200,
              lastTickRevenue: 950,
              lastTickTax: 66,
              lastTickNetIncome: 264,
            },
            corporateGdpShift: 0.014,
            taxCompetitiveness: {
              effectiveCorpTaxRate: 0.18,
              capGainsTaxRate: 0.15,
              interestRate: 0.045,
              realmAvgCorpTaxRate: 0.21,
            },
            openTenders: [
              {
                id: "ten-1",
                title: "Deepwater Port Dredging",
                sectorKey: "services",
                value: 2_500,
                fundedBy: "TREASURY",
                status: "OPEN",
                endIxTime: 5000,
                linkedDirectiveId: null,
                linkedIssueId: null,
                bidCount: 2,
                lowestBid: 2_100,
              },
            ],
          },
        }),
      },
      createTreasuryTender: {
        useMutation: () => ({ mutate: mockCreateTender, isPending: false }),
      },
    },
  },
}));

import { EconomyDrillDown } from "~/components/mycountry/shell/EconomyDrillDown";
import { CorporationsTreasuryConsole } from "~/components/mycountry/shell/CorporationsTreasuryConsole";
import { CorporateTreasuryInsights } from "~/components/mycountry/shell/rails/EconomyRail";

const COUNTRY = {
  currentTotalGdp: 100e9,
  calculatedStats: { gdpGrowth: 0.021 },
  realGDPGrowthRate: 3,
  governmentRevenueTotal: 999e9,
  incomeDistribution: {
    economicClasses: JSON.stringify([
      { name: "Upper Class", populationPercent: 5, wealthPercent: 40 },
      { name: "Upper Middle Class", populationPercent: 15, wealthPercent: 30 },
      { name: "Middle Class", populationPercent: 30, wealthPercent: 20 },
      { name: "Lower Middle Class", populationPercent: 30, wealthPercent: 8 },
      { name: "Lower Class", populationPercent: 20, wealthPercent: 2 },
    ]),
  },
  fiscalSystem: { personalIncomeTaxRates: JSON.stringify({ incomeRate: 20 }) },
};

beforeEach(() => {
  mockState.tab = null;
  mockState.country = COUNTRY;
});

const tile = (label: string) =>
  (screen.getByText(label).closest('[data-slot="stat"], [data-slot="card"]') ??
    screen.getByText(label).parentElement)! as HTMLElement;

describe("Economy report", () => {
  it("shows the engine's growth, plain reason for unrecorded unemployment, wealth shares and baselines editor link", () => {
    render(<EconomyDrillDown countryId="c1" onDeclare={jest.fn()} />);
    expect(within(tile("GDP growth")).getByText("2.10%")).toBeInTheDocument();
    expect(within(tile("Unemployment")).getByText("Not recorded")).toBeInTheDocument();
    expect(within(tile("Top 10% wealth share")).getByText("50.0%")).toBeInTheDocument();
    expect(within(tile("Middle class share")).getByText("75.0%")).toBeInTheDocument();
    expect(
      screen.getByText("No sector breakdown is recorded for this nation.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("infra-card").dataset.declare).toBe("function");
    expect(screen.getByRole("link", { name: /Edit baselines/i })).toHaveAttribute(
      "href",
      "/mycountry/editor#scale"
    );
    expect(document.body.textContent).not.toMatch(/Country Editor/);
  });
});

describe("Economy report estimates", () => {
  it("shows a blank figure as its estimate, marked, and a recorded one as recorded", () => {
    mockState.country = {
      ...COUNTRY,
      inflationRate: 2,
      totalDebtGDPRatio: 61,
      effectiveFigures: {
        unemploymentRate: { value: 7.3, estimated: true },
        inflationRate: { value: 4.4, estimated: true },
        totalDebtGDPRatio: { value: 61, estimated: false },
      },
    };
    render(<EconomyDrillDown countryId="c1" onDeclare={jest.fn()} />);
    expect(within(tile("Unemployment")).getByText("7.3%")).toBeInTheDocument();
    expect(
      within(tile("Unemployment")).getByText("Estimated from your economy")
    ).toBeInTheDocument();
    expect(within(tile("Inflation")).getByText("4.4%")).toBeInTheDocument();
    expect(within(tile("Debt to GDP")).getByText("61.0%")).toBeInTheDocument();
    expect(within(tile("Debt to GDP")).queryByText("Estimated from your economy")).toBeNull();
  });
});

describe("Economy tabs and editor handoff", () => {
  it.each([
    ["fiscal", "budget-dashboard"],
    ["budget", "budget-dashboard"],
    ["monetary", "taxes"],
    ["taxes", "taxes"],
    ["corporations", "corporations"],
  ])("?tab=%s opens the right tab", (tab, expected) => {
    mockState.tab = tab;
    render(<EconomyDrillDown countryId="c1" />);
    if (expected === "budget-dashboard")
      expect(screen.getByTestId("budget-dashboard")).toBeInTheDocument();
    else if (expected === "corporations")
      expect(screen.getByRole("tab", { name: "Corporations", selected: true })).toBeInTheDocument();
    else expect(screen.getByRole("tab", { name: "Taxes", selected: true })).toBeInTheDocument();
  });

  it("shows a trillion-dollar GDP compactly, not as thousands of billions", () => {
    mockState.tab = "report";
    mockState.country = { ...mockState.country, currentTotalGdp: 44_484.45e9 };
    render(<EconomyDrillDown countryId="c1" />);
    expect(within(tile("Total GDP")).getByText("$44.5T")).toBeInTheDocument();
  });

  it("renders budget dashboard read-only with revenue and links configuration to the editor", () => {
    mockState.tab = "budget";
    render(<EconomyDrillDown countryId="c1" />);
    const dashboard = screen.getByTestId("budget-dashboard");
    expect(dashboard.dataset.revenue).toBe(String(3.6e9));
    expect(dashboard.dataset.readonly).toBe("true");
    expect(within(tile("Tax revenue yield")).getByText("$3.6B / yr")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configure budget/i })).toHaveAttribute(
      "href",
      "/mycountry/editor#budget"
    );
  });

  it("renders read-only saved tax rates and sector tariff links into the country editor", () => {
    mockState.tab = "taxes";
    const view = render(<EconomyDrillDown countryId="c1" />);
    expect(screen.getByText("20.0%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configure tax rates/i })).toHaveAttribute(
      "href",
      "/mycountry/editor#taxes"
    );
    expect(screen.queryByRole("slider")).toBeNull();
    view.unmount();

    mockState.tab = "trade";
    render(<EconomyDrillDown countryId="c1" />);
    expect(screen.getByRole("link", { name: /Configure sector tariffs/i })).toHaveAttribute(
      "href",
      "/mycountry/editor#tariffs"
    );
    expect(screen.queryByRole("slider")).toBeNull();
  });
});

describe("Corporations & ₷ treasury console and rail", () => {
  it("renders treasury KPIs, domiciled corporations, ledger entries, and posts a B2G tender", () => {
    mockCreateTender.mockReset();
    render(<CorporationsTreasuryConsole countryId="c1" countryName="Valdris" />);

    expect(within(tile("Nation ₷ treasury")).getByText("₷14,250")).toBeInTheDocument();
    expect(within(tile("Macro GDP feedback")).getByText("+1.40%")).toBeInTheDocument();
    expect(screen.getByText("Valdris Logistics Corp")).toBeInTheDocument();
    expect(screen.getByText("Global Logistics & Shipping")).toBeInTheDocument();
    expect(screen.getByText("Rating AA")).toBeInTheDocument();
    expect(screen.getByText("Deepwater Port Dredging")).toBeInTheDocument();
    expect(screen.getByText("Corporate profit tax")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tender title"), {
      target: { value: "National Grid Transformer Upgrade" },
    });
    fireEvent.change(screen.getByLabelText("Ceiling value (₷)"), {
      target: { value: "1200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post B2G tender" }));

    expect(mockCreateTender).toHaveBeenCalledWith(
      expect.objectContaining({
        countryId: "c1",
        title: "National Grid Transformer Upgrade",
        sectorKey: "services",
        value: 1200,
        biddingDays: 7,
        fundedBy: "TREASURY",
      })
    );
  });

  it("renders CorporateTreasuryInsights in EconomyRail", () => {
    render(<CorporateTreasuryInsights countryId="c1" />);
    expect(screen.getByText("Corporate & ₷ treasury")).toBeInTheDocument();
    expect(screen.getByText("1 corporations")).toBeInTheDocument();
    expect(screen.getByText("18.0% vs 21.0%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open corporations console/i })).toHaveAttribute(
      "href",
      "/mycountry/economy?tab=corporations"
    );
  });
});
