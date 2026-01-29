import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import SuperJSON from "superjson";

// Selective logger - suppress verbose logs but keep errors
const selectiveLogger = {
  log: () => {}, // Suppress info logs
  warn: () => {}, // Suppress warnings
  error: (...args: any[]) => {
    // Only log actual query errors, not React Query internals
    if (args[0]?.message && !args[0].message.includes("No QueryClient set")) {
      console.error("[React Query Error]", ...args);
    }
  },
};

/**
 * Cache time constants for consistent query caching strategy
 * - staleTime: How long data is considered fresh (won't refetch)
 * - gcTime: How long to keep data in cache after all observers unmount
 */
export const CACHE_TIMES = {
  /** Static/reference data that rarely changes (1hr stale / 24hr gc) */
  static: { staleTime: 60 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000 },
  /** Slow-changing data like country profiles (5min stale / 30min gc) */
  slow: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  /** Standard data like lists and dashboards (30s stale / 5min gc) */
  standard: { staleTime: 30 * 1000, gcTime: 5 * 60 * 1000 },
  /** Fast-changing data like real-time feeds (10s stale / 1min gc) */
  fast: { staleTime: 10 * 1000, gcTime: 60 * 1000 },
} as const;

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,        // Data is fresh for 30s
        gcTime: 5 * 60 * 1000,       // Keep in cache for 5 minutes after unmount
        // Reduce unnecessary refetches for better performance
        refetchOnWindowFocus: false, // Don't refetch when user returns to tab
        refetchOnReconnect: false,   // Don't refetch on network reconnect
        // Reduce retry attempts for faster failure feedback
        retry: process.env.NODE_ENV === "production" ? 2 : 0,
        // Don't throw errors on failure - return error state instead
        throwOnError: false,
      },
      mutations: {
        // Mutations should retry less aggressively
        retry: process.env.NODE_ENV === "production" ? 1 : 0,
        throwOnError: false,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
