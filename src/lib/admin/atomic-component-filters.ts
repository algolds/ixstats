/**
 * Search and filter helpers for the read-only atomic component catalogs
 * (/admin/government-components and /admin/economic-components).
 */

export const COMPLEXITY_LEVELS = ["Low", "Medium", "High"] as const;

export interface FilterableAtomicComponent {
  name: string;
  description: string;
  category: string;
  metadata?: { complexity?: string };
}

/** Components matching the search text (name or description), category and complexity. */
export function filterAtomicComponents<T extends FilterableAtomicComponent>(
  components: readonly T[],
  searchTerm: string,
  categoryFilter: string,
  complexityFilter: string
): T[] {
  const lowerSearch = searchTerm.trim().toLowerCase();

  return components.filter((component) => {
    const matchesSearch =
      !lowerSearch ||
      component.name.toLowerCase().includes(lowerSearch) ||
      component.description.toLowerCase().includes(lowerSearch);
    const matchesCategory = categoryFilter === "all" || component.category === categoryFilter;
    const matchesComplexity =
      complexityFilter === "all" || component.metadata?.complexity === complexityFilter;

    return matchesSearch && matchesCategory && matchesComplexity;
  });
}

/** Distinct categories, sorted. */
export function componentCategories(components: readonly FilterableAtomicComponent[]): string[] {
  return Array.from(new Set(components.map((component) => component.category))).sort();
}
