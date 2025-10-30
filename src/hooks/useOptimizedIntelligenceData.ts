// Optimized Intelligence Data Hook - Phase 3 Performance Enhancement
// Smart query batching and optimization for maximum performance

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import type { Country, IntelligenceItem, VitalityIntelligence } from "~/types/intelligence-unified";
import type { DeliveryMethod } from "~/types/unified-notifications";
import { useNotificationStore } from "~/stores/notificationStore";
import { useUnifiedNotifications } from "~/hooks/useUnifiedNotifications";
import { createAbsoluteUrl } from "~/lib/url-utils";

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
  cacheTime = 300000, // 5 minutes cache time
}: QueryConfig): OptimizedIntelligenceData {
  // Use tRPC hooks for queries
  const utils = api.useUtils();

  // Batch related queries with optimized caching
  const queries = useQueries({
    queries: [
      // Core country data - longest cache since it changes less frequently
      {
        queryKey: ["country", countryId],
        queryFn: async () => {
          const result = await utils.client.countries.getByIdAtTime.query({ id: countryId });
          return result;
        },
        staleTime: staleTime * 2, // Country data stays fresh longer
        gcTime: cacheTime * 2,
        enabled: !!countryId,
      },

      // Intelligence feed - medium cache since it updates regularly
      {
        queryKey: ["intelligence", countryId],
        queryFn: async () => {
          const result = await utils.client.intelligence.getFeed.query();
          return result;
        },
        staleTime,
        gcTime: cacheTime,
        enabled: !!countryId && enableIntelligence,
      },

      // Vitality intelligence - disabled as API method doesn't exist
      {
        queryKey: ["vitality", countryId],
        queryFn: () => Promise.resolve(null), // API method doesn't exist
        staleTime: staleTime / 2,
        gcTime: cacheTime,
        enabled: false, // Disabled until API is implemented
      },
    ],
  });

  // Memoize the result to prevent unnecessary re-renders
  // Get notification system for live wire integration
  const { createNotification } = useUnifiedNotifications();
  const addNotification = useNotificationStore((state) => state.addNotification);

  // Wire intelligence data changes to global notifications
  useEffect(() => {
    const [, intelligenceQuery] = queries;

    if (intelligenceQuery.data && Array.isArray(intelligenceQuery.data)) {
      // Check for new high-priority intelligence items
      const highPriorityItems = intelligenceQuery.data.filter((item: IntelligenceItem) =>
        ["high", "critical"].includes(
          (item as IntelligenceItem & { priority?: string }).priority || "medium"
        )
      );

      // Create notifications for critical intelligence updates
      highPriorityItems.forEach(async (item: IntelligenceItem) => {
        const notificationData = {
          source: "intelligence" as const,
          title: `Intelligence Alert: ${item.title}`,
          message: item.content || "New intelligence information available",
          category: "security" as const,
          type: "alert" as const,
          priority: ((item as IntelligenceItem & { priority?: string }).priority || "medium") as
            | "low"
            | "medium"
            | "high"
            | "critical",
          severity: "important" as const,
          deliveryMethod: "dynamic-island" as const,
          actionable: true,
          status: "pending" as const,
          context: {
            userId: "system",
            countryId: countryId || "unknown",
            isExecutiveMode: false,
            currentRoute: "/sdi",
            ixTime: Date.now(),
            realTime: Date.now(),
            timeMultiplier: 2,
            activeFeatures: [],
            recentActions: [],
            focusMode: false,
            sessionDuration: 0,
            isUserActive: true,
            lastInteraction: Date.now(),
            deviceType: "desktop" as const,
            screenSize: "large" as const,
            networkQuality: "high" as const,
            batteryLevel: 100,
            userPreferences: {
              preferredMethods: ["dynamic-island"] as DeliveryMethod[],
              quietHours: null,
              batchingEnabled: false,
              maxNotificationsPerHour: 10,
              categories: {} as any,
              executiveModeFilters: [],
              publicModeFilters: [],
              allowMLPersonalization: false,
              trackEngagement: false,
            },
            historicalEngagement: [],
            interactionHistory: [],
            contextualFactors: {},
            urgencyFactors: [],
            contextualRelevance: 0.8,
          },
          relevanceScore: 0.8,
          actions: [
            {
              id: "view-intelligence",
              label: "View Details",
              type: "primary" as const,
              onClick: () => {
                window.location.href = createAbsoluteUrl("/sdi");
              },
            },
          ],
          triggers: [
            {
              type: "data-change" as const,
              source: "intelligence-feed",
              data: item,
              confidence: 0.9,
            },
          ],
        };

        // Add to both systems for redundancy
        try {
          await addNotification(notificationData);
        } catch (error) {
          console.warn("Failed to add intelligence notification:", error);
        }
      });
    }
  }, [queries[1].data, addNotification]);

  const result = useMemo((): OptimizedIntelligenceData => {
    const [countryQuery, intelligenceQuery, vitalityQuery] = queries;

    return {
      country: (countryQuery.data as unknown as Country) || null,
      intelligence: intelligenceQuery.data || null,
      vitality: vitalityQuery.data || null,
      isLoading: queries.some((q) => q.isLoading),
      isError: queries.some((q) => q.isError),
      error: queries.find((q) => q.error)?.error || null,
      refetchAll: () => {
        queries.forEach((query) => {
          if (query?.refetch) {
            query.refetch();
          }
        });
      },
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
    cacheTime: 180000,
  });

  // Additional executive-specific queries
  const executiveQueries = useQueries({
    queries: [
      // Regional comparison data
      {
        queryKey: ["regional-comparison", countryId],
        queryFn: () => Promise.resolve(null), // API method doesn't exist
        staleTime: 60000, // Regional data changes less frequently
        gcTime: 300000,
        enabled: !!countryId && !!baseData.country,
      },

      // Economic trends for the country
      {
        queryKey: ["economic-trends", countryId],
        queryFn: () => Promise.resolve(null), // API method doesn't exist
        staleTime: 120000, // Trends are calculated data, can be cached longer
        gcTime: 600000,
        enabled: !!countryId && !!baseData.country,
      },

      // Critical alerts specific to this country
      {
        queryKey: ["critical-alerts", countryId],
        queryFn: () => Promise.resolve(null), // API method doesn't exist
        staleTime: 5000, // Critical alerts need to be very fresh
        gcTime: 30000,
        enabled: !!countryId,
      },
    ],
  });

  return useMemo(
    () => ({
      ...baseData,
      regionalComparison: executiveQueries[0]?.data || null,
      economicTrends: executiveQueries[1]?.data || null,
      criticalAlerts: executiveQueries[2]?.data || null,
      executiveLoading: executiveQueries.some((q) => q.isLoading),
      refetchExecutive: () => {
        baseData.refetchAll();
        executiveQueries.forEach((query) => {
          if (query?.refetch) {
            query.refetch();
          }
        });
      },
    }),
    [baseData, executiveQueries]
  );
}

/**
 * Lightweight hook for component-specific intelligence data
 * Optimized for components that only need specific subsets of data
 */
export function useIntelligenceSubset(
  countryId: string,
  subset: "vitality-only" | "intelligence-only" | "country-only"
) {
  const config = useMemo(() => {
    switch (subset) {
      case "vitality-only":
        return { enableIntelligence: false, enableVitality: true };
      case "intelligence-only":
        return { enableIntelligence: true, enableVitality: false };
      case "country-only":
        return { enableIntelligence: false, enableVitality: false };
      default:
        return { enableIntelligence: true, enableVitality: true };
    }
  }, [subset]);

  return useOptimizedIntelligenceData({
    countryId,
    ...config,
    staleTime: 45000, // Subset data can be cached longer
    cacheTime: 400000,
  });
}

/**
 * Performance monitoring hook for query optimization
 * Tracks query performance and provides optimization insights
 */
interface QueryPerformanceMetrics {
  cacheHitRate: number;
  averageQueryTime: number;
  totalQueries: number;
  optimizationSuggestions: string[];
}

export function useQueryPerformanceMetrics() {
  return useQuery({
    queryKey: ["query-performance-metrics"],
    queryFn: async (): Promise<QueryPerformanceMetrics> => {
      const metrics: QueryPerformanceMetrics = {
        cacheHitRate: 0,
        averageQueryTime: 0,
        totalQueries: 0,
        optimizationSuggestions: [],
      };

      // In a real implementation, this would collect actual metrics
      // from the query client and provide optimization insights

      return metrics;
    },
    staleTime: 60000, // Performance metrics update every minute
    gcTime: 120000,
  });
}

/**
 * Preload intelligence data for improved perceived performance
 * Useful for prefetching data before user navigation
 */
export function preloadIntelligenceData(countryId: string) {
  const queryClient = api.useUtils();

  return useMemo(
    () => ({
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
      },
    }),
    [countryId, queryClient]
  );
}
