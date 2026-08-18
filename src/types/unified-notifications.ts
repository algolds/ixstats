/**
 * Unified Notification System Types
 * Canonical type definitions for notifications, alerts, and toasts across IxStates.
 */

export interface UnifiedNotification {
  id: string;
  source: NotificationSource;
  timestamp: number;
  title: string;
  message: string;
  category: NotificationCategory;
  type: NotificationType;
  priority: NotificationPriority;
  severity: NotificationSeverity;
  context?: NotificationContext;
  triggers?: NotificationTrigger[];
  relevanceScore?: number;
  deliveryMethod?: DeliveryMethod;
  status: NotificationStatus;
  expiresAt?: number;
  actionable?: boolean;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
}

export type NotificationSource =
  | "realtime"
  | "admin"
  | "system"
  | "user"
  | "intelligence"
  | "external"
  | "scheduled";

export type NotificationCategory =
  | "economic"
  | "diplomatic"
  | "governance"
  | "social"
  | "security"
  | "system"
  | "achievement"
  | "crisis"
  | "opportunity"
  | "intelligence"
  | "policy"
  | "global"
  | "military"
  | string;

export type NotificationType =
  | "alert"
  | "update"
  | "opportunity"
  | "warning"
  | "critical"
  | "info"
  | "success"
  | "error";

export type NotificationPriority = "critical" | "high" | "medium" | "low";

export type NotificationSeverity = "urgent" | "important" | "informational" | "info";

export type DeliveryMethod =
  | "dynamic-island"
  | "toast"
  | "modal"
  | "command-palette"
  | "badge"
  | "silent"
  | "push";

export type NotificationStatus =
  | "pending"
  | "delivered"
  | "deferred"
  | "read"
  | "dismissed"
  | "expired"
  | "suppressed"
  | "failed";

export interface NotificationAction {
  id: string;
  label: string;
  type?: "primary" | "secondary" | "danger";
  actionType?: string;
  href?: string;
  onClick?: () => void;
}

export interface NotificationTrigger {
  type: string;
  source: string;
  data?: any;
  confidence?: number;
}

export interface NotificationContext {
  userId: string;
  countryId?: string;
  isExecutiveMode: boolean;
  currentRoute: string;
  userRole?: string;
  ixTime?: number;
  realTime?: number;
  timeMultiplier?: number;
  isUserActive?: boolean;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface CategoryPreferences {
  enabled: boolean;
  minPriority: NotificationPriority;
  deliveryMethods?: DeliveryMethod[];
  preferredMethods: DeliveryMethod[];
  soundEnabled?: boolean;
}

export interface UserNotificationPreferences {
  preferredMethods: DeliveryMethod[];
  quietHours: { start: string; end: string } | null;
  batchingEnabled: boolean;
  maxNotificationsPerHour: number;
  categories: Record<string, CategoryPreferences>;
  executiveModeFilters: NotificationCategory[];
  publicModeFilters: NotificationCategory[];
  allowMLPersonalization?: boolean;
  trackEngagement?: boolean;
}

export interface DeliveryContext {
  currentPage: string;
  isUserActive: boolean;
  isExecutiveMode?: boolean;
  activeFeatures?: string[];
  deviceType?: "mobile" | "tablet" | "desktop" | string;
  batteryLevel?: number;
  networkCondition?: string;
  timeOfDay?: number;
  userAttentionScore?: number;
  recentInteractions?: any[];
  contextualFactors?: Record<string, any>;
  lastUserActivity?: number;
}

export interface NotificationBatch {
  id: string;
  category?: NotificationCategory;
  notifications: UnifiedNotification[];
  timestamp?: number;
  title?: string;
  message?: string;
  priority: NotificationPriority;
  estimatedDeliveryTime?: number;
  batchingReason?: string;
  createdAt?: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  delivered?: number;
  dismissed?: number;
  engaged?: number;
  byCategory: Record<string, number>;
  byStatus?: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface NotificationEngagement {
  notificationId: string;
  actionTaken?: string;
  timeToRead?: number;
  timestamp: number;
  action?: string;
  timeToAction?: number;
  contextAtEngagement?: Record<string, any>;
  lastEngagement?: number;
  engagementRate?: number;
}

export interface NotificationHistory {
  id: string;
  notificationId: string;
  action: string;
  timestamp: number;
  context?: Record<string, any>;
  userAgent?: string;
  metadata?: {
    notificationAge?: number;
    priority?: NotificationPriority;
    category?: NotificationCategory;
  };
}
