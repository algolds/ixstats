// src/lib/fiscal-calculations.ts

import type { FiscalSystemData } from "~/types/economics";

/**
 * Color constants for fiscal data visualizations
 */
export const FISCAL_CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#6b7280",
];

/**
 * Interface for chart data items
 */
export interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

/**
 * Interface for spending data items
 */
export interface SpendingDataItem {
  category: string;
  amount: number;
  percent: number;
}

/**
 * Interface for fiscal metrics
 */
export interface FiscalMetric {
  label: string;
  value: number;
  optimal: { min: number; max: number };
  color: string;
}

/**
 * Interface for validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Recalculates fiscal data based on field changes
 *
 * @param current - Current fiscal data
 * @param field - Field being updated
 * @param value - New value for the field
 * @param gdp - Nominal GDP
 * @param population - Total population
 * @returns Updated fiscal data with recalculated derived values
 */
export function recalculateFiscalData(
  current: FiscalSystemData,
  field: keyof FiscalSystemData,
  value: any,
  gdp: number,
  population: number
): FiscalSystemData {
  const updatedData = { ...current, [field]: value };

  // Recalculate tax revenue derived values
  if (field === "taxRevenueGDPPercent") {
    updatedData.governmentRevenueTotal = (gdp * value) / 100;
    updatedData.taxRevenuePerCapita = updatedData.governmentRevenueTotal / population;
  }

  // Recalculate budget deficit/surplus
  if (field === "governmentBudgetGDPPercent") {
    const totalSpending = (gdp * value) / 100;
    updatedData.budgetDeficitSurplus = updatedData.governmentRevenueTotal - totalSpending;
  }

  // Recalculate debt metrics
  if (field === "internalDebtGDPPercent" || field === "externalDebtGDPPercent") {
    updatedData.totalDebtGDPRatio =
      updatedData.internalDebtGDPPercent + updatedData.externalDebtGDPPercent;
    updatedData.debtPerCapita = (gdp * updatedData.totalDebtGDPRatio) / (100 * population);
    updatedData.debtServiceCosts =
      (gdp * updatedData.totalDebtGDPRatio * updatedData.interestRates) / 10000;
  }

  return updatedData;
}

/**
 * Calculates tax revenue metrics
 *
 * @param taxGdpPercent - Tax revenue as percentage of GDP
 * @param gdp - Nominal GDP
 * @param population - Total population
 * @returns Tax revenue metrics object
 */
export function calculateTaxRevenue(
  taxGdpPercent: number,
  gdp: number,
  population: number
): {
  total: number;
  perCapita: number;
  gdpPercent: number;
} {
  const total = (gdp * taxGdpPercent) / 100;
  const perCapita = total / population;

  return {
    total,
    perCapita,
    gdpPercent: taxGdpPercent,
  };
}

/**
 * Calculates comprehensive debt metrics
 *
 * @param internalDebt - Internal debt as % of GDP
 * @param externalDebt - External debt as % of GDP
 * @param gdp - Nominal GDP
 * @param population - Total population
 * @param interestRate - Average interest rate (as decimal, e.g., 0.05 for 5%)
 * @returns Debt metrics object
 */
export function calculateDebtMetrics(
  internalDebt: number,
  externalDebt: number,
  gdp: number,
  population: number,
  interestRate: number
): {
  totalDebtGDPRatio: number;
  debtPerCapita: number;
  debtServiceCosts: number;
  totalDebtAmount: number;
} {
  const totalDebtGDPRatio = internalDebt + externalDebt;
  const totalDebtAmount = (gdp * totalDebtGDPRatio) / 100;
  const debtPerCapita = totalDebtAmount / population;
  const debtServiceCosts = totalDebtAmount * interestRate;

  return {
    totalDebtGDPRatio,
    debtPerCapita,
    debtServiceCosts,
    totalDebtAmount,
  };
}

/**
 * Generates revenue breakdown data for pie/bar charts
 *
 * @param fiscalData - Fiscal system data
 * @returns Array of chart data items representing revenue breakdown
 */
export function generateRevenueChartData(fiscalData: FiscalSystemData): ChartDataItem[] {
  return [
    {
      name: "Income Tax",
      value: fiscalData.taxRevenueGDPPercent * 0.4,
      color: FISCAL_CHART_COLORS[0],
    },
    {
      name: "Corporate Tax",
      value: fiscalData.taxRevenueGDPPercent * 0.25,
      color: FISCAL_CHART_COLORS[1],
    },
    {
      name: "Sales Tax",
      value: fiscalData.taxRevenueGDPPercent * 0.2,
      color: FISCAL_CHART_COLORS[2],
    },
    {
      name: "Other Taxes",
      value: fiscalData.taxRevenueGDPPercent * 0.15,
      color: FISCAL_CHART_COLORS[3],
    },
  ];
}

/**
 * Generates spending breakdown data for charts
 * Uses government structure if available, otherwise returns default allocation
 *
 * @param fiscalData - Fiscal system data
 * @param nominalGDP - Nominal GDP
 * @param governmentStructure - Optional government structure with budget allocations
 * @returns Array of spending data items
 */
export function generateSpendingChartData(
  fiscalData: FiscalSystemData,
  nominalGDP: number,
  governmentStructure?: any
): SpendingDataItem[] {
  // Use actual government structure budget data if available
  if (governmentStructure?.budgetAllocations?.length > 0) {
    return governmentStructure.budgetAllocations.map((allocation: any) => {
      const department = governmentStructure.departments?.find(
        (d: any) => d.id === allocation.departmentId
      );
      return {
        category: department?.name || department?.category || "Unknown",
        amount: allocation.allocatedAmount,
        percent: allocation.allocatedPercent,
      };
    });
  }

  // Fallback to fiscal data or default spending if no government structure
  return (
    fiscalData.governmentSpendingByCategory || [
      { category: "Defense", amount: nominalGDP * 0.04, percent: 20 },
      { category: "Education", amount: nominalGDP * 0.035, percent: 17.5 },
      { category: "Healthcare", amount: nominalGDP * 0.035, percent: 17.5 },
      { category: "Infrastructure", amount: nominalGDP * 0.025, percent: 12.5 },
      { category: "Social Security", amount: nominalGDP * 0.045, percent: 22.5 },
      { category: "Other", amount: nominalGDP * 0.02, percent: 10 },
    ]
  );
}

/**
 * Generates debt composition data for visualization
 *
 * @param fiscalData - Fiscal system data
 * @returns Array of chart data items for debt composition
 */
export function generateDebtCompositionData(fiscalData: FiscalSystemData): ChartDataItem[] {
  return [
    {
      name: "Internal Debt",
      value: fiscalData.internalDebtGDPPercent,
      color: FISCAL_CHART_COLORS[0],
    },
    {
      name: "External Debt",
      value: fiscalData.externalDebtGDPPercent,
      color: FISCAL_CHART_COLORS[1],
    },
  ];
}

/**
 * Calculates fiscal health metrics with optimal ranges
 *
 * @param fiscalData - Fiscal system data
 * @param gdp - Nominal GDP
 * @returns Array of fiscal metrics with status indicators
 */
export function calculateFiscalMetrics(fiscalData: FiscalSystemData, gdp: number): FiscalMetric[] {
  return [
    {
      label: "Tax Revenue",
      value: fiscalData.taxRevenueGDPPercent,
      optimal: { min: 15, max: 30 },
      color:
        fiscalData.taxRevenueGDPPercent >= 15 && fiscalData.taxRevenueGDPPercent <= 30
          ? "text-green-600"
          : "text-yellow-600",
    },
    {
      label: "Gov Budget",
      value: fiscalData.governmentBudgetGDPPercent,
      optimal: { min: 18, max: 32 },
      color:
        fiscalData.governmentBudgetGDPPercent >= 18 && fiscalData.governmentBudgetGDPPercent <= 32
          ? "text-green-600"
          : "text-yellow-600",
    },
    {
      label: "Total Debt",
      value: fiscalData.totalDebtGDPRatio,
      optimal: { min: 20, max: 60 },
      color:
        fiscalData.totalDebtGDPRatio <= 60
          ? "text-green-600"
          : fiscalData.totalDebtGDPRatio <= 90
            ? "text-yellow-600"
            : "text-red-600",
    },
  ];
}

/**
 * Validates fiscal data against constraints and requirements
 *
 * @param fiscalData - Fiscal system data to validate
 * @returns Validation result with status and error messages
 */
export function validateFiscalData(fiscalData: FiscalSystemData): ValidationResult {
  const errors: string[] = [];

  // Validate tax revenue
  if (fiscalData.taxRevenueGDPPercent < 0 || fiscalData.taxRevenueGDPPercent > 50) {
    errors.push("Tax revenue must be between 0% and 50% of GDP");
  }

  // Validate government budget
  if (fiscalData.governmentBudgetGDPPercent < 0 || fiscalData.governmentBudgetGDPPercent > 60) {
    errors.push("Government budget must be between 0% and 60% of GDP");
  }

  // Validate debt levels
  if (fiscalData.internalDebtGDPPercent < 0 || fiscalData.internalDebtGDPPercent > 200) {
    errors.push("Internal debt must be between 0% and 200% of GDP");
  }

  if (fiscalData.externalDebtGDPPercent < 0 || fiscalData.externalDebtGDPPercent > 100) {
    errors.push("External debt must be between 0% and 100% of GDP");
  }

  // Validate interest rates
  if (fiscalData.interestRates < 0 || fiscalData.interestRates > 0.2) {
    errors.push("Interest rates must be between 0% and 20%");
  }

  // Validate required fields
  if (!fiscalData.taxRates) {
    errors.push("Tax rates configuration is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates total government spending amount
 *
 * @param budgetGDPPercent - Government budget as % of GDP
 * @param gdp - Nominal GDP
 * @returns Total government spending
 */
export function calculateTotalSpending(budgetGDPPercent: number, gdp: number): number {
  return (gdp * budgetGDPPercent) / 100;
}

/**
 * Calculates budget deficit or surplus
 *
 * @param revenue - Total government revenue
 * @param spending - Total government spending
 * @returns Deficit (negative) or surplus (positive)
 */
export function calculateBudgetBalance(revenue: number, spending: number): number {
  return revenue - spending;
}

/**
 * Calculates debt service to revenue ratio
 *
 * @param debtServiceCosts - Annual debt service costs
 * @param governmentRevenue - Total government revenue
 * @returns Ratio as decimal (e.g., 0.15 for 15%)
 */
export function calculateDebtServiceRatio(
  debtServiceCosts: number,
  governmentRevenue: number
): number {
  if (governmentRevenue === 0) return 0;
  return debtServiceCosts / governmentRevenue;
}

/**
 * Determines fiscal sustainability status based on key metrics
 *
 * @param fiscalData - Fiscal system data
 * @param gdp - Nominal GDP
 * @returns Sustainability assessment
 */
export function assessFiscalSustainability(
  fiscalData: FiscalSystemData,
  gdp: number
): {
  debtSustainability: "sustainable" | "moderate-risk" | "high-risk";
  revenueAdequacy: "adequate" | "moderate" | "low";
  budgetBalance: "surplus" | "balanced" | "moderate-deficit" | "high-deficit";
} {
  // Assess debt sustainability
  let debtSustainability: "sustainable" | "moderate-risk" | "high-risk";
  if (fiscalData.totalDebtGDPRatio <= 60) {
    debtSustainability = "sustainable";
  } else if (fiscalData.totalDebtGDPRatio <= 90) {
    debtSustainability = "moderate-risk";
  } else {
    debtSustainability = "high-risk";
  }

  // Assess revenue adequacy
  let revenueAdequacy: "adequate" | "moderate" | "low";
  if (fiscalData.taxRevenueGDPPercent >= 20) {
    revenueAdequacy = "adequate";
  } else if (fiscalData.taxRevenueGDPPercent >= 15) {
    revenueAdequacy = "moderate";
  } else {
    revenueAdequacy = "low";
  }

  // Assess budget balance
  let budgetBalance: "surplus" | "balanced" | "moderate-deficit" | "high-deficit";
  if (fiscalData.budgetDeficitSurplus > 0) {
    budgetBalance = "surplus";
  } else if (fiscalData.budgetDeficitSurplus >= -0.02 * gdp) {
    budgetBalance = "balanced";
  } else if (fiscalData.budgetDeficitSurplus >= -0.05 * gdp) {
    budgetBalance = "moderate-deficit";
  } else {
    budgetBalance = "high-deficit";
  }

  return {
    debtSustainability,
    revenueAdequacy,
    budgetBalance,
  };
}
