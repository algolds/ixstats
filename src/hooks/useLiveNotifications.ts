"use client";
/**
 * Unread-notification badge hook (page title "(N)" prefix).
 *
 * The full `useLiveNotifications()` hook that used to live here had no consumer and was
 * removed on 2026-09-25 (plan 342). Only `useNotificationBadge` remains.
 */

import { useEffect, useId } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import {
  applyRemainingBadge,
  clearBadgeCount,
  setBadgeCount,
  withUnreadPrefix,
} from "~/lib/notifications/title-badge";

/**
 * Hook specifically for unread count and title badge
 */
export function useNotificationBadge(options: { enableTitleBadge?: boolean } = {}) {
  const { enableTitleBadge = true } = options;
  const { user } = useUser();
  const userId = user?.id;
  const instanceId = useId();

  const { data: unreadData } = api.notifications.getUnreadCount.useQuery(undefined, {
    enabled: !!userId,
    refetchInterval: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const unreadCount = unreadData?.count ?? 0;

  // Update page title with unread count
  useEffect(() => {
    if (!enableTitleBadge || typeof document === "undefined") return;

    setBadgeCount(instanceId, unreadCount);
    document.title = withUnreadPrefix(unreadCount);

    return () => {
      clearBadgeCount(instanceId);
      if (typeof document !== "undefined") document.title = applyRemainingBadge();
    };
  }, [unreadCount, enableTitleBadge, instanceId]);

  return { unreadCount };
}
