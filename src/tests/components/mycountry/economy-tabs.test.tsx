/**
 * The Economy section (MyCountry fix plan, WP-B2):
 * - the GDP growth tile is the engine's rate (`calculatedStats.gdpGrowth`), unrecorded figures read "—", and the
 *   wealth tiles come from the stored income classes;
 * - the Budget tab's revenue is the one national figure, passed to the budget dashboard;
 * - old `?tab=` ids open the renamed tabs, and the infrastructure card gets the Directive handler;
 * - the tax console says rates set revenue (not growth), saves a pending rate when it unmounts, and lets a
 *   bracketed tax become one rate after a confirm;
 * - no hint sends anyone to a Country Editor step that does not exist.
 */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

// The rate sliders (Radix) measure themselves.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockState: { tab: string | null; country: object | null } = { tab: null, country: null };
const mockMutate = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => mockState.tab }),
}));
// Each dynamic import renders a stub naming the props this suite checks.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function DynamicStub(props: {
      revenue?: { total: number | null };
      onDeclareDirective?: unknown;
    }) {
      if (props.revenue) {
        return <div data-testid="budget-dashboard" data-revenue={String(props.revenue.total)} />;
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
    useUtils: () => ({ countries: { getByIdWithEconomicData: { invalidate: jest.fn() } } }),
    mycountry: {
      getCountryDashboard: {
        useQuery: () => ({ data: { economicVitality: 70, governmentalEfficiency: 60 } }),
      },
    },
    economics: {
      updateFiscalSystem: { useMutation: () => ({ mutate: mockMutate, isPending: false }) },
    },
  },
}));

import { EconomyDrillDown } from "~/components/mycountry/shell/EconomyDrillDown";
import { FiscalPolicyConsole } from "~/components/mycountry/shell/FiscalPolicyConsole";

const COUNTRY = {
  currentTotalGdp: 100e9,
  calculatedStats: { gdpGrowth: 0.021 },
  // Mixed-unit stored column: never the tile's source.
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
  mockMutate.mockReset();
});

const tile = (label: string) => screen.getByText(label).parentElement!;

describe("Economy report", () => {
  it("shows the engine's growth, a dash for unrecorded unemployment and wealth shares from classes", () => {
    render(<EconomyDrillDown countryId="c1" onDeclare={jest.fn()} />);
    expect(within(tile("GDP growth")).getByText("2.10%")).toBeInTheDocument();
    expect(within(tile("Unemployment")).getByText("—")).toBeInTheDocument();
    expect(within(tile("Top 10% wealth share")).getByText("50.0%")).toBeInTheDocument();
    expect(within(tile("Middle class share")).getByText("75.0%")).toBeInTheDocument();
    expect(
      screen.getByText("No sector breakdown is recorded for this nation.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("infra-card").dataset.declare).toBe("function");
    expect(document.body.textContent).not.toMatch(/Country Editor/);
  });
});

describe("Economy tabs", () => {
  it.each([
    ["fiscal", "budget-dashboard"],
    ["budget", "budget-dashboard"],
    ["monetary", "taxes"],
    ["taxes", "taxes"],
  ])("?tab=%s opens the right tab", (tab, expected) => {
    mockState.tab = tab;
    render(<EconomyDrillDown countryId="c1" />);
    if (expected === "budget-dashboard")
      expect(screen.getByTestId("budget-dashboard")).toBeInTheDocument();
    else expect(screen.getByRole("tab", { name: "Taxes", selected: true })).toBeInTheDocument();
  });

  it("gives the budget the saved rates on today's GDP as revenue, not the founding total", () => {
    mockState.tab = "budget";
    render(<EconomyDrillDown countryId="c1" />);
    // 100B x 20% x 0.18 (fallback income weight)
    expect(screen.getByTestId("budget-dashboard").dataset.revenue).toBe(String(3.6e9));
    expect(within(tile("Tax revenue yield")).getByText("$3.60B / yr")).toBeInTheDocument();
  });
});

describe("Tax rates console", () => {
  it("says rates set revenue, not growth", () => {
    render(<FiscalPolicyConsole countryId="c1" />);
    expect(screen.getByText(/They do not change GDP or growth/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit Tariff rate rate")).toBeNull();
    expect(screen.getByLabelText("Edit Import tariff rate")).toBeInTheDocument();
  });

  it("sends a pending rate when it unmounts instead of dropping it", () => {
    jest.useFakeTimers();
    const { unmount } = render(<FiscalPolicyConsole countryId="c1" />);
    fireEvent.click(screen.getByLabelText("Edit VAT and sales tax rate"));
    const input = screen.getByLabelText("VAT and sales tax rate, percent");
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.blur(input);
    expect(mockMutate).not.toHaveBeenCalled();
    unmount();
    expect(mockMutate).toHaveBeenCalledWith({ countryId: "c1", salesTaxRate: 12 });
    act(() => jest.runOnlyPendingTimers());
    expect(mockMutate).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("replaces bracketed income tax with its top rate after a confirm", () => {
    jest.useFakeTimers();
    mockState.country = {
      ...COUNTRY,
      fiscalSystem: {
        personalIncomeTaxRates: JSON.stringify([
          { bracket: 0, rate: 10 },
          { bracket: 50_000, rate: 35 },
        ]),
      },
    };
    render(<FiscalPolicyConsole countryId="c1" />);
    expect(screen.getByLabelText("Income tax is set by tax brackets")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Use one rate" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/becomes a flat 35%/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Use one rate" }));
    act(() => jest.advanceTimersByTime(800));
    expect(mockMutate).toHaveBeenCalledWith({
      countryId: "c1",
      personalIncomeTaxRates: JSON.stringify({ incomeRate: 35 }),
    });
    expect(screen.getByLabelText("Save and lock Income tax rate")).toBeEnabled();
    jest.useRealTimers();
  });
});
