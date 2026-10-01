import "server-only";

import { type QueryState } from "@tanstack/react-query";
import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { headers } from "next/headers";
import { cache } from "react";

import { createCaller, type AppRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { createQueryClient } from "./query-client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    headers: heads,
  });
});

const getQueryClient = cache(createQueryClient);
const caller = createCaller(createContext);

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient
);

/**
 * What `api.<path>.prefetch(input)` left in this request's query cache: the data it fetched or the
 * error it failed with (`prefetch` never throws), or undefined when nothing was prefetched. The key
 * is the one `createHydrationHelpers` and the React hooks build: `[path, { input, type: "query" }]`.
 */
export function prefetchedState<TData>(
  path: readonly string[],
  input: object
): QueryState<TData, Error> | undefined {
  return getQueryClient().getQueryState<TData, Error>([path, { input, type: "query" }]);
}

/**
 * Replaces what `api.<path>.prefetch(input)` left in this request's query cache with
 * `replace(current)`, before `HydrateClient` dehydrates it into the page. Does nothing when nothing
 * was prefetched.
 */
export function replacePrefetched<TData>(
  path: readonly string[],
  input: object,
  replace: (current: TData) => TData
): void {
  const queryClient = getQueryClient();
  const key = [path, { input, type: "query" }];
  const current = queryClient.getQueryData<TData>(key);
  if (current !== undefined) queryClient.setQueryData(key, replace(current));
}
