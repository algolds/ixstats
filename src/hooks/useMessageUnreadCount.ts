"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

/**
 * Shared hook for message unread counts across all folders.
 * Used by: navigation badges, Dynamic Island, Messages folder rail.
 *
 * Returns the total inbox unread count and per-folder counts.
 * Uses a long staleTime to avoid excessive refetches — the Messages UI
 * invalidates this query when messages are read.
 */
export function useMessageUnreadCount() {
  const { user } = useUser();
  const userId = user?.id ?? "";

  const { data: folderCounts } = api.messages.getFolderCounts.useQuery(
    { userId },
    {
      enabled: !!userId,
      staleTime: 60_000, // 1 minute — badges don't need real-time accuracy
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    }
  );

  const counts = useMemo(
    () => ({
      inbox: folderCounts?.inbox ?? 0,
      personal: folderCounts?.personal ?? 0,
      diplomatic: folderCounts?.diplomatic ?? 0,
      discussions: folderCounts?.discussions ?? 0,
      groups: folderCounts?.groups ?? 0,
      system: folderCounts?.system ?? 0,
    }),
    [folderCounts]
  );

  return {
    totalUnread: counts.inbox,
    counts,
    hasUnread: counts.inbox > 0,
  };
}
