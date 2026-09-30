"use client";

// src/hooks/admin/useAtomicComponentCatalog.ts
// Read-only catalog state for /admin/government-components and /admin/economic-components.
// The components are defined in code, so there's nothing to edit here.

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import {
  componentCategories,
  filterAtomicComponents,
  type FilterableAtomicComponent,
} from "~/lib/admin/atomic-component-filters";

export type AtomicComponentDomain = "economy" | "government";

/** The fields the catalog page shows, common to government and economic components. */
export interface CatalogComponent extends FilterableAtomicComponent {
  type: string;
  effectiveness: number;
  synergies: readonly string[];
  usageCount?: number;
}

export function useAtomicComponentCatalog(domain: AtomicComponentDomain) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [complexityFilter, setComplexityFilter] = useState("all");

  const queryOptions = { refetchOnWindowFocus: false } as const;
  const government = api.governmentComponents.getAllComponents.useQuery(undefined, {
    ...queryOptions,
    enabled: domain === "government",
  });
  const governmentStats = api.governmentComponents.getComponentUsageStats.useQuery(undefined, {
    ...queryOptions,
    enabled: domain === "government",
  });
  const economy = api.economicComponents.getAllComponents.useQuery(undefined, {
    ...queryOptions,
    enabled: domain === "economy",
  });
  const economyStats = api.economicComponents.getComponentUsageStats.useQuery(undefined, {
    ...queryOptions,
    enabled: domain === "economy",
  });
  const templates = api.economicComponents.getAllTemplates.useQuery(undefined, {
    ...queryOptions,
    enabled: domain === "economy",
  });

  const components = useMemo<readonly CatalogComponent[]>(
    () => (domain === "government" ? government.data?.components : economy.data?.components) ?? [],
    [domain, government.data, economy.data]
  );

  const filteredComponents = useMemo(
    () => filterAtomicComponents(components, searchTerm, categoryFilter, complexityFilter),
    [components, searchTerm, categoryFilter, complexityFilter]
  );

  const categories = useMemo(() => componentCategories(components), [components]);

  const synergyCount = useMemo(
    () => components.reduce((sum, component) => sum + component.synergies.length, 0),
    [components]
  );

  /** Active components adopted by nations. */
  const adoptionCount =
    domain === "government"
      ? governmentStats.data?.summary.totalUsage
      : economyStats.data?.totalUsage;

  return {
    components,
    filteredComponents,
    categories,
    synergyCount,
    adoptionCount,
    templates: templates.data?.templates ?? [],
    isLoading: domain === "government" ? government.isLoading : economy.isLoading,

    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    complexityFilter,
    setComplexityFilter,
  };
}
