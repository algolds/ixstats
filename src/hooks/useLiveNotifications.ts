"use client";
/**
 * Unread-notification badge hook (page title "(N)" prefix).
 *
 * The full `useLiveNotifications()` hook that used to live here had no consumer and was
 * removed on 2026-09-25 (plan 342). Only `useNotificationBadge` remains.
 */

import { useEffect } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

/** Matches the "(N) " prefix this hook writes, so it can be re-applied or removed. */
const UNREAD_PREFIX = /^\(\d+\) /;

// The base title is read from document.title at the moment of each write, never cached:
// pages change the title (usePageTitle, Next metadata) while this hook stays mounted
// app-wide, so any remembered copy would revert to a stale page's title.
function withUnreadPrefix(count: number): string {
  const base = document.title.replace(UNREAD_PREFIX, "");
  return count > 0 ? `(${count}) ${base}` : base;
}

/**
 * Hook specifically for unread count and title badge
 */
export function useNotificationBadge(options: { enableTitleBadge?: boolean } = {}) {
  const { enableTitleBadge = true } = options;
  const { user } = useUser();
  const userId = user?.id;

  const { data: unreadData } = api.notifications.getUnreadCount.useQuery(undefined, {
    enabled: !!userId,
    refetchInterval: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const unreadCount = unreadData?.count ?? 0;

  // Update page title with unread count
  useEffect(() => {
    if (!enableTitleBadge || typeof document === "undefined") return;

    document.title = withUnreadPrefix(unreadCount);

    return () => {
      if (typeof document !== "undefined") document.title = withUnreadPrefix(0);
    };
  }, [unreadCount, enableTitleBadge]);

  return { unreadCount };
}
