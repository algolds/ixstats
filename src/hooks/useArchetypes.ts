/**
 * useArchetypes Hook
 *
 * Provides database-backed economic archetypes with fallback to hardcoded data.
 * Integrates with tRPC API for archetype management and usage tracking.
 *
 * @module useArchetypes
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { modernArchetypes } from "@/app/builder/data/archetypes/modern";
import { historicalArchetypes } from "@/app/builder/data/archetypes/historical";
import type { EconomicArchetype } from "@/app/builder/data/archetype-types";
import { ComponentType } from "~/lib/enums";

export const GOVERNMENT_COMPONENT_LEGACY_MAP: Record<string, ComponentType[]> = {
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
    const list = Array.isArray(dbArchetypes) ? dbArchetypes : (dbArchetypes as any)?.archetypes;

    // Use database if available and not empty
    if (list && list.length > 0) {
      const mappedDbList = (list as EconomicArchetype[]).map((a) => ({
        ...a,
        governmentComponents: mapLegacyGovernmentComponents(a.governmentComponents as any[]),
      }));
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

    const fallback: EconomicArchetype[] = [
      ...Array.from(modernArchetypes.values()),
      ...Array.from(historicalArchetypes.values()),
    ].map((a) => ({
      ...a,
      governmentComponents: mapLegacyGovernmentComponents(a.governmentComponents as any[]),
    }));

    // Filter by era if specified
    let filtered = fallback;
    if (era === "modern") {
      filtered = fallback.filter((a) => modernArchetypes.has(a.id));
    } else if (era === "historical") {
      filtered = fallback.filter((a) => historicalArchetypes.has(a.id));
    }

    return {
      archetypes: filtered,
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
