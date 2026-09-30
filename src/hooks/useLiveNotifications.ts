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

export interface LiveNotification {
  id: string;
  userId: string | null;
  countryId: string | null;
  title: string;
  description: string | null;
  message: string | null;
  read: boolean;
  dismissed: boolean;
  href: string | null;
  type: string | null;
  category: string | null;
  priority: string;
  severity: string;
  source: string | null;
  actionable: boolean;
  metadata: string | null;
  relevanceScore: number | null;
  deliveryMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
}

let originalTitle: string | null = null;

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

    if (originalTitle === null) {
      originalTitle = document.title;
    }

    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${originalTitle}`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      if (originalTitle !== null && typeof document !== "undefined") {
        document.title = originalTitle;
      }
    };
  }, [unreadCount, enableTitleBadge]);

  return { unreadCount };
}
