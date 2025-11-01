/**
 * useEconomicComponentsData Hook (Phase 5 Migration)
 *
 * Provides database-backed economic component data with fallback to hardcoded data.
 * Integrates with tRPC API for component management and usage tracking.
 *
 * Features:
 * - Database query with 10-minute cache
 * - Automatic fallback to ATOMIC_ECONOMIC_COMPONENTS
 * - 7-field JSON parsing (synergies, conflicts, governmentSynergies, governmentConflicts,
 *   taxImpact, sectorImpact, employmentImpact)
 * - Usage tracking for analytics
 * - Warning system when using fallback data
 *
 * @module useEconomicComponentsData
 */

import { useMemo } from "react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "~/trpc/react";
import {
  ATOMIC_ECONOMIC_COMPONENTS,
  type AtomicEconomicComponent,
  type EconomicComponentType,
} from "~/lib/atomic-economic-data";

const ICON_REGISTRY = Icons as unknown as Record<string, LucideIcon | undefined>;
const DEFAULT_COMPONENT_ICON =
  ICON_REGISTRY.BriefcaseBusiness ??
  ICON_REGISTRY.PieChart ??
  ICON_REGISTRY.Activity ??
  ICON_REGISTRY.HelpCircle!;

function resolveComponentIcon(iconName?: string | null): LucideIcon {
  if (!iconName) return DEFAULT_COMPONENT_ICON;

  const candidates = [iconName, iconName.charAt(0).toUpperCase() + iconName.slice(1)];
  for (const candidate of candidates) {
    const icon = ICON_REGISTRY[candidate];
    if (icon) {
      return icon;
    }
  }

  return DEFAULT_COMPONENT_ICON;
}

/**
 * useEconomicComponentsData - Fetch economic component reference data
 *
 * Queries the database for economic component metadata and falls back to hardcoded
 * data if the database is empty or unavailable. Supports filtering by category and
 * automatic caching with 10-minute staleTime.
 *
 * All 7 impact fields are parsed from JSON in the database response:
 * - synergies: EconomicComponentType[]
 * - conflicts: EconomicComponentType[]
 * - governmentSynergies: string[]
 * - governmentConflicts: string[]
 * - taxImpact: { optimalCorporateRate, optimalIncomeRate, revenueEfficiency }
 * - sectorImpact: Record<string, number>
 * - employmentImpact: { unemploymentModifier, participationModifier, wageGrowthModifier }
 *
 * NOTE: Currently uses hardcoded fallback as reference data migration to database
 * is pending (Phase 5). When EconomicComponentData model is seeded to database,
 * this hook will automatically use database data.
 *
 * @param {string} [category] - Filter components by category (optional)
 * @returns {Object} Component data and loading state
 * @property {AtomicEconomicComponent[]} components - List of economic components with parsed impact fields
 * @property {boolean} isLoading - Loading state indicator
 * @property {any} error - Error object if query failed
 * @property {boolean} isUsingFallback - True if using hardcoded fallback data
 * @property {(componentType: EconomicComponentType) => void} incrementUsage - Track component selection
 *
 * @example
 * ```tsx
 * function EconomicBuilder() {
 *   const { components, isLoading, isUsingFallback, incrementUsage } =
 *     useEconomicComponentsData('Economic Model');
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {isUsingFallback && <FallbackWarning />}
 *       <ComponentGrid
 *         components={components}
 *         onSelect={incrementUsage}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useEconomicComponentsData(category?: string) {
  // ==================== DATABASE QUERY ====================
  const {
    data: dbResponse,
    isLoading,
    error,
  } = api.economicComponents.getAllComponents.useQuery(
    { category, isActive: true },
    {
      staleTime: 10 * 60 * 1000, // 10-minute cache
      enabled: true,
    }
  );

  // Extract components from response
  const dbComponents = dbResponse?.components;
  const isUsingFallbackFromAPI = dbResponse?.isUsingFallback ?? true;

  // ==================== USAGE TRACKING MUTATION ====================
  // Track component selection for analytics
  const { mutate: incrementUsage } = api.economicComponents.incrementComponentUsage.useMutation({
    onError: (err) => {
      console.warn("[useEconomicComponentsData] Failed to track component usage:", err);
    },
  });

  // ==================== PROCESS COMPONENTS WITH FALLBACK ====================
  const { components, isUsingFallback } = useMemo(() => {
    // Use database if available and not empty
    if (dbComponents && dbComponents.length > 0 && !isUsingFallbackFromAPI) {
      // Transform database format to AtomicEconomicComponent interface
      // Database components already have 7 JSON fields parsed by the router
      const transformed = dbComponents.map((dbComp: any) => transformDatabaseComponent(dbComp));

      // Apply category filter if specified (double-check since API filters too)
      const filtered = category
        ? transformed.filter((comp) => comp.category === category)
        : transformed;

      return {
        components: filtered,
        isUsingFallback: false,
      };
    }

    // Fallback to hardcoded data
    if (!isLoading) {
      console.warn(
        "[useEconomicComponentsData] Database empty or unavailable, falling back to hardcoded components"
      );
    }

    // Convert ATOMIC_ECONOMIC_COMPONENTS to array
    const fallbackComponents = Object.values(ATOMIC_ECONOMIC_COMPONENTS).filter(
      (comp): comp is AtomicEconomicComponent => comp !== undefined
    );

    // Apply category filter if specified
    const filtered = category
      ? fallbackComponents.filter((comp) => comp.category === category)
      : fallbackComponents;

    return {
      components: filtered,
      isUsingFallback: true,
    };
  }, [dbComponents, category, isLoading, isUsingFallbackFromAPI]);

  // ==================== RETURN HOOK INTERFACE ====================
  return {
    components,
    isLoading,
    error,
    isUsingFallback,
    incrementUsage: (componentType: EconomicComponentType) => {
      incrementUsage({ componentType });
    },
  };
}

/**
 * Transform database component format to AtomicEconomicComponent interface
 *
 * Converts database schema (when implemented) to the frontend component format.
 * This ensures backward compatibility with existing component consumers.
 *
 * The database component already has JSON fields parsed by the router, so we
 * just need to map field names and provide sensible defaults.
 */
function transformDatabaseComponent(dbComp: any): AtomicEconomicComponent {
  return {
    id: dbComp.id || dbComp.type.toLowerCase(),
    type: dbComp.type,
    name: dbComp.name,
    description: dbComp.description || "",
    effectiveness: dbComp.effectiveness || 75,
    synergies: dbComp.synergies || [],
    conflicts: dbComp.conflicts || [],
    governmentSynergies: dbComp.governmentSynergies || [],
    governmentConflicts: dbComp.governmentConflicts || [],
    taxImpact: dbComp.taxImpact || {
      optimalCorporateRate: 20,
      optimalIncomeRate: 25,
      revenueEfficiency: 0.75,
    },
    sectorImpact: dbComp.sectorImpact || {},
    employmentImpact: dbComp.employmentImpact || {
      unemploymentModifier: 0,
      participationModifier: 1,
      wageGrowthModifier: 1,
    },
    implementationCost: dbComp.implementationCost || 100000,
    maintenanceCost: dbComp.maintenanceCost || 50000,
    requiredCapacity: dbComp.requiredCapacity || 75,
    category: dbComp.category || "Economic Model",
    icon: resolveComponentIcon(dbComp.icon),
    color: dbComp.color || "emerald",
    metadata: dbComp.metadata || {
      complexity: "Medium" as const,
      timeToImplement: "2-3 years",
      staffRequired: 150,
      technologyRequired: true,
    },
  };
}

/**
 * Get all available economic component categories
 */
export function useEconomicComponentCategories() {
  const { components } = useEconomicComponentsData();

  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    components.forEach((comp) => {
      if (comp.category) {
        categorySet.add(comp.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [components]);

  return categories;
}

/**
 * Get component by type
 */
export function useEconomicComponent(componentType: EconomicComponentType) {
  const { components, isLoading, error } = useEconomicComponentsData();

  const component = useMemo(() => {
    return components.find((comp) => comp.type === componentType);
  }, [components, componentType]);

  return {
    component,
    isLoading,
    error,
  };
}
