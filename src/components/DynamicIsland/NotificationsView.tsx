import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useNotificationStore } from "~/stores/notificationStore";
import { useExecutiveNotifications } from "~/contexts/ExecutiveNotificationContext";
import { useUser } from "~/context/auth-context";
import {
  Bell,
  BellRing,
  BookOpen,
  X,
  CheckCircle,
  Info,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Globe,
  Users,
  Building2,
  ChevronRight,
} from "lucide-react";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import type { NotificationsViewProps } from "./types";
import { PreText } from "~/components/ui/pretext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  economic: TrendingUp,
  diplomatic: Globe,
  social: Users,
  security: AlertTriangle,
  governance: Building2,
  achievement: CheckCircle,
  crisis: AlertCircle,
  opportunity: TrendingUp,
  military: AlertTriangle,
  wiki: BookOpen,
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: AlertCircle,
};

function getIcon(n: any) {
  return ICON_MAP[n.category] ?? ICON_MAP[n.type] ?? Bell;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "bg-red-500/15", text: "text-red-500" },
  high: { bg: "bg-orange-500/15", text: "text-orange-500" },
  medium: { bg: "bg-yellow-500/15", text: "text-yellow-500" },
  warning: { bg: "bg-yellow-500/15", text: "text-yellow-500" },
  success: { bg: "bg-green-500/15", text: "text-green-500" },
  error: { bg: "bg-red-500/15", text: "text-red-500" },
  info: { bg: "bg-blue-500/15", text: "text-blue-500" },
};

function getColors(n: any) {
  const level = n.priority ?? n.severity ?? n.type;
  return PRIORITY_COLORS[level] ?? PRIORITY_COLORS.info!;
}

function relativeTime(ts: string | number | Date): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationsView({ onClose }: NotificationsViewProps) {
  const notify = useNotify();
  const { user } = useUser();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  const {
    notifications: executiveNotifications,
    unreadCount: executiveUnreadCount,
    isExecutiveMode,
    markAsRead: markExecutiveAsRead,
    markAllAsRead: markAllExecutiveAsRead,
  } = useExecutiveNotifications();

  const { data: notificationsData, refetch: refetchNotifications } =
    api.notifications.getUserNotifications.useQuery(
      { limit: 5, unreadOnly: false },
      {
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      }
    );

  const markAsReadMutation = api.notifications.markAsRead.useMutation({
    onSuccess: () => void refetchNotifications(),
  });
  const markAllAsReadMutation = api.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      void refetchNotifications();
      notify.success("All notifications marked as read");
    },
  });

  const unreadNotifications = notificationsData?.unreadCount || 0;
  const enhancedUnreadCount = enhancedStats.unread || 0;
  const { totalUnread: messageUnreadCount } = useMessageUnreadCount();
  const totalUnreadCount =
    unreadNotifications +
    (isExecutiveMode ? executiveUnreadCount : 0) +
    enhancedUnreadCount +
    messageUnreadCount;

  // ─── Merge & group ─────────────────────────────────────────────────────

  const standardList = (notificationsData?.notifications || []).map((n: any) => ({
    ...n,
    source: "standard",
  }));
  const executiveList = (isExecutiveMode ? executiveNotifications || [] : [])
    .filter((n: any) => n?.id)
    .map((n: any) => ({ ...n, source: "executive" }));
  const enhancedList = (enhancedNotifications || [])
    .filter((n: any) => n?.id)
    .map((n: any) => ({ ...n, source: "enhanced" }));

  const allNotifications = [...enhancedList, ...executiveList, ...standardList]
    .filter((n: any) => n?.id && n?.title)
    // Deduplicate
    .reduce((acc: any[], n: any) => {
      const key = `${n.source}-${n.id}`;
      if (!acc.some((x: any) => `${x.source}-${x.id}` === key)) acc.push(n);
      return acc;
    }, [])
    .sort((a: any, b: any) => {
      const at = new Date(a.timestamp || a.createdAt || 0).getTime();
      const bt = new Date(b.timestamp || b.createdAt || 0).getTime();
      return bt - at;
    });

  // Prepend unread messages entry
  if (messageUnreadCount > 0) {
    allNotifications.unshift({
      id: "unread-messages",
      source: "messages",
      title: "Unread Messages",
      description: `You have ${messageUnreadCount} unread message${messageUnreadCount > 1 ? "s" : ""}`,
      timestamp: Date.now(),
      priority: "high",
      category: "social",
      href: "/messages",
      read: false,
      type: "info",
    });
  }

  // Group by time
  const groups: { label: string; items: any[] }[] = [];
  const buckets = {
    Recent: [] as any[],
    "Earlier Today": [] as any[],
    "This Week": [] as any[],
    Earlier: [] as any[],
  };

  for (const n of allNotifications) {
    const hrs = (Date.now() - new Date(n.timestamp || n.createdAt || 0).getTime()) / 3600000;
    if (hrs < 1) buckets.Recent.push(n);
    else if (hrs < 24) buckets["Earlier Today"].push(n);
    else if (hrs < 168) buckets["This Week"].push(n);
    else buckets.Earlier.push(n);
  }

  for (const [label, items] of Object.entries(buckets)) {
    if (items.length > 0) groups.push({ label, items });
  }

  // ─── Actions ───────────────────────────────────────────────────────────

  const handleMarkRead = (n: any) => {
    if (n.source === "enhanced") {
      markEnhancedAsRead(n.id);
      recordEngagement(n.id, "read");
    } else if (n.source === "executive") {
      markExecutiveAsRead(n.id);
    } else if (user?.id) {
      markAsReadMutation.mutate({ notificationId: n.id, userId: user.id });
    }
  };

  const handleMarkAllRead = () => {
    if (user?.id && unreadNotifications > 0) markAllAsReadMutation.mutate({ userId: user.id });
    if (isExecutiveMode && executiveUnreadCount > 0) markAllExecutiveAsRead();
    if (enhancedUnreadCount > 0) markAllEnhancedAsRead();
  };

  const handleClick = (n: any) => {
    const isRead = n.status === "read" || n.read;
    if (!isRead) handleMarkRead(n);
    if (n.href) window.location.href = createAbsoluteUrl(n.href);
    if (n.source === "enhanced") recordEngagement(n.id, "click");
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <BellRing className="h-4 w-4 text-blue-400" />
          <PreText className="text-inherit" whiteSpace="nowrap">
            {isExecutiveMode ? "Intelligence" : "Notifications"}
          </PreText>
          {totalUnreadCount > 0 && (
            <PreText
              className="bg-destructive min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold text-white"
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
              disabled={markAllAsReadMutation.isPending}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-40"
            >
              <CheckCircle className="h-3 w-3" />
              <PreText className="text-inherit" whiteSpace="nowrap">
                Read all
              </PreText>
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-accent/10 flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div
        className="max-h-80 space-y-2 overflow-y-auto pr-0.5"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(128,128,128,0.2) transparent" }}
      >
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
                      className="space-y-0.5 overflow-hidden"
                    >
                      {group.items.map((n: any, i: number) => {
                        const Icon = getIcon(n);
                        const colors = getColors(n);
                        const isRead = n.status === "read" || n.read;
                        const key = n.id ? `${n.source}-${n.id}` : `${n.source}-${i}`;

                        return (
                          <motion.button
                            key={key}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, x: -120 }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.25}
                            onDragEnd={(_e, info) => {
                              if (
                                Math.abs(info.offset.x) > 100 ||
                                Math.abs(info.velocity.x) > 500
                              ) {
                                handleMarkRead(n);
                              }
                            }}
                            onClick={() => handleClick(n)}
                            className={`hover:bg-accent/10 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                              isRead ? "opacity-50" : ""
                            }`}
                          >
                            {/* Icon */}
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${colors.bg}`}
                            >
                              <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <PreText
                                  className="text-foreground truncate text-sm font-medium"
                                  whiteSpace="nowrap"
                                >
                                  {n.title}
                                </PreText>
                                {!isRead && (
                                  <span className="bg-primary h-1.5 w-1.5 shrink-0 rounded-full" />
                                )}
                              </div>
                              {(n.description || n.message) && (
                                <PreText
                                  className="text-foreground/70 mt-0.5 block truncate text-xs"
                                  whiteSpace="nowrap"
                                >
                                  {n.description || n.message}
                                </PreText>
                              )}
                            </div>

                            {/* Time */}
                            <PreText
                              className="text-muted-foreground/70 shrink-0 text-[10px]"
                              whiteSpace="nowrap"
                            >
                              {relativeTime(n.timestamp || n.createdAt || Date.now())}
                            </PreText>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        ) : (
          /* ── Empty state ────────────────────────────────────────── */
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
    </div>
  );
}
