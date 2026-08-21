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
  BellRing,
  X,
  CheckCircle,
  ChevronRight,
  Maximize2,
  Minimize2,
  MessageCircle,
} from "lucide-react";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import type { NotificationsViewProps } from "./types";
import { PreText } from "~/components/ui/pretext";
import { cn } from "~/lib/utils";
import { useDynamicIslandSize, SIZE_PRESETS } from "~/components/ui/dynamic-island";
import { SwipeableGroup } from "~/components/ui/facet/swipeable";
import { MessageTrayItem, type MessageTrayConversation } from "./tray/MessageTrayItem";
import { NotificationRow } from "./tray/NotificationRow";
import {
  type NotificationItem,
  type NotificationTab,
  getIcon,
  getColors,
  relativeTime,
} from "./tray/types";

export function NotificationsView({ onClose }: NotificationsViewProps) {
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

  const { data: notificationsData, refetch: refetchNotifications } =
    api.notifications.getUserNotifications.useQuery(
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

  const markAsReadMutation = api.notifications.markAsRead.useMutation({
    onSuccess: () => void refetchNotifications(),
  });
  const dismissMutation = api.notifications.dismissNotification.useMutation({
    onSuccess: () => void refetchNotifications(),
  });
  const markAllAsReadMutation = api.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      void refetchNotifications();
    },
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
    unreadNotifications +
    (isExecutiveMode ? executiveUnreadCount : 0) +
    enhancedUnreadCount;
  const totalUnreadCount = totalAlertsUnreadCount + messageUnreadCount;

  // Default active tab to whichever has unread, defaulting to alerts
  const [activeTab, setActiveTab] = useState<NotificationTab>("alerts");

  // ─── Merge & group ─────────────────────────────────────────────────────

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

  const allAlerts: NotificationItem[] = [...enhancedList, ...executiveList, ...standardList]
    .filter((n) => n?.id && n?.title)
    // Deduplicate
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

  // Group alerts by time
  const groups: { label: string; items: NotificationItem[] }[] = [];
  const buckets = {
    Recent: [] as NotificationItem[],
    "Earlier Today": [] as NotificationItem[],
    "This Week": [] as NotificationItem[],
    Earlier: [] as NotificationItem[],
  };

  for (const n of allAlerts) {
    const hrs = (Date.now() - new Date(n.timestamp ?? n.createdAt ?? 0).getTime()) / 3600000;
    if (hrs < 1) buckets.Recent.push(n);
    else if (hrs < 24) buckets["Earlier Today"].push(n);
    else if (hrs < 168) buckets["This Week"].push(n);
    else buckets.Earlier.push(n);
  }

  for (const [label, items] of Object.entries(buckets)) {
    if (items.length > 0) groups.push({ label, items });
  }

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
        <div className="text-foreground flex items-center gap-2 text-sm font-bold tracking-tight">
          <BellRing className="h-4 w-4 text-blue-400" />
          <PreText className="text-inherit" whiteSpace="nowrap">
            {isExecutiveMode ? "Intelligence Hub" : "Alert Center"}
          </PreText>
          {totalUnreadCount > 0 && (
            <PreText
              className="bg-blue-500 min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold text-white shadow-xs"
              whiteSpace="nowrap"
            >
              {String(totalUnreadCount)}
            </PreText>
          )}
        </div>
        <div className="flex items-center gap-1">
          {totalUnreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllAsReadMutation.isPending || markAllMessagesMutation.isPending}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
              title="Mark all notifications and messages as read"
            >
              <CheckCircle className="h-3 w-3 text-emerald-400" />
              <PreText className="text-inherit" whiteSpace="nowrap">
                Read all
              </PreText>
            </button>
          )}
          <Link
            href="/messages"
            className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-all active:scale-95"
            title="Open Messages Hub"
          >
            <MessageCircle className="h-3 w-3 text-blue-400" />
            <span className="hidden sm:inline">Messages</span>
          </Link>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            title="Close tray"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Segmented Filter Pills (Notifications vs Messages) */}
      <div className="mb-3 flex items-center gap-1 rounded-xl border border-border/40 bg-accent/10 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-semibold transition-all select-none active:scale-[0.97]",
                isSelected
                  ? "text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
              )}
            >
              {isSelected && (
                <motion.div
                  layoutId="halo-notif-tab-indicator"
                  className="absolute inset-0 rounded-lg border border-border/60 bg-card shadow-xs"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5", isSelected && "text-blue-400")} />
                <span>{tab.label}</span>
                {tab.unread > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white shadow-2xs">
                    {tab.unread > 9 ? "9+" : tab.unread}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div
        className={cn(
          "space-y-2 overflow-y-auto pr-0.5 transition-all duration-300",
          isUltra ? "max-h-[540px]" : "max-h-80"
        )}
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(128,128,128,0.2) transparent" }}
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
                <MessageCircle className="text-muted-foreground/20 mx-auto mb-3 h-8 w-8" />
                <p className="text-muted-foreground text-xs font-semibold">No recent messages</p>
                <Link
                  href="/messages"
                  className="text-primary hover:underline mt-2 inline-block text-[11px] font-semibold"
                >
                  Start a diplomatic conversation →
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
                      onClick={() => toggleGroup(group.label)}
                      className="hover:bg-accent/5 mb-1 flex w-full items-center justify-between rounded px-1 py-0.5 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <motion.div
                          animate={{ rotate: isCollapsed ? 0 : 90 }}
                          transition={{ duration: 0.15 }}
                        >
                          <ChevronRight className="text-muted-foreground/60 h-3 w-3" />
                        </motion.div>
                        <PreText
                          className="text-muted-foreground/90 text-[11px] font-semibold tracking-wider uppercase"
                          whiteSpace="nowrap"
                        >
                          {group.label}
                        </PreText>
                      </div>
                      <PreText className="text-muted-foreground/70 text-[10px]" whiteSpace="nowrap">
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
                <Bell className="text-muted-foreground/20 mx-auto mb-3 h-8 w-8" />
                <PreText className="text-muted-foreground text-sm font-medium" whiteSpace="nowrap">
                  {isExecutiveMode ? "Situation stable" : "All caught up"}
                </PreText>
                <PreText className="text-muted-foreground/75 mt-1 text-xs" whiteSpace="nowrap">
                  No notifications right now
                </PreText>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expand / Minimize DI Size Toggle */}
      <div className="mt-3 flex justify-center border-t border-border/30 pt-2">
        <button
          onClick={() => {
            setSize(isUltra ? SIZE_PRESETS.TALL : SIZE_PRESETS.ULTRA);
          }}
          className="text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center rounded-full border border-border/40 shadow-xs transition-all hover:bg-accent/15 active:scale-[0.98]"
          title={isUltra ? "Standard View" : "Expanded View"}
          aria-label={isUltra ? "Standard View" : "Expanded View"}
        >
          {isUltra ? (
            <Minimize2 className="h-3.5 w-3.5 text-blue-400" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5 text-blue-400" />
          )}
        </button>
      </div>
    </div>
  );
}
