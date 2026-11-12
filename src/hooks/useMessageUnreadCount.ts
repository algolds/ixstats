"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

type FolderCounts = {
  inbox?: number;
  thinktank?: number;
  diplomatic?: number;
  wiki?: number;
  forum?: number;
  requests?: number;
};

/**
 * The unread total for the badge. `inbox` already holds every per-source count (thinktank, diplomatic, wiki,
 * forum), so they are not added again. `requests` counts unanswered message requests, which `inbox` leaves out.
 */
export function messageUnreadTotal(folderCounts: FolderCounts | undefined): number {
  return (folderCounts?.inbox ?? 0) + (folderCounts?.requests ?? 0);
}

/**
 * Shared hook for message unread counts across all folders.
 * Used by: navigation badges, Dynamic Island, Messages folder rail.
 *
 * Shares one React Query entry with `useNavBadges` (same no-argument key, same options), so the
 * server is asked once. The Messages UI invalidates this query when messages are read.
 */
export function useMessageUnreadCount() {
  const { user } = useUser();
  const userId = user?.id ?? "";

  const { data: folderCounts, refetch } = api.messages.getFolderCounts.useQuery(undefined, {
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const counts = useMemo(
    () => ({
      inbox: folderCounts?.inbox ?? 0,
      thinktank: folderCounts?.thinktank ?? 0,
      diplomatic: folderCounts?.diplomatic ?? 0,
      wiki: folderCounts?.wiki ?? 0,
      forum: folderCounts?.forum ?? 0,
      requests: folderCounts?.requests ?? 0,
    }),
    [folderCounts]
  );

  const totalUnreadCount = messageUnreadTotal(folderCounts);

  return {
    totalUnread: totalUnreadCount,
    counts,
    hasUnread: totalUnreadCount > 0,
    refetch,
  };
}
