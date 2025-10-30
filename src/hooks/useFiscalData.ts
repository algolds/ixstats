// src/hooks/useFiscalData.ts

import { useState, useMemo, useCallback } from "react";
import type { FiscalSystemData } from "~/types/economics";
import { calculateBudgetHealth } from "~/app/countries/_components/economy/utils";
import {
  recalculateFiscalData,
  generateRevenueChartData,
  generateSpendingChartData,
  generateDebtCompositionData,
  calculateFiscalMetrics,
  type ChartDataItem,
  type SpendingDataItem,
  type FiscalMetric,
} from "~/lib/fiscal-calculations";

/**
 * Props for useFiscalData hook
 */
interface UseFiscalDataProps {
  fiscalData: FiscalSystemData;
  nominalGDP: number;
  totalPopulation: number;
  onFiscalDataChange?: (data: FiscalSystemData) => void;
  isReadOnly?: boolean;
  governmentStructure?: any;
}

/**
 * View types for fiscal system tabs
 */
export type FiscalView = "overview" | "revenue" | "spending" | "debt" | "taxes" | "analysis";

/**
 * Return type for useFiscalData hook
 */
interface UseFiscalDataReturn {
  // State
  view: FiscalView;
  editMode: boolean;

  // Computed data
  budgetHealth: {
    label: string;
    color: string;
  };
  revenueChartData: ChartDataItem[];
  spendingChartData: SpendingDataItem[];
  debtChartData: ChartDataItem[];
  fiscalMetrics: FiscalMetric[];

  // Handlers
  handleFieldChange: (field: keyof FiscalSystemData, value: any) => void;
  handleTaxRateChange: (type: string, value: number) => void;
  setView: (view: FiscalView) => void;
  toggleEditMode: () => void;
}

/**
 * Custom hook for managing fiscal data state and computed values
 *
 * Encapsulates:
 * - Fiscal data state management
 * - View and edit mode state
 * - Memoized computed values (charts, metrics, health indicators)
 * - Handlers for field changes and tax rate updates
 *
 * @param props - Hook configuration props
 * @returns Fiscal data state, computed values, and handlers
 */
export function useFiscalData({
  fiscalData,
  nominalGDP,
  totalPopulation,
  onFiscalDataChange,
  isReadOnly = true,
  governmentStructure,
}: UseFiscalDataProps): UseFiscalDataReturn {
  // Local state
  const [view, setView] = useState<FiscalView>("overview");
  const [editMode, setEditMode] = useState(false);

  // Memoized budget health calculation
  const budgetHealth = useMemo(
    () => calculateBudgetHealth({
      budgetDeficitSurplus: fiscalData.budgetDeficitSurplus,
      nominalGDP: nominalGDP,
    }),
    [fiscalData.budgetDeficitSurplus, nominalGDP]
  );

  // Memoized revenue chart data
  const revenueChartData = useMemo(
    () => generateRevenueChartData(fiscalData),
    [fiscalData.taxRevenueGDPPercent]
  );

  // Memoized spending chart data
  const spendingChartData = useMemo(
    () => generateSpendingChartData(fiscalData, nominalGDP, governmentStructure),
    [fiscalData.governmentSpendingByCategory, nominalGDP, governmentStructure]
  );

  // Memoized debt composition data
  const debtChartData = useMemo(
    () => generateDebtCompositionData(fiscalData),
    [fiscalData.internalDebtGDPPercent, fiscalData.externalDebtGDPPercent]
  );

  // Memoized fiscal metrics
  const fiscalMetrics = useMemo(
    () => calculateFiscalMetrics(fiscalData, nominalGDP),
    [
      fiscalData.taxRevenueGDPPercent,
      fiscalData.governmentBudgetGDPPercent,
      fiscalData.totalDebtGDPRatio,
      nominalGDP,
    ]
  );

  /**
   * Handle field changes with automatic recalculation of derived values
   */
  const handleFieldChange = useCallback(
    (field: keyof FiscalSystemData, value: any) => {
      if (isReadOnly || !onFiscalDataChange) return;

      const updatedData = recalculateFiscalData(
        fiscalData,
        field,
        value,
        nominalGDP,
        totalPopulation
      );

      onFiscalDataChange(updatedData);
    },
    [fiscalData, nominalGDP, totalPopulation, isReadOnly, onFiscalDataChange]
  );

  /**
   * Handle tax rate changes
   */
  const handleTaxRateChange = useCallback(
    (type: string, value: number) => {
      if (isReadOnly || !onFiscalDataChange) return;

      const updatedTaxRates = { ...fiscalData.taxRates };

      if (type === 'salesTaxRate') updatedTaxRates.salesTaxRate = value;
      if (type === 'propertyTaxRate') updatedTaxRates.propertyTaxRate = value;
      if (type === 'payrollTaxRate') updatedTaxRates.payrollTaxRate = value;
      if (type === 'wealthTaxRate') updatedTaxRates.wealthTaxRate = value;

      onFiscalDataChange({
        ...fiscalData,
        taxRates: updatedTaxRates
      });
    },
    [fiscalData, isReadOnly, onFiscalDataChange]
  );

  /**
   * Toggle edit mode
   */
  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
  }, []);

  return {
    // State
    view,
    editMode,

    // Computed data
    budgetHealth,
    revenueChartData,
    spendingChartData,
    debtChartData,
    fiscalMetrics,

    // Handlers
    handleFieldChange,
    handleTaxRateChange,
    setView,
    toggleEditMode,
  };
}
