/**
 * Global Notification Bridge Service
 * Central hub for wiring all data streams into the unified notification system
 */

'use client';

import { EventEmitter } from 'events';
import type {
  UnifiedNotification,
  NotificationCategory,
  NotificationPriority,
  DeliveryMethod,
  NotificationAction
} from '~/types/unified-notifications';
import type { IntelligenceItem } from '~/types/intelligence-unified';
import { useNotificationStore } from '~/stores/notificationStore';
import { IxTime } from '~/lib/ixtime';

interface DataStreamEvent {
  type: 'intelligence' | 'economic' | 'diplomatic' | 'achievement' | 'crisis';
  data: Record<string, unknown>;
  timestamp: number;
  source: string;
  priority?: NotificationPriority;
  countryId?: string;
}

interface NotificationRule {
  type: DataStreamEvent['type'];
  condition: (data: Record<string, unknown>) => boolean;
  priority: NotificationPriority;
  category: NotificationCategory;
  titleGenerator: (data: Record<string, unknown>) => string;
  messageGenerator: (data: Record<string, unknown>) => string;
  actionGenerator?: (data: Record<string, unknown>) => Array<Record<string, unknown>>;
}

class GlobalNotificationBridge extends EventEmitter {
  private static instance: GlobalNotificationBridge;
  private rules: NotificationRule[] = [];
  private recentNotifications = new Map<string, number>();
  private isInitialized = false;

  static getInstance(): GlobalNotificationBridge {
    if (!GlobalNotificationBridge.instance) {
      GlobalNotificationBridge.instance = new GlobalNotificationBridge();
    }
    return GlobalNotificationBridge.instance;
  }

  constructor() {
    super();
    this.setupDefaultRules();
  }

  private setupDefaultRules() {
    this.rules = [
      // Intelligence Feed Rules
      {
        type: 'intelligence',
        condition: (data: Record<string, unknown>) => {
          const priority = this.getDataProperty(data, 'priority') || 'medium';
          return ['high', 'critical'].includes(String(priority));
        },
        priority: 'high',
        category: 'security',
        titleGenerator: (data: Record<string, unknown>) =>
          `🚨 Intelligence Alert: ${this.getDataProperty(data, 'title') || 'Alert'}`,
        messageGenerator: (data: Record<string, unknown>) =>
          this.getDataProperty(data, 'content') || this.getDataProperty(data, 'description') || 'Critical intelligence update available',
        actionGenerator: (data: Record<string, unknown>) => [{
          id: 'view-intelligence',
          label: 'View in SDI',
          type: 'primary',
          onClick: () => window.location.href = '/sdi'
        }]
      },
      {
        type: 'intelligence',
        condition: (data: Record<string, unknown>) => {
          const category = this.getDataProperty(data, 'category');
          return String(category) === 'crisis';
        },
        priority: 'critical',
        category: 'crisis',
        titleGenerator: (data: Record<string, unknown>) =>
          `⚠️ Crisis Alert: ${this.getDataProperty(data, 'title') || 'Crisis'}`,
        messageGenerator: (data: Record<string, unknown>) =>
          `Crisis detected: ${this.getDataProperty(data, 'content') || this.getDataProperty(data, 'description') || 'Crisis situation'}`,
        actionGenerator: (data: Record<string, unknown>) => [{
          id: 'crisis-response',
          label: 'Emergency Response',
          type: 'primary',
          onClick: () => window.location.href = '/crisis-management'
        }]
      },

      // Economic Data Rules
      {
        type: 'economic',
        condition: (data: Record<string, unknown>) => {
          const changePercent = this.getNumberProperty(data, 'changePercent') || 0;
          return Math.abs(changePercent) > 10;
        },
        priority: 'high',
        category: 'economic',
        titleGenerator: (data: Record<string, unknown>) =>
          `📈 Economic Alert: ${this.getDataProperty(data, 'metric') || 'Economic Change'}`,
        messageGenerator: (data: Record<string, unknown>) => {
          const metric = this.getDataProperty(data, 'metric') || 'Value';
          const changePercent = this.getNumberProperty(data, 'changePercent') || 0;
          const value = this.getNumberProperty(data, 'value') || 0;
          return `${metric} changed by ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}% to ${value.toLocaleString()}`;
        },
        actionGenerator: (data: Record<string, unknown>) => [{
          id: 'view-economics',
          label: 'View Economic Dashboard',
          type: 'primary',
          onClick: () => window.location.href = '/mycountry/new?tab=economy'
        }]
      },
      {
        type: 'economic',
        condition: (data: Record<string, unknown>) => {
          const metric = this.getDataProperty(data, 'metric') || '';
          const changePercent = this.getNumberProperty(data, 'changePercent') || 0;
          return String(metric).toLowerCase().includes('gdp') && Math.abs(changePercent) > 5;
        },
        priority: 'medium',
        category: 'economic',
        titleGenerator: (data: Record<string, unknown>) => {
          const changePercent = this.getNumberProperty(data, 'changePercent') || 0;
          return `💰 GDP Update: ${changePercent > 0 ? 'Growth' : 'Decline'}`;
        },
        messageGenerator: (data: Record<string, unknown>) => {
          const changePercent = this.getNumberProperty(data, 'changePercent') || 0;
          return `GDP ${changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(2)}%`;
        },
      },

      // Diplomatic Events
      {
        type: 'diplomatic',
        condition: (data: Record<string, unknown>) => {
          const eventType = this.getDataProperty(data, 'eventType');
          return ['agreement', 'treaty', 'conflict'].includes(String(eventType));
        },
        priority: 'medium',
        category: 'diplomatic',
        titleGenerator: (data: Record<string, unknown>) => {
          const title = this.getDataProperty(data, 'title');
          const eventType = this.getDataProperty(data, 'eventType');
          return `🤝 Diplomatic Update: ${title || eventType || 'Diplomatic Event'}`;
        },
        messageGenerator: (data: Record<string, unknown>) => {
          const description = this.getDataProperty(data, 'description');
          const eventType = this.getDataProperty(data, 'eventType');
          return description || `New diplomatic ${eventType || 'event'} recorded`;
        },
        actionGenerator: (data: Record<string, unknown>) => [{
          id: 'view-diplomatic',
          label: 'View Diplomatic Relations',
          type: 'primary',
          onClick: () => window.location.href = '/diplomatic'
        }]
      },

      // Achievement System
      {
        type: 'achievement',
        condition: (data: Record<string, unknown>) => {
          const unlocked = data.unlocked;
          return Boolean(unlocked);
        },
        priority: 'low',
        category: 'achievement',
        titleGenerator: (data: Record<string, unknown>) => {
          const name = this.getDataProperty(data, 'name');
          return `🏆 Achievement Unlocked: ${name || 'Achievement'}`;
        },
        messageGenerator: (data: Record<string, unknown>) => {
          const description = this.getDataProperty(data, 'description');
          return description || 'New achievement earned!';
        },
        actionGenerator: (data: Record<string, unknown>) => [{
          id: 'view-achievements',
          label: 'View All Achievements',
          type: 'secondary',
          onClick: () => window.location.href = '/achievements'
        }]
      }
    ];
  }

  /**
   * Initialize the notification bridge with store connection
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('[NotificationBridge] Initializing global notification bridge...');
    
    // Set up event listeners for various data streams
    this.setupEventListeners();
    
    this.isInitialized = true;
    this.emit('initialized');
  }

  private setupEventListeners() {
    // Listen for data stream events
    this.on('dataStream', this.handleDataStreamEvent.bind(this));
    
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupRecentNotifications();
    }, 60000); // Clean up every minute
  }

  /**
   * Process incoming data stream events and create notifications
   */
  private async handleDataStreamEvent(event: DataStreamEvent) {
    const matchingRules = this.rules.filter(rule => 
      rule.type === event.type && rule.condition(event.data)
    );

    for (const rule of matchingRules) {
      await this.createNotificationFromRule(rule, event);
    }
  }

  private async createNotificationFromRule(rule: NotificationRule, event: DataStreamEvent) {
    const notificationKey = `${rule.type}-${JSON.stringify(event.data).slice(0, 50)}`;
    
    // Prevent duplicate notifications within 5 minutes
    const lastNotification = this.recentNotifications.get(notificationKey);
    if (lastNotification && (Date.now() - lastNotification) < 300000) {
      return;
    }

    const notification = {
      source: event.source as 'intelligence' | 'realtime' | 'system',
      title: rule.titleGenerator(event.data),
      message: rule.messageGenerator(event.data),
      category: rule.category,
      type: this.getNotificationType(rule.priority),
      priority: rule.priority,
      severity: this.getSeverity(rule.priority),
      deliveryMethod: this.getDeliveryMethod(rule.priority),
      actionable: !!rule.actionGenerator,
      actions: (rule.actionGenerator?.(event.data) || []) as unknown as NotificationAction[],
      triggers: [{
        type: 'data-change' as const,
        source: event.source,
        data: event.data,
        confidence: 0.8,
        timestamp: event.timestamp
      }],
      context: {
        userId: 'system',
        isExecutiveMode: false,
        currentRoute: '/',
        ixTime: IxTime.getCurrentIxTime(),
        realTime: Date.now(),
        timeMultiplier: IxTime.getTimeMultiplier(),
        activeFeatures: [],
        recentActions: [],
        focusMode: false,
        sessionDuration: 0,
        isUserActive: true,
        lastInteraction: Date.now(),
        deviceType: 'desktop' as const,
        screenSize: 'large' as const,
        networkQuality: 'high' as const,
        batteryLevel: 100,
        userPreferences: {
          preferredMethods: ['dynamic-island'] as DeliveryMethod[],
          quietHours: null,
          batchingEnabled: true,
          maxNotificationsPerHour: 30,
          categories: {
            economic: { enabled: true, minPriority: 'low' as const, deliveryMethods: ['dynamic-island'] as DeliveryMethod[] },
            diplomatic: { enabled: true, minPriority: 'low' as const, deliveryMethods: ['dynamic-island'] as DeliveryMethod[] },
            governance: { enabled: true, minPriority: 'low' as const, deliveryMethods: ['dynamic-island'] as DeliveryMethod[] },
            social: { enabled: true, minPriority: 'low' as const, deliveryMethods: ['dynamic-island'] as DeliveryMethod[] },
            security: { enabled: true, minPriority: 'medium' as const, deliveryMethods: ['dynamic-island'] as DeliveryMethod[] },
            system: { enabled: true, minPriority: 'low' as const, deliveryMethods: ['dynamic-island'] as DeliveryMethod[] },
            achievement: { enabled: true, minPriority: 'low' as const, deliveryMethods: ['dynamic-island'] as DeliveryMethod[] },
            crisis: { enabled: true, minPriority: 'high' as const, deliveryMethods: ['dynamic-island', 'toast'] as DeliveryMethod[] },
            opportunity: { enabled: true, minPriority: 'low' as const, deliveryMethods: ['dynamic-island'] as DeliveryMethod[] }
          },
          executiveModeFilters: ['economic', 'governance', 'security', 'crisis'] as NotificationCategory[],
          publicModeFilters: ['achievement', 'opportunity', 'system'] as NotificationCategory[],
          allowMLPersonalization: true,
          trackEngagement: true
        },
        historicalEngagement: [],
        interactionHistory: [],
        contextualFactors: {},
        urgencyFactors: [],
        contextualRelevance: 0.7
      }
    };

    try {
      // Add to notification store with required fields
      const store = useNotificationStore.getState();
      const completeNotification = {
        ...notification,
        relevanceScore: 0.7,
        status: 'pending' as const
      };

      await store.addNotification(completeNotification);
      
      // Track recent notifications
      this.recentNotifications.set(notificationKey, Date.now());
      console.log(`[NotificationBridge] Created ${rule.priority} notification:`, notification.title);
      
      // Emit event for other systems
      this.emit('notificationCreated', { notification, rule, originalData: event.data });
    } catch (error) {
      console.error('[NotificationBridge] Failed to create notification:', error);
    }
  }

  private getNotificationType(priority: NotificationPriority): 'info' | 'success' | 'warning' | 'error' | 'alert' | 'update' {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'alert';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'update';
    }
  }

  private getSeverity(priority: NotificationPriority): 'informational' | 'important' | 'urgent' {
    switch (priority) {
      case 'critical': return 'urgent'; // Critical maps to urgent since critical is not in NotificationSeverity
      case 'high': return 'urgent';
      case 'medium': return 'important';
      case 'low': return 'informational';
      default: return 'informational';
    }
  }

  private getDeliveryMethod(priority: NotificationPriority): 'toast' | 'dynamic-island' | 'modal' | 'command-palette' {
    switch (priority) {
      case 'critical': return 'modal';
      case 'high': return 'dynamic-island';
      case 'medium': return 'dynamic-island';
      case 'low': return 'toast';
      default: return 'toast';
    }
  }

  /**
   * Wire intelligence data stream
   */
  wireIntelligenceStream(intelligenceData: IntelligenceItem[]) {
    intelligenceData.forEach(item => {
      // Safely extract priority from item properties
      const itemData = item as unknown as Record<string, unknown>;
      const rawPriority = this.getDataProperty(itemData, 'priority') || this.getDataProperty(itemData, 'severity') || 'medium';
      const priority = this.validatePriority(rawPriority);

      this.emit('dataStream', {
        type: 'intelligence' as const,
        data: item,
        timestamp: Date.now(),
        source: 'intelligence-feed',
        priority,
        countryId: item.region || undefined
      });
    });
  }

  /**
   * Wire economic data stream
   */
  wireEconomicStream(economicData: { metric: string; value: number; changePercent: number; countryId?: string }) {
    this.emit('dataStream', {
      type: 'economic' as const,
      data: economicData,
      timestamp: Date.now(),
      source: 'economic-system',
      priority: Math.abs(economicData.changePercent) > 10 ? 'high' : 'medium',
      countryId: economicData.countryId
    });
  }

  /**
   * Wire diplomatic events stream
   */
  wireDiplomaticStream(diplomaticEvent: { eventType: string; title?: string; description?: string; countries?: string[] }) {
    this.emit('dataStream', {
      type: 'diplomatic' as const,
      data: diplomaticEvent,
      timestamp: Date.now(),
      source: 'diplomatic-system',
      priority: ['conflict', 'war'].includes(diplomaticEvent.eventType) ? 'high' : 'medium'
    });
  }

  /**
   * Wire achievement system
   */
  wireAchievementStream(achievement: { name: string; description: string; unlocked: boolean; category?: string }) {
    if (achievement.unlocked) {
      this.emit('dataStream', {
        type: 'achievement' as const,
        data: achievement,
        timestamp: Date.now(),
        source: 'achievement-system',
        priority: 'low' as const
      });
    }
  }

  /**
   * Add custom notification rule
   */
  addRule(rule: NotificationRule) {
    this.rules.push(rule);
  }

  /**
   * Remove notification rule
   */
  removeRule(ruleIndex: number) {
    this.rules.splice(ruleIndex, 1);
  }

  /**
   * Safe data property getter with type checking
   */
  private getDataProperty(data: Record<string, unknown>, key: string): string | null {
    const value = data[key];
    return value !== null && value !== undefined ? String(value) : null;
  }

  /**
   * Safe number property getter with type checking
   */
  private getNumberProperty(data: Record<string, unknown>, key: string): number | null {
    const value = data[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return !isNaN(parsed) ? parsed : null;
    }
    return null;
  }

  /**
   * Validate and normalize priority values
   */
  private validatePriority(priority: string | null): NotificationPriority {
    if (!priority) return 'medium';
    const normalized = priority.toLowerCase();
    if (['critical', 'high', 'medium', 'low'].includes(normalized)) {
      return normalized as NotificationPriority;
    }
    return 'medium';
  }

  /**
   * Clean up old recent notifications
   */
  private cleanupRecentNotifications() {
    const now = Date.now();
    const cutoff = 300000; // 5 minutes
    
    for (const [key, timestamp] of this.recentNotifications.entries()) {
      if (now - timestamp > cutoff) {
        this.recentNotifications.delete(key);
      }
    }
  }

  /**
   * Get bridge statistics
   */
  getStats() {
    return {
      totalRules: this.rules.length,
      recentNotifications: this.recentNotifications.size,
      isInitialized: this.isInitialized,
      rulesByType: this.rules.reduce((acc, rule) => {
        acc[rule.type] = (acc[rule.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

// Export singleton instance
export const globalNotificationBridge = GlobalNotificationBridge.getInstance();

// Hook for React components
export function useGlobalNotificationBridge() {
  return {
    bridge: globalNotificationBridge,
    wireIntelligence: globalNotificationBridge.wireIntelligenceStream.bind(globalNotificationBridge),
    wireEconomic: globalNotificationBridge.wireEconomicStream.bind(globalNotificationBridge),
    wireDiplomatic: globalNotificationBridge.wireDiplomaticStream.bind(globalNotificationBridge),
    wireAchievement: globalNotificationBridge.wireAchievementStream.bind(globalNotificationBridge),
    getStats: globalNotificationBridge.getStats.bind(globalNotificationBridge)
  };
}

export default globalNotificationBridge;