/**
 * useGovernmentComponentsData Hook
 *
 * Provides database-backed government component data with fallback to hardcoded data.
 * Integrates with tRPC API for component management and usage tracking.
 *
 * Phase 4 Migration: Database integration for government components with backward compatibility.
 *
 * @module useGovernmentComponentsData
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { ATOMIC_COMPONENTS, type AtomicGovernmentComponent } from "~/lib/atomic-government-data";
import type { ComponentType } from "@prisma/client";

/**
 * useGovernmentComponentsData - Fetch government component reference data
 *
 * Queries the database for government component metadata and falls back to hardcoded
 * data if the database is empty or unavailable. Supports filtering by category and
 * automatic caching with 10-minute staleTime.
 *
 * NOTE: Currently uses hardcoded fallback as reference data migration to database
 * is pending (Phase 4). When GovernmentComponentData model is added to schema,
 * this hook will automatically use database data.
 *
 * @param {string} [category] - Filter components by category (optional)
 * @returns {Object} Component data and loading state
 * @property {AtomicGovernmentComponent[]} components - List of government components
 * @property {boolean} isLoading - Loading state indicator
 * @property {any} error - Error object if query failed
 * @property {boolean} isUsingFallback - True if using hardcoded fallback data
 * @property {(componentType: ComponentType) => void} incrementUsage - Track component selection
 *
 * @example
 * ```tsx
 * function GovernmentBuilder() {
 *   const { components, isLoading, isUsingFallback, incrementUsage } =
 *     useGovernmentComponentsData('governance');
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
export function useGovernmentComponentsData(category?: string) {
  // ==================== DATABASE QUERY ====================
  const {
    data: dbResponse,
    isLoading,
    error,
  } = api.governmentComponents.getAllComponents.useQuery(
    { category, isActive: true },
    {
      staleTime: 10 * 60 * 1000, // 10-minute cache
      enabled: true,
    }
  );

  // Extract components from response
  const dbComponents = dbResponse?.components;

  // ==================== USAGE TRACKING MUTATION ====================
  // Track component selection for analytics
  const { mutate: incrementUsage } = api.governmentComponents.incrementComponentUsage.useMutation({
    onError: (err) => {
      console.warn("[useGovernmentComponentsData] Failed to track component usage:", err);
    },
  });

  // ==================== PROCESS COMPONENTS WITH FALLBACK ====================
  const { components, isUsingFallback } = useMemo(() => {
    // Use database if available and not empty
    if (dbComponents && dbComponents.length > 0) {
      // Transform database format to AtomicGovernmentComponent interface
      const transformed = dbComponents.map((dbComp: any) => transformDatabaseComponent(dbComp));

      // Apply category filter if specified
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
        "[useGovernmentComponentsData] Database empty or unavailable, falling back to hardcoded components"
      );
    }

    // Convert ATOMIC_COMPONENTS to array
    const fallbackComponents = Object.values(ATOMIC_COMPONENTS).filter(
      (comp): comp is AtomicGovernmentComponent => comp !== undefined
    );

    // Apply category filter if specified
    const filtered = category
      ? fallbackComponents.filter((comp) => comp.category === category)
      : fallbackComponents;

    return {
      components: filtered,
      isUsingFallback: true,
    };
  }, [dbComponents, category, isLoading]);

  // ==================== RETURN HOOK INTERFACE ====================
  return {
    components,
    isLoading,
    error,
    isUsingFallback,
    incrementUsage: (componentType: ComponentType) => {
      incrementUsage({ componentType });
    },
  };
}

/**
 * Transform database component format to AtomicGovernmentComponent interface
 *
 * Converts database schema (when implemented) to the frontend component format.
 * This ensures backward compatibility with existing component consumers.
 */
function transformDatabaseComponent(dbComp: any): AtomicGovernmentComponent {
  // TODO: Implement actual transformation when database schema is finalized
  // Expected database schema:
  // {
  //   id: string,
  //   componentType: ComponentType,
  //   name: string,
  //   description: string,
  //   effectiveness: number,
  //   synergies: ComponentType[],
  //   conflicts: ComponentType[],
  //   implementationCost: number,
  //   maintenanceCost: number,
  //   requiredCapacity: number,
  //   category: string,
  //   color: string,
  //   metadata: { complexity, timeToImplement, staffRequired, technologyRequired }
  // }

  return {
    id: dbComp.id || dbComp.componentType.toLowerCase(),
    type: dbComp.componentType,
    name: dbComp.name,
    description: dbComp.description || "",
    effectiveness: dbComp.effectiveness || dbComp.effectivenessScore || 50,
    synergies: dbComp.synergies || [],
    conflicts: dbComp.conflicts || [],
    implementationCost: dbComp.implementationCost || 0,
    maintenanceCost: dbComp.maintenanceCost || 0,
    requiredCapacity: dbComp.requiredCapacity || 50,
    category: dbComp.category || "general",
    prerequisites: dbComp.prerequisites || [],
    color: dbComp.color || "blue",
    icon: dbComp.icon || (() => null), // Placeholder - icons should be mapped from string to component
    metadata: dbComp.metadata || {
      complexity: "Medium" as const,
      timeToImplement: "12-18 months",
      staffRequired: 10,
      technologyRequired: false,
    },
  };
}

/**
 * Get all available government component categories
 */
export function useGovernmentComponentCategories() {
  const { components } = useGovernmentComponentsData();

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
export function useGovernmentComponent(componentType: ComponentType) {
  const { components, isLoading, error } = useGovernmentComponentsData();

  const component = useMemo(() => {
    return components.find((comp) => comp.type === componentType);
  }, [components, componentType]);

  return {
    component,
    isLoading,
    error,
  };
}
