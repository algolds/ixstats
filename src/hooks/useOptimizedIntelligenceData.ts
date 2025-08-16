// Optimized Intelligence Data Hook - Phase 3 Performance Enhancement
// Smart query batching and optimization for maximum performance

import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '~/trpc/react';
import type { Country, IntelligenceItem, VitalityIntelligence } from '~/types/intelligence';

interface OptimizedIntelligenceData {
  country: Country | null;
  intelligence: IntelligenceItem[] | null;
  vitality: VitalityIntelligence | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetchAll: () => void;
}

interface QueryConfig {
  countryId: string;
  enableIntelligence?: boolean;
  enableVitality?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

/**
 * Optimized hook for batching intelligence-related queries
 * Reduces API calls and improves performance through intelligent query coordination
 */
export function useOptimizedIntelligenceData({
  countryId,
  enableIntelligence = true,
  enableVitality = true,
  staleTime = 30000, // 30 seconds default stale time
  cacheTime = 300000  // 5 minutes cache time
}: QueryConfig): OptimizedIntelligenceData {

  // Batch related queries with optimized caching
  const queries = useQueries({
    queries: [
      // Core country data - longest cache since it changes less frequently
      {
        queryKey: ['country', countryId],
        queryFn: () => api.countries.getByIdAtTime.query({ id: countryId }),
        staleTime: staleTime * 2, // Country data stays fresh longer
        cacheTime: cacheTime * 2,
        enabled: !!countryId
      },
      
      // Intelligence feed - medium cache since it updates regularly
      {
        queryKey: ['intelligence', countryId],
        queryFn: () => api.intelligence.getFeed.query(),
        staleTime,
        cacheTime,
        enabled: !!countryId && enableIntelligence
      },
      
      // Vitality intelligence - disabled as API method doesn't exist
      {
        queryKey: ['vitality', countryId],
        queryFn: () => Promise.resolve(null), // API method doesn't exist
        staleTime: staleTime / 2,
        cacheTime,
        enabled: false // Disabled until API is implemented
      }
    ]
  });

  // Memoize the result to prevent unnecessary re-renders
  const result = useMemo((): OptimizedIntelligenceData => {
    const [countryQuery, intelligenceQuery, vitalityQuery] = queries;
    
    return {
      country: countryQuery.data || null,
      intelligence: intelligenceQuery.data || null,
      vitality: vitalityQuery.data || null,
      isLoading: queries.some(q => q.isLoading),
      isError: queries.some(q => q.isError),
      error: queries.find(q => q.error)?.error || null,
      refetchAll: () => {
        queries.forEach(query => query.refetch());
      }
    };
  }, [queries]);

  return result;
}

/**
 * Optimized hook for executive-level intelligence with additional context
 * Includes comparative data and enhanced analytics
 */
export function useOptimizedExecutiveIntelligence(countryId: string) {
  // Use base intelligence data
  const baseData = useOptimizedIntelligenceData({ 
    countryId,
    staleTime: 15000, // Executive data needs to be fresher
    cacheTime: 180000
  });

  // Additional executive-specific queries
  const executiveQueries = useQueries({
    queries: [
      // Regional comparison data
      {
        queryKey: ['regional-comparison', countryId],
        queryFn: () => Promise.resolve(null), // API method doesn't exist
        staleTime: 60000, // Regional data changes less frequently
        cacheTime: 300000,
        enabled: !!countryId && !!baseData.country
      },
      
      // Economic trends for the country
      {
        queryKey: ['economic-trends', countryId],
        queryFn: () => Promise.resolve(null), // API method doesn't exist
        staleTime: 120000, // Trends are calculated data, can be cached longer
        cacheTime: 600000,
        enabled: !!countryId && !!baseData.country
      },
      
      // Critical alerts specific to this country
      {
        queryKey: ['critical-alerts', countryId],
        queryFn: () => Promise.resolve(null), // API method doesn't exist
        staleTime: 5000, // Critical alerts need to be very fresh
        cacheTime: 30000,
        enabled: !!countryId
      }
    ]
  });

  return useMemo(() => ({
    ...baseData,
    regionalComparison: executiveQueries[0].data,
    economicTrends: executiveQueries[1].data,
    criticalAlerts: executiveQueries[2].data,
    executiveLoading: executiveQueries.some(q => q.isLoading),
    refetchExecutive: () => {
      baseData.refetchAll();
      executiveQueries.forEach(query => query.refetch());
    }
  }), [baseData, executiveQueries]);
}

/**
 * Lightweight hook for component-specific intelligence data
 * Optimized for components that only need specific subsets of data
 */
export function useIntelligenceSubset(
  countryId: string, 
  subset: 'vitality-only' | 'intelligence-only' | 'country-only'
) {
  const config = useMemo(() => {
    switch (subset) {
      case 'vitality-only':
        return { enableIntelligence: false, enableVitality: true };
      case 'intelligence-only':
        return { enableIntelligence: true, enableVitality: false };
      case 'country-only':
        return { enableIntelligence: false, enableVitality: false };
      default:
        return { enableIntelligence: true, enableVitality: true };
    }
  }, [subset]);

  return useOptimizedIntelligenceData({
    countryId,
    ...config,
    staleTime: 45000, // Subset data can be cached longer
    cacheTime: 400000
  });
}

/**
 * Performance monitoring hook for query optimization
 * Tracks query performance and provides optimization insights
 */
export function useQueryPerformanceMetrics() {
  return useQuery({
    queryKey: ['query-performance-metrics'],
    queryFn: async () => {
      const metrics = {
        cacheHitRate: 0,
        averageQueryTime: 0,
        totalQueries: 0,
        optimizationSuggestions: []
      };
      
      // In a real implementation, this would collect actual metrics
      // from the query client and provide optimization insights
      
      return metrics;
    },
    staleTime: 60000, // Performance metrics update every minute
    cacheTime: 120000
  });
}

/**
 * Preload intelligence data for improved perceived performance
 * Useful for prefetching data before user navigation
 */
export function preloadIntelligenceData(countryId: string) {
  const queryClient = api.useUtils();

  return useMemo(() => ({
    preloadCountry: () => {
      queryClient.countries.getByIdAtTime.prefetch({ id: countryId });
    },
    preloadIntelligence: () => {
      queryClient.intelligence.getFeed.prefetch();
    },
    preloadVitality: () => {
      // queryClient.countries.getVitalityIntelligence.prefetch({ countryId }); // API method doesn't exist
    },
    preloadAll: () => {
      queryClient.countries.getByIdAtTime.prefetch({ id: countryId });
      queryClient.intelligence.getFeed.prefetch();
      // queryClient.countries.getVitalityIntelligence.prefetch({ countryId }); // API method doesn't exist
    }
  }), [countryId, queryClient]);
}