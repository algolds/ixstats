"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Globe,
  Shield,
  Crown,
  Zap,
  X,
} from "lucide-react";

// Notification types for different data categories
export interface GlobalNotification {
  id: string;
  type: "alert" | "success" | "info" | "warning" | "critical";
  category: "economic" | "demographic" | "diplomatic" | "governance" | "system" | "achievement";
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: number;
  source: string;
  actionable: boolean;
  priority: "low" | "medium" | "high" | "critical";
  autoRemove?: boolean;
  removeAfter?: number; // milliseconds
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  type: "primary" | "secondary" | "danger";
  onClick: () => void;
}

interface NotificationContextType {
  notifications: GlobalNotification[];
  addNotification: (notification: Omit<GlobalNotification, "id" | "timestamp">) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  markAsRead: (id: string) => void;
  getNotificationsByCategory: (category: GlobalNotification["category"]) => GlobalNotification[];
  getNotificationsByPriority: (priority: GlobalNotification["priority"]) => GlobalNotification[];
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Global notification provider
export function GlobalNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<GlobalNotification[]>([]);

  const addNotification = useCallback(
    (notification: Omit<GlobalNotification, "id" | "timestamp">) => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newNotification: GlobalNotification = {
        ...notification,
        id,
        timestamp: Date.now(),
        autoRemove: notification.autoRemove ?? notification.priority === "low",
        removeAfter: notification.removeAfter ?? 30000, // 30 seconds default
      };

      setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Limit to 50 notifications

      // Auto-remove if specified
      if (newNotification.autoRemove) {
        setTimeout(() => {
          removeNotification(id);
        }, newNotification.removeAfter);
      }

      return id;
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, priority: "low" as const } : n))
    );
  }, []);

  const getNotificationsByCategory = useCallback(
    (category: GlobalNotification["category"]) => {
      return notifications.filter((n) => n.category === category);
    },
    [notifications]
  );

  const getNotificationsByPriority = useCallback(
    (priority: GlobalNotification["priority"]) => {
      return notifications.filter((n) => n.priority === priority);
    },
    [notifications]
  );

  const contextValue: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    markAsRead,
    getNotificationsByCategory,
    getNotificationsByPriority,
  };

  return (
    <NotificationContext.Provider value={contextValue}>{children}</NotificationContext.Provider>
  );
}

export function useGlobalNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useGlobalNotifications must be used within GlobalNotificationProvider");
  }
  return context;
}

// Notification icon resolver
function getNotificationIcon(
  type: GlobalNotification["type"],
  category: GlobalNotification["category"]
) {
  if (type === "critical") return AlertTriangle;
  if (type === "warning") return AlertTriangle;
  if (type === "success") return CheckCircle;
  if (type === "info") return Info;

  // Category-specific icons
  switch (category) {
    case "economic":
      return DollarSign;
    case "demographic":
      return Users;
    case "diplomatic":
      return Globe;
    case "governance":
      return Shield;
    case "achievement":
      return Crown;
    case "system":
      return Zap;
    default:
      return Info;
  }
}

// Notification color theme resolver
function getNotificationTheme(
  type: GlobalNotification["type"],
  priority: GlobalNotification["priority"]
) {
  if (priority === "critical") {
    return {
      bg: "bg-red-500/10 border-red-500/20 hover:bg-red-500/15",
      text: "text-red-700 dark:text-red-300",
      icon: "text-red-600",
      glow: "shadow-red-500/20",
    };
  }

  switch (type) {
    case "alert":
    case "warning":
      return {
        bg: "bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/15",
        text: "text-yellow-700 dark:text-yellow-300",
        icon: "text-yellow-600",
        glow: "shadow-yellow-500/20",
      };
    case "success":
      return {
        bg: "bg-green-500/10 border-green-500/20 hover:bg-green-500/15",
        text: "text-green-700 dark:text-green-300",
        icon: "text-green-600",
        glow: "shadow-green-500/20",
      };
    case "info":
    default:
      return {
        bg: "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15",
        text: "text-blue-700 dark:text-blue-300",
        icon: "text-blue-600",
        glow: "shadow-blue-500/20",
      };
  }
}

// Individual notification component
interface NotificationCardProps {
  notification: GlobalNotification;
  onRemove: (id: string) => void;
  onAction?: (actionId: string) => void;
  compact?: boolean;
}

export function NotificationCard({
  notification,
  onRemove,
  onAction,
  compact = false,
}: NotificationCardProps) {
  const Icon = getNotificationIcon(notification.type, notification.category);
  const theme = getNotificationTheme(notification.type, notification.priority);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`relative rounded-lg border p-4 backdrop-blur-md transition-all duration-200 ${theme.bg} ${theme.glow} ${compact ? "p-3" : "p-4"} `}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 rounded-lg p-2 ${theme.icon}`}>
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className={`font-semibold ${compact ? "text-sm" : "text-base"} ${theme.text}`}>
                {notification.title}
              </h4>
              <p className={`${compact ? "text-xs" : "text-sm"} text-muted-foreground mt-1`}>
                {notification.message}
              </p>

              {!compact && (
                <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                  <span>{notification.source}</span>
                  <span>•</span>
                  <span>{new Date(notification.timestamp).toLocaleTimeString()}</span>
                  <span>•</span>
                  <span className="capitalize">{notification.category}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => onRemove(notification.id)}
              className="text-muted-foreground hover:text-foreground flex-shrink-0 rounded p-1 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action buttons */}
          {notification.actions && notification.actions.length > 0 && !compact && (
            <div className="mt-3 flex gap-2">
              {notification.actions.map((action, actionIndex) => (
                <button
                  key={
                    action.id && action.id.trim()
                      ? `action-${action.id.trim()}`
                      : `action-fallback-${actionIndex}`
                  }
                  onClick={() => {
                    action.onClick();
                    onAction?.(action.id);
                  }}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    action.type === "primary"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : action.type === "danger"
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  } `}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Data-driven notification generators
export const DataNotificationGenerators = {
  // Economic data changes
  economicAlert: (data: { metric: string; value: number; change: number; threshold?: number }) => ({
    type: "alert" as const,
    category: "economic" as const,
    title: `Economic Alert: ${data.metric}`,
    message: `${data.metric} has changed by ${data.change > 0 ? "+" : ""}${data.change.toFixed(2)}% to ${data.value.toLocaleString()}`,
    data,
    source: "Economic Intelligence",
    actionable: true,
    priority: Math.abs(data.change) > 5 ? ("high" as const) : ("medium" as const),
  }),

  // Population changes
  demographicUpdate: (data: { population: number; change: number; growthRate: number }) => ({
    type: "info" as const,
    category: "demographic" as const,
    title: "Population Update",
    message: `Population: ${data.population.toLocaleString()} (${data.change > 0 ? "+" : ""}${data.change.toLocaleString()}) • Growth Rate: ${(data.growthRate * 100).toFixed(2)}%`,
    data,
    source: "Demographics Bureau",
    actionable: false,
    priority: "low" as const,
  }),

  // Achievement unlocked
  achievementUnlocked: (data: { title: string; description: string; rarity: string }) => ({
    type: "success" as const,
    category: "achievement" as const,
    title: "Achievement Unlocked!",
    message: `${data.title} - ${data.description}`,
    data,
    source: "Achievement System",
    actionable: false,
    priority: data.rarity === "legendary" ? ("high" as const) : ("medium" as const),
  }),

  // System status
  systemStatus: (data: { component: string; status: string; message: string }) => ({
    type: data.status === "error" ? ("critical" as const) : ("info" as const),
    category: "system" as const,
    title: `System: ${data.component}`,
    message: data.message,
    data,
    source: "System Monitor",
    actionable: data.status === "error",
    priority: data.status === "error" ? ("critical" as const) : ("low" as const),
  }),

  // Diplomatic events
  diplomaticEvent: (data: { event: string; country?: string; impact: string }) => ({
    type: "info" as const,
    category: "diplomatic" as const,
    title: "Diplomatic Update",
    message: `${data.event}${data.country ? ` with ${data.country}` : ""} • Impact: ${data.impact}`,
    data,
    source: "Diplomatic Intelligence",
    actionable: true,
    priority: "medium" as const,
  }),
};

export default {
  GlobalNotificationProvider,
  useGlobalNotifications,
  NotificationCard,
  DataNotificationGenerators,
};
