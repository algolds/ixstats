import React from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useToast } from "~/components/ui/toast";
import { useNotificationStore } from "~/stores/notificationStore";
import { useExecutiveNotifications } from "~/contexts/ExecutiveNotificationContext";
import { useUser } from "~/context/auth-context";
import {
  Bell,
  BellRing,
  X,
  CheckCircle,
  Info,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Globe,
  Users,
  Building2,
  ChevronDown,
  Plus,
} from "lucide-react";
import type { NotificationsViewProps } from "./types";

export function NotificationsView({ onClose }: NotificationsViewProps) {
  const { toast } = useToast();
  const { user } = useUser();

  // Enhanced notification system integration
  const enhancedNotifications = useNotificationStore((state) => state.notifications);
  const enhancedStats = useNotificationStore((state) => state.stats);
  const markEnhancedAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllEnhancedAsRead = useNotificationStore((state) => state.markAllAsRead);
  const recordEngagement = useNotificationStore((state) => state.recordEngagement);

  // Get executive notifications context
  const {
    notifications: executiveNotifications,
    unreadCount: executiveUnreadCount,
    isExecutiveMode,
    markAsRead: markExecutiveAsRead,
    markAllAsRead: markAllExecutiveAsRead,
  } = useExecutiveNotifications();

  // Standard notifications - only fetch when absolutely necessary
  const { data: notificationsData, refetch: refetchNotifications } =
    api.notifications.getUserNotifications.useQuery(
      {
        limit: 5,
        unreadOnly: false,
      },
      {
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      }
    );

  const markAsReadMutation = api.notifications.markAsRead.useMutation({
    onSuccess: () => {
      void refetchNotifications();
    },
  });

  const markAllAsReadMutation = api.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      void refetchNotifications();
      toast({
        type: "success",
        title: "All notifications marked as read",
      });
    },
  });

  const createTestNotificationMutation = api.notifications.createNotification.useMutation({
    onSuccess: () => {
      void refetchNotifications();
      toast({
        type: "success",
        title: "Test notification created",
      });
    },
  });

  const unreadNotifications = notificationsData?.unreadCount || 0;
  const enhancedUnreadCount = enhancedStats.unread || 0;
  const totalUnreadCount =
    unreadNotifications + (isExecutiveMode ? executiveUnreadCount : 0) + enhancedUnreadCount;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="text-foreground flex w-full items-center justify-center gap-3 text-xl font-bold">
          <BellRing className="h-6 w-6 text-blue-400" />
          <span>{isExecutiveMode ? "Intelligence Center" : "Notification Center"}</span>
          {totalUnreadCount > 0 && (
            <Badge className="bg-destructive text-foreground rounded-full px-2 py-1 text-sm">
              {totalUnreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {process.env.NODE_ENV === "development" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const testNotifications = [
                  {
                    title: "Economic Alert",
                    description: "GDP growth increased by 2.5%",
                    type: "economic" as const,
                  },
                  {
                    title: "System Update",
                    description: "New features available",
                    type: "info" as const,
                  },
                  {
                    title: "Crisis Alert",
                    description: "Minor diplomatic tension detected",
                    type: "warning" as const,
                  },
                ];
                const randomNotification =
                  testNotifications[Math.floor(Math.random() * testNotifications.length)];
                if (randomNotification) {
                  createTestNotificationMutation.mutate({
                    ...randomNotification,
                    adminUserId: user?.id || "debug",
                  });
                }
              }}
              disabled={createTestNotificationMutation.isPending}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/10 px-2 py-2 text-xs"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {totalUnreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (user?.id && unreadNotifications > 0) {
                  markAllAsReadMutation.mutate({ userId: user.id });
                }
                if (isExecutiveMode && executiveUnreadCount > 0) {
                  markAllExecutiveAsRead();
                }
                if (enhancedUnreadCount > 0) {
                  markAllEnhancedAsRead();
                }
              }}
              disabled={markAllAsReadMutation.isPending}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/10 px-3 py-2"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-accent/10 absolute top-6 right-6 px-2 py-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="max-h-80 overflow-x-hidden overflow-y-auto pr-1"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255, 255, 255, 0.2) transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.scrollbarColor = "rgba(255, 255, 255, 0.4) transparent";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.scrollbarColor = "rgba(255, 255, 255, 0.2) transparent";
        }}
      >
        {(() => {
          // Safely get notification sources with proper defaults
          const standardNotifications = notificationsData?.notifications || [];
          const executiveNotificationsList = (isExecutiveMode ? executiveNotifications || [] : [])
            .filter((n: any) => n && n.id)
            .map((n: any) => ({ ...n, source: "executive" }));
          const enhancedNotificationsList = (enhancedNotifications || [])
            .filter((n: any) => n && n.id)
            .map((n: any) => ({ ...n, source: "enhanced" }));

          // Combine all notification sources
          const allNotifications = [
            ...enhancedNotificationsList,
            ...executiveNotificationsList,
            ...standardNotifications.map((n: any) => ({ ...n, source: "standard" })),
          ]
            // Remove any invalid notifications
            .filter((n: any) => n && n.id && n.title)
            // Deduplicate by ID and source combination
            .reduce((acc: any[], notification: any) => {
              const key = `${notification.source}-${notification.id}`;
              const exists = acc.some((n: any) => `${n.source}-${n.id}` === key);
              if (!exists) {
                acc.push(notification);
              }
              return acc;
            }, [])
            // Sort by timestamp, newest first
            .sort((a: any, b: any) => {
              const aTime = new Date(a.timestamp || a.createdAt || 0).getTime();
              const bTime = new Date(b.timestamp || b.createdAt || 0).getTime();
              return bTime - aTime;
            });

          // Group notifications iOS-style by category and time
          const groupedNotifications = allNotifications.reduce((groups: any, notification: any) => {
            const category = notification.category || notification.type || "general";
            const now = new Date().getTime();
            const notificationTime = new Date(
              notification.timestamp || notification.createdAt || 0
            ).getTime();
            const hoursDiff = Math.floor((now - notificationTime) / (1000 * 60 * 60));

            let timeGroup = "";
            if (hoursDiff < 1) timeGroup = "Recent";
            else if (hoursDiff < 24) timeGroup = "Earlier Today";
            else if (hoursDiff < 168) timeGroup = "This Week";
            else timeGroup = "Earlier";

            const groupKey = `${timeGroup}-${category}`;

            if (!groups[groupKey]) {
              groups[groupKey] = {
                title:
                  category === "general"
                    ? timeGroup
                    : `${timeGroup} • ${category.charAt(0).toUpperCase() + category.slice(1)}`,
                timeGroup,
                category,
                notifications: [],
              };
            }

            groups[groupKey].notifications.push(notification);
            return groups;
          }, {});

          // Sort groups by time priority
          const sortedGroups = Object.values(groupedNotifications).sort((a: any, b: any) => {
            const timeOrder = { Recent: 0, "Earlier Today": 1, "This Week": 2, Earlier: 3 };
            return (
              (timeOrder[a.timeGroup as keyof typeof timeOrder] || 3) -
              (timeOrder[b.timeGroup as keyof typeof timeOrder] || 3)
            );
          });

          console.log("Notification Debug:", {
            standardCount: standardNotifications.length,
            executiveCount: executiveNotificationsList.length,
            enhancedCount: enhancedNotificationsList.length,
            totalCombined: allNotifications.length,
            groupCount: sortedGroups.length,
            groups: sortedGroups.map((g: any) => ({
              title: g.title,
              count: g.notifications.length,
            })),
          });

          return sortedGroups.length > 0 ? (
            <div className="space-y-4">
              {sortedGroups.map((group: any, groupIndex: number) => (
                <div key={`group-${groupIndex}`} className="space-y-2">
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-muted-foreground/70 text-xs font-semibold tracking-wider uppercase">
                      {group.title}
                    </h4>
                    <Badge variant="secondary" className="bg-muted/40 px-1.5 py-0.5 text-[10px]">
                      {group.notifications.length}
                    </Badge>
                  </div>

                  {/* Grouped Notifications */}
                  <div className="space-y-2">
                    {group.notifications.map((notification: any, index: number) => {
                      // Determine notification type and appropriate handling
                      const isEnhancedNotification = notification.source === "enhanced";
                      const isExecutiveNotification = notification.source === "executive";

                      const IconComponent = isEnhancedNotification
                        ? (notification as any).category === "economic"
                          ? TrendingUp
                          : (notification as any).category === "diplomatic"
                            ? Globe
                            : (notification as any).category === "social"
                              ? Users
                              : (notification as any).category === "security"
                                ? AlertTriangle
                                : (notification as any).category === "governance"
                                  ? Building2
                                  : (notification as any).category === "achievement"
                                    ? CheckCircle
                                    : (notification as any).category === "crisis"
                                      ? AlertCircle
                                      : (notification as any).category === "opportunity"
                                        ? TrendingUp
                                        : Bell
                        : isExecutiveNotification
                          ? (notification as any).category === "economic"
                            ? TrendingUp
                            : (notification as any).category === "diplomatic"
                              ? Globe
                              : (notification as any).category === "social"
                                ? Users
                                : (notification as any).category === "security"
                                  ? AlertTriangle
                                  : (notification as any).category === "governance"
                                    ? Building2
                                    : Bell
                          : (notification as any).type === "info"
                            ? Info
                            : (notification as any).type === "warning"
                              ? AlertTriangle
                              : (notification as any).type === "success"
                                ? CheckCircle
                                : (notification as any).type === "error"
                                  ? AlertCircle
                                  : Bell;

                      return (
                        <div
                          key={
                            notification.id
                              ? `${notification.source}-${notification.id}`
                              : `${notification.source}-fallback-${index}`
                          }
                          className={`hover:bg-accent/50 cursor-pointer rounded-lg border p-3 transition-all ${
                            notification.status === "read" || notification.read
                              ? "bg-muted/20 border-muted/40"
                              : "bg-muted/30 border-muted/60 shadow-sm"
                          }`}
                          onClick={() => {
                            const isRead = notification.status === "read" || notification.read;

                            if (!isRead) {
                              if (isEnhancedNotification) {
                                markEnhancedAsRead(notification.id);
                                recordEngagement(notification.id, "read");
                              } else if (isExecutiveNotification) {
                                markExecutiveAsRead(notification.id);
                              } else if (user?.id) {
                                markAsReadMutation.mutate({
                                  notificationId: notification.id,
                                  userId: user.id,
                                });
                              }
                            }

                            if ("href" in notification && notification.href) {
                              window.location.href = notification.href;
                            }

                            if (isEnhancedNotification) {
                              recordEngagement(notification.id, "click");
                            }
                          }}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`flex-shrink-0 rounded-lg p-2 ${
                                isEnhancedNotification
                                  ? (notification as any).priority === "critical"
                                    ? "bg-red-500/20"
                                    : (notification as any).priority === "high"
                                      ? "bg-orange-500/20"
                                      : (notification as any).priority === "medium"
                                        ? "bg-yellow-500/20"
                                        : "bg-blue-500/20"
                                  : isExecutiveNotification
                                    ? (notification as any).severity === "critical"
                                      ? "bg-red-500/20"
                                      : (notification as any).severity === "high"
                                        ? "bg-orange-500/20"
                                        : (notification as any).severity === "medium"
                                          ? "bg-yellow-500/20"
                                          : "bg-blue-500/20"
                                    : (notification as any).type === "info"
                                      ? "bg-blue-500/20"
                                      : (notification as any).type === "warning"
                                        ? "bg-yellow-500/20"
                                        : (notification as any).type === "success"
                                          ? "bg-green-500/20"
                                          : (notification as any).type === "error"
                                            ? "bg-destructive/20"
                                            : "bg-muted/50"
                              }`}
                            >
                              <IconComponent
                                className={`h-5 w-5 ${
                                  isEnhancedNotification
                                    ? (notification as any).priority === "critical"
                                      ? "text-red-600 dark:text-red-400"
                                      : (notification as any).priority === "high"
                                        ? "text-orange-600 dark:text-orange-400"
                                        : (notification as any).priority === "medium"
                                          ? "text-yellow-600 dark:text-yellow-400"
                                          : "text-blue-600 dark:text-blue-400"
                                    : isExecutiveNotification
                                      ? (notification as any).severity === "critical"
                                        ? "text-red-600 dark:text-red-400"
                                        : (notification as any).severity === "high"
                                          ? "text-orange-600 dark:text-orange-400"
                                          : (notification as any).severity === "medium"
                                            ? "text-yellow-600 dark:text-yellow-400"
                                            : "text-blue-600 dark:text-blue-400"
                                      : (notification as any).type === "info"
                                        ? "text-blue-600 dark:text-blue-400"
                                        : (notification as any).type === "warning"
                                          ? "text-yellow-600 dark:text-yellow-400"
                                          : (notification as any).type === "success"
                                            ? "text-green-600 dark:text-green-400"
                                            : (notification as any).type === "error"
                                              ? "text-red-600 dark:text-red-400"
                                              : "text-muted-foreground"
                                }`}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-foreground text-base font-medium break-words">
                                  {notification.title}
                                </div>
                                {!(notification.status === "read" || notification.read) && (
                                  <div className="bg-primary mt-1 h-3 w-3 flex-shrink-0 rounded-full" />
                                )}
                              </div>
                              {(notification.description || notification.message) && (
                                <div className="text-muted-foreground mt-2 text-sm leading-relaxed break-words">
                                  {notification.description || notification.message}
                                </div>
                              )}
                              <div className="mt-3 flex items-center justify-between">
                                <div className="text-muted-foreground/70 text-xs">
                                  {isEnhancedNotification
                                    ? `${new Date((notification as any).timestamp).toLocaleString()} • Smart Alert`
                                    : isExecutiveNotification
                                      ? `${new Date((notification as any).timestamp).toLocaleString()} • ${(notification as any).source}`
                                      : new Date((notification as any).createdAt).toLocaleString()}
                                </div>
                                <div className="flex items-center gap-2">
                                  {(isEnhancedNotification || isExecutiveNotification) && (
                                    <Badge
                                      variant="secondary"
                                      className={`px-2 py-0 text-xs ${
                                        isEnhancedNotification
                                          ? (notification as any).priority === "critical"
                                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                            : (notification as any).priority === "high"
                                              ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                              : (notification as any).priority === "medium"
                                                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                          : (notification as any).severity === "critical"
                                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                            : (notification as any).severity === "high"
                                              ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                              : (notification as any).severity === "medium"
                                                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                      }`}
                                    >
                                      {isEnhancedNotification
                                        ? (notification as any).priority
                                        : (notification as any).severity}
                                    </Badge>
                                  )}
                                  {notification.href && (
                                    <div className="text-primary flex items-center gap-1 text-xs">
                                      <span>View details</span>
                                      <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="mx-auto max-w-sm rounded-2xl bg-gradient-to-b from-white/5 to-white/10 p-6">
                <Bell className="mx-auto mb-4 h-16 w-16 text-white/30" />
                <div className="text-muted-foreground mb-2 text-lg">
                  {isExecutiveMode ? "Intelligence Center Clear" : "All caught up!"}
                </div>
                <div className="text-muted-foreground text-sm">
                  {isExecutiveMode
                    ? "No intelligence reports available. The situation is stable."
                    : "No notifications at this time. We'll notify you of important updates, economic changes, and system alerts."}
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/30">
                  <CheckCircle className="h-4 w-4" />
                  <span>{isExecutiveMode ? "Situation stable" : "Stay tuned for updates"}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
