/**
 * Hook for the National Issues system.
 * Fetches issues, handles responses, and manages issue state.
 */

import { api } from "~/trpc/react";

/**
 * Lightweight hook for just the pending count (for badges).
 */
export function useIssueCount(countryId: string | undefined) {
  const { data, isLoading } = api.nationalIssues.getPendingCount.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId, refetchInterval: 30000 }
  );

  return {
    total: data?.total ?? 0,
    urgent: data?.urgent ?? 0,
    isLoading,
  };
}
