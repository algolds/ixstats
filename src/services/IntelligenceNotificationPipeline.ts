// Intelligence Notification Pipeline - Phase 4 Advanced Features
// Contextual intelligence processing and advanced notification routing

import { IxTime } from '~/lib/ixtime';
import { predictiveAnalyticsEngine } from '~/lib/predictive-analytics-engine';
import { intelligenceCache, CacheUtils } from '~/lib/intelligence-cache';
import { performanceMonitor } from '~/lib/performance-monitor';

interface IntelligenceItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  details: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore: number;
  timestamp: number;
  source: string;
  countryId?: string;
  metadata?: Record<string, any>;
}

interface SignificanceAnalysis {
  overallSignificance: number; // 0-100
  categories: {
    economic: number;
    strategic: number;
    operational: number;
    temporal: number;
  };
  factors: {
    urgency: number;
    impact: number;
    relevance: number;
    uniqueness: number;
  };
  reasoning: string[];
  recommendedActions: string[];
}

interface ContextualNotification {
  id: string;
  intelligenceId: string;
  type: 'alert' | 'insight' | 'recommendation' | 'forecast' | 'milestone';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  context: {
    countryId?: string;
    userId?: string;
    userRole?: string;
    relevanceScore: number;
    personalizedContent: string[];
    relatedIntelligence: string[];
  };
  delivery: {
    channels: DeliveryChannel[];
    timing: 'immediate' | 'scheduled' | 'batched';
    scheduledTime?: number;
    expirationTime?: number;
  };
  analytics: {
    created: number;
    significance: number;
    expectedEngagement: number;
    category: string;
  };
  actions?: NotificationAction[];
}

interface DeliveryChannel {
  channel: 'web' | 'websocket' | 'email' | 'webhook' | 'integration';
  config: Record<string, any>;
  priority: number;
  fallback?: DeliveryChannel;
}

interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: 'navigate' | 'api_call' | 'external_link' | 'dismiss';
  data: Record<string, any>;
}

interface NotificationTemplate {
  id: string;
  name: string;
  category: string;
  template: {
    title: string;
    message: string;
    actions?: NotificationAction[];
  };
  triggers: {
    categories: string[];
    priorities: string[];
    significance: number;
    conditions: Record<string, any>;
  };
  delivery: {
    defaultChannels: string[];
    timing: 'immediate' | 'scheduled' | 'batched';
    batchWindow?: number;
  };
}

interface UserNotificationPreferences {
  userId: string;
  channels: {
    web: { enabled: boolean; settings: Record<string, any> };
    email: { enabled: boolean; settings: Record<string, any> };
    webhook: { enabled: boolean; settings: Record<string, any> };
  };
  categories: {
    economic: { enabled: boolean; minPriority: string };
    strategic: { enabled: boolean; minPriority: string };
    operational: { enabled: boolean; minPriority: string };
    predictive: { enabled: boolean; minPriority: string };
  };
  timing: {
    quietHours: { start: string; end: string; enabled: boolean };
    batchDelivery: boolean;
    immediateForCritical: boolean;
  };
  personalization: {
    countryFocus: string[];
    interestAreas: string[];
    expertiseLevel: 'basic' | 'intermediate' | 'expert';
  };
}

interface DeliveryResult {
  notificationId: string;
  channel: string;
  success: boolean;
  timestamp: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Advanced Intelligence Notification Pipeline
 * Processes intelligence items and generates contextual, personalized notifications
 */
export class IntelligenceNotificationPipeline {
  private templates: Map<string, NotificationTemplate> = new Map();
  private userPreferences: Map<string, UserNotificationPreferences> = new Map();
  private deliveryQueue: Map<string, ContextualNotification[]> = new Map();
  private processingStats = {
    processed: 0,
    notifications: 0,
    delivered: 0,
    errors: 0,
    averageProcessingTime: 0
  };

  constructor() {
    this.initializeDefaultTemplates();
    this.startBatchProcessor();
  }

  /**
   * Main processing entry point for intelligence items
   */
  async processIntelligenceUpdate(intelligenceItem: IntelligenceItem): Promise<void> {
    const startTime = performance.now();

    try {
      // Analyze intelligence significance
      const significance = await this.analyzeSignificance(intelligenceItem);
      
      // Generate contextual notifications
      const notifications = await this.generateContextualNotifications(
        intelligenceItem, 
        significance
      );
      
      // Route to appropriate delivery systems
      const deliveryResults: DeliveryResult[] = [];
      for (const notification of notifications) {
        const result = await this.routeNotification(notification);
        deliveryResults.push(...result);
      }
      
      // Update processing statistics
      this.updateProcessingStats(startTime, notifications.length, deliveryResults);

      // Cache processed intelligence for future reference
      const cacheKey = CacheUtils.generateKey('processed-intelligence', intelligenceItem.id);
      intelligenceCache.set(cacheKey, {
        intelligence: intelligenceItem,
        significance,
        notifications: notifications.map(n => n.id),
        processed: Date.now()
      }, 'standard');

      performanceMonitor.recordQuery({
        queryKey: `processIntelligenceUpdate:${intelligenceItem.id}`,
        duration: performance.now() - startTime,
        success: true,
        cacheHit: false,
        countryId: intelligenceItem.countryId
      });

    } catch (error) {
      this.processingStats.errors++;
      
      performanceMonitor.recordQuery({
        queryKey: `processIntelligenceUpdate:${intelligenceItem.id}`,
        duration: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheHit: false,
        countryId: intelligenceItem.countryId
      });

      console.error('Intelligence notification processing failed:', error);
    }
  }

  /**
   * Analyze the significance of an intelligence item
   */
  private async analyzeSignificance(intelligenceItem: IntelligenceItem): Promise<SignificanceAnalysis> {
    // Priority-based base scoring
    const priorityScores = { low: 25, medium: 50, high: 75, critical: 100 };
    let baseScore = priorityScores[intelligenceItem.priority] || 25;

    // Confidence score adjustment
    const confidenceAdjustment = (intelligenceItem.confidenceScore - 50) * 0.5;
    baseScore += confidenceAdjustment;

    // Temporal relevance (recent intelligence is more significant)
    const hoursOld = (Date.now() - intelligenceItem.timestamp) / (1000 * 60 * 60);
    const temporalFactor = Math.max(0, 100 - (hoursOld * 2)); // Decays over 50 hours
    
    // Category-specific analysis
    const categories = {
      economic: this.analyzeEconomicSignificance(intelligenceItem),
      strategic: this.analyzeStrategicSignificance(intelligenceItem),
      operational: this.analyzeOperationalSignificance(intelligenceItem),
      temporal: temporalFactor
    };

    // Factor analysis
    const factors = {
      urgency: this.calculateUrgency(intelligenceItem),
      impact: this.calculateImpact(intelligenceItem),
      relevance: this.calculateRelevance(intelligenceItem),
      uniqueness: this.calculateUniqueness(intelligenceItem)
    };

    // Calculate overall significance
    const categoryAvg = Object.values(categories).reduce((sum, score) => sum + score, 0) / 4;
    const factorAvg = Object.values(factors).reduce((sum, score) => sum + score, 0) / 4;
    const overallSignificance = Math.round((baseScore * 0.4 + categoryAvg * 0.3 + factorAvg * 0.3));

    // Generate reasoning and recommendations
    const reasoning = this.generateSignificanceReasoning(intelligenceItem, categories, factors, overallSignificance);
    const recommendedActions = this.generateRecommendedActions(intelligenceItem, overallSignificance);

    return {
      overallSignificance: Math.max(0, Math.min(100, overallSignificance)),
      categories,
      factors,
      reasoning,
      recommendedActions
    };
  }

  /**
   * Generate contextual notifications based on intelligence and significance
   */
  private async generateContextualNotifications(
    intelligenceItem: IntelligenceItem,
    significance: SignificanceAnalysis
  ): Promise<ContextualNotification[]> {
    const notifications: ContextualNotification[] = [];

    // Find applicable templates
    const applicableTemplates = this.findApplicableTemplates(intelligenceItem, significance);

    for (const template of applicableTemplates) {
      // Get relevant users for this intelligence
      const relevantUsers = await this.findRelevantUsers(intelligenceItem, template);

      for (const user of relevantUsers) {
        const userPrefs = this.userPreferences.get(user.userId);
        if (!userPrefs || !this.shouldNotifyUser(intelligenceItem, significance, userPrefs)) {
          continue;
        }

        // Generate personalized notification
        const notification = await this.createPersonalizedNotification(
          intelligenceItem,
          significance,
          template,
          user,
          userPrefs
        );

        notifications.push(notification);
      }
    }

    // Generate predictive notifications if significance is high enough
    if (significance.overallSignificance > 70) {
      const predictiveNotifications = await this.generatePredictiveNotifications(
        intelligenceItem,
        significance
      );
      notifications.push(...predictiveNotifications);
    }

    return notifications;
  }

  /**
   * Route notification to appropriate delivery channels
   */
  private async routeNotification(notification: ContextualNotification): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    for (const deliveryChannel of notification.delivery.channels) {
      try {
        let result: DeliveryResult;

        switch (notification.delivery.timing) {
          case 'immediate':
            result = await this.deliverImmediate(notification, deliveryChannel);
            break;
          case 'scheduled':
            result = await this.scheduleNotification(notification, deliveryChannel);
            break;
          case 'batched':
            result = await this.addToBatch(notification, deliveryChannel);
            break;
          default:
            result = await this.deliverImmediate(notification, deliveryChannel);
        }

        results.push(result);

        // If delivery succeeds and it's high priority, we might not need fallback
        if (result.success && ['critical', 'high'].includes(notification.priority)) {
          break;
        }

      } catch (error) {
        const errorResult: DeliveryResult = {
          notificationId: notification.id,
          channel: deliveryChannel.channel,
          success: false,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown delivery error'
        };

        results.push(errorResult);

        // Try fallback channel if available
        if (deliveryChannel.fallback) {
          try {
            const fallbackResult = await this.deliverImmediate(notification, deliveryChannel.fallback);
            results.push(fallbackResult);
          } catch (fallbackError) {
            console.error('Fallback delivery also failed:', fallbackError);
          }
        }
      }
    }

    return results;
  }

  /**
   * Deliver notification immediately
   */
  private async deliverImmediate(
    notification: ContextualNotification,
    channel: DeliveryChannel
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    switch (channel.channel) {
      case 'web':
        return this.deliverToWeb(notification, channel);
      
      case 'websocket':
        return this.deliverToWebSocket(notification, channel);
      
      case 'email':
        return this.deliverToEmail(notification, channel);
      
      case 'webhook':
        return this.deliverToWebhook(notification, channel);
      
      case 'integration':
        return this.deliverToIntegration(notification, channel);
      
      default:
        throw new Error(`Unknown delivery channel: ${channel.channel}`);
    }
  }

  /**
   * Schedule notification for later delivery
   */
  private async scheduleNotification(
    notification: ContextualNotification,
    channel: DeliveryChannel
  ): Promise<DeliveryResult> {
    // Implementation would depend on your scheduling system
    // For now, return a placeholder
    return {
      notificationId: notification.id,
      channel: channel.channel,
      success: true,
      timestamp: Date.now(),
      metadata: { scheduled: true, scheduledFor: notification.delivery.scheduledTime }
    };
  }

  /**
   * Add notification to batch queue
   */
  private async addToBatch(
    notification: ContextualNotification,
    channel: DeliveryChannel
  ): Promise<DeliveryResult> {
    const batchKey = `${channel.channel}:${notification.context.userId || 'global'}`;
    
    if (!this.deliveryQueue.has(batchKey)) {
      this.deliveryQueue.set(batchKey, []);
    }
    
    this.deliveryQueue.get(batchKey)!.push(notification);

    return {
      notificationId: notification.id,
      channel: channel.channel,
      success: true,
      timestamp: Date.now(),
      metadata: { batched: true, batchKey }
    };
  }

  // Delivery channel implementations

  private async deliverToWeb(
    notification: ContextualNotification,
    channel: DeliveryChannel
  ): Promise<DeliveryResult> {
    // This would integrate with your web notification system
    // For now, we'll simulate the delivery
    
    return {
      notificationId: notification.id,
      channel: 'web',
      success: true,
      timestamp: Date.now(),
      metadata: { displayed: true }
    };
  }

  private async deliverToWebSocket(
    notification: ContextualNotification,
    channel: DeliveryChannel
  ): Promise<DeliveryResult> {
    // This would integrate with your WebSocket server from Phase 2
    // For now, we'll simulate the delivery
    
    return {
      notificationId: notification.id,
      channel: 'websocket',
      success: true,
      timestamp: Date.now(),
      metadata: { broadcast: true, countryId: notification.context.countryId }
    };
  }

  private async deliverToEmail(
    notification: ContextualNotification,
    channel: DeliveryChannel
  ): Promise<DeliveryResult> {
    // Email delivery implementation would go here
    // For now, simulate delivery
    
    return {
      notificationId: notification.id,
      channel: 'email',
      success: true,
      timestamp: Date.now(),
      metadata: { emailSent: true, recipient: channel.config.recipient }
    };
  }

  private async deliverToWebhook(
    notification: ContextualNotification,
    channel: DeliveryChannel
  ): Promise<DeliveryResult> {
    // Webhook delivery implementation
    
    try {
      const response = await fetch(channel.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...channel.config.headers
        },
        body: JSON.stringify({
          notification,
          timestamp: Date.now(),
          source: 'ixstats-intelligence'
        })
      });

      return {
        notificationId: notification.id,
        channel: 'webhook',
        success: response.ok,
        timestamp: Date.now(),
        metadata: { statusCode: response.status, url: channel.config.url }
      };

    } catch (error) {
      return {
        notificationId: notification.id,
        channel: 'webhook',
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Webhook delivery failed'
      };
    }
  }

  private async deliverToIntegration(
    notification: ContextualNotification,
    channel: DeliveryChannel
  ): Promise<DeliveryResult> {
    // Integration delivery (Discord, Slack, etc.)
    // Implementation would depend on specific integration
    
    return {
      notificationId: notification.id,
      channel: 'integration',
      success: true,
      timestamp: Date.now(),
      metadata: { integration: channel.config.type }
    };
  }

  // Analysis helper methods

  private analyzeEconomicSignificance(item: IntelligenceItem): number {
    let score = 50; // Base score
    
    // Category-specific scoring
    if (item.category.includes('economic') || item.category.includes('financial')) {
      score += 30;
    }
    
    // Keywords that indicate economic significance
    const economicKeywords = ['gdp', 'growth', 'recession', 'inflation', 'trade', 'investment'];
    const keywordMatches = economicKeywords.filter(keyword => 
      item.title.toLowerCase().includes(keyword) || 
      item.summary.toLowerCase().includes(keyword)
    );
    
    score += keywordMatches.length * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private analyzeStrategicSignificance(item: IntelligenceItem): number {
    let score = 40;
    
    const strategicKeywords = ['strategic', 'policy', 'government', 'leadership', 'reform', 'initiative'];
    const keywordMatches = strategicKeywords.filter(keyword => 
      item.title.toLowerCase().includes(keyword) || 
      item.summary.toLowerCase().includes(keyword)
    );
    
    score += keywordMatches.length * 8;
    
    // Priority boost for strategic content
    if (item.priority === 'critical') score += 20;
    if (item.priority === 'high') score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private analyzeOperationalSignificance(item: IntelligenceItem): number {
    let score = 30;
    
    const operationalKeywords = ['operation', 'process', 'system', 'infrastructure', 'performance'];
    const keywordMatches = operationalKeywords.filter(keyword => 
      item.title.toLowerCase().includes(keyword) || 
      item.summary.toLowerCase().includes(keyword)
    );
    
    score += keywordMatches.length * 6;
    
    // Source credibility factor
    if (item.source.includes('official') || item.source.includes('government')) {
      score += 15;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateUrgency(item: IntelligenceItem): number {
    const hoursOld = (Date.now() - item.timestamp) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 100 - (hoursOld * 5)); // Decays over 20 hours
    
    const priorityScore = { low: 20, medium: 50, high: 80, critical: 100 }[item.priority] || 20;
    
    return Math.round((recencyScore * 0.6 + priorityScore * 0.4));
  }

  private calculateImpact(item: IntelligenceItem): number {
    // Base impact from priority
    let impact = { low: 25, medium: 50, high: 75, critical: 100 }[item.priority] || 25;
    
    // Adjust based on confidence score
    impact = impact * (item.confidenceScore / 100);
    
    // Keywords that suggest high impact
    const highImpactKeywords = ['major', 'significant', 'breakthrough', 'crisis', 'unprecedented'];
    const matches = highImpactKeywords.filter(keyword => 
      item.title.toLowerCase().includes(keyword) || 
      item.summary.toLowerCase().includes(keyword)
    ).length;
    
    impact += matches * 10;
    
    return Math.max(0, Math.min(100, Math.round(impact)));
  }

  private calculateRelevance(item: IntelligenceItem): number {
    // This would typically consider user context, interests, role, etc.
    // For now, we'll use a simplified calculation
    
    let relevance = 60; // Base relevance
    
    // Country-specific intelligence is more relevant
    if (item.countryId) {
      relevance += 20;
    }
    
    // Recent intelligence is more relevant
    const hoursOld = (Date.now() - item.timestamp) / (1000 * 60 * 60);
    if (hoursOld < 24) {
      relevance += 15;
    }
    
    return Math.max(0, Math.min(100, relevance));
  }

  private calculateUniqueness(item: IntelligenceItem): number {
    // This would check against recent similar intelligence
    // For now, return a base score
    return 70;
  }

  private generateSignificanceReasoning(
    item: IntelligenceItem,
    categories: SignificanceAnalysis['categories'],
    factors: SignificanceAnalysis['factors'],
    overallScore: number
  ): string[] {
    const reasoning: string[] = [];
    
    if (overallScore > 80) {
      reasoning.push('High-priority intelligence with significant potential impact');
    }
    
    if (categories.economic > 70) {
      reasoning.push('Strong economic implications identified');
    }
    
    if (categories.strategic > 70) {
      reasoning.push('Strategic importance for long-term planning');
    }
    
    if (factors.urgency > 80) {
      reasoning.push('Time-sensitive information requiring immediate attention');
    }
    
    if (factors.impact > 75) {
      reasoning.push('Potential for significant operational or strategic impact');
    }
    
    if (item.confidenceScore > 80) {
      reasoning.push(`High confidence score (${item.confidenceScore}%) increases reliability`);
    }
    
    return reasoning.length > 0 ? reasoning : ['Standard intelligence processing'];
  }

  private generateRecommendedActions(item: IntelligenceItem, significance: number): string[] {
    const actions: string[] = [];
    
    if (significance > 85) {
      actions.push('Escalate to executive leadership');
      actions.push('Convene emergency strategy session');
    } else if (significance > 70) {
      actions.push('Brief relevant department heads');
      actions.push('Update strategic planning documents');
    } else if (significance > 50) {
      actions.push('Include in next intelligence briefing');
      actions.push('Monitor for related developments');
    } else {
      actions.push('Archive for future reference');
    }
    
    if (item.category.includes('economic') && significance > 60) {
      actions.push('Update economic forecasting models');
    }
    
    if (item.priority === 'critical') {
      actions.push('Implement crisis management protocols');
    }
    
    return actions;
  }

  // Template and user management methods

  private findApplicableTemplates(item: IntelligenceItem, significance: SignificanceAnalysis): NotificationTemplate[] {
    const applicable: NotificationTemplate[] = [];
    
    for (const template of this.templates.values()) {
      // Check category match
      const categoryMatch = template.triggers.categories.length === 0 || 
        template.triggers.categories.includes(item.category);
      
      // Check priority match
      const priorityMatch = template.triggers.priorities.length === 0 ||
        template.triggers.priorities.includes(item.priority);
      
      // Check significance threshold
      const significanceMatch = significance.overallSignificance >= template.triggers.significance;
      
      if (categoryMatch && priorityMatch && significanceMatch) {
        applicable.push(template);
      }
    }
    
    return applicable;
  }

  private async findRelevantUsers(item: IntelligenceItem, template: NotificationTemplate): Promise<Array<{ userId: string; relevanceScore: number }>> {
    // This would typically query your user database
    // For now, return mock users
    return [
      { userId: 'user-1', relevanceScore: 85 },
      { userId: 'user-2', relevanceScore: 70 }
    ];
  }

  private shouldNotifyUser(
    item: IntelligenceItem,
    significance: SignificanceAnalysis,
    userPrefs: UserNotificationPreferences
  ): boolean {
    // Check if category is enabled
    const categoryKey = this.mapCategoryToPreference(item.category);
    const categoryPref = userPrefs.categories[categoryKey as keyof typeof userPrefs.categories];
    
    if (!categoryPref?.enabled) {
      return false;
    }
    
    // Check minimum priority threshold
    const priorityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const itemPriorityLevel = priorityLevels[item.priority] || 1;
    const minPriorityLevel = priorityLevels[categoryPref.minPriority as keyof typeof priorityLevels] || 1;
    
    if (itemPriorityLevel < minPriorityLevel) {
      return false;
    }
    
    // Check quiet hours
    if (userPrefs.timing.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 100 + now.getMinutes();
      const startTime = parseInt(userPrefs.timing.quietHours.start.replace(':', ''));
      const endTime = parseInt(userPrefs.timing.quietHours.end.replace(':', ''));
      
      if (currentTime >= startTime && currentTime <= endTime && item.priority !== 'critical') {
        return false;
      }
    }
    
    return true;
  }

  private async createPersonalizedNotification(
    item: IntelligenceItem,
    significance: SignificanceAnalysis,
    template: NotificationTemplate,
    user: { userId: string; relevanceScore: number },
    userPrefs: UserNotificationPreferences
  ): Promise<ContextualNotification> {
    // Generate personalized content
    const personalizedContent = this.generatePersonalizedContent(item, userPrefs);
    
    // Find related intelligence
    const relatedIntelligence = await this.findRelatedIntelligence(item);
    
    // Determine delivery channels based on user preferences
    const deliveryChannels = this.determineDeliveryChannels(item, userPrefs, template);
    
    // Calculate expected engagement
    const expectedEngagement = this.calculateExpectedEngagement(item, significance, user.relevanceScore);
    
    return {
      id: `notif-${Date.now()}-${user.userId}`,
      intelligenceId: item.id,
      type: this.determineNotificationType(item, significance),
      priority: this.adjustPriorityForUser(item.priority, userPrefs),
      title: this.personalizeTitle(template.template.title, item, userPrefs),
      message: this.personalizeMessage(template.template.message, item, userPrefs),
      context: {
        countryId: item.countryId,
        userId: user.userId,
        relevanceScore: user.relevanceScore,
        personalizedContent,
        relatedIntelligence
      },
      delivery: {
        channels: deliveryChannels,
        timing: this.determineTiming(item, userPrefs, template),
        scheduledTime: template.delivery.timing === 'scheduled' ? Date.now() + (template.delivery.batchWindow || 0) : undefined,
        expirationTime: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      },
      analytics: {
        created: Date.now(),
        significance: significance.overallSignificance,
        expectedEngagement,
        category: item.category
      },
      actions: template.template.actions
    };
  }

  private async generatePredictiveNotifications(
    item: IntelligenceItem,
    significance: SignificanceAnalysis
  ): Promise<ContextualNotification[]> {
    const notifications: ContextualNotification[] = [];
    
    // Generate predictive insights based on this intelligence
    if (item.countryId && significance.factors.impact > 70) {
      // This would integrate with the predictive analytics engine
      // For now, create a placeholder predictive notification
      
      notifications.push({
        id: `predictive-${Date.now()}`,
        intelligenceId: item.id,
        type: 'forecast',
        priority: 'medium',
        title: `Predictive Analysis: Impact of ${item.title}`,
        message: `Our AI models predict this development may lead to significant changes in economic indicators over the next 30-90 days.`,
        context: {
          countryId: item.countryId,
          relevanceScore: significance.overallSignificance,
          personalizedContent: ['Predictive modeling suggests monitoring recommended'],
          relatedIntelligence: [item.id]
        },
        delivery: {
          channels: [{ channel: 'web', config: {}, priority: 1 }],
          timing: 'scheduled',
          scheduledTime: Date.now() + (2 * 60 * 60 * 1000) // 2 hours later
        },
        analytics: {
          created: Date.now(),
          significance: significance.overallSignificance,
          expectedEngagement: 0.7,
          category: 'predictive'
        }
      });
    }
    
    return notifications;
  }

  // Utility methods

  private initializeDefaultTemplates(): void {
    // Economic Intelligence Template
    this.templates.set('economic-alert', {
      id: 'economic-alert',
      name: 'Economic Intelligence Alert',
      category: 'economic',
      template: {
        title: '🏦 Economic Alert: {title}',
        message: '{summary}\n\nConfidence: {confidence}% | Priority: {priority}',
        actions: [
          { id: 'view-details', label: 'View Details', type: 'primary', action: 'navigate', data: { route: '/intelligence/{id}' } },
          { id: 'dismiss', label: 'Dismiss', type: 'secondary', action: 'dismiss', data: {} }
        ]
      },
      triggers: {
        categories: ['economic', 'financial'],
        priorities: ['medium', 'high', 'critical'],
        significance: 60,
        conditions: {}
      },
      delivery: {
        defaultChannels: ['web', 'websocket'],
        timing: 'immediate'
      }
    });

    // Strategic Intelligence Template
    this.templates.set('strategic-briefing', {
      id: 'strategic-briefing',
      name: 'Strategic Intelligence Briefing',
      category: 'strategic',
      template: {
        title: '🎯 Strategic Update: {title}',
        message: '{summary}\n\nRecommended Actions: {actions}',
        actions: [
          { id: 'schedule-briefing', label: 'Schedule Briefing', type: 'primary', action: 'api_call', data: { endpoint: '/api/briefings' } },
          { id: 'view-analysis', label: 'View Analysis', type: 'secondary', action: 'navigate', data: { route: '/analysis/{id}' } }
        ]
      },
      triggers: {
        categories: ['strategic', 'policy'],
        priorities: ['high', 'critical'],
        significance: 75,
        conditions: {}
      },
      delivery: {
        defaultChannels: ['web', 'email'],
        timing: 'scheduled',
        batchWindow: 30 * 60 * 1000 // 30 minutes
      }
    });

    // Critical Alert Template
    this.templates.set('critical-alert', {
      id: 'critical-alert',
      name: 'Critical Intelligence Alert',
      category: 'critical',
      template: {
        title: '🚨 CRITICAL: {title}',
        message: 'IMMEDIATE ATTENTION REQUIRED\n\n{summary}\n\nThis requires immediate executive review.',
        actions: [
          { id: 'emergency-briefing', label: 'Emergency Briefing', type: 'danger', action: 'api_call', data: { endpoint: '/api/emergency' } },
          { id: 'escalate', label: 'Escalate', type: 'primary', action: 'api_call', data: { endpoint: '/api/escalate' } }
        ]
      },
      triggers: {
        categories: [],
        priorities: ['critical'],
        significance: 90,
        conditions: {}
      },
      delivery: {
        defaultChannels: ['web', 'websocket', 'email', 'webhook'],
        timing: 'immediate'
      }
    });
  }

  private startBatchProcessor(): void {
    // Process batched notifications every 5 minutes
    setInterval(() => {
      this.processBatchQueue();
    }, 5 * 60 * 1000);
  }

  private async processBatchQueue(): Promise<void> {
    for (const [batchKey, notifications] of this.deliveryQueue) {
      if (notifications.length === 0) continue;
      
      try {
        // Process batch
        await this.processBatch(batchKey, notifications);
        
        // Clear processed notifications
        this.deliveryQueue.set(batchKey, []);
        
      } catch (error) {
        console.error(`Failed to process batch ${batchKey}:`, error);
      }
    }
  }

  private async processBatch(batchKey: string, notifications: ContextualNotification[]): Promise<void> {
    // Group notifications and create batch digest
    const [channel, userId] = batchKey.split(':');
    
    // Implementation would depend on the specific channel
    console.log(`Processing batch of ${notifications.length} notifications for ${userId} via ${channel}`);
  }

  // Helper methods for personalization

  private generatePersonalizedContent(item: IntelligenceItem, userPrefs: UserNotificationPreferences): string[] {
    const content: string[] = [];
    
    // Add expertise level appropriate content
    if (userPrefs.personalization.expertiseLevel === 'expert') {
      content.push('Technical details and methodology available');
    } else if (userPrefs.personalization.expertiseLevel === 'basic') {
      content.push('Simplified explanation available');
    }
    
    // Add country-specific context if relevant
    if (item.countryId && userPrefs.personalization.countryFocus.includes(item.countryId)) {
      content.push('High relevance based on your country focus');
    }
    
    return content;
  }

  private async findRelatedIntelligence(item: IntelligenceItem): Promise<string[]> {
    // This would search for related intelligence items
    // For now, return empty array
    return [];
  }

  private determineDeliveryChannels(
    item: IntelligenceItem,
    userPrefs: UserNotificationPreferences,
    template: NotificationTemplate
  ): DeliveryChannel[] {
    const channels: DeliveryChannel[] = [];
    
    // Web notification if enabled
    if (userPrefs.channels.web.enabled) {
      channels.push({
        channel: 'web',
        config: userPrefs.channels.web.settings,
        priority: 1
      });
    }
    
    // Email if enabled and not immediate critical
    if (userPrefs.channels.email.enabled && (item.priority !== 'critical' || !userPrefs.timing.immediateForCritical)) {
      channels.push({
        channel: 'email',
        config: userPrefs.channels.email.settings,
        priority: 2
      });
    }
    
    // Webhook if enabled
    if (userPrefs.channels.webhook.enabled) {
      channels.push({
        channel: 'webhook',
        config: userPrefs.channels.webhook.settings,
        priority: 3
      });
    }
    
    return channels.length > 0 ? channels : template.delivery.defaultChannels.map(ch => ({
      channel: ch as any,
      config: {},
      priority: 1
    }));
  }

  private determineNotificationType(item: IntelligenceItem, significance: SignificanceAnalysis): ContextualNotification['type'] {
    if (item.priority === 'critical') return 'alert';
    if (significance.overallSignificance > 80) return 'insight';
    if (significance.factors.urgency > 75) return 'alert';
    if (item.category.includes('forecast') || item.category.includes('predict')) return 'forecast';
    return 'insight';
  }

  private adjustPriorityForUser(priority: string, userPrefs: UserNotificationPreferences): ContextualNotification['priority'] {
    // Could adjust based on user preferences
    return priority as ContextualNotification['priority'];
  }

  private personalizeTitle(template: string, item: IntelligenceItem, userPrefs: UserNotificationPreferences): string {
    return template
      .replace('{title}', item.title)
      .replace('{category}', item.category)
      .replace('{priority}', item.priority);
  }

  private personalizeMessage(template: string, item: IntelligenceItem, userPrefs: UserNotificationPreferences): string {
    return template
      .replace('{summary}', item.summary)
      .replace('{confidence}', item.confidenceScore.toString())
      .replace('{priority}', item.priority.toUpperCase())
      .replace('{actions}', 'Review and assess implications');
  }

  private determineTiming(
    item: IntelligenceItem,
    userPrefs: UserNotificationPreferences,
    template: NotificationTemplate
  ): ContextualNotification['delivery']['timing'] {
    if (item.priority === 'critical' && userPrefs.timing.immediateForCritical) {
      return 'immediate';
    }
    
    if (userPrefs.timing.batchDelivery && item.priority !== 'critical') {
      return 'batched';
    }
    
    return template.delivery.timing as ContextualNotification['delivery']['timing'];
  }

  private calculateExpectedEngagement(item: IntelligenceItem, significance: SignificanceAnalysis, relevanceScore: number): number {
    const baseEngagement = 0.3; // 30% base engagement
    const significanceBoost = (significance.overallSignificance / 100) * 0.4;
    const relevanceBoost = (relevanceScore / 100) * 0.3;
    
    return Math.min(1, baseEngagement + significanceBoost + relevanceBoost);
  }

  private mapCategoryToPreference(category: string): string {
    if (category.includes('economic') || category.includes('financial')) return 'economic';
    if (category.includes('strategic') || category.includes('policy')) return 'strategic';
    if (category.includes('operational') || category.includes('system')) return 'operational';
    if (category.includes('forecast') || category.includes('predict')) return 'predictive';
    return 'operational';
  }

  private updateProcessingStats(startTime: number, notificationCount: number, results: DeliveryResult[]): void {
    const processingTime = performance.now() - startTime;
    
    this.processingStats.processed++;
    this.processingStats.notifications += notificationCount;
    this.processingStats.delivered += results.filter(r => r.success).length;
    this.processingStats.errors += results.filter(r => !r.success).length;
    
    // Update average processing time
    this.processingStats.averageProcessingTime = 
      (this.processingStats.averageProcessingTime * (this.processingStats.processed - 1) + processingTime) / 
      this.processingStats.processed;
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return { ...this.processingStats };
  }

  /**
   * Clear processing statistics
   */
  clearProcessingStats(): void {
    this.processingStats = {
      processed: 0,
      notifications: 0,
      delivered: 0,
      errors: 0,
      averageProcessingTime: 0
    };
  }
}

// Global intelligence notification pipeline instance
export const intelligenceNotificationPipeline = new IntelligenceNotificationPipeline();