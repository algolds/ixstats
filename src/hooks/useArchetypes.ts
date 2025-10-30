/**
 * useArchetypes Hook
 *
 * Provides database-backed economic archetypes with fallback to hardcoded data.
 * Integrates with tRPC API for archetype management and usage tracking.
 *
 * @module useArchetypes
 */

import { useMemo } from 'react';
import { api } from '~/trpc/react';
import { modernArchetypes } from '@/app/builder/data/archetypes/modern';
import { historicalArchetypes } from '@/app/builder/data/archetypes/historical';
import type { EconomicArchetype } from '@/app/builder/data/archetype-types';

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
export function useArchetypes(era?: 'modern' | 'historical' | 'all') {
  // Query database with 10-minute cache
  const { data: dbArchetypes, isLoading, error } = api.economicArchetypes.getAllArchetypes.useQuery(
    { era: era || 'all', isActive: true },
    { staleTime: 10 * 60 * 1000 } // 10-minute cache
  );

  // Process archetypes with fallback logic
  const { archetypes, isUsingFallback } = useMemo(() => {
    // Use database if available and not empty
    if (dbArchetypes && dbArchetypes.length > 0) {
      return {
        archetypes: dbArchetypes,
        isUsingFallback: false
      };
    }

    // Fallback to hardcoded data
    if (!isLoading) {
      console.warn('[useArchetypes] Database empty or unavailable, falling back to hardcoded archetypes');
    }

    const fallback: EconomicArchetype[] = [
      ...Array.from(modernArchetypes.values()),
      ...Array.from(historicalArchetypes.values())
    ];

    // Filter by era if specified
    let filtered = fallback;
    if (era === 'modern') {
      filtered = fallback.filter(a => modernArchetypes.has(a.id));
    } else if (era === 'historical') {
      filtered = fallback.filter(a => historicalArchetypes.has(a.id));
    }

    return {
      archetypes: filtered,
      isUsingFallback: true
    };
  }, [dbArchetypes, era, isLoading]);

  return {
    archetypes,
    isLoading,
    error,
    isUsingFallback
  };
}
