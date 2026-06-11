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
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import type { NotificationsViewProps } from "./types";
import { PreText } from "~/components/ui/pretext";
import { cn } from "~/lib/utils";
import { useDynamicIslandSize, SIZE_PRESETS } from "~/components/ui/dynamic-island";
import { SwipeableRow, SwipeableGroup, SwipeActionButton } from "~/components/facet-ui/swipeable";

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
  critical: { bg: "bg-red-500/15", text: "text-red-400" },
  high: { bg: "bg-orange-500/15", text: "text-orange-400" },
  medium: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  warning: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  success: { bg: "bg-green-500/15", text: "text-green-400" },
  error: { bg: "bg-red-500/15", text: "text-red-400" },
  info: { bg: "bg-blue-500/15", text: "text-blue-400" },
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

// ─── NotificationRow Component (powered by Glass SwipeableRow) ────────────────
interface NotificationRowProps {
  n: any;
  isRead: boolean;
  colors: { bg: string; text: string };
  Icon: React.ComponentType<{ className?: string }>;
  handleMarkRead: (n: any) => void;
  handleDismiss: (n: any) => void;
  handleClick: (n: any) => void;
  relativeTime: (ts: any) => string;
  isExpanded: boolean;
  onExpandToggle: () => void;
}

function NotificationRow({
  n,
  isRead,
  colors,
  Icon,
  handleMarkRead,
  handleDismiss,
  handleClick,
  relativeTime: relTime,
  isExpanded,
  onExpandToggle,
}: NotificationRowProps) {
  return (
    <SwipeableRow
      id={`notif-${n.source}-${n.id}`}
      className="rounded-xl mb-1.5 last:mb-0"
      springPreset="bouncy"
      expanded={isExpanded}
      onExpandedChange={(expanded) => {
        if (expanded !== isExpanded) onExpandToggle();
      }}
    >
      {/* Leading actions (swipe right → open) */}
      {n.href && (
        <SwipeableRow.Leading
          commit={{ action: () => handleClick(n), label: "Open", color: "#22c55e" }}
        >
          <SwipeActionButton
            id="open"
            icon={ChevronRight}
            label="Open"
            onClick={() => handleClick(n)}
            color="#22c55e"
          />
        </SwipeableRow.Leading>
      )}

      {/* Trailing actions (swipe left → dismiss) */}
      <SwipeableRow.Trailing
        commit={{ action: () => handleDismiss(n), label: "Clear", color: "#ef4444" }}
      >
        {n.href && (
          <SwipeActionButton
            id="open-trailing"
            icon={ChevronRight}
            label="Open"
            onClick={() => handleClick(n)}
            color="#3b82f6"
          />
        )}
        <SwipeActionButton
          id="clear"
          icon={X}
          label="Clear"
          onClick={() => handleDismiss(n)}
          color="#ef4444"
        />
      </SwipeableRow.Trailing>

      {/* Front card content */}
      <SwipeableRow.Content>
        <div
          className={cn(
            "relative bg-white/[0.16] dark:bg-slate-950/75 backdrop-blur-xl border border-white/[0.18] dark:border-white/10 hover:bg-white/[0.22] dark:hover:bg-slate-900/80 hover:border-white/[0.24] flex flex-col w-full rounded-xl transition-all duration-300 shadow-lg overflow-hidden",
            !isRead && "bg-gradient-to-r from-white/[0.24] to-white/[0.14] dark:from-slate-900/60 dark:to-slate-950/80 border-blue-500/40 shadow-blue-500/10 shadow-md",
            isRead && "opacity-80 bg-white/[0.1] dark:bg-slate-950/60 border-white/[0.08] dark:border-white/[0.06] hover:opacity-95"
          )}
        >
          {/* Left Accent Border Strip */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-all duration-300",
              colors.text.replace("text-", "bg-"),
              isRead ? "opacity-30" : "opacity-100"
            )}
          />

          {/* Header Content */}
          <div className="flex items-center gap-3 p-3.5 text-left cursor-grab active:cursor-grabbing hover:bg-white/[0.02]">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm border border-white/5",
                colors.bg
              )}
            >
              <Icon className={cn("h-4 w-4", colors.text)} />
            </div>

            <div className="min-w-0 flex-1 pl-0.5">
              <div className="flex items-center gap-2">
                <span className="text-foreground text-xs font-bold block truncate">
                  {n.title}
                </span>
                {!isRead && (
                  <span className="bg-blue-500 h-1.5 w-1.5 shrink-0 rounded-full animate-pulse shadow-sm shadow-blue-500/50" />
                )}
              </div>
              {!isExpanded && (n.description || n.message) && (
                <span className="text-muted-foreground mt-0.5 block truncate text-[11px] font-semibold leading-relaxed">
                  {n.description || n.message}
                </span>
              )}
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-muted-foreground/80 text-[9px] font-semibold">
                {relTime(n.timestamp || n.createdAt || Date.now())}
              </span>
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
              </motion.div>
            </div>
          </div>
        </div>
      </SwipeableRow.Content>

      {/* Expanded detail panel */}
      <SwipeableRow.Expanded>
        <div className="border-t border-slate-200/20 px-3.5 pb-3.5 pt-3 space-y-3 bg-black/[0.02] rounded-b-xl pl-[18px]">
          <p className="text-[11.5px] text-foreground/95 font-semibold leading-relaxed whitespace-pre-wrap select-text selection:bg-blue-500/30">
            {n.description || n.message}
          </p>

          <div className="flex items-center gap-2 pt-1.5">
            {n.href && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick(n);
                }}
                className="flex-1 py-1.5 px-3 bg-blue-500 hover:bg-blue-600 active:scale-[0.98] text-white text-[10px] font-bold rounded-md flex items-center justify-center gap-1.5 transition-all shadow-sm border border-blue-400/20"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                <span>Open</span>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss(n);
              }}
              className="flex-1 py-1.5 px-3 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 active:scale-[0.98] text-muted-foreground hover:text-foreground text-[10px] font-bold rounded-md flex items-center justify-center gap-1.5 transition-all border border-slate-300/30 dark:border-white/10"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      </SwipeableRow.Expanded>
    </SwipeableRow>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

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
  const dismissMutation = api.notifications.dismissNotification.useMutation({
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

  const standardList = (notificationsData?.notifications || [])
    .filter((n: any) => !n.dismissed && !locallyDismissedIds.has(n.id))
    .map((n: any) => ({
      ...n,
      source: "standard",
    }));
  const executiveList = (isExecutiveMode ? executiveNotifications || [] : [])
    .filter((n: any) => n?.id && !locallyDismissedIds.has(n.id))
    .map((n: any) => ({ ...n, source: "executive" }));
  const enhancedList = (enhancedNotifications || [])
    .filter((n: any) => n?.id && n?.status !== "dismissed" && !locallyDismissedIds.has(n.id))
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

  const handleDismiss = (n: any) => {
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
        className={cn(
          "space-y-2 overflow-y-auto pr-0.5 transition-all duration-300",
          isUltra ? "max-h-[520px]" : "max-h-80"
        )}
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
                      className="space-y-1 overflow-hidden"
                    >
                    <SwipeableGroup>
                      {group.items.map((n: any, i: number) => {
                        const Icon = getIcon(n);
                        const colors = getColors(n);
                        const isRead = n.status === "read" || n.read;
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

      {/* Expand / Minimize DI Size Toggle */}
      <div className="mt-3 pt-2 border-t border-white/5 flex justify-center">
        <button
          onClick={() => {
            setSize(isUltra ? SIZE_PRESETS.TALL : SIZE_PRESETS.ULTRA);
          }}
          className="text-muted-foreground hover:text-foreground hover:bg-white/5 flex h-7 w-7 items-center justify-center rounded-full transition-all border border-white/5 shadow-sm active:scale-[0.98]"
          title={isUltra ? "Standard View" : "Reading View"}
          aria-label={isUltra ? "Standard View" : "Reading View"}
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
