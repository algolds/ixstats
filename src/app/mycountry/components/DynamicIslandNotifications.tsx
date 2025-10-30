"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Crown,
  Globe2,
  TrendingUp,
  Users,
  Building2,
  MessageSquare,
  Calendar,
  Settings,
  Search,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";

interface Notification {
  id: string;
  type: "alert" | "opportunity" | "update" | "message" | "achievement";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  category: "economic" | "diplomatic" | "social" | "security" | "governance";
  timestamp: number;
  actionable: boolean;
  read: boolean;
  source: string;
}

interface DynamicIslandNotificationsProps {
  notifications: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkAllRead?: () => void;
  onNotificationAction?: (notificationId: string, action: string) => void;
  className?: string;
}

function getNotificationIcon(type: Notification["type"], severity: Notification["severity"]) {
  const iconProps = {
    size: 16,
    className:
      severity === "critical"
        ? "text-red-500"
        : severity === "high"
          ? "text-orange-500"
          : severity === "medium"
            ? "text-yellow-500"
            : "text-blue-500",
  };

  switch (type) {
    case "alert":
      return <AlertTriangle {...iconProps} />;
    case "opportunity":
      return <Zap {...iconProps} />;
    case "update":
      return <CheckCircle {...iconProps} />;
    case "message":
      return <MessageSquare {...iconProps} />;
    case "achievement":
      return <Crown {...iconProps} />;
    default:
      return <Bell {...iconProps} />;
  }
}

function getCategoryIcon(category: Notification["category"]) {
  const iconProps = { size: 14, className: "text-muted-foreground" };

  switch (category) {
    case "economic":
      return <TrendingUp {...iconProps} />;
    case "diplomatic":
      return <Globe2 {...iconProps} />;
    case "social":
      return <Users {...iconProps} />;
    case "governance":
      return <Building2 {...iconProps} />;
    case "security":
      return <AlertTriangle {...iconProps} />;
    default:
      return <Bell {...iconProps} />;
  }
}

export function DynamicIslandNotifications({
  notifications,
  onNotificationClick,
  onMarkAllRead,
  onNotificationAction,
  className = "",
}: DynamicIslandNotificationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "critical" | "actionable">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const criticalCount = notifications.filter((n) => n.severity === "critical" && !n.read).length;

  // Filter notifications
  const filteredNotifications = notifications
    .filter((notification) => {
      if (filter === "unread") return !notification.read;
      if (filter === "critical") return notification.severity === "critical";
      if (filter === "actionable") return notification.actionable;
      return true;
    })
    .filter(
      (notification) =>
        searchQuery === "" ||
        notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by severity (critical first), then by timestamp (newest first)
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return b.timestamp - a.timestamp;
    });

  const handleNotificationClick = (notification: Notification) => {
    onNotificationClick?.(notification);
    // Mark as read when clicked
    if (!notification.read) {
      // This would typically trigger a state update in the parent
      onNotificationAction?.(notification.id, "mark_read");
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <AnimatePresence>
        {!isExpanded ? (
          // Collapsed Dynamic Island
          <motion.div
            key="collapsed"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative"
          >
            <Button
              onClick={() => setIsExpanded(true)}
              className="glass-hierarchy-interactive relative overflow-hidden border-white/10 bg-black/80 text-white backdrop-blur-xl transition-all duration-300 hover:bg-black/90"
              style={{
                borderRadius: "20px",
                padding: "8px 16px",
                minWidth: unreadCount > 0 ? "120px" : "80px",
              }}
            >
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-1"
                  >
                    <Badge
                      className={`px-1.5 py-0 text-xs ${
                        criticalCount > 0 ? "bg-red-500 text-white" : "bg-blue-500 text-white"
                      }`}
                    >
                      {unreadCount}
                    </Badge>
                  </motion.div>
                )}
              </div>

              {/* Pulse animation for critical notifications */}
              {criticalCount > 0 && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-red-500/20"
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </Button>
          </motion.div>
        ) : (
          // Expanded Notification Panel
          <motion.div
            key="expanded"
            initial={{ scale: 0.9, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-96"
          >
            <Card className="glass-hierarchy-parent border-white/10 bg-black/90 text-white shadow-2xl backdrop-blur-xl">
              <CardContent className="p-0">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 p-4">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-white" />
                    <div>
                      <h3 className="font-semibold">Notifications</h3>
                      <p className="text-xs text-white/60">
                        {unreadCount} unread {criticalCount > 0 && `• ${criticalCount} critical`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMarkAllRead}
                        className="text-xs text-white/80 hover:bg-white/10 hover:text-white"
                      >
                        Mark all read
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsExpanded(false)}
                      className="p-1 text-white/80 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="space-y-3 border-b border-white/10 p-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-white/40" />
                      <Input
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/40 focus:border-white/20"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/80 hover:bg-white/10 hover:text-white"
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    {["all", "unread", "critical", "actionable"].map((filterOption) => (
                      <Button
                        key={filterOption}
                        variant={filter === filterOption ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setFilter(filterOption as any)}
                        className={`text-xs capitalize ${
                          filter === filterOption
                            ? "bg-white/20 text-white"
                            : "text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {filterOption}
                        {filterOption === "unread" && unreadCount > 0 && (
                          <Badge className="ml-1 bg-blue-500 px-1 text-xs text-white">
                            {unreadCount}
                          </Badge>
                        )}
                        {filterOption === "critical" && criticalCount > 0 && (
                          <Badge className="ml-1 bg-red-500 px-1 text-xs text-white">
                            {criticalCount}
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-96 overflow-y-auto">
                  {filteredNotifications.length > 0 ? (
                    <div className="space-y-1 p-2">
                      {filteredNotifications.map((notification, index) => (
                        <motion.div
                          key={
                            notification.id && notification.id.trim()
                              ? `notification-${notification.id.trim()}`
                              : `notification-fallback-${index}`
                          }
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleNotificationClick(notification)}
                          className={`cursor-pointer rounded-lg border border-transparent p-3 transition-all duration-200 hover:border-white/10 hover:bg-white/5 ${
                            !notification.read ? "bg-white/5" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0">
                              {getNotificationIcon(notification.type, notification.severity)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <h4 className="truncate text-sm font-medium text-white">
                                  {notification.title}
                                </h4>
                                {!notification.read && (
                                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                                )}
                              </div>

                              <p className="mb-2 line-clamp-2 text-xs text-white/70">
                                {notification.description}
                              </p>

                              <div className="flex items-center gap-2 text-xs text-white/50">
                                {getCategoryIcon(notification.category)}
                                <span className="capitalize">{notification.category}</span>
                                <span>•</span>
                                <span>{new Date(notification.timestamp).toLocaleTimeString()}</span>
                                <span>•</span>
                                <span>{notification.source}</span>
                                {notification.actionable && (
                                  <>
                                    <span>•</span>
                                    <Badge className="bg-amber-500/20 px-1 text-xs text-amber-300">
                                      Action Required
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-white/60">
                      <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      <p className="text-sm">No notifications found</p>
                      {searchQuery && (
                        <p className="mt-1 text-xs">Try adjusting your search or filters</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {filteredNotifications.length > 0 && (
                  <div className="flex items-center justify-between border-t border-white/10 p-3">
                    <span className="text-xs text-white/60">
                      {filteredNotifications.length} notification
                      {filteredNotifications.length !== 1 ? "s" : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <Settings className="mr-1 h-3 w-3" />
                      Settings
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DynamicIslandNotifications;
