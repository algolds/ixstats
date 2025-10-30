/**
 * Unified Notification Center
 * Main notification hub integrating with enhanced notification system
 */

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  X,
  Settings,
  Filter,
  CheckCircle,
  AlertTriangle,
  Info,
  Zap,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type {
  UnifiedNotification,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  UserNotificationPreferences,
} from "~/types/unified-notifications";
import { generateSafeKey } from "~/app/mycountry/utils/keyValidation";
import { useLiveNotifications } from "~/hooks/useLiveNotifications";
import { createAbsoluteUrl } from "~/lib/url-utils";

// Notification center configuration
interface NotificationCenterConfig {
  maxVisible: number;
  autoHide: boolean;
  groupByCategory: boolean;
  showPreviews: boolean;
  enableFiltering: boolean;
  refreshInterval: number; // milliseconds
}

// Notification display props
interface NotificationDisplayProps {
  notification: UnifiedNotification;
  onAction: (action: string) => void;
  onDismiss: () => void;
  compact?: boolean;
}

// Filter options
interface NotificationFilters {
  categories: NotificationCategory[];
  priorities: NotificationPriority[];
  status: NotificationStatus[];
  timeRange: "hour" | "day" | "week" | "month" | "all";
}

// Notification stats
interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
}

export interface UnifiedNotificationCenterProps {
  config?: Partial<NotificationCenterConfig>;
  userPreferences?: UserNotificationPreferences;
  onNotificationAction?: (notification: UnifiedNotification, action: string) => void;
  onPreferencesChange?: (preferences: Partial<UserNotificationPreferences>) => void;
  className?: string;
}

const defaultConfig: NotificationCenterConfig = {
  maxVisible: 50,
  autoHide: false,
  groupByCategory: true,
  showPreviews: true,
  enableFiltering: true,
  refreshInterval: 30000, // 30 seconds
};

const priorityConfig = {
  critical: {
    color: "text-red-600 bg-red-50 border-red-200",
    icon: AlertTriangle,
    badge: "bg-red-500 text-white",
  },
  high: {
    color: "text-orange-600 bg-orange-50 border-orange-200",
    icon: Zap,
    badge: "bg-orange-500 text-white",
  },
  medium: {
    color: "text-blue-600 bg-blue-50 border-blue-200",
    icon: Info,
    badge: "bg-blue-500 text-white",
  },
  low: {
    color: "text-gray-600 bg-gray-50 border-gray-200",
    icon: Clock,
    badge: "bg-gray-500 text-white",
  },
};

const categoryConfig: Record<string, { icon: string; color: string }> = {
  economic: { icon: "💰", color: "text-green-600" },
  diplomatic: { icon: "🌍", color: "text-blue-600" },
  governance: { icon: "🏛️", color: "text-purple-600" },
  social: { icon: "👥", color: "text-cyan-600" },
  security: { icon: "🛡️", color: "text-red-600" },
  system: { icon: "⚙️", color: "text-gray-600" },
  achievement: { icon: "🏆", color: "text-yellow-600" },
  crisis: { icon: "🚨", color: "text-red-700" },
  opportunity: { icon: "✨", color: "text-green-700" },
  intelligence: { icon: "🧠", color: "text-indigo-600" },
  policy: { icon: "📜", color: "text-gray-700" },
  global: { icon: "🌐", color: "text-teal-600" },
  military: { icon: "⚔️", color: "text-red-800" },
};

function NotificationDisplay({
  notification,
  onAction,
  onDismiss,
  compact = false,
}: NotificationDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const priorityConf = priorityConfig[notification.priority];
  const categoryConf = categoryConfig[notification.category];
  const PriorityIcon = priorityConf.icon;

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`relative rounded-lg border p-4 transition-all duration-200 hover:shadow-sm ${priorityConf.color} ${notification.status === "read" ? "opacity-75" : ""} ${compact ? "p-3" : "p-4"} `}
    >
      {/* Priority indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <Badge className={priorityConf.badge}>
          <PriorityIcon className="mr-1 h-3 w-3" />
          {notification.priority}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 w-6 p-0 hover:bg-red-100"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Header */}
      <div className="mb-2 pr-20">
        <div className="flex items-start gap-3">
          <span className="text-lg">{categoryConf.icon}</span>
          <div className="flex-1">
            <h4 className="line-clamp-1 text-sm font-medium">{notification.title}</h4>
            <p className="text-muted-foreground text-xs">
              {categoryConf.color} • {formatTimestamp(notification.timestamp)}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="ml-8">
        <p
          className={`text-sm text-gray-700 ${compact ? "line-clamp-2" : expanded ? "" : "line-clamp-3"}`}
        >
          {notification.message}
        </p>

        {notification.message.length > 150 && !compact && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 h-auto p-0 text-xs"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="ml-1 h-3 w-3" />
              </>
            ) : (
              <>
                Show more <ChevronDown className="ml-1 h-3 w-3" />
              </>
            )}
          </Button>
        )}
      </div>

      {/* Actions */}
      {notification.actions && notification.actions.length > 0 && (
        <div className="mt-3 ml-8 flex gap-2">
          {notification.actions.slice(0, 2).map((action, index) => (
            <Button
              key={generateSafeKey(action.id, "action", index)}
              variant="outline"
              size="sm"
              onClick={() => onAction(action.id)}
              className="h-7 text-xs"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Metadata */}
      {notification.metadata && Object.keys(notification.metadata).length > 0 && expanded && (
        <div className="mt-3 ml-8 rounded bg-gray-50 p-2 text-xs">
          <div className="mb-1 font-medium">Additional Info:</div>
          {Object.entries(notification.metadata)
            .slice(0, 3)
            .map(([key, value]) => (
              <div key={key} className="text-gray-600">
                {key}: {String(value)}
              </div>
            ))}
        </div>
      )}
    </motion.div>
  );
}

export function UnifiedNotificationCenter({
  config: userConfig = {},
  userPreferences,
  onNotificationAction,
  onPreferencesChange,
  className = "",
}: UnifiedNotificationCenterProps) {
  const config = { ...defaultConfig, ...userConfig };

  // State management
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "priority">("all");
  const [filters, setFilters] = useState<NotificationFilters>({
    categories: [],
    priorities: [],
    status: [],
    timeRange: "day",
  });

  // Import live notifications hook
  const {
    notifications: liveNotifications,
    unreadCount: liveUnreadCount,
    isLoading,
    markAsRead: liveMarkAsRead,
    markAllAsRead: liveMarkAllAsRead,
    dismiss: liveDismiss,
  } = useLiveNotifications();

  // Convert live notifications to UnifiedNotification format
  const notifications = React.useMemo(() => {
    return liveNotifications.map((n) => ({
      id: n.id,
      source: (n.source as "intelligence" | "realtime" | "system") || "system",
      timestamp: new Date(n.createdAt).getTime(),
      title: n.title,
      message: n.message || n.description || "",
      category: (n.category as NotificationCategory) || "system",
      type: (n.type as any) || "info",
      priority: (n.priority as NotificationPriority) || "medium",
      severity: (n.severity as any) || "informational",
      context: {} as any, // Not needed for display
      triggers: [],
      relevanceScore: n.relevanceScore || 0,
      deliveryMethod: (n.deliveryMethod as any) || "toast",
      status: n.read
        ? ("read" as const)
        : n.dismissed
          ? ("dismissed" as const)
          : ("delivered" as const),
      actionable: n.actionable,
      actions: n.href
        ? [
            {
              id: "view",
              label: "View Details",
              type: "primary" as const,
              onClick: () => {
                if (!n.href) return;
                window.location.href = createAbsoluteUrl(n.href);
              },
            },
          ]
        : undefined,
      metadata: n.metadata ? JSON.parse(n.metadata) : undefined,
    }));
  }, [liveNotifications]);

  // Calculate stats
  const stats = useMemo((): NotificationStats => {
    const total = notifications.length;
    const unread = notifications.filter((n) => n.status !== "read").length;

    const byCategory = notifications.reduce(
      (acc, n) => {
        acc[n.category] = (acc[n.category] || 0) + 1;
        return acc;
      },
      {} as Record<NotificationCategory, number>
    );

    const byPriority = notifications.reduce(
      (acc, n) => {
        acc[n.priority] = (acc[n.priority] || 0) + 1;
        return acc;
      },
      {} as Record<NotificationPriority, number>
    );

    return { total, unread, byCategory, byPriority };
  }, [notifications]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications];

    // Filter by tab
    if (activeTab === "unread") {
      filtered = filtered.filter((n) => n.status !== "read");
    } else if (activeTab === "priority") {
      filtered = filtered.filter((n) => ["critical", "high"].includes(n.priority));
    }

    // Apply additional filters
    if (filters.categories.length > 0) {
      filtered = filtered.filter((n) => filters.categories.includes(n.category));
    }

    if (filters.priorities.length > 0) {
      filtered = filtered.filter((n) => filters.priorities.includes(n.priority));
    }

    // Sort by timestamp (newest first) and priority
    return filtered.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      return priorityDiff !== 0 ? priorityDiff : b.timestamp - a.timestamp;
    });
  }, [notifications, activeTab, filters]);

  // Handlers
  const handleNotificationAction = useCallback(
    async (notification: UnifiedNotification, action: string) => {
      // Mark as read if action taken
      await liveMarkAsRead(notification.id);
      onNotificationAction?.(notification, action);
    },
    [liveMarkAsRead, onNotificationAction]
  );

  const handleDismiss = useCallback(
    async (notificationId: string) => {
      await liveDismiss(notificationId);
    },
    [liveDismiss]
  );

  const markAllAsRead = useCallback(async () => {
    await liveMarkAllAsRead();
  }, [liveMarkAllAsRead]);

  return (
    <div className={`w-full max-w-2xl ${className}`}>
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
              {stats.unread > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {stats.unread}
                </Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              {config.enableFiltering && (
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={markAllAsRead}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark All Read
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      Preferences
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="text-muted-foreground flex gap-4 text-sm">
            <span>{stats.total} total</span>
            <span>{stats.unread} unread</span>
            <span>{Object.keys(stats.byPriority).length} categories</span>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="unread">Unread ({stats.unread})</TabsTrigger>
              <TabsTrigger value="priority">
                Priority ({(stats.byPriority.critical || 0) + (stats.byPriority.high || 0)})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <div className="max-h-96 space-y-3 overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {filteredNotifications.length > 0 ? (
                    filteredNotifications
                      .slice(0, config.maxVisible)
                      .map((notification) => (
                        <NotificationDisplay
                          key={generateSafeKey(notification.id, "notification", 0)}
                          notification={notification}
                          onAction={(action) => handleNotificationAction(notification, action)}
                          onDismiss={() => handleDismiss(notification.id)}
                          compact={false}
                        />
                      ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-muted-foreground py-8 text-center"
                    >
                      <Eye className="mx-auto mb-4 w-12 opacity-50" />
                      <p>No notifications to display</p>
                      <p className="mt-1 text-xs">
                        {activeTab === "unread" ? "All caught up!" : "Check back later for updates"}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default UnifiedNotificationCenter;
