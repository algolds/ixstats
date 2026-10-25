import type {
  BudgetAllocation,
  BudgetSummary,
  GovernmentDepartment,
  RevenueCategory,
  RevenueSource,
  RevenueSummary,
} from "~/types/government";
import type { BudgetTrendItem, DepartmentChartItem } from "./budgetTypes";
import { TAX_CHANNELS } from "~/components/mycountry/shell/fiscal/taxChannels";
import type { NationalRevenue } from "~/components/mycountry/shell/fiscal/nationalRevenue";
import { latestBudgetYearUpTo } from "~/lib/government/budget-year";

const sumOf = <T>(items: T[], pick: (item: T) => number | null | undefined) =>
  items.reduce((total, item) => total + (pick(item) ?? 0), 0);

const REVENUE_CATEGORIES: RevenueCategory[] = [
  "Direct Tax",
  "Indirect Tax",
  "Non-Tax Revenue",
  "Fees and Fines",
  "Other",
];

export function summarizeBudget(
  allocations: BudgetAllocation[],
  departments: GovernmentDepartment[],
  totalBudget: number
): BudgetSummary {
  const totalAllocated = sumOf(allocations, (a) => a.allocatedAmount);
  const departmentAllocations = departments
    .map((department) => ({
      department,
      allocation: allocations.find((a) => a.departmentId === department.id) ?? null,
    }))
    .sort((a, b) => (b.allocation?.allocatedAmount ?? 0) - (a.allocation?.allocatedAmount ?? 0));

  return {
    totalBudget,
    totalAllocated,
    departmentCount: departments.length,
    departmentAllocations,
  };
}

/** Income, corporate, wealth and capital gains taxes; VAT and tariffs are indirect. */
const DIRECT_TAX_CHANNELS = new Set(["income", "corporate", "wealth", "capGains"]);

function breakdownOf(lines: RevenueSummary["topRevenueSources"], total: number) {
  return REVENUE_CATEGORIES.map((category) => {
    const amount = sumOf(
      lines.filter((r) => r.category === category),
      (r) => r.revenueAmount
    );
    return { category, amount, percent: total > 0 ? (amount / total) * 100 : 0 };
  }).filter((item) => item.amount > 0);
}

function summaryOf(
  lines: RevenueSummary["topRevenueSources"],
  totalRevenue: number,
  basis: RevenueSummary["basis"]
): RevenueSummary {
  const totalTaxRevenue = sumOf(
    lines.filter((r) => r.category?.includes("Tax")),
    (r) => r.revenueAmount
  );
  return {
    totalRevenue,
    totalTaxRevenue,
    totalNonTaxRevenue: totalRevenue - totalTaxRevenue,
    revenueBreakdown: breakdownOf(lines, totalRevenue),
    topRevenueSources: [...lines]
      .sort((a, b) => (b.revenueAmount ?? 0) - (a.revenueAmount ?? 0))
      .slice(0, 5),
    basis,
  };
}

/** One line per tax with a yield, from the saved rates. */
function rateLines(revenue: NationalRevenue, total: number): RevenueSummary["topRevenueSources"] {
  return TAX_CHANNELS.flatMap((ch) => {
    const amount = revenue.yields.byChannel[ch.key];
    if (amount == null) return [];
    const category: RevenueCategory = DIRECT_TAX_CHANNELS.has(ch.key)
      ? "Direct Tax"
      : "Indirect Tax";
    return [
      {
        id: ch.key,
        name: ch.label,
        category,
        revenueAmount: amount,
        revenuePercent: (amount / total) * 100,
      },
    ];
  });
}

/** The founding revenue rows, scaled so they add up to the founding total. */
function foundingLines(
  total: number,
  sources: RevenueSource[]
): RevenueSummary["topRevenueSources"] {
  const recorded = sumOf(sources, (r) => r.revenueAmount);
  if (recorded <= 0) {
    return [
      {
        id: "founding",
        name: "Founding estimate",
        category: "Direct Tax",
        revenueAmount: total,
        revenuePercent: 100,
      },
    ];
  }
  return sources.map((r) => {
    const amount = ((r.revenueAmount ?? 0) / recorded) * total;
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      revenueAmount: amount,
      revenuePercent: (amount / total) * 100,
    };
  });
}

/**
 * The budget's revenue, from the one national figure (`nationalRevenue`): split by tax on the
 * rates basis; on the founding basis the founding rows give the split, scaled to the total.
 */
export function summarizeRevenue(
  revenue: NationalRevenue,
  sources: RevenueSource[]
): RevenueSummary {
  const total = revenue.total ?? 0;
  if (revenue.basis === "rates" && total > 0)
    return summaryOf(rateLines(revenue, total), total, "rates");
  if (revenue.basis === "founding" && total > 0) {
    return summaryOf(foundingLines(total, sources), total, "founding");
  }
  return summaryOf([], 0, null);
}

/** What the budget in effect (latest year at or before now) allocates in total. */
export function allocatedInEffect(
  allocations: Pick<BudgetAllocation, "budgetYear" | "allocatedAmount">[]
): number | null {
  const year = latestBudgetYearUpTo(allocations.map((a) => a.budgetYear));
  if (year == null) return null;
  return sumOf(
    allocations.filter((a) => a.budgetYear === year),
    (a) => a.allocatedAmount
  );
}

/** Slices the allocation chart draws; the rest stay in the Departments list. */
export const CHART_SLICE_LIMIT = 8;

/**
 * One slice per department, largest first, each in its own theme chart colour. The label carries
 * the share of the total budget (`allocatedPercent`, 0-100) so the chart never rescales it.
 */
export function buildDepartmentChartData(
  allocations: BudgetAllocation[],
  departments: GovernmentDepartment[]
): DepartmentChartItem[] {
  return allocations
    .map((allocation) => {
      const department = departments.find((d) => d.id === allocation.departmentId);
      const name = department?.shortName || department?.name || "Unknown";
      return {
        name,
        label: `${name} ${(allocation.allocatedPercent ?? 0).toFixed(1)}%`,
        allocated: allocation.allocatedAmount ?? 0,
      };
    })
    .sort((a, b) => b.allocated - a.allocated)
    .slice(0, CHART_SLICE_LIMIT)
    .map((item, index) => ({ ...item, color: `var(--color-chart-${index + 1})` }));
}

/**
 * Allocated per recorded budget year, oldest first. Revenue has no history, so no revenue line;
 * nothing records spending yet (`spentAmount` has no writer), so no spending line either.
 */
export function buildTrendData(allocations: BudgetAllocation[]): BudgetTrendItem[] {
  const years = [...new Set(allocations.map((a) => a.budgetYear))].sort((a, b) => a - b);
  return years.map((year) => {
    const inYear = allocations.filter((a) => a.budgetYear === year);
    return {
      year: String(year),
      budget: sumOf(inYear, (a) => a.allocatedAmount),
    };
  });
}
