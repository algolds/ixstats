/**
 * useCountryTaxSystem - Shared hook for country tax system data queries
 *
 * Phase 2 optimization: Standardizes staleTime and caching strategy for tax-related
 * queries across the builder system. Provides consistent access to tax data with
 * proper caching behavior.
 *
 * Standard staleTime values:
 * - 30s for frequently changing data (tax calculations)
 * - 60s for semi-stable data (tax categories, brackets)
 * - 5min for rarely changing data (tax system structure)
 */

import { useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";
import type { TaxCategoryInput, TaxBracketInput } from "~/types/tax-system";

// Standard staleTime constants (in milliseconds)
export const STALE_TIME = {
  FREQUENT: 30_000, // 30 seconds
  STANDARD: 60_000, // 60 seconds
  STABLE: 300_000, // 5 minutes
} as const;

interface UseCountryTaxSystemOptions {
  countryId?: string;
  enabled?: boolean;
  /** Override default staleTime (30s) */
  staleTime?: number;
  /** Callback when tax data changes */
  onTaxDataChange?: (data: TaxBuilderState) => void;
}

interface TaxSystemMetrics {
  totalTaxRevenue: number;
  taxToGDPRatio: number;
  effectiveTaxRate: number;
  categoryCount: number;
  bracketCount: number;
}

interface UseCountryTaxSystemReturn {
  // Data
  taxSystemData: TaxBuilderState | null;
  categories: TaxCategoryInput[];
  brackets: Record<string, TaxBracketInput[]>;

  // Metrics
  metrics: TaxSystemMetrics;

  // Query states
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;

  // Mutations
  createTaxSystem: ReturnType<typeof api.taxSystem.create.useMutation>;
  updateTaxSystem: ReturnType<typeof api.taxSystem.update.useMutation>;

  // Refetch
  refetch: () => Promise<void>;
}

/**
 * Shared hook for tax system data queries with standardized caching
 */
export function useCountryTaxSystem({
  countryId,
  enabled = true,
  staleTime = STALE_TIME.FREQUENT,
  onTaxDataChange: _onTaxDataChange,
}: UseCountryTaxSystemOptions): UseCountryTaxSystemReturn {
  const isEnabled = enabled && !!countryId;

  // Tax system query
  const taxQuery = api.taxSystem.getByCountryId.useQuery(
    { countryId: countryId! },
    {
      enabled: isEnabled,
      staleTime,
      refetchOnWindowFocus: false,
    }
  );

  // Mutations
  const createTaxSystem = api.taxSystem.create.useMutation({
    onSuccess: () => {
      taxQuery.refetch();
    },
  });

  const updateTaxSystem = api.taxSystem.update.useMutation({
    onSuccess: () => {
      taxQuery.refetch();
    },
  });

  // Extract data with safe defaults
  const taxSystemData = useMemo(() => {
    return (taxQuery.data as TaxBuilderState | null) ?? null;
  }, [taxQuery.data]);

  const categories = useMemo(() => {
    return taxSystemData?.categories || [];
  }, [taxSystemData?.categories]);

  const brackets = useMemo(() => {
    return taxSystemData?.brackets || {};
  }, [taxSystemData?.brackets]);

  // Calculate metrics
  const metrics = useMemo((): TaxSystemMetrics => {
    if (!taxSystemData) {
      return {
        totalTaxRevenue: 0,
        taxToGDPRatio: 0,
        effectiveTaxRate: 0,
        categoryCount: 0,
        bracketCount: 0,
      };
    }

    const totalTaxRevenue = categories.reduce((sum, cat) => {
      const catBrackets = brackets[cat.id || ""] || [];
      const catRevenue = catBrackets.reduce((bSum, bracket) => bSum + (bracket.revenue || 0), 0);
      return sum + catRevenue;
    }, 0);

    const bracketCount = Object.values(brackets).reduce(
      (sum, catBrackets) => sum + catBrackets.length,
      0
    );

    return {
      totalTaxRevenue,
      taxToGDPRatio: taxSystemData.taxToGDPRatio || 0,
      effectiveTaxRate: taxSystemData.taxSystem?.baseRate || 0,
      categoryCount: categories.length,
      bracketCount,
    };
  }, [taxSystemData, categories, brackets]);

  // Refetch function
  const refetch = useCallback(async () => {
    await taxQuery.refetch();
  }, [taxQuery]);

  return {
    taxSystemData,
    categories,
    brackets,
    metrics,
    isLoading: taxQuery.isLoading,
    isError: taxQuery.isError,
    error: taxQuery.error as Error | null,
    isFetching: taxQuery.isFetching,
    createTaxSystem,
    updateTaxSystem,
    refetch,
  };
}

export default useCountryTaxSystem;
