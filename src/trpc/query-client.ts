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

export const createQueryClient = () =>
  new QueryClient({
    // Use selective logger in development
    logger: process.env.NODE_ENV === "development" ? selectiveLogger : undefined,
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        // Reduce retry attempts to minimize log noise
        retry: process.env.NODE_ENV === "production" ? 3 : 1,
        // Don't throw errors on failure - return error state instead
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
