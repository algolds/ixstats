/**
 * useArchetypes Hook
 *
 * Provides the economic archetypes admins maintain at /admin/economic-archetypes, with
 * fallback to the built-in archetypes while loading or if the API fails.
 *
 * @module useArchetypes
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { builtinArchetypes } from "~/lib/economy/archetypes/seed";
import { rememberArchetypes } from "~/lib/economy/archetypes/registry";
import type { EconomicArchetype } from "~/lib/economy/archetypes/types";
import { ComponentType } from "~/lib/enums";

const GOVERNMENT_COMPONENT_LEGACY_MAP: Record<string, ComponentType[]> = {
  PRIVATE_SECTOR_LEADERSHIP: [ComponentType.ENTREPRENEURSHIP_SUPPORT],
  SOCIAL_DEMOCRACY: [ComponentType.WELFARE_STATE, ComponentType.WORKER_PROTECTION],
  COMPREHENSIVE_WELFARE: [ComponentType.SOCIAL_SAFETY_NET, ComponentType.UNIVERSAL_HEALTHCARE],
  PUBLIC_SECTOR_LEADERSHIP: [ComponentType.PROFESSIONAL_BUREAUCRACY],
  ENVIRONMENTAL_FOCUS: [ComponentType.ENVIRONMENTAL_PROTECTION],
  ECONOMIC_PLANNING: [ComponentType.STRATEGIC_PLANNING],
  DEVELOPMENTAL_STATE: [ComponentType.PERFORMANCE_LEGITIMACY],
  REGIONAL_DEVELOPMENT: [ComponentType.ADMINISTRATIVE_DECENTRALIZATION],
  MERITOCRATIC_SYSTEM: [ComponentType.MERIT_BASED_SYSTEM],
  PLANNED_ECONOMY: [ComponentType.STRATEGIC_PLANNING],
  SOCIAL_MARKET_ECONOMY: [ComponentType.WELFARE_STATE],
  FREE_MARKET_SYSTEM: [ComponentType.ECONOMIC_INCENTIVES],
  STATE_CAPITALISM: [ComponentType.CENTRALIZED_POWER],
};

function normalizeComplexity(value: string): EconomicArchetype["implementationComplexity"] {
  const lower = value.toLowerCase();
  return lower === "low" || lower === "high" ? lower : "medium";
}

export function mapLegacyGovernmentComponents(components: string[]): ComponentType[] {
  if (!components) return [];
  const result = new Set<ComponentType>();
  for (const comp of components) {
    if (GOVERNMENT_COMPONENT_LEGACY_MAP[comp]) {
      GOVERNMENT_COMPONENT_LEGACY_MAP[comp].forEach((c) => result.add(c));
    } else {
      result.add(comp as ComponentType);
    }
  }
  return Array.from(result);
}

/**
 * useArchetypes - Fetch economic archetypes with fallback pattern
 *
 * Queries the database for economic archetypes and falls back to hardcoded
 * data if the database is empty. Supports filtering by era and automatic
 * caching with 10-minute staleTime.
 *
 * @param {('modern'|'historical'|'all')} [era='all'] - Filter archetypes by era
 * @returns {Object} Archetype data and loading state
 * @property {EconomicArchetype[]} archetypes - List of economic archetypes
 * @property {boolean} isLoading - Loading state indicator
 * @property {any} error - Error object if query failed
 * @property {boolean} isUsingFallback - True if using hardcoded fallback data
 *
 * @example
 * ```tsx
 * function EconomyBuilder() {
 *   const { archetypes, isLoading, isUsingFallback } = useArchetypes('modern');
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {isUsingFallback && <FallbackWarning />}
 *       <ArchetypeGrid archetypes={archetypes} />
 *     </>
 *   );
 * }
 * ```
 */
export function useArchetypes(era?: "modern" | "historical" | "all") {
  // Query database with 10-minute cache
  const {
    data: dbArchetypes,
    isLoading,
    error,
  } = api.economicArchetypes.getAllArchetypes.useQuery(
    { era: era || "all", isActive: true },
    { staleTime: 10 * 60 * 1000 } // 10-minute cache
  );

  // Process archetypes with fallback logic
  const { archetypes, isUsingFallback } = useMemo(() => {
    const list = dbArchetypes?.archetypes;

    // Use database if available and not empty
    if (list && list.length > 0) {
      // `key` is the stable archetype id (the built-in id for seeded archetypes); builder state
      // stores it as selectedArchetypeId.
      const mappedDbList: EconomicArchetype[] = list.map((a) => ({
        ...a,
        id: a.key,
        implementationComplexity: normalizeComplexity(a.implementationComplexity),
        governmentComponents: mapLegacyGovernmentComponents(a.governmentComponents as string[]),
      }));
      rememberArchetypes(mappedDbList);
      return {
        archetypes: mappedDbList,
        isUsingFallback: false,
      };
    }

    // Fallback to hardcoded data
    if (!isLoading) {
      console.warn(
        "[useArchetypes] Database empty or unavailable, falling back to hardcoded archetypes"
      );
    }

    const fallback: EconomicArchetype[] = builtinArchetypes()
      .filter((a) => !era || era === "all" || a.era === era)
      .map((a) => ({
        ...a,
        governmentComponents: mapLegacyGovernmentComponents(a.governmentComponents as string[]),
      }));

    return {
      archetypes: fallback,
      isUsingFallback: true,
    };
  }, [dbArchetypes, era, isLoading]);

  return {
    archetypes,
    isLoading,
    error,
    isUsingFallback,
  };
}
