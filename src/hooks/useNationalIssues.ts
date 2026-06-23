/**
 * Hook for the National Issues system.
 * Fetches issues, handles responses, and manages issue state.
 */

import { api } from "~/trpc/react";
import { useState, useCallback } from "react";

export function useNationalIssues(countryId: string | undefined, domain?: string) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Fetch active issues (optionally scoped to a domain, e.g. "political")
  const {
    data: activeData,
    isLoading: isLoadingActive,
    refetch: refetchActive,
  } = api.nationalIssues.getMyIssues.useQuery(
    { countryId: countryId!, status: "active", domain },
    { enabled: !!countryId, refetchInterval: 60000 }
  );

  // Fetch history
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = api.nationalIssues.getHistory.useQuery(
    { countryId: countryId!, limit: 20 },
    { enabled: !!countryId }
  );

  // Fetch single issue detail
  const { data: selectedIssue, isLoading: isLoadingDetail } = api.nationalIssues.getIssue.useQuery(
    { id: selectedIssueId! },
    { enabled: !!selectedIssueId }
  );

  // Pending count for badges
  const { data: countData, refetch: refetchCount } = api.nationalIssues.getPendingCount.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId, refetchInterval: 30000 }
  );

  // Mutations
  const respondMutation = api.nationalIssues.respond.useMutation({
    onSuccess: () => {
      void refetchActive();
      void refetchHistory();
      void refetchCount();
    },
  });

  const markViewedMutation = api.nationalIssues.markViewed.useMutation();

  const dismissMutation = api.nationalIssues.dismiss.useMutation({
    onSuccess: () => {
      void refetchActive();
      void refetchCount();
    },
  });

  const respond = useCallback(
    async (issueId: string, optionId: string) => {
      return respondMutation.mutateAsync({ issueId, optionId });
    },
    [respondMutation]
  );

  const markViewed = useCallback(
    (issueId: string) => {
      markViewedMutation.mutate({ id: issueId });
    },
    [markViewedMutation]
  );

  const dismiss = useCallback(
    async (issueId: string) => {
      return dismissMutation.mutateAsync({ id: issueId });
    },
    [dismissMutation]
  );

  const openIssue = useCallback(
    (issueId: string) => {
      setSelectedIssueId(issueId);
      markViewed(issueId);
    },
    [markViewed]
  );

  const closeIssue = useCallback(() => {
    setSelectedIssueId(null);
  }, []);

  return {
    // Data
    activeIssues: activeData?.issues ?? [],
    // getHistory isn't domain-aware; filter client-side when a domain is requested.
    historyIssues: domain
      ? (historyData?.issues ?? []).filter((i: { domain?: string }) => i.domain === domain)
      : (historyData?.issues ?? []),
    selectedIssue,
    pendingCount: countData?.total ?? 0,
    urgentCount: countData?.urgent ?? 0,

    // Loading states
    isLoadingActive,
    isLoadingHistory,
    isLoadingDetail,
    isResponding: respondMutation.isPending,

    // Response result
    lastResponse: respondMutation.data,

    // Actions
    respond,
    markViewed,
    dismiss,
    openIssue,
    closeIssue,
    refetch: () => {
      void refetchActive();
      void refetchCount();
    },
  };
}

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
