/**
 * Unified Atomic Components State Management Hook.
 *
 * Manages all atomic component types (government, economic, tax) with:
 * - Cross-builder synergy detection
 * - Combined effectiveness calculations
 * - Historical change tracking
 * - Real-time metrics and analytics
 *
 * Phase 3 optimization: Added standardized staleTime values.
 */

import { useState } from "react";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import { EconomicComponentType, TaxComponentType } from "~/lib/enums";
import { api } from "~/trpc/react";
import { STALE_TIME } from "~/hooks/useCountryGovernment";

export interface SynergyItem {
  type: "GOV_ECON" | "GOV_TAX" | "ECON_TAX" | "ALL_THREE";
  governmentComponent?: { componentType: string };
  economicComponent?: { componentType: string };
  taxComponent?: { componentType: string };
  bonus: number;
  description: string;
}

export interface UseUnifiedAtomicComponentsProps {
  countryId?: string;
  initialGovernmentComponents?: ComponentType[];
  initialEconomicComponents?: EconomicComponentType[];
  initialTaxComponents?: TaxComponentType[];
}

export function useUnifiedAtomicComponents({
  countryId,
  // eslint-disable-next-line unused-imports/no-unused-vars
  initialGovernmentComponents = [],
  // eslint-disable-next-line unused-imports/no-unused-vars
  initialEconomicComponents = [],
  // eslint-disable-next-line unused-imports/no-unused-vars
  initialTaxComponents = [],
}: UseUnifiedAtomicComponentsProps) {
  // State
  const [isLoading, setIsLoading] = useState(false);

  // tRPC queries with standardized staleTime
  const getAllQuery = api.unifiedAtomic.getAll.useQuery(
    { countryId: countryId || "" },
    { enabled: !!countryId, staleTime: STALE_TIME.STANDARD }
  );

  const detectSynergiesQuery = api.unifiedAtomic.detectSynergies.useQuery(
    { countryId: countryId || "" },
    { enabled: !!countryId, staleTime: STALE_TIME.STABLE }
  );

  const detectConflictsQuery = api.unifiedAtomic.detectConflicts.useQuery(
    { countryId: countryId || "" },
    { enabled: !!countryId, staleTime: STALE_TIME.STABLE }
  );

  const calculateCombinedEffectivenessQuery =
    api.unifiedAtomic.calculateCombinedEffectiveness.useQuery(
      { countryId: countryId || "" },
      { enabled: !!countryId, staleTime: STALE_TIME.STANDARD }
    );

  const getHistoricalChangesQuery = api.unifiedAtomic.getHistoricalChanges.useQuery(
    { countryId: countryId || "" },
    { enabled: !!countryId, staleTime: STALE_TIME.STABLE }
  );

  const saveSynergiesMutation = api.unifiedAtomic.saveSynergies.useMutation();

  // Computed values
  const allComponents = getAllQuery.data;
  const synergies = detectSynergiesQuery.data || [];
  const conflicts = detectConflictsQuery.data || [];
  const combinedEffectiveness = calculateCombinedEffectivenessQuery.data;
  const historicalChanges = getHistoricalChangesQuery.data || [];

  // Save synergies to database
  const saveSynergies = async () => {
    if (!countryId || synergies.length === 0) return;

    setIsLoading(true);
    try {
      const synergyData = (synergies as SynergyItem[]).map((synergy) => ({
        governmentComponents: synergy.governmentComponent
          ? [synergy.governmentComponent.componentType]
          : [],
        economicComponents: synergy.economicComponent
          ? [synergy.economicComponent.componentType]
          : [],
        taxComponents: synergy.taxComponent ? [synergy.taxComponent.componentType] : [],
        synergyType: synergy.type,
        effectivenessBonus: synergy.bonus,
        description: synergy.description,
      }));

      await saveSynergiesMutation.mutateAsync({
        countryId,
        synergies: synergyData,
      });
    } catch (error) {
      console.error("Failed to save synergies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get component effectiveness by type
  const getEffectivenessByType = (type: "government" | "economic" | "tax") => {
    switch (type) {
      case "government":
        return (
          (allComponents?.government?.reduce((sum, comp) => sum + comp.effectivenessScore, 0) ??
            0) / (allComponents?.government?.length || 1)
        );
      case "economic":
        return (
          (allComponents?.economic?.reduce((sum, comp) => sum + comp.effectivenessScore, 0) ?? 0) /
          (allComponents?.economic?.length || 1)
        );
      case "tax":
        return (
          (allComponents?.tax?.reduce((sum, comp) => sum + comp.effectivenessScore, 0) ?? 0) /
          (allComponents?.tax?.length || 1)
        );
      default:
        return 0;
    }
  };

  // Get component count by type
  const getComponentCountByType = (type: "government" | "economic" | "tax") => {
    switch (type) {
      case "government":
        return allComponents?.government?.length || 0;
      case "economic":
        return allComponents?.economic?.length || 0;
      case "tax":
        return allComponents?.tax?.length || 0;
      default:
        return 0;
    }
  };

  // Get recent changes
  const getRecentChanges = (limit: number = 10) => {
    return historicalChanges.slice(0, limit);
  };

  // Get changes by component type
  const getChangesByType = (componentType: string) => {
    return historicalChanges.filter((change) => change.componentType === componentType);
  };

  return {
    // State
    isLoading,
    allComponents,
    synergies,
    conflicts,
    combinedEffectiveness,
    historicalChanges,

    // Computed values
    totalComponentCount: allComponents?.totalCount || 0,
    governmentEffectiveness: getEffectivenessByType("government"),
    economicEffectiveness: getEffectivenessByType("economic"),
    taxEffectiveness: getEffectivenessByType("tax"),
    governmentCount: getComponentCountByType("government"),
    economicCount: getComponentCountByType("economic"),
    taxCount: getComponentCountByType("tax"),

    // Actions
    saveSynergies,
    getRecentChanges,
    getChangesByType,

    // Status
    isSavingSynergies: saveSynergiesMutation.isPending,
    isLoaded: getAllQuery.isSuccess,
    isError: getAllQuery.isError,
  };
}
