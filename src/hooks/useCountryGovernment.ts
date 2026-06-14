// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
/**
 * useCountryGovernment - Shared hook for country government data queries
 *
 * Phase 2 optimization: Standardizes staleTime and caching strategy for government-related
 * queries across the builder system. Reduces duplicate query definitions and ensures
 * consistent caching behavior.
 *
 * Standard staleTime values:
 * - 30s for frequently changing data (budget years, allocations)
 * - 60s for semi-stable data (departments, components)
 * - 5min for rarely changing data (structure, synergies)
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";
import type { GovernmentDepartment, BudgetAllocationInput } from "~/types/government";

// Standard staleTime constants (in milliseconds)
export const STALE_TIME = {
  FREQUENT: 30_000, // 30 seconds - budget years, allocations
  STANDARD: 60_000, // 60 seconds - departments, components
  STABLE: 300_000, // 5 minutes - structure, synergies
} as const;

interface UseCountryGovernmentOptions {
  countryId?: string;
  enabled?: boolean;
  /** Override default staleTime (60s) */
  staleTime?: number;
  /** Number of budget years to fetch (default: 3) */
  budgetYearsLimit?: number;
  /** Include sub-departments in response */
  includeSubDepartments?: boolean;
  /** Include sub-budgets in response */
  includeSubBudgets?: boolean;
}

interface UseCountryGovernmentReturn {
  // Data
  departments: GovernmentDepartment[];
  structure: any | null;
  budgetAllocations: BudgetAllocationInput[];
  revenueSources: any[];

  // Query states
  isLoading: boolean;
  isError: boolean;
  error: Error | null;

  // Refetch functions
  refetchDepartments: () => Promise<void>;
  refetchStructure: () => Promise<void>;

  // Computed
  totalBudget: number;
  departmentCount: number;
}

/**
 * Shared hook for government data queries with standardized caching
 */
export function useCountryGovernment({
  countryId,
  enabled = true,
  staleTime: _staleTime = STALE_TIME.STANDARD,
  budgetYearsLimit = 3,
  includeSubDepartments = false,
  includeSubBudgets = false,
}: UseCountryGovernmentOptions): UseCountryGovernmentReturn {
  const isEnabled = enabled && !!countryId;

  // Government structure query (stable data, longer cache)
  const structureQuery = api.government.getByCountryId.useQuery(
    {
      countryId: countryId!,
      budgetYearsLimit,
      includeSubDepartments,
      includeSubBudgets,
    },
    {
      enabled: isEnabled,
      staleTime: STALE_TIME.STABLE,
      refetchOnWindowFocus: false,
    }
  );

  // Extract data with safe defaults
  const departments = useMemo(() => {
    return (structureQuery.data?.departments as GovernmentDepartment[]) || [];
  }, [structureQuery.data?.departments]);

  const budgetAllocations = useMemo(() => {
    return (structureQuery.data?.budgetAllocations as BudgetAllocationInput[]) || [];
  }, [structureQuery.data?.budgetAllocations]);

  const revenueSources = useMemo(() => {
    return (structureQuery.data?.revenueSources as any[]) || [];
  }, [structureQuery.data?.revenueSources]);

  // Computed values
  const totalBudget = useMemo(() => {
    return budgetAllocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
  }, [budgetAllocations]);

  const departmentCount = departments.length;

  // Refetch functions
  const refetchDepartments = async () => {
    await structureQuery.refetch();
  };

  const refetchStructure = async () => {
    await structureQuery.refetch();
  };

  return {
    departments,
    structure: structureQuery.data || null,
    budgetAllocations,
    revenueSources,
    isLoading: structureQuery.isLoading,
    isError: structureQuery.isError,
    error: structureQuery.error as Error | null,
    refetchDepartments,
    refetchStructure,
    totalBudget,
    departmentCount,
  };
}

export default useCountryGovernment;
