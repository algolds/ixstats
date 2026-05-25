/**
 * Live Notifications Hook
 * Provides real-time notification updates with page title badge
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  const utils = api.useUtils();

  // Query for initial notifications
  const {
    data: notificationsData,
    isLoading,
    refetch,
  } = api.notifications.getUserNotifications.useQuery(
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
  // Only enable when user is fully loaded to prevent auth errors
  const { data: unreadData, refetch: refetchUnreadCount } =
    api.notifications.getUnreadCount.useQuery(undefined, {
      enabled: !!userId && !!user,
      refetchInterval: pollingInterval,
    });

  // Derived state directly from Query Cache
  const notifications = (notificationsData?.notifications ?? []) as LiveNotification[];
  const unreadCount =
    unreadData?.count !== undefined ? unreadData.count : (notificationsData?.unreadCount ?? 0);

  // Mutations with Optimistic Updates and Rollback
  const markAsReadMutation = api.notifications.markAsRead.useMutation({
    onMutate: async ({ notificationId }) => {
      const queryKey = { limit: 50, offset: 0, unreadOnly: false };
      await utils.notifications.getUserNotifications.cancel(queryKey);
      await utils.notifications.getUnreadCount.cancel();

      const prevNotifications = utils.notifications.getUserNotifications.getData(queryKey);
      const prevUnreadCount = utils.notifications.getUnreadCount.getData();

      utils.notifications.getUserNotifications.setData(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            n.id === notificationId ? { ...n, read: true } : n
          ),
        };
      });

      utils.notifications.getUnreadCount.setData(undefined, (old) => {
        if (!old) return old;
        return {
          ...old,
          count: Math.max(0, old.count - 1),
        };
      });

      return { prevNotifications, prevUnreadCount };
    },
    onError: (err, variables, context) => {
      const queryKey = { limit: 50, offset: 0, unreadOnly: false };
      if (context?.prevNotifications) {
        utils.notifications.getUserNotifications.setData(queryKey, context.prevNotifications);
      }
      if (context?.prevUnreadCount) {
        utils.notifications.getUnreadCount.setData(undefined, context.prevUnreadCount);
      }
    },
    onSettled: () => {
      const queryKey = { limit: 50, offset: 0, unreadOnly: false };
      void utils.notifications.getUserNotifications.invalidate(queryKey);
      void utils.notifications.getUnreadCount.invalidate();
    },
  });

  const markAllAsReadMutation = api.notifications.markAllAsRead.useMutation({
    onMutate: async () => {
      const queryKey = { limit: 50, offset: 0, unreadOnly: false };
      await utils.notifications.getUserNotifications.cancel(queryKey);
      await utils.notifications.getUnreadCount.cancel();

      const prevNotifications = utils.notifications.getUserNotifications.getData(queryKey);
      const prevUnreadCount = utils.notifications.getUnreadCount.getData();

      utils.notifications.getUserNotifications.setData(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) => ({ ...n, read: true })),
        };
      });

      utils.notifications.getUnreadCount.setData(undefined, { count: 0 });

      return { prevNotifications, prevUnreadCount };
    },
    onError: (err, variables, context) => {
      const queryKey = { limit: 50, offset: 0, unreadOnly: false };
      if (context?.prevNotifications) {
        utils.notifications.getUserNotifications.setData(queryKey, context.prevNotifications);
      }
      if (context?.prevUnreadCount) {
        utils.notifications.getUnreadCount.setData(undefined, context.prevUnreadCount);
      }
    },
    onSettled: () => {
      const queryKey = { limit: 50, offset: 0, unreadOnly: false };
      void utils.notifications.getUserNotifications.invalidate(queryKey);
      void utils.notifications.getUnreadCount.invalidate();
    },
  });

  const dismissMutation = api.notifications.dismissNotification.useMutation({
    onMutate: async ({ notificationId }) => {
      const queryKey = { limit: 50, offset: 0, unreadOnly: false };
      await utils.notifications.getUserNotifications.cancel(queryKey);
      await utils.notifications.getUnreadCount.cancel();

      const prevNotifications = utils.notifications.getUserNotifications.getData(queryKey);
      const prevUnreadCount = utils.notifications.getUnreadCount.getData();

      let wasUnread = false;

      utils.notifications.getUserNotifications.setData(queryKey, (old) => {
        if (!old) return old;
        const notification = old.notifications.find((n) => n.id === notificationId);
        if (notification && !notification.read && !notification.dismissed) {
          wasUnread = true;
        }
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            n.id === notificationId ? { ...n, dismissed: true } : n
          ),
        };
      });

      if (wasUnread) {
        utils.notifications.getUnreadCount.setData(undefined, (old) => {
          if (!old) return old;
          return {
            ...old,
            count: Math.max(0, old.count - 1),
          };
        });
      }

      return { prevNotifications, prevUnreadCount };
    },
    onError: (err, variables, context) => {
      const queryKey = { limit: 50, offset: 0, unreadOnly: false };
      if (context?.prevNotifications) {
        utils.notifications.getUserNotifications.setData(queryKey, context.prevNotifications);
      }
      if (context?.prevUnreadCount) {
        utils.notifications.getUnreadCount.setData(undefined, context.prevUnreadCount);
      }
    },
    onSettled: () => {
      const queryKey = { limit: 50, offset: 0, unreadOnly: false };
      void utils.notifications.getUserNotifications.invalidate(queryKey);
      void utils.notifications.getUnreadCount.invalidate();
    },
  });

  // Real-time Subscription updates the tRPC query cache directly
  api.notifications.onNotificationAdded.useSubscription(
    { userId },
    {
      enabled: enableRealtime && !!userId,
      onData: (notification) => {
        const queryKey = { limit: 50, offset: 0, unreadOnly: false };

        utils.notifications.getUserNotifications.setData(queryKey, (oldData) => {
          const normalized: LiveNotification = {
            ...(notification as LiveNotification),
            createdAt: new Date(notification.createdAt),
            updatedAt: new Date(notification.updatedAt),
          };

          if (!oldData) {
            return {
              notifications: [normalized],
              unreadCount: normalized.read || normalized.dismissed ? 0 : 1,
            };
          }

          const existingIndex = oldData.notifications.findIndex(
            (item) => item.id === normalized.id
          );
          let nextNotifications = [...oldData.notifications];
          if (existingIndex !== -1) {
            nextNotifications[existingIndex] = normalized;
          } else {
            nextNotifications = [normalized, ...oldData.notifications].slice(0, 50);
          }

          return {
            ...oldData,
            notifications: nextNotifications,
          };
        });

        if (!notification.read && !notification.dismissed) {
          utils.notifications.getUnreadCount.setData(undefined, (oldData) => {
            if (!oldData) return { count: 1 };
            return {
              ...oldData,
              count: oldData.count + 1,
            };
          });
        }
      },
      onError: (error) => {
        console.error("[useLiveNotifications] Subscription error:", error);
      },
    }
  );

  // Update page title with unread count
  useEffect(() => {
    if (!enableTitleBadge || typeof document === "undefined") return;

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
      if (originalTitle !== null && typeof document !== "undefined") {
        document.title = originalTitle;
      }
    };
  }, [unreadCount, enableTitleBadge]);

  // Handlers
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      try {
        await markAsReadMutation.mutateAsync({
          notificationId,
          userId,
        });
      } catch (error) {
        console.error("[useLiveNotifications] Failed to mark as read:", error);
      }
    },
    [userId, markAsReadMutation]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      await markAllAsReadMutation.mutateAsync({ userId });
    } catch (error) {
      console.error("[useLiveNotifications] Failed to mark all as read:", error);
    }
  }, [userId, markAllAsReadMutation]);

  const dismiss = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      try {
        await dismissMutation.mutateAsync({
          notificationId,
          userId,
        });
      } catch (error) {
        console.error("[useLiveNotifications] Failed to dismiss:", error);
      }
    },
    [userId, dismissMutation]
  );

  const refresh = useCallback(async () => {
    await Promise.all([refetch(), refetchUnreadCount()]);
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
