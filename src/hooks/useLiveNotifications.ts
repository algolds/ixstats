/**
 * Live Notifications Hook
 * Provides real-time notification updates with page title badge
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { api } from '~/trpc/react';

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

interface UseLiveNotificationsOptions {
  enableTitleBadge?: boolean;
  enableRealtime?: boolean;
  pollingInterval?: number;
}

interface UseLiveNotificationsReturn {
  notifications: LiveNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (notificationId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

let originalTitle: string | null = null;

export function useLiveNotifications(
  options: UseLiveNotificationsOptions = {}
): UseLiveNotificationsReturn {
  const {
    enableTitleBadge = true,
    enableRealtime = true,
    pollingInterval = 30000, // 30 seconds
  } = options;

  const { user } = useUser();
  const userId = user?.id;

  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Query for initial notifications
  const { data: notificationsData, isLoading, refetch } = api.notifications.getUserNotifications.useQuery(
    {
      limit: 50,
      offset: 0,
      unreadOnly: false,
    },
    {
      enabled: !!userId,
      refetchOnWindowFocus: true,
      refetchInterval: pollingInterval,
    }
  );

  // Query for unread count
  const { data: unreadData, refetch: refetchUnreadCount } = api.notifications.getUnreadCount.useQuery(
    undefined,
    {
      enabled: !!userId,
      refetchInterval: pollingInterval,
    }
  );

  // Mutations
  const markAsReadMutation = api.notifications.markAsRead.useMutation({
    onSuccess: () => {
      void refetch();
      void refetchUnreadCount();
    },
  });

  const markAllAsReadMutation = api.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      void refetch();
      void refetchUnreadCount();
    },
  });

  // Update notifications when data changes
  useEffect(() => {
    if (notificationsData?.notifications) {
      setNotifications(notificationsData.notifications as LiveNotification[]);
    }
  }, [notificationsData]);

  // Update unread count when data changes
  useEffect(() => {
    if (unreadData?.count !== undefined) {
      setUnreadCount(unreadData.count);
    } else if (notificationsData?.unreadCount !== undefined) {
      setUnreadCount(notificationsData.unreadCount);
    }
  }, [unreadData, notificationsData]);

  // Update page title with unread count
  useEffect(() => {
    if (!enableTitleBadge || typeof document === 'undefined') return;

    // Store original title on first run
    if (originalTitle === null) {
      originalTitle = document.title;
    }

    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${originalTitle}`;
    } else {
      document.title = originalTitle;
    }

    // Cleanup on unmount
    return () => {
      if (originalTitle !== null && typeof document !== 'undefined') {
        document.title = originalTitle;
      }
    };
  }, [unreadCount, enableTitleBadge]);

  // Handlers
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId) return;

    try {
      await markAsReadMutation.mutateAsync({
        notificationId,
        userId,
      });
    } catch (error) {
      console.error('[useLiveNotifications] Failed to mark as read:', error);
    }
  }, [userId, markAsReadMutation]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      await markAllAsReadMutation.mutateAsync({ userId });
    } catch (error) {
      console.error('[useLiveNotifications] Failed to mark all as read:', error);
    }
  }, [userId, markAllAsReadMutation]);

  const dismiss = useCallback(async (notificationId: string) => {
    if (!userId) return;

    try {
      // Update local state optimistically
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, dismissed: true } : n
        )
      );

      await markAsReadMutation.mutateAsync({
        notificationId,
        userId,
      });
    } catch (error) {
      console.error('[useLiveNotifications] Failed to dismiss:', error);
      // Revert optimistic update on error
      void refetch();
    }
  }, [userId, markAsReadMutation, refetch]);

  const refresh = useCallback(async () => {
    await Promise.all([
      refetch(),
      refetchUnreadCount(),
    ]);
  }, [refetch, refetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismiss,
    refresh,
  };
}

/**
 * Hook specifically for unread count and title badge
 */
export function useNotificationBadge(options: { enableTitleBadge?: boolean } = {}) {
  const { enableTitleBadge = true } = options;
  const { user } = useUser();
  const userId = user?.id;

  const { data: unreadData } = api.notifications.getUnreadCount.useQuery(
    undefined,
    {
      enabled: !!userId,
      refetchInterval: 30000, // 30 seconds
      refetchOnWindowFocus: true,
    }
  );

  const unreadCount = unreadData?.count ?? 0;

  // Update page title with unread count
  useEffect(() => {
    if (!enableTitleBadge || typeof document === 'undefined') return;

    if (originalTitle === null) {
      originalTitle = document.title;
    }

    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${originalTitle}`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      if (originalTitle !== null && typeof document !== 'undefined') {
        document.title = originalTitle;
      }
    };
  }, [unreadCount, enableTitleBadge]);

  return { unreadCount };
}
