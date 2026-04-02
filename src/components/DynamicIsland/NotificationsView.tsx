import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import type { NotificationsViewProps } from "./types";

// Helper: resolve icon by category/type
function getNotificationIcon(notification: any): React.ComponentType<{ className?: string }> {
  const cat = notification.category;
  if (cat) {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      economic: TrendingUp, diplomatic: Globe, social: Users,
      security: AlertTriangle, governance: Building2, achievement: CheckCircle,
      crisis: AlertCircle, opportunity: TrendingUp, military: AlertTriangle,
      wiki: BookOpen,
    };
    return iconMap[cat] ?? Bell;
  }
  const typeMap: Record<string, React.ComponentType<{ className?: string }>> = {
    info: Info, warning: AlertTriangle, success: CheckCircle, error: AlertCircle,
  };
  return typeMap[notification.type] ?? Bell;
}

// Helper: resolve priority/severity color classes
function getPriorityColors(notification: any): { bg: string; text: string } {
  const level = notification.priority ?? notification.severity ?? notification.type;
  const map: Record<string, { bg: string; text: string }> = {
    critical: { bg: "bg-red-500/20", text: "text-red-600 dark:text-red-400" },
    high: { bg: "bg-orange-500/20", text: "text-orange-600 dark:text-orange-400" },
    medium: { bg: "bg-yellow-500/20", text: "text-yellow-600 dark:text-yellow-400" },
    warning: { bg: "bg-yellow-500/20", text: "text-yellow-600 dark:text-yellow-400" },
    success: { bg: "bg-green-500/20", text: "text-green-600 dark:text-green-400" },
    error: { bg: "bg-destructive/20", text: "text-red-600 dark:text-red-400" },
    info: { bg: "bg-blue-500/20", text: "text-blue-600 dark:text-blue-400" },
  };
  return map[level] ?? { bg: "bg-blue-500/20", text: "text-blue-600 dark:text-blue-400" };
}

// Helper: priority badge color
function getPriorityBadgeClass(notification: any): string {
  const level = notification.priority ?? notification.severity;
  const map: Record<string, string> = {
    critical: "bg-red-500/10 text-red-600 dark:text-red-400",
    high: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  };
  return map[level] ?? "bg-blue-500/10 text-blue-600 dark:text-blue-400";
}

export function NotificationsView({ onClose }: NotificationsViewProps) {
  const notify = useNotify();
  const { user } = useUser();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Close on ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
      notify.success("All notifications marked as read");
    },
  });

  const createTestNotificationMutation = api.notifications.createNotification.useMutation({
    onSuccess: () => {
      void refetchNotifications();
      notify.success("Test notification created");
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
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white hover:scale-110 active:scale-95"
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>
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

          const toggleGroup = (key: string) => {
            setCollapsedGroups((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          };

          return sortedGroups.length > 0 ? (
            <div className="space-y-4">
              {sortedGroups.map((group: any, groupIndex: number) => {
                const groupKey = `group-${groupIndex}`;
                const isCollapsed = collapsedGroups.has(groupKey);

                return (
                <div key={groupKey} className="space-y-2">
                  {/* Collapsible Group Header */}
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="flex w-full items-center justify-between px-1 py-0.5 rounded hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <motion.div
                        animate={{ rotate: isCollapsed ? 0 : 90 }}
                        transition={{ duration: 0.15 }}
                      >
                        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                      </motion.div>
                      <h4 className="text-muted-foreground/70 text-xs font-semibold tracking-wider uppercase">
                        {group.title}
                      </h4>
                    </div>
                    <Badge variant="secondary" className="bg-muted/40 px-1.5 py-0.5 text-[10px]">
                      {group.notifications.length}
                    </Badge>
                  </button>

                  {/* Grouped Notifications with swipe-to-dismiss */}
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2 overflow-hidden"
                      >
                    {group.notifications.map((notification: any, index: number) => {
                      const isEnhancedNotification = notification.source === "enhanced";
                      const isExecutiveNotification = notification.source === "executive";
                      const IconComponent = getNotificationIcon(notification);
                      const colors = getPriorityColors(notification);
                      const itemKey = notification.id
                        ? `${notification.source}-${notification.id}`
                        : `${notification.source}-fallback-${index}`;

                      return (
                        <motion.div
                          key={itemKey}
                          layout
                          initial={{ opacity: 0, x: 0 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -200, transition: { duration: 0.2 } }}
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.3}
                          onDragEnd={(_e, info) => {
                            if (Math.abs(info.offset.x) > 100 || Math.abs(info.velocity.x) > 500) {
                              // Swipe to dismiss — mark as read
                              if (isEnhancedNotification) {
                                markEnhancedAsRead(notification.id);
                                recordEngagement(notification.id, "dismiss");
                              } else if (isExecutiveNotification) {
                                markExecutiveAsRead(notification.id);
                              } else if (user?.id) {
                                markAsReadMutation.mutate({
                                  notificationId: notification.id,
                                  userId: user.id,
                                });
                              }
                            }
                          }}
                          className={`hover:bg-accent/50 cursor-pointer rounded-lg border p-3 transition-colors ${
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
                            <div className={`flex-shrink-0 rounded-lg p-2 ${colors.bg}`}>
                              <IconComponent className={`h-5 w-5 ${colors.text}`} />
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
                                    ? `${new Date(notification.timestamp).toLocaleString()} • Smart Alert`
                                    : isExecutiveNotification
                                      ? `${new Date(notification.timestamp).toLocaleString()} • ${notification.source}`
                                      : new Date(notification.createdAt).toLocaleString()}
                                </div>
                                <div className="flex items-center gap-2">
                                  {(isEnhancedNotification || isExecutiveNotification) && (
                                    <Badge
                                      variant="secondary"
                                      className={`px-2 py-0 text-xs ${getPriorityBadgeClass(notification)}`}
                                    >
                                      {notification.priority ?? notification.severity}
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
                        </motion.div>
                      );
                    })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                );
              })}
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
