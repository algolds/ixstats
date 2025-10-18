/**
 * Unified Notification System Types
 * Central type definitions for the unified notification/data alert system
 */

// Core notification interface
export interface UnifiedNotification {
  // Core identification
  id: string;
  source: NotificationSource;
  timestamp: number;
  
  // Content
  title: string;
  message: string;
  category: NotificationCategory;
  
  // Classification
  type: NotificationType;
  priority: NotificationPriority;
  severity: NotificationSeverity;
  
  // Context & Intelligence
  context: NotificationContext;
  triggers: NotificationTrigger[];
  relevanceScore: number; // 0-100
  
  // Delivery & Lifecycle
  deliveryMethod: DeliveryMethod;
  status: NotificationStatus;
  expiresAt?: number;
  
  // User Interaction
  actionable: boolean;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
  
  // Analytics & Learning
  userEngagement?: NotificationEngagement;
  suppressionRules?: SuppressionRule[];
}

// Notification source types
export type NotificationSource = 
  | 'realtime'        // Real-time data changes
  | 'admin'           // Admin panel created
  | 'system'          // System events/errors
  | 'user'            // User-triggered actions
  | 'intelligence'    // AI/ML generated
  | 'external'        // Third-party integrations
  | 'scheduled';      // Time-based alerts

// Content categorization
export type NotificationCategory = 
  | 'economic'        // GDP, trade, markets
  | 'diplomatic'      // International relations
  | 'governance'      // Government efficiency, policies
  | 'social'          // Population, demographics
  | 'security'        // National security, crises
  | 'system'          // Technical system events
  | 'achievement'     // Milestones, awards
  | 'crisis'          // Emergency situations
  | 'opportunity'     // Growth opportunities
  | 'intelligence'
  | 'policy'
  | 'global'
  | 'military' | string;

// Notification types
export type NotificationType = 
  | 'alert'           // Requires attention
  | 'update'          // Informational change
  | 'opportunity'     // Actionable chance
  | 'warning'         // Potential issue
  | 'critical'        // Immediate action needed
  | 'info'            // General information
  | 'success'         // Positive outcome
  | 'error';          // System/process error

// Priority levels
export type NotificationPriority = 
  | 'critical'        // Immediate attention required
  | 'high'            // Important, should be seen soon
  | 'medium'          // Normal priority
  | 'low';            // Can be delayed/batched

// Severity classification
export type NotificationSeverity = 
  | 'urgent'          // Time-sensitive, disruptive
  | 'important'       // Significant but not time-critical
  | 'informational' | 'info';  // Nice to know

// Delivery methods
export type DeliveryMethod = 
  | 'dynamic-island'  // Dynamic island notification
  | 'toast'           // Toast notification
  | 'modal'           // Modal dialog
  | 'command-palette' // Command palette entry
  | 'badge'           // Icon badge only
  | 'silent'          // Store only, no UI
  | 'push';           // Browser push notification

// Notification lifecycle status
export type NotificationStatus = 
  | 'pending'         // Awaiting delivery
  | 'delivered'       // Successfully delivered
  | 'deferred'        // Delivery deferred by optimization
  | 'read'            // User acknowledged
  | 'dismissed'       // User dismissed
  | 'expired'         // TTL expired
  | 'suppressed'      // Suppressed by rules
  | 'failed';         // Delivery failed

// Context information for intelligent routing
export interface NotificationContext {
  // User State
  userId: string;
  countryId?: string;
  isExecutiveMode: boolean;
  currentRoute: string;
  userRole?: string;
  
  // Temporal Context
  ixTime: number;
  realTime: number;
  timeMultiplier: number;
  gameYear?: number;
  
  // Session Context
  activeFeatures: string[];
  recentActions: string[];
  focusMode: boolean;
  sessionDuration: number;
  isUserActive: boolean;
  lastInteraction?: number; // Timestamp of last user interaction
  
  // Device Context
  deviceType: 'desktop' | 'tablet' | 'mobile';
  screenSize: 'small' | 'medium' | 'large';
  networkQuality: 'high' | 'medium' | 'low';
  batteryLevel?: number; // 0-100 battery percentage
  
  // Intelligence Factors
  userPreferences: UserNotificationPreferences;
  historicalEngagement: NotificationEngagement[];
  interactionHistory: any[];
  contextualFactors: Record<string, any>;
  urgencyFactors: string[];
  contextualRelevance: number; // 0-1 score
}

// What triggered this notification
export interface NotificationTrigger {
  type: TriggerType;
  source: string;
  data: Record<string, any>;
  threshold?: number;
  comparison?: 'greater' | 'less' | 'equal' | 'change';
  confidence: number; // 0-1
}

export type TriggerType = 
  | 'data-change'     // Data value changed
  | 'threshold'       // Value crossed threshold
  | 'pattern'         // Pattern detected
  | 'time'            // Time-based trigger
  | 'user-action'     // User performed action
  | 'external'        // External system event
  | 'scheduled'       // Scheduled event
  | 'correlation';    // Multiple factors correlated

// User notification preferences
export interface UserNotificationPreferences {
  // Delivery preferences
  preferredMethods: DeliveryMethod[];
  quietHours: { start: string; end: string } | null;
  batchingEnabled: boolean;
  maxNotificationsPerHour: number;
  
  // Content preferences
  categories: Record<NotificationCategory, {
    enabled: boolean;
    minPriority: NotificationPriority;
    deliveryMethods: DeliveryMethod[];
  }>;
  
  // Contextual preferences
  executiveModeFilters: NotificationCategory[];
  publicModeFilters: NotificationCategory[];
  
  // Learning preferences
  allowMLPersonalization: boolean;
  trackEngagement: boolean;
}

// User engagement tracking
export interface NotificationEngagement {
  notificationId: string;
  timestamp: number;
  action: EngagementAction;
  timeToAction?: number; // ms from delivery to action
  contextAtEngagement: Partial<NotificationContext>;
}

export type EngagementAction = 
  | 'viewed'          // Notification was seen
  | 'clicked'         // User clicked notification
  | 'dismissed'       // User dismissed
  | 'action-taken'    // User performed notification action
  | 'ignored'         // Notification expired without interaction
  | 'suppressed';     // User suppressed similar notifications

// Actionable elements in notifications
export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger' | 'info';
  onClick: () => void | Promise<void>;
  shortcut?: string; // Keyboard shortcut
  icon?: string;
  tooltip?: string;
  disabled?: boolean;
  loading?: boolean;
}

// Suppression rules to prevent notification spam
export interface SuppressionRule {
  id: string;
  type: SuppressionType;
  conditions: SuppressionCondition[];
  action: SuppressionAction;
  duration?: number; // ms
  maxOccurrences?: number;
}

export type SuppressionType = 
  | 'duplicate'       // Duplicate content
  | 'frequency'       // Too frequent
  | 'category-limit'  // Category overload
  | 'user-defined'    // User-created rule
  | 'intelligent'     // AI-determined suppression
  | 'context';        // Context-based suppression

export interface SuppressionCondition {
  field: keyof UnifiedNotification;
  operator: 'equals' | 'contains' | 'pattern' | 'threshold';
  value: any;
  timeWindow?: number; // ms
}

export type SuppressionAction = 
  | 'block'           // Don't deliver
  | 'batch'           // Batch with similar
  | 'delay'           // Delay delivery
  | 'downgrade'       // Reduce priority
  | 'redirect';       // Change delivery method

// Analytics and metrics
export interface NotificationAnalytics {
  totalDelivered: number;
  deliveryRate: number;
  engagementRate: number;
  averageTimeToAction: number;
  dismissalRate: number;
  categoryBreakdown: Record<NotificationCategory, number>;
  methodEffectiveness: Record<DeliveryMethod, {
    delivered: number;
    engaged: number;
    rate: number;
  }>;
}

// Orchestrator configuration
export interface OrchestratorConfig {
  // Processing limits
  maxConcurrentNotifications: number;
  maxQueueSize: number;
  processingTimeout: number;
  
  // Intelligence settings
  relevanceThreshold: number; // 0-100
  contextWeighting: Record<string, number>;
  learningEnabled: boolean;
  
  // Delivery settings
  batchingWindow: number; // ms
  rateLimiting: Record<NotificationPriority, number>; // per minute
  fallbackMethod: DeliveryMethod;
  
  // Integration settings
  dynamicIslandEnabled: boolean;
  commandPaletteIntegration: boolean;
  adminOverrideEnabled: boolean;
}

// Event interfaces for the orchestrator
export interface NotificationEvent {
  type: NotificationEventType;
  notification: UnifiedNotification;
  timestamp: number;
  context: NotificationContext;
}

export type NotificationEventType = 
  | 'created'         // Notification created
  | 'queued'          // Added to delivery queue
  | 'processed'       // Processed by orchestrator
  | 'delivered'       // Successfully delivered
  | 'failed'          // Delivery failed
  | 'engaged'         // User engaged
  | 'suppressed'      // Suppressed by rules
  | 'expired';        // Expired before delivery

// Export default configuration
export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxConcurrentNotifications: 10,
  maxQueueSize: 1000,
  processingTimeout: 5000,
  relevanceThreshold: 30,
  contextWeighting: {
    priority: 0.4,
    recency: 0.2,
    relevance: 0.2,
    userPreference: 0.2,
  },
  learningEnabled: true,
  batchingWindow: 2000,
  rateLimiting: {
    critical: 20,
    high: 10,
    medium: 5,
    low: 2,
  },
  fallbackMethod: 'command-palette',
  dynamicIslandEnabled: true,
  commandPaletteIntegration: true,
  adminOverrideEnabled: true,
};

export const DEFAULT_USER_PREFERENCES: UserNotificationPreferences = {
  preferredMethods: ['dynamic-island', 'toast'],
  quietHours: null,
  batchingEnabled: true,
  maxNotificationsPerHour: 30,
  categories: {
    economic: { enabled: true, minPriority: 'medium', deliveryMethods: ['dynamic-island'] },
    diplomatic: { enabled: true, minPriority: 'medium', deliveryMethods: ['dynamic-island'] },
    governance: { enabled: true, minPriority: 'high', deliveryMethods: ['dynamic-island'] },
    social: { enabled: true, minPriority: 'low', deliveryMethods: ['toast'] },
    security: { enabled: true, minPriority: 'high', deliveryMethods: ['dynamic-island', 'modal'] },
    system: { enabled: true, minPriority: 'medium', deliveryMethods: ['toast'] },
    achievement: { enabled: true, minPriority: 'low', deliveryMethods: ['toast'] },
    crisis: { enabled: true, minPriority: 'critical', deliveryMethods: ['modal', 'dynamic-island'] },
    opportunity: { enabled: true, minPriority: 'medium', deliveryMethods: ['dynamic-island'] },
    policy: { enabled: true, minPriority: 'medium', deliveryMethods: ['toast'] },
    intelligence: { enabled: true, minPriority: 'high', deliveryMethods: ['dynamic-island'] },
    global: { enabled: true, minPriority: 'medium', deliveryMethods: ['toast'] },
    military: { enabled: true, minPriority: 'high', deliveryMethods: ['dynamic-island'] },
  } as Record<NotificationCategory, { enabled: boolean, minPriority: NotificationPriority, deliveryMethods: DeliveryMethod[] }>,
  executiveModeFilters: ['economic', 'governance', 'security', 'crisis'],
  publicModeFilters: ['achievement', 'opportunity', 'system'],
  allowMLPersonalization: true,
  trackEngagement: true,
};

// Additional types for notification store
export interface NotificationBatch {
  id: string;
  notifications: UnifiedNotification[];
  priority: NotificationPriority;
  estimatedDeliveryTime: number;
  batchingReason: string;
  createdAt: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
  delivered: number;
  dismissed: number;
  engaged: number;
}

export interface DeliveryContext {
  isUserActive: boolean;
  currentPage: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  batteryLevel: number;
  networkCondition: 'poor' | 'good' | 'excellent';
  timeOfDay: number;
  userAttentionScore: number;
  recentInteractions: string[];
  contextualFactors: Record<string, any>;
  lastUserActivity: number;
}

export interface NotificationHistory {
  id: string;
  notificationId: string;
  action: string;
  timestamp: number;
  context: Record<string, any>;
  userAgent: string;
  metadata: Record<string, any>;
}

// Grouping preferences for notification batching
export interface GroupingPreferences {
  enableGrouping: boolean;
  maxGroupSize: number;
  timeWindow: number;
  groupByCategory: boolean;
  groupBySeverity: boolean;
}

// Notification group for batching
export interface NotificationGroup {
  id: string;
  notifications: UnifiedNotification[];
  groupingCriteria: string[];
  priority: NotificationPriority;
  createdAt: number;
}