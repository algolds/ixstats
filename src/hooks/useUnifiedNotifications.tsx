/**
 * Unified Notifications React Hook and Provider
 * Integrates all notification services with React components
 */

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { IxTime } from '~/lib/ixtime';
import { getNotificationOrchestrator } from '~/services/NotificationOrchestrator';
import { getContextIntelligenceEngine } from '~/services/ContextIntelligenceEngine';
import { getGlobalNotificationStore } from '~/services/GlobalNotificationStore';
import { getDeliveryHandlerRegistry } from '~/services/DeliveryHandlers';
import type {
  UnifiedNotification,
  NotificationContext,
  UserNotificationPreferences,
  NotificationEngagement,
  NotificationAnalytics,
  NotificationCategory,
  NotificationPriority,
  DeliveryMethod,
} from '~/types/unified-notifications';
import {
  DEFAULT_USER_PREFERENCES,
} from '~/types/unified-notifications';

// Context interface
interface UnifiedNotificationContextType {
  // Core functionality
  createNotification: (notification: Omit<UnifiedNotification, 'id' | 'timestamp' | 'status' | 'relevanceScore'>) => Promise<string>;
  getNotifications: (filter?: any) => UnifiedNotification[];
  markAsRead: (notificationId: string) => Promise<void>;
  dismiss: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  
  // State
  notifications: UnifiedNotification[];
  unreadCount: number;
  isLoading: boolean;
  
  // User preferences
  preferences: UserNotificationPreferences;
  updatePreferences: (updates: Partial<UserNotificationPreferences>) => Promise<void>;
  
  // Analytics
  analytics: NotificationAnalytics | null;
  
  // Dynamic Island integration
  currentIslandNotification: UnifiedNotification | null;
  dismissIslandNotification: () => void;
  
  // Context information
  currentContext: NotificationContext | null;
}

const UnifiedNotificationContext = createContext<UnifiedNotificationContextType | null>(null);

// Provider component
interface UnifiedNotificationProviderProps {
  children: React.ReactNode;
  userId?: string;
  countryId?: string;
  isExecutiveMode?: boolean;
}

export function UnifiedNotificationProvider({
  children,
  userId,
  countryId,
  isExecutiveMode = false,
}: UnifiedNotificationProviderProps) {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [currentIslandNotification, setCurrentIslandNotification] = useState<UnifiedNotification | null>(null);
  const [preferences, setPreferences] = useState<UserNotificationPreferences>(DEFAULT_USER_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null);

  // Service instances
  const orchestrator = getNotificationOrchestrator();
  const intelligenceEngine = getContextIntelligenceEngine();
  const store = getGlobalNotificationStore();
  const deliveryRegistry = getDeliveryHandlerRegistry();

  // Refs for tracking
  const sessionStartRef = useRef(Date.now());
  const actionCountRef = useRef(0);
  const recentActionsRef = useRef<string[]>([]);
  const activeFeatures = useRef<string[]>([]);

  // Derived state
  const effectiveUserId = userId || user?.id || '';
  const effectiveCountryId = countryId || '';
  const unreadCount = notifications.filter(n => n.status !== 'read').length;

  // Create current context
  const currentContext: NotificationContext = {
    userId: effectiveUserId,
    countryId: effectiveCountryId,
    isExecutiveMode,
    currentRoute: pathname || '',
    userRole: 'user', // Could be enhanced
    ixTime: IxTime.getCurrentIxTime(),
    realTime: Date.now(),
    timeMultiplier: IxTime.getTimeMultiplier(),
    gameYear: IxTime.getCurrentGameYear(),
    activeFeatures: activeFeatures.current,
    recentActions: recentActionsRef.current,
    focusMode: false, // Could be enhanced
    sessionDuration: Date.now() - sessionStartRef.current,
    deviceType: 'desktop', // Could be enhanced
    screenSize: 'large', // Could be enhanced
    networkQuality: 'high', // Could be enhanced
    userPreferences: preferences,
    historicalEngagement: [], // Would be loaded from storage
    urgencyFactors: [],
    contextualRelevance: 0.5,
  };

  // Initialize system
  useEffect(() => {
    initializeNotificationSystem();
  }, [effectiveUserId]);

  const initializeNotificationSystem = async () => {
    try {
      setIsLoading(true);

      // Load user preferences
      await loadUserPreferences();

      // Setup delivery handlers
      setupDeliveryHandlers();

      // Setup orchestrator event listeners
      setupOrchestratorListeners();

      // Load existing notifications
      await loadNotifications();

      // Update analytics
      updateAnalytics();

      setIsLoading(false);
      console.log('[UnifiedNotifications] System initialized');
    } catch (error) {
      console.error('[UnifiedNotifications] Initialization failed:', error);
      setIsLoading(false);
    }
  };

  const loadUserPreferences = async () => {
    // In a real app, this would load from backend
    const stored = localStorage.getItem(`notification-preferences-${effectiveUserId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_USER_PREFERENCES, ...parsed });
        orchestrator.setUserPreferences(effectiveUserId, { ...DEFAULT_USER_PREFERENCES, ...parsed });
      } catch (error) {
        console.error('[UnifiedNotifications] Failed to load preferences:', error);
      }
    } else {
      orchestrator.setUserPreferences(effectiveUserId, DEFAULT_USER_PREFERENCES);
    }
  };

  const setupDeliveryHandlers = () => {
    // Dynamic Island handler
    const dynamicIslandHandler = deliveryRegistry.getHandler('dynamic-island');
    if (dynamicIslandHandler && 'setIslandCallback' in dynamicIslandHandler) {
      (dynamicIslandHandler as any).setIslandCallback((notification: UnifiedNotification) => {
        setCurrentIslandNotification(notification);
        
        // Auto-dismiss after delay for non-critical notifications
        if (notification.priority !== 'critical') {
          setTimeout(() => {
            setCurrentIslandNotification(null);
          }, 5000);
        }
      });
    }

    // Toast handler (integrate with existing toast system)
    const toastHandler = deliveryRegistry.getHandler('toast');
    if (toastHandler && 'setToastCallback' in toastHandler) {
      (toastHandler as any).setToastCallback((notification: UnifiedNotification) => {
        // This would integrate with your existing toast system
        console.log('[UnifiedNotifications] Toast notification:', notification);
      });
    }

    // Command Palette handler
    const paletteHandler = deliveryRegistry.getHandler('command-palette');
    if (paletteHandler && 'setPaletteCallback' in paletteHandler) {
      (paletteHandler as any).setPaletteCallback((notification: UnifiedNotification) => {
        // This would integrate with CommandPalette component
        console.log('[UnifiedNotifications] Command palette notification:', notification);
      });
    }

    // Modal handler
    const modalHandler = deliveryRegistry.getHandler('modal');
    if (modalHandler && 'setModalCallback' in modalHandler) {
      (modalHandler as any).setModalCallback((notification: UnifiedNotification) => {
        // This would trigger a modal dialog
        console.log('[UnifiedNotifications] Modal notification:', notification);
      });
    }

    // Register handlers with orchestrator
    for (const [method, handler] of deliveryRegistry.getAllHandlers()) {
      orchestrator.registerDeliveryHandler(method, handler);
    }
  };

  const setupOrchestratorListeners = () => {
    orchestrator.on('delivered', (event) => {
      const { notification } = event.detail;
      // Update local state
      setNotifications(prev => {
        const index = prev.findIndex(n => n.id === notification.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = notification;
          return updated;
        }
        return [notification, ...prev];
      });
    });

    orchestrator.on('failed', (event) => {
      console.error('[UnifiedNotifications] Delivery failed:', event.detail.notification);
    });
  };

  const loadNotifications = async () => {
    const stored = store.getNotifications({
      userId: effectiveUserId,
      limit: 100,
    });
    setNotifications(stored);
  };

  const updateAnalytics = () => {
    const currentAnalytics = orchestrator.getAnalytics();
    setAnalytics(currentAnalytics);
  };

  // Core notification functions
  const createNotification = useCallback(async (
    notification: Omit<UnifiedNotification, 'id' | 'timestamp' | 'status' | 'relevanceScore'>
  ): Promise<string> => {
    try {
      // Track action
      recordUserAction('create-notification');

      // Create notification through orchestrator
      const id = await orchestrator.createNotification(notification, currentContext);
      
      // Store in global store
      const fullNotification: UnifiedNotification = {
        ...notification,
        id,
        timestamp: Date.now(),
        status: 'pending',
        relevanceScore: 0,
      };
      
      await store.addNotification(fullNotification, currentContext);
      
      return id;
    } catch (error) {
      console.error('[UnifiedNotifications] Failed to create notification:', error);
      throw error;
    }
  }, [currentContext]);

  const getNotifications = useCallback((filter: any = {}) => {
    return store.getNotifications({
      userId: effectiveUserId,
      ...filter,
    });
  }, [effectiveUserId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await store.updateNotification(notificationId, { status: 'read' });
      
      // Record engagement
      const engagement: NotificationEngagement = {
        notificationId,
        timestamp: Date.now(),
        action: 'viewed',
        contextAtEngagement: currentContext,
      };
      
      orchestrator.recordEngagement(engagement);
      intelligenceEngine.recordEngagement(
        notifications.find(n => n.id === notificationId)!,
        currentContext,
        engagement
      );

      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, status: 'read' as const } : n)
      );

      recordUserAction('mark-read');
    } catch (error) {
      console.error('[UnifiedNotifications] Failed to mark as read:', error);
    }
  }, [currentContext, notifications]);

  const dismiss = useCallback(async (notificationId: string) => {
    try {
      await store.updateNotification(notificationId, { status: 'dismissed' });

      // Record engagement
      const engagement: NotificationEngagement = {
        notificationId,
        timestamp: Date.now(),
        action: 'dismissed',
        contextAtEngagement: currentContext,
      };
      
      orchestrator.recordEngagement(engagement);

      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, status: 'dismissed' as const } : n)
      );

      recordUserAction('dismiss');
    } catch (error) {
      console.error('[UnifiedNotifications] Failed to dismiss:', error);
    }
  }, [currentContext]);

  const clearAll = useCallback(async () => {
    try {
      await store.clearNotifications({ userId: effectiveUserId });
      setNotifications([]);
      recordUserAction('clear-all');
    } catch (error) {
      console.error('[UnifiedNotifications] Failed to clear all:', error);
    }
  }, [effectiveUserId]);

  const updatePreferences = useCallback(async (updates: Partial<UserNotificationPreferences>) => {
    try {
      const newPreferences = { ...preferences, ...updates };
      setPreferences(newPreferences);
      
      // Store locally
      localStorage.setItem(
        `notification-preferences-${effectiveUserId}`,
        JSON.stringify(newPreferences)
      );

      // Update orchestrator
      orchestrator.setUserPreferences(effectiveUserId, newPreferences);

      recordUserAction('update-preferences');
    } catch (error) {
      console.error('[UnifiedNotifications] Failed to update preferences:', error);
    }
  }, [preferences, effectiveUserId]);

  const dismissIslandNotification = useCallback(() => {
    if (currentIslandNotification) {
      dismiss(currentIslandNotification.id);
      setCurrentIslandNotification(null);
    }
  }, [currentIslandNotification, dismiss]);

  // Helper functions
  const recordUserAction = (action: string) => {
    actionCountRef.current++;
    recentActionsRef.current.push(action);
    
    // Keep only last 20 actions
    if (recentActionsRef.current.length > 20) {
      recentActionsRef.current = recentActionsRef.current.slice(-20);
    }
  };

  // Track route changes
  useEffect(() => {
    recordUserAction('navigation');
  }, [pathname]);

  // Track executive mode changes
  useEffect(() => {
    recordUserAction('mode-change');
    activeFeatures.current = isExecutiveMode ? ['executive-dashboard'] : ['public-view'];
  }, [isExecutiveMode]);

  // Context value
  const contextValue: UnifiedNotificationContextType = {
    createNotification,
    getNotifications,
    markAsRead,
    dismiss,
    clearAll,
    notifications,
    unreadCount,
    isLoading,
    preferences,
    updatePreferences,
    analytics,
    currentIslandNotification,
    dismissIslandNotification,
    currentContext,
  };

  return (
    <UnifiedNotificationContext.Provider value={contextValue}>
      {children}
    </UnifiedNotificationContext.Provider>
  );
}

// Hook to use the unified notification system
export function useUnifiedNotifications(): UnifiedNotificationContextType {
  const context = useContext(UnifiedNotificationContext);
  if (!context) {
    throw new Error('useUnifiedNotifications must be used within UnifiedNotificationProvider');
  }
  return context;
}

// Convenience hooks for specific use cases

// Hook for creating data-driven notifications
export function useDataNotifications() {
  const { createNotification } = useUnifiedNotifications();

  const createEconomicAlert = useCallback(async (data: {
    metric: string;
    value: number;
    change: number;
    threshold?: number;
  }) => {
    return createNotification({
      source: 'realtime',
      title: `Economic Alert: ${data.metric}`,
      message: `${data.metric} changed by ${data.change > 0 ? '+' : ''}${data.change.toFixed(2)}% to ${data.value.toLocaleString()}`,
      category: 'economic',
      type: Math.abs(data.change) > 10 ? 'alert' : 'update',
      priority: Math.abs(data.change) > 10 ? 'high' : 'medium',
      severity: 'important',
      context: {} as NotificationContext, // Will be filled by provider
      triggers: [{
        type: 'data-change',
        source: 'economic-data',
        data,
        threshold: data.threshold,
        confidence: 0.9,
      }],
      deliveryMethod: 'dynamic-island',
      actionable: true,
      actions: [{
        id: 'view-economic-data',
        label: 'View Details',
        type: 'primary',
        onClick: () => {
          window.location.href = '/mycountry/new?tab=economy';
        }
      }],
    });
  }, [createNotification]);

  const createAchievementNotification = useCallback(async (achievement: {
    title: string;
    description: string;
    category: string;
  }) => {
    return createNotification({
      source: 'system',
      title: `Achievement Unlocked: ${achievement.title}`,
      message: achievement.description,
      category: 'achievement',
      type: 'success',
      priority: 'medium',
      severity: 'informational',
      context: {} as NotificationContext,
      triggers: [{
        type: 'user-action',
        source: 'achievement-system',
        data: achievement,
        confidence: 1.0,
      }],
      deliveryMethod: 'toast',
      actionable: true,
      actions: [{
        id: 'view-achievements',
        label: 'View All Achievements',
        type: 'secondary',
        onClick: () => {
          window.location.href = '/mycountry/achievements';
        }
      }],
    });
  }, [createNotification]);

  return {
    createEconomicAlert,
    createAchievementNotification,
  };
}

// Hook for notification analytics
export function useNotificationAnalytics() {
  const { analytics } = useUnifiedNotifications();
  
  return {
    analytics,
    getTotalEngagement: () => analytics?.engagementRate || 0,
    getDeliveryRate: () => analytics?.deliveryRate || 0,
    getCategoryBreakdown: () => analytics?.categoryBreakdown || {},
    getMethodEffectiveness: () => analytics?.methodEffectiveness || {},
  };
}

export default useUnifiedNotifications;