"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { createAbsoluteUrl } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useNotificationStore } from "~/stores/notificationStore";
import { useExecutiveNotifications } from "~/context/ExecutiveNotificationContext";
import { useUser } from "~/context/auth-context";
import {
  Bell,
  BellNotification as BellRing,
  Xmark as X,
  CheckCircle,
  NavArrowRight as ChevronRight,
  Expand as Maximize2,
  Compress as Minimize2,
  ChatBubble as MessageCircle,
} from "iconoir-react";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import type { NotificationsViewProps } from "../types";
import { PreText } from "~/components/ui/pretext";
import { cn } from "~/lib/utils";
import { useDynamicIslandSize, SIZE_PRESETS } from "../HaloPrimitives";
import { SwipeableGroup } from "~/components/ui/facet/swipeable/SwipeableRow";
import { MessageTrayItem, type MessageTrayConversation } from "./tray/MessageTrayItem";
import { NotificationRow } from "./tray/NotificationRow";
import {
  type NotificationItem,
  type NotificationTab,
  getIcon,
  getColors,
  relativeTime,
} from "./tray/types";
import { soundEffects } from "~/lib/sound/cuelume";
import { tweenFast } from "~/lib/design/motion";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";

function NotificationsViewComponent({ onClose }: NotificationsViewProps) {
  const notify = useNotify();
  const { user } = useUser();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [locallyDismissedIds, setLocallyDismissedIds] = useState<Set<string>>(new Set());
  const { state: diSizeState, setSize } = useDynamicIslandSize();
  const isUltra = diSizeState.size === SIZE_PRESETS.ULTRA;

  // ESC to close
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // ─── Data sources ──────────────────────────────────────────────────────

  const enhancedNotifications = useNotificationStore((s) => s.notifications);
  const enhancedStats = useNotificationStore((s) => s.stats);
  const markEnhancedAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllEnhancedAsRead = useNotificationStore((s) => s.markAllAsRead);
  const recordEngagement = useNotificationStore((s) => s.recordEngagement);
  const dismissEnhanced = useNotificationStore((s) => s.dismissNotification);

  const {
    notifications: executiveNotifications,
    unreadCount: executiveUnreadCount,
    isExecutiveMode,
    markAsRead: markExecutiveAsRead,
    markAllAsRead: markAllExecutiveAsRead,
  } = useExecutiveNotifications();

  const utils = api.useUtils();
  const { data: notificationsData } = api.notifications.getUserNotifications.useQuery(
    { limit: 8, unreadOnly: false },
    {
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  );

  const { data: messagesData, refetch: refetchMessages } =
    api.messages.getConversationsByFolder.useQuery(
      { folder: "inbox", limit: 8 },
      {
        enabled: !!user?.id,
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
      }
    );

  // No input → invalidates every getUserNotifications list size (Halo, dashboard, messages).
  const invalidateNotifications = () => {
    void utils.notifications.getUserNotifications.invalidate();
    void utils.notifications.getUnreadCount.invalidate();
  };
  const markAsReadMutation = api.notifications.markAsRead.useMutation({
    onSettled: invalidateNotifications,
  });
  const dismissMutation = api.notifications.dismissNotification.useMutation({
    onSettled: invalidateNotifications,
  });
  const markAllAsReadMutation = api.notifications.markAllAsRead.useMutation({
    onSettled: invalidateNotifications,
  });
  const markAllMessagesMutation = api.messages.markAllAsRead.useMutation({
    onSuccess: () => {
      void refetchMessages();
    },
  });

  const unreadNotifications = notificationsData?.unreadCount || 0;
  const enhancedUnreadCount = enhancedStats.unread || 0;
  const { totalUnread: messageUnreadCount } = useMessageUnreadCount();
  const totalAlertsUnreadCount =
    unreadNotifications + (isExecutiveMode ? executiveUnreadCount : 0) + enhancedUnreadCount;
  const totalUnreadCount = totalAlertsUnreadCount + messageUnreadCount;

  // Default active tab to whichever has unread, defaulting to alerts
  const [activeTab, setActiveTab] = useState<NotificationTab>("alerts");

  // ─── Merge & group ─────────────────────────────────────────────────────

  // oxlint-disable-next-line eslint/no-unused-vars
  const { allAlerts, groups } = useMemo(() => {
    const standardList: NotificationItem[] = (notificationsData?.notifications || [])
      .filter((n) => !n.dismissed && !locallyDismissedIds.has(n.id))
      .map((n) => ({
        ...n,
        source: "standard",
      }));
    const executiveList: NotificationItem[] = (isExecutiveMode ? executiveNotifications || [] : [])
      .filter((n) => n?.id && !locallyDismissedIds.has(n.id))
      .map((n) => ({ ...n, source: "executive" }));
    const enhancedList: NotificationItem[] = (enhancedNotifications || [])
      .filter((n) => n?.id && n?.status !== "dismissed" && !locallyDismissedIds.has(n.id))
      .map((n) => ({ ...n, source: "enhanced" }));

    const alerts: NotificationItem[] = [...enhancedList, ...executiveList, ...standardList]
      .filter((n) => n?.id && n?.title)
      .reduce((acc: NotificationItem[], n: NotificationItem) => {
        const key = `${n.source}-${n.id}`;
        if (!acc.some((x: NotificationItem) => `${x.source}-${x.id}` === key)) acc.push(n);
        return acc;
      }, [])
      .sort((a: NotificationItem, b: NotificationItem) => {
        const at = new Date(a.timestamp ?? a.createdAt ?? 0).getTime();
        const bt = new Date(b.timestamp ?? b.createdAt ?? 0).getTime();
        return bt - at;
      });

    const grps: { label: string; items: NotificationItem[] }[] = [];
    const buckets = {
      Recent: [] as NotificationItem[],
      "Earlier today": [] as NotificationItem[],
      "This week": [] as NotificationItem[],
      Earlier: [] as NotificationItem[],
    };

    for (const n of alerts) {
      // oxlint-disable-next-line
      const hrs = (Date.now() - new Date(n.timestamp ?? n.createdAt ?? 0).getTime()) / 3600000;
      if (hrs < 1) buckets.Recent.push(n);
      else if (hrs < 24) buckets["Earlier today"].push(n);
      else if (hrs < 168) buckets["This week"].push(n);
      else buckets.Earlier.push(n);
    }

    for (const [label, items] of Object.entries(buckets)) {
      if (items.length > 0) grps.push({ label, items });
    }

    return { allAlerts: alerts, groups: grps };
  }, [
    notificationsData?.notifications,
    locallyDismissedIds,
    isExecutiveMode,
    executiveNotifications,
    enhancedNotifications,
  ]);

  const conversationsList: MessageTrayConversation[] = useMemo(() => {
    return (messagesData?.conversations || []).filter(
      (c: MessageTrayConversation) => !locallyDismissedIds.has(c.id)
    );
  }, [messagesData?.conversations, locallyDismissedIds]);

  // ─── Actions ───────────────────────────────────────────────────────────

  const handleMarkRead = (n: NotificationItem) => {
    if (n.source === "enhanced") {
      markEnhancedAsRead(n.id);
      recordEngagement(n.id, "read");
    } else if (n.source === "executive") {
      markExecutiveAsRead(n.id);
    } else if (user?.id) {
      markAsReadMutation.mutate({ notificationId: n.id, userId: user.id });
    }
  };

  const handleDismiss = (n: NotificationItem) => {
    setLocallyDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(n.id);
      return next;
    });

    if (n.source === "enhanced") {
      dismissEnhanced(n.id);
      recordEngagement(n.id, "dismiss");
    } else if (n.source === "executive") {
      markExecutiveAsRead(n.id);
    } else if (user?.id) {
      dismissMutation.mutate({ notificationId: n.id, userId: user.id });
    }
  };

  const handleDismissMessage = (conv: MessageTrayConversation) => {
    setLocallyDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(conv.id);
      return next;
    });
  };

  const handleMarkAllRead = () => {
    if (user?.id && unreadNotifications > 0) markAllAsReadMutation.mutate({ userId: user.id });
    if (isExecutiveMode && executiveUnreadCount > 0) markAllExecutiveAsRead();
    if (enhancedUnreadCount > 0) markAllEnhancedAsRead();
    if (messageUnreadCount > 0) markAllMessagesMutation.mutate();
    notify.success("All notifications and messages marked as read");
  };

  const handleClick = (n: NotificationItem) => {
    const isRead = n.status === "read" || n.read;
    if (!isRead) handleMarkRead(n);
    const targetUrl = n.actionUrl || n.href;
    if (targetUrl) window.location.href = createAbsoluteUrl(targetUrl);
    if (n.source === "enhanced") recordEngagement(n.id, "click");
  };

  const handleMessageClick = (conv: MessageTrayConversation) => {
    window.location.href = createAbsoluteUrl(`/messages?conversationId=${conv.id}`);
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const tabs: Array<{ id: NotificationTab; label: string; icon: typeof Bell; unread: number }> = [
    { id: "alerts", label: "Notifications", icon: Bell, unread: totalAlertsUnreadCount },
    { id: "messages", label: "Messages", icon: MessageCircle, unread: messageUnreadCount },
  ];

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-label text-headline flex items-center gap-2">
          <BellRing className="text-yellow h-4 w-4" />
          <PreText className="text-inherit" whiteSpace="nowrap">
            {isExecutiveMode ? "Intelligence" : "Notifications"}
          </PreText>
          {totalUnreadCount > 0 && (
            <PreText
              className="bg-yellow text-caption text-on-yellow min-w-[18px] rounded-full px-2 py-0.5 text-center font-semibold"
              whiteSpace="nowrap"
            >
              {String(totalUnreadCount)}
            </PreText>
          )}
        </div>
        <div className="flex items-center gap-1">
          {totalUnreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllAsReadMutation.isPending || markAllMessagesMutation.isPending}
              className="text-label-secondary hover:text-label"
              title="Mark all notifications and messages as read"
            >
              <CheckCircle aria-hidden className="text-green" />
              <PreText className="text-inherit" whiteSpace="nowrap">
                Read all
              </PreText>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              soundEffects.droplet();
              onClose();
            }}
            className="text-label-secondary hover:text-label"
            title="Close tray"
            aria-label="Close tray"
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>

      {/* Segmented Filter Pills (Notifications vs Messages) */}
      <SegmentedControl
        aria-label="Inbox"
        asTabs
        fullWidth
        size="sm"
        className="mb-3"
        value={activeTab}
        onValueChange={setActiveTab}
        options={tabs.map((tab) => {
          const Icon = tab.icon;
          return {
            value: tab.id,
            label: tab.label,
            icon: <Icon aria-hidden />,
            badge: tab.unread > 0 ? (tab.unread > 9 ? "9+" : tab.unread) : undefined,
            badgeLabel: tab.unread > 0 ? `${tab.unread} unread` : undefined,
          };
        })}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          "space-y-2 overflow-y-auto pr-0.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300",
          isUltra ? "max-h-[540px]" : "max-h-80"
        )}
        style={{ scrollbarWidth: "thin" }}
      >
        {activeTab === "messages" ? (
          /* Messages View */
          <div className="space-y-2">
            {conversationsList.length > 0 ? (
              <div className="space-y-1">
                {conversationsList.map((conv) => (
                  <MessageTrayItem
                    key={conv.id}
                    conversation={conv}
                    currentUserId={user?.id}
                    relativeTime={relativeTime}
                    onClick={handleMessageClick}
                    onDismiss={handleDismissMessage}
                  />
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <MessageCircle className="text-label-tertiary mx-auto mb-3 h-8 w-8" />
                <p className="text-label-secondary text-caption font-semibold">
                  No recent messages
                </p>
                <Link
                  href="/messages"
                  className="text-tint text-caption mt-2 inline-block font-semibold hover:underline"
                >
                  Start a conversation
                </Link>
              </div>
            )}
          </div>
        ) : (
          /* Notifications View */
          <div className="space-y-2">
            {groups.length > 0 ? (
              groups.map((group) => {
                const isCollapsed = collapsedGroups.has(group.label);
                return (
                  <div key={group.label}>
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      aria-expanded={!isCollapsed}
                      className="hover:bg-fill-4 rounded-control-sm focus-visible:outline-tint mb-1 flex w-full items-center justify-between px-1 py-0.5 transition-colors focus-visible:outline-2"
                    >
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: isCollapsed ? 0 : 90 }}
                          transition={tweenFast}
                        >
                          <ChevronRight className="text-label-tertiary h-3 w-3" />
                        </motion.div>
                        <PreText className="text-label-secondary text-eyebrow" whiteSpace="nowrap">
                          {group.label}
                        </PreText>
                      </div>
                      <PreText className="text-label-secondary text-footnote" whiteSpace="nowrap">
                        {String(group.items.length)}
                      </PreText>
                    </button>

                    {/* Items */}
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-1 overflow-hidden"
                        >
                          <SwipeableGroup>
                            {group.items.map((n: NotificationItem, i: number) => {
                              const Icon = getIcon(n);
                              const colors = getColors(n);
                              const isRead = n.status === "read" || Boolean(n.read);
                              const key = n.id ? `${n.source}-${n.id}` : `${n.source}-${i}`;

                              return (
                                <NotificationRow
                                  key={key}
                                  n={n}
                                  isRead={isRead}
                                  colors={colors}
                                  Icon={Icon}
                                  handleMarkRead={handleMarkRead}
                                  handleDismiss={handleDismiss}
                                  handleClick={handleClick}
                                  relativeTime={relativeTime}
                                  isExpanded={expandedNotificationId === key}
                                  onExpandToggle={() => {
                                    setExpandedNotificationId(
                                      expandedNotificationId === key ? null : key
                                    );
                                  }}
                                />
                              );
                            })}
                          </SwipeableGroup>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center">
                <Bell className="text-label-tertiary mx-auto mb-3 h-8 w-8" />
                <PreText className="text-label-secondary text-body font-medium" whiteSpace="nowrap">
                  {isExecutiveMode ? "No alerts" : "No notifications"}
                </PreText>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expand / Minimize DI Size Toggle */}
      <div className="border-separator mt-3 flex justify-center border-t pt-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => {
            setSize(isUltra ? SIZE_PRESETS.TALL : SIZE_PRESETS.ULTRA);
          }}
          className="text-label-secondary hover:text-label rounded-full"
          title={isUltra ? "Standard view" : "Expanded view"}
          aria-label={isUltra ? "Standard view" : "Expanded view"}
        >
          {isUltra ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

export const NotificationsView = React.memo(NotificationsViewComponent);
