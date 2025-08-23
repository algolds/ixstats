/**
 * Unified Notification Store
 * Global state management for the enhanced notification system
 */

'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  UnifiedNotification,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  UserNotificationPreferences,
  NotificationBatch,
  NotificationStats,
  NotificationEngagement,
  DeliveryContext,
  NotificationHistory
} from '~/types/unified-notifications';
import { 
  calculateEnhancedPriority 
} from '~/services/EnhancedNotificationPriority';
import { 
  optimizeDelivery,
  updateUserAttention 
} from '~/services/NotificationDeliveryOptimization';
import { 
  categorizeNotification,
  calculateDynamicUrgency 
} from '~/services/NotificationCategorization';
import { 
  groupNotifications,
  createSmartBatches 
} from '~/services/NotificationGrouping';
import { generateSafeKey } from '~/app/mycountry/new/utils/keyValidation';

interface NotificationState {
  // Core data
  notifications: UnifiedNotification[];
  batches: NotificationBatch[];
  stats: NotificationStats;
  engagement: NotificationEngagement;
  userPreferences: UserNotificationPreferences;
  history: NotificationHistory[];
  
  // UI state
  isVisible: boolean;
  activeTab: 'all' | 'unread' | 'priority';
  filters: {
    categories: NotificationCategory[];
    priorities: NotificationPriority[];
    status: NotificationStatus[];
    timeRange: 'hour' | 'day' | 'week' | 'month' | 'all';
  };
  
  // Context
  deliveryContext: DeliveryContext;
  lastUpdate: number;
  isLoading: boolean;
  error: string | null;
}

interface NotificationActions {
  // Core actions
  addNotification: (notification: Omit<UnifiedNotification, 'id' | 'timestamp'>) => Promise<void>;
  removeNotification: (id: string) => void;
  updateNotification: (id: string, updates: Partial<UnifiedNotification>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  
  // Batch operations
  processBatches: () => void;
  optimizeDelivery: () => void;
  updateDeliveryContext: (context: Partial<DeliveryContext>) => void;
  
  // User interaction
  recordEngagement: (notificationId: string, action: string, context?: any) => void;
  updatePreferences: (preferences: Partial<UserNotificationPreferences>) => void;
  
  // UI actions
  setVisible: (visible: boolean) => void;
  setActiveTab: (tab: 'all' | 'unread' | 'priority') => void;
  setFilters: (filters: Partial<NotificationState['filters']>) => void;
  
  // System actions
  initialize: () => Promise<void>;
  cleanup: () => void;
  refresh: () => void;
}

type NotificationStore = NotificationState & NotificationActions;

// Local default preferences
const defaultUserPreferences: UserNotificationPreferences = {
  preferredMethods: ['dynamic-island', 'toast'],
  quietHours: null,
  batchingEnabled: true,
  maxNotificationsPerHour: 30,
  categories: {
    economic: { enabled: true, minPriority: 'medium', deliveryMethods: ['dynamic-island'] },
    diplomatic: { enabled: true, minPriority: 'medium', deliveryMethods: ['dynamic-island'] },
    governance: { enabled: true, minPriority: 'high', deliveryMethods: ['dynamic-island'] },
    social: { enabled: true, minPriority: 'low', deliveryMethods: ['toast'] },
    security: { enabled: true, minPriority: 'high', deliveryMethods: ['dynamic-island'] },
    system: { enabled: true, minPriority: 'medium', deliveryMethods: ['toast'] },
    achievement: { enabled: true, minPriority: 'low', deliveryMethods: ['toast'] },
    crisis: { enabled: true, minPriority: 'critical', deliveryMethods: ['dynamic-island'] },
    opportunity: { enabled: true, minPriority: 'medium', deliveryMethods: ['dynamic-island'] }
  },
  executiveModeFilters: ['economic', 'governance', 'security', 'crisis'],
  publicModeFilters: ['achievement', 'opportunity', 'system'],
  allowMLPersonalization: true,
  trackEngagement: true,
};

// Default delivery context
const defaultDeliveryContext: DeliveryContext = {
  isUserActive: true,
  currentPage: 'dashboard',
  deviceType: 'desktop',
  batteryLevel: 100,
  networkCondition: 'good',
  timeOfDay: new Date().getHours(),
  userAttentionScore: 80,
  recentInteractions: [],
  contextualFactors: {},
  lastUserActivity: Date.now()
};

export const useNotificationStore = create<NotificationStore>()(
  subscribeWithSelector(
      (set, get) => ({
    // Initial state
    notifications: [],
    batches: [],
    stats: {
      total: 0,
      unread: 0,
      byCategory: {} as Record<NotificationCategory, number>,
      byPriority: {} as Record<NotificationPriority, number>,
      delivered: 0,
      dismissed: 0,
      engaged: 0
    },
    engagement: {
      notificationId: '',
      timestamp: 0,
      action: 'viewed' as const,
      timeToAction: 0,
      contextAtEngagement: {}
    },
    userPreferences: defaultUserPreferences,
    history: [],
    
    // UI state
    isVisible: false,
    activeTab: 'all',
    filters: {
      categories: [],
      priorities: [],
      status: [],
      timeRange: 'day'
    },
    
    // Context
    deliveryContext: defaultDeliveryContext,
    lastUpdate: Date.now(),
    isLoading: false,
    error: null,

    // Actions
    addNotification: async (notificationData) => {
      try {
        const state = get();
        
        // Generate safe ID
        const id = generateSafeKey(notificationData.title || 'notification', 'notif', Date.now());
        
        // Create full notification with safe defaults
        const notification: UnifiedNotification = {
          ...notificationData,
          id,
          title: notificationData.title || 'Notification',
          message: notificationData.message || '',
          category: notificationData.category || 'system',
          priority: notificationData.priority || 'medium',
          severity: notificationData.severity || 'info',
          timestamp: Date.now(),
          status: 'pending',
          deliveryMethod: 'dynamic-island',
          relevanceScore: 50
        };

        // Apply enhanced priority calculation (async) - temporarily disabled due to type issues
        try {
          // const enhancedPriority = await calculateEnhancedPriority(notification, state.notifications, state.userPreferences);
          // notification.priority = enhancedPriority.finalPriority;
          // notification.relevanceScore = enhancedPriority.breakdown?.relevance || 50;
        } catch (error) {
          console.warn('Enhanced priority calculation failed, using defaults:', error);
        }

        // Apply categorization (async)
        try {
          // const categorization = await categorizeNotification(notification);
          // notification.category = categorization.primary || notification.category;
          // notification.severity = categorization.severity || notification.severity;
        } catch (error) {
          console.warn('Notification categorization failed, using defaults:', error);
        }

        // Optimize delivery (async)
        try {
          // const deliveryOptimization = await optimizeDelivery(notification, state.deliveryContext);
          // notification.deliveryMethod = deliveryOptimization.method || 'dynamic-island';
          // notification.status = deliveryOptimization.shouldDefer ? 'deferred' : 'delivered';
        } catch (error) {
          console.warn('Delivery optimization failed, using defaults:', error);
          notification.status = 'delivered';
        }

        set((state) => {
          const newNotifications = [notification, ...state.notifications];
          
          // Update stats
          const newStats = calculateStats(newNotifications);
          
          return {
            notifications: newNotifications,
            stats: newStats,
            lastUpdate: Date.now()
          };
        });

        // Process batches after adding
        get().processBatches();
      } catch (error) {
        console.error('Failed to add notification:', error);
        set({ error: `Failed to add notification: ${error instanceof Error ? error.message : String(error)}` });
      }
    },

    removeNotification: (id) => {
      set((state) => {
        const newNotifications = state.notifications.filter(n => n.id !== id);
        return {
          notifications: newNotifications,
          stats: calculateStats(newNotifications),
          lastUpdate: Date.now()
        };
      });
    },

    updateNotification: (id, updates) => {
      set((state) => {
        const newNotifications = state.notifications.map(n =>
          n.id === id ? { ...n, ...updates } : n
        );
        return {
          notifications: newNotifications,
          stats: calculateStats(newNotifications),
          lastUpdate: Date.now()
        };
      });
    },

    markAsRead: (id) => {
      get().updateNotification(id, { status: 'read' });
      get().recordEngagement(id, 'read');
    },

    markAllAsRead: () => {
      set((state) => {
        const newNotifications = state.notifications.map(n => 
          n.status !== 'read' ? { ...n, status: 'read' as const } : n
        );
        return {
          notifications: newNotifications,
          stats: calculateStats(newNotifications),
          lastUpdate: Date.now()
        };
      });
    },

    dismissNotification: (id) => {
      get().updateNotification(id, { status: 'dismissed' });
      get().recordEngagement(id, 'dismiss');
    },

    processBatches: () => {
      const state = get();
      const pendingNotifications = state.notifications.filter(n => n.status === 'pending');
      
      if (pendingNotifications.length === 0) return;

      // const grouped = await groupNotifications(pendingNotifications, state.userPreferences);
      // const batches = await createSmartBatches(grouped, state.deliveryContext);

      // set({ batches });
    },

    optimizeDelivery: () => {
      const state = get();
      const pendingNotifications = state.notifications.filter(n => n.status === 'pending');
      
      // Temporarily disable delivery optimization due to runtime errors
      const optimizedNotifications = pendingNotifications.map(notification => {
        // const optimization = optimizeDelivery(notification, state.deliveryContext);
        return {
          ...notification,
          deliveryMethod: 'toast' as const, // Default fallback
          status: 'delivered' as const
        };
      });

      set((state) => {
        const updatedNotifications = state.notifications.map(n => {
          const optimized = optimizedNotifications.find(opt => opt.id === n.id);
          return optimized || n;
        });

        return {
          notifications: updatedNotifications,
          stats: calculateStats(updatedNotifications),
          lastUpdate: Date.now()
        };
      });
    },

    updateDeliveryContext: (context) => {
      set((state) => ({
        deliveryContext: { ...state.deliveryContext, ...context },
        lastUpdate: Date.now()
      }));

      // Re-optimize delivery after context change
      get().optimizeDelivery();
    },

    recordEngagement: (notificationId, action, context = {}) => {
      const timestamp = Date.now();
      const notification = get().notifications.find(n => n.id === notificationId);
      
      if (!notification) return;

      set((state) => {
        const newHistory: NotificationHistory = {
          id: generateSafeKey(`${notificationId}-${action}`, 'history', timestamp),
          notificationId,
          action,
          timestamp,
          context,
          userAgent: navigator.userAgent,
          metadata: {
            notificationAge: timestamp - notification.timestamp,
            priority: notification.priority,
            category: notification.category
          }
        };

        const newEngagement = {
          ...state.engagement,
          lastEngagement: timestamp,
          engagementRate: calculateEngagementRate([...state.history, newHistory])
        };

        return {
          history: [...state.history, newHistory],
          engagement: newEngagement,
          lastUpdate: Date.now()
        };
      });

      // Update user attention based on engagement - temporarily disabled
      // updateUserAttention(action, get().deliveryContext);
    },

    updatePreferences: (preferences) => {
      set((state) => ({
        userPreferences: { ...state.userPreferences, ...preferences },
        lastUpdate: Date.now()
      }));
    },

    setVisible: (visible) => {
      set({ isVisible: visible });
      
      if (visible) {
        get().updateDeliveryContext({ 
          isUserActive: true,
          lastUserActivity: Date.now()
        });
      }
    },

    setActiveTab: (tab) => {
      set({ activeTab: tab });
    },

    setFilters: (filters) => {
      set((state) => ({
        filters: { ...state.filters, ...filters }
      }));
    },

    initialize: async () => {
      try {
        // Load saved preferences from localStorage (only on client)
        if (typeof window !== 'undefined') {
          const savedPreferences = localStorage.getItem('notification-preferences');
          if (savedPreferences) {
            try {
              const preferences = JSON.parse(savedPreferences);
              get().updatePreferences(preferences);
            } catch (error) {
              console.warn('Failed to load notification preferences:', error);
            }
          }
        }

        // Initialize delivery context
        get().updateDeliveryContext({
          deviceType: getDeviceType(),
          networkCondition: getNetworkCondition(),
          timeOfDay: new Date().getHours(),
          userAttentionScore: 80
        });

        // Add demo notifications if none exist
        if (get().notifications.length === 0) {
          await get().addNotification({
          source: 'intelligence',
          title: 'Economic Performance Alert',
          message: 'GDP growth has exceeded expectations by 12% this quarter, indicating strong economic momentum.',
          category: 'economic',
          type: 'alert',
          priority: 'high',
          severity: 'important',
          context: {
            userId: 'demo-user',
            isExecutiveMode: false,
            currentRoute: '/mycountry/new',
            ixTime: Date.now(),
            realTime: Date.now(),
            timeMultiplier: 2,
            activeFeatures: [],
            recentActions: [],
            focusMode: false,
            sessionDuration: 0,
            isUserActive: true,
            lastInteraction: Date.now(),
            deviceType: 'desktop',
            screenSize: 'large',
            networkQuality: 'high',
            batteryLevel: 100,
            userPreferences: { channels: [], quietHours: [] },
            historicalEngagement: [],
            interactionHistory: [],
            contextualFactors: {},
            urgencyFactors: [],
            contextualRelevance: 0.5
          },
          triggers: [],
          relevanceScore: 85,
          actionable: true,
          actions: [
            { id: 'view-details', label: 'View Economic Report', type: 'primary', onClick: () => console.log('View details clicked') },
            { id: 'acknowledge', label: 'Acknowledge', type: 'secondary', onClick: () => console.log('Acknowledge clicked') }
          ]
        });

          await get().addNotification({
            source: 'system',
            title: 'Diplomatic Relations Update',
            message: 'New trade agreements have been established with three neighboring countries, improving regional stability.',
            category: 'diplomatic',
            type: 'update',
            priority: 'medium',
            severity: 'informational',
            context: {
              userId: 'system',
              isExecutiveMode: false,
              currentRoute: '/',
              ixTime: Date.now(),
              realTime: Date.now(),
              timeMultiplier: 2,
              activeFeatures: [],
              recentActions: [],
              focusMode: false,
              sessionDuration: 0,
              isUserActive: true,
              lastInteraction: Date.now(),
              deviceType: 'desktop',
              screenSize: 'large',
              networkQuality: 'high',
              batteryLevel: 100,
              userPreferences: { channels: [], quietHours: [] },
              historicalEngagement: [],
              interactionHistory: [],
              contextualFactors: {},
              urgencyFactors: [],
              contextualRelevance: 0.5
            },
            triggers: [],
            relevanceScore: 70,
            actionable: false
          });
        }

        set({ isLoading: false });
      } catch (error) {
        console.error('Failed to initialize notification store:', error);
        set({ error: `Initialization failed: ${error instanceof Error ? error.message : String(error)}`, isLoading: false });
      }
    },

    cleanup: () => {
      // Save preferences to localStorage
      localStorage.setItem(
        'notification-preferences', 
        JSON.stringify(get().userPreferences)
      );
      
      // Clear old notifications (older than 7 days)
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
      set((state) => {
        const newNotifications = state.notifications.filter(n => n.timestamp > cutoff);
        const newHistory = state.history.filter(h => h.timestamp > cutoff);
        
        return {
          notifications: newNotifications,
          history: newHistory,
          stats: calculateStats(newNotifications)
        };
      });
    },

    refresh: () => {
      set({ lastUpdate: Date.now() });
      get().processBatches();
      get().optimizeDelivery();
    }
  })
  )
);

// Helper functions
function calculateStats(notifications: UnifiedNotification[]): NotificationStats {
  const stats: NotificationStats = {
    total: notifications.length,
    unread: notifications.filter(n => n.status !== 'read').length,
    byCategory: {} as Record<NotificationCategory, number>,
    byPriority: {} as Record<NotificationPriority, number>,
    delivered: notifications.filter(n => n.status === 'delivered').length,
    dismissed: notifications.filter(n => n.status === 'dismissed').length,
    engaged: notifications.filter(n => n.status === 'read').length
  };

  // Count by category
  for (const notification of notifications) {
    stats.byCategory[notification.category] = (stats.byCategory[notification.category] || 0) + 1;
  }

  // Count by priority
  for (const notification of notifications) {
    stats.byPriority[notification.priority] = (stats.byPriority[notification.priority] || 0) + 1;
  }

  return stats;
}

function calculateEngagementRate(history: NotificationHistory[]): number {
  if (history.length === 0) return 0;
  
  const actionHistory = history.filter(h => ['read', 'action'].includes(h.action));
  return (actionHistory.length / history.length) * 100;
}

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function getNetworkCondition(): 'poor' | 'good' | 'excellent' {
  // @ts-ignore - navigator.connection is experimental
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  if (!connection) return 'good';
  
  const { effectiveType } = connection;
  if (effectiveType === '4g') return 'excellent';
  if (effectiveType === '3g') return 'good';
  return 'poor';
}

// Subscribe to store changes for auto-cleanup
useNotificationStore.subscribe(
  (state) => state.notifications.length,
  (notificationsCount) => {
    // Auto-cleanup when notification count gets too high
    if (notificationsCount > 1000) {
      useNotificationStore.getState().cleanup();
    }
  }
);

export default useNotificationStore;