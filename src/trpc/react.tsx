"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { httpBatchStreamLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import { type AppRouter } from "~/server/api/root";
import { createQueryClient } from "./query-client";
import { useAuth } from "~/context/auth-context";

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient();

  return clientQueryClientSingleton;
};

export const api = createTRPCReact<AppRouter>();

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const { getToken } = useAuth();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) => {
            // Only log errors, and suppress noisy analytics errors in dev
            const isError = op.direction === "down" && op.result instanceof Error;
            if (!isError) return false;
            // Suppress unifiedIntelligence.getAnalytics errors in the client console
            if (typeof op.path === "string" && op.path.startsWith("unifiedIntelligence.getAnalytics")) {
              return false;
            }
            return true;
          },
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/api/trpc",
          headers: async () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");

            // Add Clerk authentication token
            if (getToken) {
              const token = await getToken();
              if (token) {
                headers.set("authorization", `Bearer ${token}`);
              }
            }

            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  // Use NEXT_PUBLIC_BASE_PATH from environment or BASE_PATH, fallback to empty string
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || "";

  if (typeof window !== "undefined") return window.location.origin + basePath;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}${basePath}`;
  if (process.env.NODE_ENV === "production") return `https://ixwiki.com${basePath}`;
  return `http://localhost:${process.env.PORT ?? 3000}${basePath}`;
}
