/**
 * The National budget tab (owner decision 1). The owner sets a department's share, adds and removes departments; the
 * fiscal balance weighs allocations against revenue (nothing records spending, so no utilization); the year's policy
 * maintenance shows as spending; the revenue chart says when nothing is recorded; a nation with no departments gets
 * the create action, and no hint sends anyone to a Country Editor step that does not exist.
 * WP-B2: revenue is the nation's one figure (`nationalRevenue`: saved rates on today's GDP, else the founding total),
 * never the sum of the founding RevenueSource rows.
 */
import "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

const mockMutate: Record<string, jest.Mock> = {};
function mockMutation(name: string) {
  return () => {
    mockMutate[name] ??= jest.fn();
    return { mutate: mockMutate[name], isPending: false };
  };
}
const mockData: { gov: unknown; country: unknown } = { gov: null, country: undefined };

jest.mock("~/trpc/react", () => {
  const invalidate = { invalidate: jest.fn() };
  return {
    api: {
      useUtils: () => ({
        government: { getFullByCountryId: invalidate, getByCountryId: invalidate },
        mycountry: { getFirstSteps: invalidate },
      }),
      countries: {
        getByIdWithEconomicData: { useQuery: () => ({ data: mockData.country }) },
      },
      government: {
        getFullByCountryId: { useQuery: () => ({ data: mockData.gov, isSuccess: true }) },
        getPolicyMaintenance: { useQuery: () => ({ data: { 2043: 1_500_000_000 } }) },
        setAllocation: { useMutation: mockMutation("setAllocation") },
        addDepartment: { useMutation: mockMutation("addDepartment") },
        removeDepartment: { useMutation: mockMutation("removeDepartment") },
        createStructure: { useMutation: mockMutation("createStructure") },
        startBudgetYear: { useMutation: mockMutation("startBudgetYear") },
      },
    },
  };
});
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
// Charts measure their container, which jsdom cannot do; the tab's text is what is under test.
jest.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return new Proxy({}, { get: () => Stub });
});

import { IxTime } from "~/lib/ixtime";
import { BudgetManagementDashboard } from "~/components/mycountry/domains/government/BudgetManagementDashboard";
import { nationalRevenue } from "~/components/mycountry/shell/fiscal/nationalRevenue";

/** A nation with no tax rate saved: its founding revenue stands in. */
const foundingRevenue = (total: number) => nationalRevenue({ governmentRevenueTotal: total });

const department = (id: string, name: string) => ({
  id,
  name,
  category: "Health",
  ministerTitle: "Minister",
  minister: null,
  color: "#6366f1",
});
const allocation = (departmentId: string, allocatedPercent: number) => ({
  id: `a-${departmentId}`,
  departmentId,
  budgetYear: 2043,
  allocatedPercent,
  allocatedAmount: (10e9 * allocatedPercent) / 100,
  spentAmount: 0,
});
const government = (revenue: number) => ({
  id: "gs",
  governmentName: "Government of Testland",
  totalBudget: 10e9,
  budgetCurrency: "USD",
  departments: [
    department("health", "Ministry of Health"),
    department("roads", "Ministry of Roads"),
  ],
  budgetAllocations: [allocation("health", 70), allocation("roads", 50)],
  revenueSources:
    revenue > 0
      ? [{ id: "r", name: "Income tax", category: "Direct Tax", revenueAmount: revenue }]
      : [],
});

beforeAll(() => {
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(Date.UTC(2043, 3, 1));
});
afterAll(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
});
beforeEach(() => {
  for (const key of Object.keys(mockMutate)) delete mockMutate[key];
});

// Radix tabs switch on mouse down
const openView = (name: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });

describe("the National budget tab", () => {
  it("weighs allocations against revenue and shows the year's maintenance, with no utilization", () => {
    mockData.gov = government(10e9);
    render(<BudgetManagementDashboard countryId="testland" revenue={foundingRevenue(10e9)} />);
    // 12B allocated against 10B of revenue: a deficit, never "Surplus" from an unrecorded spend
    expect(screen.getAllByText("High deficit").length).toBeGreaterThan(0);
    expect(screen.queryByText("Surplus")).toBeNull();
    expect(screen.getByText("Policy maintenance")).toBeInTheDocument();
    expect(screen.getByText("15.0% of the year's budget")).toBeInTheDocument();
    openView("Analysis");
    expect(screen.queryByText(/utilization rate|efficiency score/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Country Editor/);
  });

  it("shows the saved tax rates on today's GDP as revenue, not the founding revenue rows", () => {
    // Founding rows say 999B; a 20% income tax on 100B of GDP yields 3.6B (fallback income weight 0.18).
    mockData.gov = government(999e9);
    const revenue = nationalRevenue({
      currentTotalGdp: 100e9,
      governmentRevenueTotal: 999e9,
      fiscalSystem: { personalIncomeTaxRates: JSON.stringify({ incomeRate: 20 }) },
    });
    render(<BudgetManagementDashboard countryId="testland" revenue={revenue} />);
    expect(screen.getByText("3.6B")).toBeInTheDocument();
    expect(screen.getByText("Your tax rates on today's GDP")).toBeInTheDocument();
    expect(screen.queryByText("999.0B")).toBeNull();
    // 12B allocated against 3.6B of revenue
    expect(screen.getAllByText("High deficit").length).toBeGreaterThan(0);
    openView("Revenue");
    expect(screen.getByText("Income tax")).toBeInTheDocument();
  });

  it("says when no revenue is recorded instead of drawing an empty chart", () => {
    mockData.gov = government(0);
    render(<BudgetManagementDashboard countryId="testland" revenue={foundingRevenue(0)} />);
    expect(
      screen.getByText("No revenue sources are recorded for this government yet.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("No revenue recorded").length).toBeGreaterThan(0);
  });

  it("lets the owner set a share, remove a department and add one", () => {
    mockData.gov = government(20e9);
    render(<BudgetManagementDashboard countryId="testland" revenue={foundingRevenue(20e9)} />);
    openView("Departments");
    expect(screen.queryByText(/Budget utilization|Remaining/)).toBeNull();

    const share = screen.getByLabelText("Ministry of Health share of the budget, in percent");
    fireEvent.change(share, { target: { value: "30" } });
    fireEvent.click(within(share.closest("form")!).getByRole("button", { name: "Save" }));
    expect(mockMutate.setAllocation).toHaveBeenCalledWith({
      countryId: "testland",
      departmentId: "health",
      allocatedPercent: 30,
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove Ministry of Roads" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(mockMutate.removeDepartment).toHaveBeenCalledWith({
      countryId: "testland",
      departmentId: "roads",
    });

    fireEvent.change(screen.getByLabelText("New department name"), {
      target: { value: "Ministry of Fisheries" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add department" }));
    expect(mockMutate.addDepartment).toHaveBeenCalledWith({
      countryId: "testland",
      name: "Ministry of Fisheries",
      category: "Other",
    });
  });

  it("offers a nation with no government the create action", () => {
    mockData.gov = null;
    render(<BudgetManagementDashboard countryId="testland" revenue={foundingRevenue(0)} />);
    fireEvent.click(screen.getByRole("button", { name: "Create government structure" }));
    expect(mockMutate.createStructure).toHaveBeenCalledWith({
      countryId: "testland",
      revenue: undefined,
    });
    expect(document.body.textContent).not.toMatch(/Country Editor/);
  });

  it("sends the nation's revenue with the create action, so the new budget starts balanced", () => {
    mockData.gov = null;
    mockData.country = { currentTotalGdp: 1.5e11, governmentRevenueTotal: 6e9 };
    render(<BudgetManagementDashboard countryId="testland" revenue={foundingRevenue(6e9)} />);
    fireEvent.click(screen.getByRole("button", { name: "Create government structure" }));
    expect(mockMutate.createStructure).toHaveBeenLastCalledWith({
      countryId: "testland",
      revenue: 6e9,
    });
    mockData.country = undefined;
  });
});
