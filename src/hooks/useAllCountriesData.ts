import { api, type RouterOutputs } from "~/trpc/react";

type GetAllCountriesOutput = RouterOutputs["countries"]["getAll"];

/**
 * Standardized hook to fetch all countries with a high staleTime.
 * Unifies caching across multiple pages and components to avoid redundant calls.
 */
export function useAllCountriesData<TData = GetAllCountriesOutput>(
  options?: Omit<
    Parameters<typeof api.countries.getAll.useQuery>[1],
    "select"
  > & {
    select?: (data: GetAllCountriesOutput) => TData;
  }
) {
  return api.countries.getAll.useQuery(
    {
      limit: 1000, // Standardized limit to capture all active countries
    },
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 60 * 60 * 1000,   // 60 minutes
      ...options,
    }
  );
}

