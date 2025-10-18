/**
 * Economic Archetypes Index
 *
 * Central index for all economic archetypes (modern and historical).
 * Provides unified access, categorization, and helper functions for archetype management.
 */

import { modernArchetypes } from './modern';
import { historicalArchetypes } from './historical';
import type { EconomicArchetype } from '../archetype-types';
import { ArchetypeCategory } from '../archetype-types';

// ============================================================================
// Combined Collections
// ============================================================================

/**
 * All economic archetypes combined into a single Map
 * Contains both modern and historical models (20 total)
 */
export const allArchetypes = new Map<string, EconomicArchetype>([
  ...modernArchetypes,
  ...historicalArchetypes,
]);

// ============================================================================
// Categorized Collections
// ============================================================================

/**
 * Archetypes organized by geographic region
 */
export const archetypesByRegion = {
  northAmerica: Array.from(allArchetypes.values()).filter(a =>
    a.region.includes('United States') || a.region.includes('Canada')
  ),
  europe: Array.from(allArchetypes.values()).filter(a =>
    a.region.includes('Germany') ||
    a.region.includes('Scandinavia') ||
    a.region.includes('Switzerland') ||
    a.region.includes('Netherlands') ||
    a.region.includes('France') ||
    a.region.includes('Italy') ||
    a.region.includes('Northern Europe') ||
    a.region.includes('Great Britain') ||
    a.region.includes('British Empire')
  ),
  asia: Array.from(allArchetypes.values()).filter(a =>
    a.region.includes('East Asia') ||
    a.region.includes('Japan') ||
    a.region.includes('Singapore') ||
    a.region.includes('China')
  ),
  oceania: Array.from(allArchetypes.values()).filter(a =>
    a.region.includes('Australia')
  ),
  latinAmerica: Array.from(allArchetypes.values()).filter(a =>
    a.region.includes('Brazil')
  ),
  multiRegional: Array.from(allArchetypes.values()).filter(a =>
    a.region.includes('Global') ||
    a.region.includes('Multi-continental') ||
    a.region.includes('Baltic')
  ),
};

/**
 * Archetypes organized by historical era
 */
export const archetypesByEra = {
  modern: Array.from(modernArchetypes.values()),
  historical: Array.from(historicalArchetypes.values()),
  contemporary: Array.from(modernArchetypes.values()).filter(a =>
    a.id === 'silicon-valley' ||
    a.id === 'singapore' ||
    a.id === 'nordic' ||
    a.id === 'asian-tiger'
  ),
  industrial: Array.from(historicalArchetypes.values()).filter(a =>
    a.id === 'industrial-revolution' ||
    a.id === 'american-gilded-age' ||
    a.id === 'british-empire'
  ),
  preindustrial: Array.from(historicalArchetypes.values()).filter(a =>
    a.id === 'venetian-republic' ||
    a.id === 'hanseatic-league' ||
    a.id === 'dutch-golden-age' ||
    a.id === 'french-mercantilism' ||
    a.id === 'ottoman-empire' ||
    a.id === 'chinese-ming-dynasty'
  ),
  twentiethCentury: Array.from(allArchetypes.values()).filter(a =>
    a.id === 'soviet-command' ||
    a.id === 'japanese' ||
    a.id === 'german-social-market' ||
    a.id === 'brazilian' ||
    a.id === 'australian' ||
    a.id === 'canadian'
  ),
};

/**
 * Archetypes organized by development level/complexity
 */
export const archetypesByDevelopmentLevel = {
  high: Array.from(allArchetypes.values()).filter(a =>
    a.implementationComplexity === 'high'
  ),
  medium: Array.from(allArchetypes.values()).filter(a =>
    a.implementationComplexity === 'medium'
  ),
  low: Array.from(allArchetypes.values()).filter(a =>
    a.implementationComplexity === 'low'
  ),
};

/**
 * Archetypes organized by economic focus
 */
export const archetypesByEconomicFocus = {
  technology: Array.from(allArchetypes.values()).filter(a =>
    a.economicComponents.some(c =>
      c.toString().includes('INNOVATION') ||
      c.toString().includes('TECHNOLOGY') ||
      c.toString().includes('KNOWLEDGE')
    )
  ),
  manufacturing: Array.from(allArchetypes.values()).filter(a =>
    a.economicComponents.some(c =>
      c.toString().includes('MANUFACTURING')
    )
  ),
  services: Array.from(allArchetypes.values()).filter(a =>
    a.economicComponents.some(c =>
      c.toString().includes('SERVICE')
    )
  ),
  trade: Array.from(allArchetypes.values()).filter(a =>
    a.economicComponents.some(c =>
      c.toString().includes('TRADE') ||
      c.toString().includes('EXPORT')
    )
  ),
  resources: Array.from(allArchetypes.values()).filter(a =>
    a.economicComponents.some(c =>
      c.toString().includes('RESOURCE') ||
      c.toString().includes('EXTRACTION')
    )
  ),
  social: Array.from(allArchetypes.values()).filter(a =>
    a.economicComponents.some(c =>
      c.toString().includes('SOCIAL') ||
      c.toString().includes('WELFARE')
    )
  ),
};

/**
 * Archetypes organized by government style
 */
export const archetypesByGovernmentStyle = {
  democratic: Array.from(allArchetypes.values()).filter(a =>
    a.governmentComponents.some(c =>
      c.toString().includes('DEMOCRATIC')
    )
  ),
  authoritarian: Array.from(allArchetypes.values()).filter(a =>
    a.governmentComponents.some(c =>
      c.toString().includes('AUTOCRATIC') ||
      c.toString().includes('CENTRALIZED')
    )
  ),
  mixed: Array.from(allArchetypes.values()).filter(a =>
    a.governmentComponents.some(c =>
      c.toString().includes('MIXED') ||
      c.toString().includes('HYBRID')
    )
  ),
  minimal: Array.from(allArchetypes.values()).filter(a =>
    a.governmentComponents.some(c =>
      c.toString().includes('MINIMAL')
    )
  ),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Retrieves a specific archetype by its ID
 *
 * @param id - The unique identifier of the archetype
 * @returns The archetype if found, undefined otherwise
 *
 * @example
 * const archetype = getArchetypeById('silicon-valley');
 */
export function getArchetypeById(id: string): EconomicArchetype | undefined {
  return allArchetypes.get(id);
}

/**
 * Retrieves archetypes by category
 *
 * @param category - The category to filter by
 * @returns Array of archetypes in the specified category
 *
 * @example
 * const modern = getArchetypesByCategory(ArchetypeCategory.MODERN);
 */
export function getArchetypesByCategory(category: ArchetypeCategory): EconomicArchetype[] {
  switch (category) {
    case ArchetypeCategory.MODERN:
      return Array.from(modernArchetypes.values());
    case ArchetypeCategory.HISTORICAL:
      return Array.from(historicalArchetypes.values());
    case ArchetypeCategory.REGIONAL:
      return [
        ...archetypesByRegion.europe,
        ...archetypesByRegion.asia,
        ...archetypesByRegion.latinAmerica,
      ];
    case ArchetypeCategory.EMERGING:
      return Array.from(allArchetypes.values()).filter(a =>
        a.id === 'asian-tiger' ||
        a.id === 'brazilian' ||
        a.id === 'singapore'
      );
    case ArchetypeCategory.TRADITIONAL:
      return archetypesByEra.preindustrial;
    case ArchetypeCategory.EXPERIMENTAL:
      return Array.from(allArchetypes.values()).filter(a =>
        a.id === 'soviet-command'
      );
    default:
      return [];
  }
}

/**
 * Search archetypes by name, description, region, or characteristics
 *
 * @param query - Search query string (case-insensitive)
 * @returns Array of matching archetypes
 *
 * @example
 * const results = searchArchetypes('innovation');
 * const techResults = searchArchetypes('tech');
 */
export function searchArchetypes(query: string): EconomicArchetype[] {
  if (!query || query.trim().length === 0) {
    return Array.from(allArchetypes.values());
  }

  const searchTerm = query.toLowerCase().trim();

  return Array.from(allArchetypes.values()).filter(archetype => {
    // Search in name
    if (archetype.name.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in description
    if (archetype.description.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in region
    if (archetype.region.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in characteristics
    if (archetype.characteristics.some(c => c.toLowerCase().includes(searchTerm))) {
      return true;
    }

    // Search in strengths
    if (archetype.strengths.some(s => s.toLowerCase().includes(searchTerm))) {
      return true;
    }

    // Search in historical context
    if (archetype.historicalContext.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in modern examples
    if (archetype.modernExamples.some(e => e.toLowerCase().includes(searchTerm))) {
      return true;
    }

    return false;
  });
}

/**
 * Filter archetypes by multiple criteria
 *
 * @param filters - Object containing filter criteria
 * @returns Array of archetypes matching all criteria
 *
 * @example
 * const filtered = filterArchetypes({
 *   region: 'Europe',
 *   complexity: 'high',
 *   minGdpGrowth: 3.0
 * });
 */
export function filterArchetypes(filters: {
  region?: string;
  complexity?: 'low' | 'medium' | 'high';
  minGdpGrowth?: number;
  maxGdpGrowth?: number;
  minInnovation?: number;
  hasEconomicComponent?: string;
  hasGovernmentComponent?: string;
}): EconomicArchetype[] {
  return Array.from(allArchetypes.values()).filter(archetype => {
    // Filter by region
    if (filters.region && !archetype.region.toLowerCase().includes(filters.region.toLowerCase())) {
      return false;
    }

    // Filter by complexity
    if (filters.complexity && archetype.implementationComplexity !== filters.complexity) {
      return false;
    }

    // Filter by minimum GDP growth
    if (filters.minGdpGrowth !== undefined && archetype.growthMetrics.gdpGrowth < filters.minGdpGrowth) {
      return false;
    }

    // Filter by maximum GDP growth
    if (filters.maxGdpGrowth !== undefined && archetype.growthMetrics.gdpGrowth > filters.maxGdpGrowth) {
      return false;
    }

    // Filter by minimum innovation index
    if (filters.minInnovation !== undefined && archetype.growthMetrics.innovationIndex < filters.minInnovation) {
      return false;
    }

    // Filter by economic component presence
    if (filters.hasEconomicComponent) {
      const hasComponent = archetype.economicComponents.some(c =>
        c.toString().toLowerCase().includes(filters.hasEconomicComponent!.toLowerCase())
      );
      if (!hasComponent) return false;
    }

    // Filter by government component presence
    if (filters.hasGovernmentComponent) {
      const hasComponent = archetype.governmentComponents.some(c =>
        c.toString().toLowerCase().includes(filters.hasGovernmentComponent!.toLowerCase())
      );
      if (!hasComponent) return false;
    }

    return true;
  });
}

/**
 * Get recommended archetypes based on criteria
 *
 * @param criteria - Desired characteristics
 * @returns Array of recommended archetypes sorted by relevance
 *
 * @example
 * const recommendations = getRecommendedArchetypes({
 *   focusArea: 'technology',
 *   preferredComplexity: 'medium',
 *   region: 'Asia'
 * });
 */
export function getRecommendedArchetypes(criteria: {
  focusArea?: 'technology' | 'manufacturing' | 'services' | 'trade' | 'resources' | 'social';
  preferredComplexity?: 'low' | 'medium' | 'high';
  region?: string;
  modernOnly?: boolean;
}): EconomicArchetype[] {
  let candidates = Array.from(allArchetypes.values());

  // Filter by era if modern only
  if (criteria.modernOnly) {
    candidates = Array.from(modernArchetypes.values());
  }

  // Filter by region
  if (criteria.region) {
    candidates = candidates.filter(a =>
      a.region.toLowerCase().includes(criteria.region!.toLowerCase())
    );
  }

  // Filter by focus area
  if (criteria.focusArea) {
    const focusMap = archetypesByEconomicFocus;
    const focusArchetypes = focusMap[criteria.focusArea] || [];
    const focusIds = new Set(focusArchetypes.map(a => a.id));
    candidates = candidates.filter(a => focusIds.has(a.id));
  }

  // Sort by complexity preference (exact match first, then others)
  if (criteria.preferredComplexity) {
    candidates.sort((a, b) => {
      const aMatch = a.implementationComplexity === criteria.preferredComplexity ? 0 : 1;
      const bMatch = b.implementationComplexity === criteria.preferredComplexity ? 0 : 1;
      return aMatch - bMatch;
    });
  }

  // Sort by relevance metrics (GDP growth, innovation, stability)
  candidates.sort((a, b) => {
    const aScore = a.growthMetrics.gdpGrowth +
                   a.growthMetrics.innovationIndex +
                   a.growthMetrics.stability;
    const bScore = b.growthMetrics.gdpGrowth +
                   b.growthMetrics.innovationIndex +
                   b.growthMetrics.stability;
    return bScore - aScore;
  });

  return candidates;
}

/**
 * Compare multiple archetypes
 *
 * @param archetypeIds - Array of archetype IDs to compare
 * @returns Comparison data object
 *
 * @example
 * const comparison = compareArchetypes(['silicon-valley', 'nordic', 'asian-tiger']);
 */
export function compareArchetypes(archetypeIds: string[]): {
  archetypes: EconomicArchetype[];
  metrics: {
    gdpGrowth: Record<string, number>;
    innovation: Record<string, number>;
    stability: Record<string, number>;
    competitiveness: Record<string, number>;
    unemployment: Record<string, number>;
    taxEfficiency: Record<string, number>;
  };
  summary: {
    highestGrowth: string;
    mostInnovative: string;
    mostStable: string;
    lowestUnemployment: string;
    mostEfficient: string;
  };
} {
  const archetypes = archetypeIds
    .map(id => getArchetypeById(id))
    .filter((a): a is EconomicArchetype => a !== undefined);

  const metrics = {
    gdpGrowth: {} as Record<string, number>,
    innovation: {} as Record<string, number>,
    stability: {} as Record<string, number>,
    competitiveness: {} as Record<string, number>,
    unemployment: {} as Record<string, number>,
    taxEfficiency: {} as Record<string, number>,
  };

  let highestGrowth = { id: '', value: -Infinity };
  let mostInnovative = { id: '', value: -Infinity };
  let mostStable = { id: '', value: -Infinity };
  let lowestUnemployment = { id: '', value: Infinity };
  let mostEfficient = { id: '', value: -Infinity };

  archetypes.forEach(archetype => {
    const id = archetype.id;

    metrics.gdpGrowth[id] = archetype.growthMetrics.gdpGrowth;
    metrics.innovation[id] = archetype.growthMetrics.innovationIndex;
    metrics.stability[id] = archetype.growthMetrics.stability;
    metrics.competitiveness[id] = archetype.growthMetrics.competitiveness;
    metrics.unemployment[id] = archetype.employmentProfile.unemploymentRate;
    metrics.taxEfficiency[id] = archetype.taxProfile.revenueEfficiency * 100;

    if (archetype.growthMetrics.gdpGrowth > highestGrowth.value) {
      highestGrowth = { id, value: archetype.growthMetrics.gdpGrowth };
    }
    if (archetype.growthMetrics.innovationIndex > mostInnovative.value) {
      mostInnovative = { id, value: archetype.growthMetrics.innovationIndex };
    }
    if (archetype.growthMetrics.stability > mostStable.value) {
      mostStable = { id, value: archetype.growthMetrics.stability };
    }
    if (archetype.employmentProfile.unemploymentRate < lowestUnemployment.value) {
      lowestUnemployment = { id, value: archetype.employmentProfile.unemploymentRate };
    }
    if (archetype.taxProfile.revenueEfficiency > mostEfficient.value) {
      mostEfficient = { id, value: archetype.taxProfile.revenueEfficiency };
    }
  });

  return {
    archetypes,
    metrics,
    summary: {
      highestGrowth: highestGrowth.id,
      mostInnovative: mostInnovative.id,
      mostStable: mostStable.id,
      lowestUnemployment: lowestUnemployment.id,
      mostEfficient: mostEfficient.id,
    },
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export { modernArchetypes, historicalArchetypes };
export type { EconomicArchetype } from '../archetype-types';
export { ArchetypeCategory } from '../archetype-types';
