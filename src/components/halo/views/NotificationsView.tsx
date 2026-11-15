"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { navigateWithBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useNotificationStore } from "~/stores/notificationStore";
import { useUser } from "~/context/auth-context";
import {
  Bell,
  BellNotification as BellRing,
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
import { useHaloSize, SIZE_PRESETS } from "../HaloPrimitives";
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
import { soundCues } from "~/lib/sound/cuelume";
import { REDUCED_MOTION_FADE, tweenFast } from "~/lib/design/motion";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { Button, focusRing, hitSlop } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { HaloEmpty, HaloViewHeader } from "./shared/HaloViewParts";

function TrayLoading({ label }: { label: string }) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export function NotificationsView({ onClose }: NotificationsViewProps) {
  const router = useRouter();
  const notify = useNotify();
  const { user } = useUser();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [locallyDismissedIds, setLocallyDismissedIds] = useState<Set<string>>(new Set());
  const { size: haloSize, setSize } = useHaloSize();
  const isUltra = haloSize === SIZE_PRESETS.ULTRA;
  const reduceMotion = useFacetReducedMotion();

  // Data sources

  const enhancedNotifications = useNotificationStore((s) => s.notifications);
  const enhancedStats = useNotificationStore((s) => s.stats);
  const markEnhancedAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllEnhancedAsRead = useNotificationStore((s) => s.markAllAsRead);
  const recordEngagement = useNotificationStore((s) => s.recordEngagement);
  const dismissEnhanced = useNotificationStore((s) => s.dismissNotification);

  const utils = api.useUtils();
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    isError: notificationsError,
    refetch: refetchNotifications,
  } = api.notifications.getUserNotifications.useQuery(
    { limit: 8, unreadOnly: false },
    {
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  );

  const {
    data: messagesData,
    isLoading: messagesLoading,
    isError: messagesError,
    refetch: refetchMessages,
  } = api.messages.getConversationsByFolder.useQuery(
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
  const totalAlertsUnreadCount = unreadNotifications + enhancedUnreadCount;
  const totalUnreadCount = totalAlertsUnreadCount + messageUnreadCount;

  // Default active tab to whichever has unread, defaulting to alerts
  const [activeTab, setActiveTab] = useState<NotificationTab>("alerts");

  // Merge & group

  const { groups } = useMemo(() => {
    const standardList: NotificationItem[] = (notificationsData?.notifications || [])
      .filter((n) => !n.dismissed && !locallyDismissedIds.has(n.id))
      .map((n) => ({
        ...n,
        source: "standard",
      }));
    const enhancedList: NotificationItem[] = (enhancedNotifications || [])
      .filter((n) => n?.id && n?.status !== "dismissed" && !locallyDismissedIds.has(n.id))
      .map((n) => ({ ...n, source: "enhanced" }));

    const alerts: NotificationItem[] = [...enhancedList, ...standardList]
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

    return { groups: grps };
  }, [notificationsData?.notifications, locallyDismissedIds, enhancedNotifications]);

  const conversationsList: MessageTrayConversation[] = useMemo(() => {
    return (messagesData?.conversations || []).filter(
      (c: MessageTrayConversation) => !locallyDismissedIds.has(c.id)
    );
  }, [messagesData?.conversations, locallyDismissedIds]);

  // Actions

  const handleMarkRead = (n: NotificationItem) => {
    if (n.source === "enhanced") {
      markEnhancedAsRead(n.id);
      recordEngagement(n.id, "read");
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

  const handleMarkAllRead = async () => {
    const pending: Promise<unknown>[] = [];
    if (user?.id && unreadNotifications > 0) {
      pending.push(markAllAsReadMutation.mutateAsync({ userId: user.id }));
    }
    if (enhancedUnreadCount > 0) markAllEnhancedAsRead();
    if (messageUnreadCount > 0) pending.push(markAllMessagesMutation.mutateAsync());
    const results = await Promise.allSettled(pending);
    if (results.every((r) => r.status === "fulfilled")) notify.success("All marked as read");
    else notify.error("Couldn't mark everything as read");
  };

  const handleClick = (n: NotificationItem) => {
    const isRead = n.status === "read" || n.read;
    if (!isRead) handleMarkRead(n);
    const targetUrl = n.actionUrl || n.href;
    if (targetUrl) navigateWithBasePath(targetUrl, router);
    if (n.source === "enhanced") recordEngagement(n.id, "click");
  };

  const handleMessageClick = (conv: MessageTrayConversation) => {
    navigateWithBasePath(`/messages?conversation=${conv.id}`, router);
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

  return (
    <div className="p-4">
      <HaloViewHeader
        leading={<BellRing className="text-yellow h-4 w-4 shrink-0" />}
        title={
          <span className="inline-flex items-center gap-2">
            <PreText className="text-inherit" whiteSpace="nowrap">
              Notifications
            </PreText>
            {totalUnreadCount > 0 && (
              <PreText
                className="bg-yellow text-caption text-on-yellow min-w-[18px] rounded-full px-2 py-0.5 text-center font-semibold"
                whiteSpace="nowrap"
              >
                {String(totalUnreadCount)}
              </PreText>
            )}
          </span>
        }
        trailing={
          totalUnreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleMarkAllRead()}
              disabled={markAllAsReadMutation.isPending || markAllMessagesMutation.isPending}
              className="text-label-secondary hover:text-label"
              title="Mark all notifications and messages as read"
            >
              <CheckCircle aria-hidden className="text-green" />
              <PreText className="text-inherit" whiteSpace="nowrap">
                Read all
              </PreText>
            </Button>
          ) : undefined
        }
        onClose={() => {
          soundCues.dismiss();
          onClose();
        }}
      />

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
        className={cn("space-y-2 overflow-y-auto pr-0.5", isUltra ? "max-h-[540px]" : "max-h-80")}
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
                    relativeTime={relativeTime}
                    onClick={handleMessageClick}
                    onDismiss={handleDismissMessage}
                  />
                ))}
              </div>
            ) : messagesLoading ? (
              <TrayLoading label="Loading messages" />
            ) : messagesError ? (
              <HaloEmpty
                title="Couldn't load messages"
                action={
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => void refetchMessages()}
                  >
                    Try again
                  </Button>
                }
              />
            ) : (
              <HaloEmpty
                icon={<MessageCircle />}
                title="No recent messages"
                action={
                  <Link
                    href="/messages"
                    className="text-tint text-caption inline-block font-semibold hover:underline"
                  >
                    Start a conversation
                  </Link>
                }
              />
            )}
          </div>
        ) : (
          /* Notifications View */
          <div className="space-y-2">
            {groups.length > 0 ? (
              groups.map((group) => {
                const groupCollapsed = collapsedGroups.has(group.label);
                return (
                  <div key={group.label}>
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      aria-expanded={!groupCollapsed}
                      className={cn(
                        "hover:bg-fill-4 rounded-control-sm relative mb-1 flex w-full cursor-pointer items-center justify-between px-1 py-0.5 transition-colors",
                        focusRing,
                        hitSlop
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: groupCollapsed ? 0 : 90 }}
                          transition={reduceMotion ? { duration: 0 } : tweenFast}
                        >
                          <ChevronRight className="text-label-tertiary h-3 w-3" />
                        </motion.div>
                        <PreText className="text-label-secondary text-footnote" whiteSpace="nowrap">
                          {group.label}
                        </PreText>
                      </div>
                      <PreText className="text-label-secondary text-footnote" whiteSpace="nowrap">
                        {String(group.items.length)}
                      </PreText>
                    </button>

                    {/* Items */}
                    <AnimatePresence>
                      {!groupCollapsed && (
                        <motion.div
                          initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={reduceMotion ? REDUCED_MOTION_FADE : tweenFast}
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
            ) : notificationsLoading ? (
              <TrayLoading label="Loading notifications" />
            ) : notificationsError ? (
              <HaloEmpty
                title="Couldn't load notifications"
                action={
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => void refetchNotifications()}
                  >
                    Try again
                  </Button>
                }
              />
            ) : (
              <HaloEmpty icon={<Bell />} title="No notifications" />
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
