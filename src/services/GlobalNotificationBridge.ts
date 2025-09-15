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
  DeliveryMethod
} from '~/types/unified-notifications';
import type { IntelligenceItem } from '~/types/intelligence-unified';
import { useNotificationStore } from '~/stores/notificationStore';
import { IxTime } from '~/lib/ixtime';

interface DataStreamEvent {
  type: 'intelligence' | 'economic' | 'diplomatic' | 'achievement' | 'crisis';
  data: any;
  timestamp: number;
  source: string;
  priority?: NotificationPriority;
  countryId?: string;
}

interface NotificationRule {
  type: DataStreamEvent['type'];
  condition: (data: any) => boolean;
  priority: NotificationPriority;
  category: NotificationCategory;
  titleGenerator: (data: any) => string;
  messageGenerator: (data: any) => string;
  actionGenerator?: (data: any) => any[];
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
        condition: (data: IntelligenceItem) => 
          ['high', 'critical'].includes((data as any).priority || 'medium'),
        priority: 'high',
        category: 'security',
        titleGenerator: (data: IntelligenceItem) => 
          `🚨 Intelligence Alert: ${data.title}`,
        messageGenerator: (data: IntelligenceItem) => 
          data.content || 'Critical intelligence update available',
        actionGenerator: (data: IntelligenceItem) => [{
          id: 'view-intelligence',
          label: 'View in SDI',
          type: 'primary',
          onClick: () => window.location.href = '/sdi'
        }]
      },
      {
        type: 'intelligence',
        condition: (data: IntelligenceItem) => 
          (data as any).category === 'crisis',
        priority: 'critical',
        category: 'crisis',
        titleGenerator: (data: IntelligenceItem) => 
          `⚠️ Crisis Alert: ${data.title}`,
        messageGenerator: (data: IntelligenceItem) => 
          `Crisis detected: ${data.content}`,
        actionGenerator: (data: IntelligenceItem) => [{
          id: 'crisis-response',
          label: 'Emergency Response',
          type: 'primary',
          onClick: () => window.location.href = '/crisis-management'
        }]
      },

      // Economic Data Rules
      {
        type: 'economic',
        condition: (data: any) => 
          Math.abs(data.changePercent || 0) > 10,
        priority: 'high',
        category: 'economic',
        titleGenerator: (data: any) => 
          `📈 Economic Alert: ${data.metric}`,
        messageGenerator: (data: any) => 
          `${data.metric} changed by ${data.changePercent > 0 ? '+' : ''}${data.changePercent.toFixed(2)}% to ${(data.value || 0).toLocaleString()}`,
        actionGenerator: (data: any) => [{
          id: 'view-economics',
          label: 'View Economic Dashboard',
          type: 'primary',
          onClick: () => window.location.href = '/mycountry/new?tab=economy'
        }]
      },
      {
        type: 'economic',
        condition: (data: any) => 
          data.metric?.toLowerCase().includes('gdp') && Math.abs(data.changePercent || 0) > 5,
        priority: 'medium',
        category: 'economic',
        titleGenerator: (data: any) => 
          `💰 GDP Update: ${data.changePercent > 0 ? 'Growth' : 'Decline'}`,
        messageGenerator: (data: any) => 
          `GDP ${data.changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(data.changePercent).toFixed(2)}%`,
      },

      // Diplomatic Events
      {
        type: 'diplomatic',
        condition: (data: any) => 
          ['agreement', 'treaty', 'conflict'].includes(data.eventType),
        priority: 'medium',
        category: 'diplomatic',
        titleGenerator: (data: any) => 
          `🤝 Diplomatic Update: ${data.title || data.eventType}`,
        messageGenerator: (data: any) => 
          data.description || `New diplomatic ${data.eventType} recorded`,
        actionGenerator: (data: any) => [{
          id: 'view-diplomatic',
          label: 'View Diplomatic Relations',
          type: 'primary',
          onClick: () => window.location.href = '/diplomatic'
        }]
      },

      // Achievement System
      {
        type: 'achievement',
        condition: (data: any) => !!data.unlocked,
        priority: 'low',
        category: 'achievement',
        titleGenerator: (data: any) => 
          `🏆 Achievement Unlocked: ${data.name}`,
        messageGenerator: (data: any) => 
          data.description || 'New achievement earned!',
        actionGenerator: (data: any) => [{
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
      actions: rule.actionGenerator?.(event.data) || [],
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
          categories: {},
          executiveModeFilters: ['economic', 'governance', 'security', 'crisis'],
          publicModeFilters: ['achievement', 'opportunity', 'system'],
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
      this.emit('dataStream', {
        type: 'intelligence' as const,
        data: item,
        timestamp: Date.now(),
        source: 'intelligence-feed',
        priority: ((item as any).priority || 'medium') as NotificationPriority,
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