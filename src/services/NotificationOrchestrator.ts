/**
 * Unified Notification Orchestrator
 * Central hub for processing, routing, and delivering all notifications
 */

import { IxTime } from '~/lib/ixtime';
import type {
  UnifiedNotification,
  NotificationContext,
  NotificationEvent,
  NotificationEventType,
  OrchestratorConfig,
  UserNotificationPreferences,
  NotificationEngagement,
  SuppressionRule,
  NotificationAnalytics,
  DeliveryMethod,
  NotificationPriority,
  NotificationCategory,
} from '~/types/unified-notifications';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  DEFAULT_USER_PREFERENCES,
} from '~/types/unified-notifications';

// Event emitter for orchestrator events
class NotificationEventEmitter extends EventTarget {
  emit(type: NotificationEventType, notification: UnifiedNotification, context: NotificationContext) {
    const event = new CustomEvent(type, {
      detail: { notification, context, timestamp: Date.now() }
    });
    this.dispatchEvent(event);
  }

  on(type: NotificationEventType, handler: (event: CustomEvent) => void) {
    this.addEventListener(type, handler as EventListener);
  }

  off(type: NotificationEventType, handler: (event: CustomEvent) => void) {
    this.removeEventListener(type, handler as EventListener);
  }
}

// Delivery handler interface
interface DeliveryHandler {
  canHandle(method: DeliveryMethod): boolean;
  deliver(notification: UnifiedNotification, context: NotificationContext): Promise<boolean>;
  getCapabilities(): DeliveryCapabilities;
}

interface DeliveryCapabilities {
  supportsBatching: boolean;
  supportsActions: boolean;
  maxContentLength: number;
  priorityLevels: NotificationPriority[];
}

// Queue item for processing
interface QueueItem {
  notification: UnifiedNotification;
  context: NotificationContext;
  attempts: number;
  addedAt: number;
  scheduledFor?: number;
}

export class NotificationOrchestrator {
  private config: OrchestratorConfig;
  private eventEmitter: NotificationEventEmitter;
  private processingQueue: QueueItem[] = [];
  private deliveryHandlers: Map<DeliveryMethod, DeliveryHandler> = new Map();
  private userPreferences: Map<string, UserNotificationPreferences> = new Map();
  private suppressionRules: Map<string, SuppressionRule[]> = new Map();
  private analytics: NotificationAnalytics;
  private isProcessing = false;
  private rateLimiters: Map<string, number[]> = new Map();

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.eventEmitter = new NotificationEventEmitter();
    this.analytics = this.initializeAnalytics();
    
    // Start processing queue
    this.startProcessing();
    
    console.log('[NotificationOrchestrator] Initialized with config:', this.config);
  }

  /**
   * Main entry point for creating notifications
   */
  async createNotification(
    notification: Omit<UnifiedNotification, 'id' | 'timestamp' | 'status' | 'relevanceScore'>,
    context: NotificationContext
  ): Promise<string> {
    // Generate unique ID
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create full notification object
    const fullNotification: UnifiedNotification = {
      ...notification,
      id,
      timestamp: Date.now(),
      status: 'pending',
      relevanceScore: 0, // Will be calculated
    };

    // Calculate relevance score
    fullNotification.relevanceScore = await this.calculateRelevanceScore(fullNotification, context);

    // Check if notification should be suppressed
    if (await this.shouldSuppress(fullNotification, context)) {
      fullNotification.status = 'suppressed';
      this.eventEmitter.emit('suppressed', fullNotification, context);
      return id;
    }

    // Add to processing queue
    this.addToQueue(fullNotification, context);
    
    // Emit created event
    this.eventEmitter.emit('created', fullNotification, context);
    
    // Update analytics
    this.analytics.totalDelivered++;
    
    return id;
  }

  /**
   * Register a delivery handler for a specific method
   */
  registerDeliveryHandler(method: DeliveryMethod, handler: DeliveryHandler) {
    this.deliveryHandlers.set(method, handler);
    console.log(`[NotificationOrchestrator] Registered handler for ${method}`);
  }

  /**
   * Set user preferences
   */
  setUserPreferences(userId: string, preferences: Partial<UserNotificationPreferences>) {
    const existing = this.userPreferences.get(userId) || DEFAULT_USER_PREFERENCES;
    this.userPreferences.set(userId, { ...existing, ...preferences });
  }

  /**
   * Add suppression rules for a user
   */
  addSuppressionRules(userId: string, rules: SuppressionRule[]) {
    const existing = this.suppressionRules.get(userId) || [];
    this.suppressionRules.set(userId, [...existing, ...rules]);
  }

  /**
   * Record user engagement with a notification
   */
  recordEngagement(engagement: NotificationEngagement) {
    const userId = engagement.contextAtEngagement?.userId;
    if (!userId) return;

    // Update analytics
    this.analytics.engagementRate = this.calculateEngagementRate();
    
    // Emit engagement event for learning
    this.eventEmitter.emit('engaged', {
      id: engagement.notificationId,
    } as UnifiedNotification, engagement.contextAtEngagement as NotificationContext);
  }

  /**
   * Get current analytics
   */
  getAnalytics(): NotificationAnalytics {
    return { ...this.analytics };
  }

  /**
   * Subscribe to orchestrator events
   */
  on(eventType: NotificationEventType, handler: (event: CustomEvent) => void) {
    this.eventEmitter.on(eventType, handler);
  }

  /**
   * Unsubscribe from orchestrator events
   */
  off(eventType: NotificationEventType, handler: (event: CustomEvent) => void) {
    this.eventEmitter.off(eventType, handler);
  }

  // Private methods

  private async calculateRelevanceScore(
    notification: UnifiedNotification,
    context: NotificationContext
  ): Promise<number> {
    let score = 0;
    const weights = this.config.contextWeighting;

    // Priority scoring (0-40 points)
    const priorityScore = {
      critical: 40,
      high: 30,
      medium: 20,
      low: 10,
    }[notification.priority] || 10;
    score += priorityScore * (weights.priority || 0.4);

    // Recency scoring (0-20 points)
    const ageMinutes = (Date.now() - notification.timestamp) / (1000 * 60);
    const recencyScore = Math.max(0, 20 - ageMinutes);
    score += recencyScore * (weights.recency || 0.2);

    // Context relevance (0-20 points)
    const contextScore = this.calculateContextRelevance(notification, context);
    score += contextScore * (weights.relevance || 0.2);

    // User preference scoring (0-20 points)
    const preferenceScore = this.calculateUserPreferenceScore(notification, context);
    score += preferenceScore * (weights.userPreference || 0.2);

    return Math.min(100, Math.max(0, score));
  }

  private calculateContextRelevance(
    notification: UnifiedNotification,
    context: NotificationContext
  ): number {
    let relevance = 10; // Base relevance

    // Executive mode relevance
    if (context.isExecutiveMode) {
      const executiveCategories: NotificationCategory[] = [
        'economic', 'governance', 'security', 'crisis'
      ];
      if (executiveCategories.includes(notification.category)) {
        relevance += 5;
      }
    }

    // Route-based relevance
    if (context.currentRoute.includes('mycountry') && 
        ['economic', 'governance', 'achievement'].includes(notification.category)) {
      relevance += 3;
    }

    // Time-based relevance (during business hours for important notifications)
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17 && notification.priority === 'high') {
      relevance += 2;
    }

    return Math.min(20, relevance);
  }

  private calculateUserPreferenceScore(
    notification: UnifiedNotification,
    context: NotificationContext
  ): number {
    const preferences = this.getUserPreferences(context.userId);
    const categoryPrefs = preferences.categories[notification.category];
    
    if (!categoryPrefs?.enabled) return 0;
    
    // Check minimum priority
    const priorityOrder = ['low', 'medium', 'high', 'critical'];
    const notificationPriorityIndex = priorityOrder.indexOf(notification.priority);
    const minPriorityIndex = priorityOrder.indexOf(categoryPrefs.minPriority);
    
    if (notificationPriorityIndex < minPriorityIndex) return 5;
    
    return 15; // Good match with user preferences
  }

  private async shouldSuppress(
    notification: UnifiedNotification,
    context: NotificationContext
  ): Promise<boolean> {
    const rules = this.suppressionRules.get(context.userId) || [];
    
    for (const rule of rules) {
      if (await this.evaluateSuppressionRule(rule, notification, context)) {
        return true;
      }
    }

    // Rate limiting check
    if (this.isRateLimited(notification, context)) {
      return true;
    }

    // Quiet hours check
    const preferences = this.getUserPreferences(context.userId);
    if (preferences.quietHours && this.isInQuietHours(preferences.quietHours)) {
      return notification.priority !== 'critical';
    }

    return false;
  }

  private async evaluateSuppressionRule(
    rule: SuppressionRule,
    notification: UnifiedNotification,
    context: NotificationContext
  ): Promise<boolean> {
    // Simple rule evaluation - can be extended
    for (const condition of rule.conditions) {
      const value = notification[condition.field as keyof UnifiedNotification];
      
      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'contains':
          if (typeof value === 'string' && !value.includes(condition.value)) return false;
          break;
        // Add more operators as needed
      }
    }
    
    return true;
  }

  private isRateLimited(notification: UnifiedNotification, context: NotificationContext): boolean {
    const key = `${context.userId}-${notification.priority}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const limit = this.config.rateLimiting[notification.priority];
    
    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, []);
    }
    
    const timestamps = this.rateLimiters.get(key);
    if (!timestamps) {
      return false;
    }
    
    // Remove old timestamps
    while (timestamps.length > 0 && timestamps[0] !== undefined && timestamps[0] < now - windowMs) {
      timestamps.shift();
    }
    
    if (timestamps.length >= limit) {
      return true;
    }
    
    timestamps.push(now);
    return false;
  }

  private isInQuietHours(quietHours: { start: string; end: string }): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    
    const startTime = (startHour || 0) * 60 + (startMin || 0);
    const endTime = (endHour || 0) * 60 + (endMin || 0);
    
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private addToQueue(notification: UnifiedNotification, context: NotificationContext) {
    if (this.processingQueue.length >= this.config.maxQueueSize) {
      console.warn('[NotificationOrchestrator] Queue full, dropping oldest notification');
      this.processingQueue.shift();
    }

    const queueItem: QueueItem = {
      notification,
      context,
      attempts: 0,
      addedAt: Date.now(),
    };

    // Insert based on priority
    const priorityOrder = ['critical', 'high', 'medium', 'low'];
    const insertIndex = this.processingQueue.findIndex(item => 
      priorityOrder.indexOf(item.notification.priority) > 
      priorityOrder.indexOf(notification.priority)
    );

    if (insertIndex === -1) {
      this.processingQueue.push(queueItem);
    } else {
      this.processingQueue.splice(insertIndex, 0, queueItem);
    }

    this.eventEmitter.emit('queued', notification, context);
  }

  private startProcessing() {
    const processNext = async () => {
      if (this.isProcessing || this.processingQueue.length === 0) {
        setTimeout(processNext, 100);
        return;
      }

      this.isProcessing = true;
      const item = this.processingQueue.shift();
      
      if (item) {
        try {
          await this.processNotification(item);
        } catch (error) {
          console.error('[NotificationOrchestrator] Processing error:', error);
          
          // Retry logic
          if (item.attempts < 3) {
            item.attempts++;
            this.processingQueue.unshift(item);
          } else {
            this.eventEmitter.emit('failed', item.notification, item.context);
          }
        }
      }

      this.isProcessing = false;
      setTimeout(processNext, 50);
    };

    processNext();
  }

  private async processNotification(item: QueueItem) {
    const { notification, context } = item;
    
    // Check if notification is still relevant
    if (notification.expiresAt && Date.now() > notification.expiresAt) {
      notification.status = 'expired';
      this.eventEmitter.emit('expired', notification, context);
      return;
    }

    // Determine delivery method
    const deliveryMethod = this.determineDeliveryMethod(notification, context);
    notification.deliveryMethod = deliveryMethod;

    // Get delivery handler
    const handler = this.deliveryHandlers.get(deliveryMethod);
    if (!handler) {
      console.warn(`[NotificationOrchestrator] No handler for ${deliveryMethod}, using fallback`);
      const fallbackHandler = this.deliveryHandlers.get(this.config.fallbackMethod);
      if (fallbackHandler) {
        notification.deliveryMethod = this.config.fallbackMethod;
        await this.deliverNotification(notification, context, fallbackHandler);
      }
      return;
    }

    await this.deliverNotification(notification, context, handler);
  }

  private determineDeliveryMethod(
    notification: UnifiedNotification,
    context: NotificationContext
  ): DeliveryMethod {
    const preferences = this.getUserPreferences(context.userId);
    const categoryPrefs = preferences.categories[notification.category];
    
    // Critical notifications always use dynamic island or modal
    if (notification.priority === 'critical') {
      return context.isExecutiveMode ? 'dynamic-island' : 'modal';
    }

    // Use category preferences if available
    if (categoryPrefs?.deliveryMethods?.length > 0) {
      const method = categoryPrefs.deliveryMethods[0];
      if (method) return method;
    }

    // Use user's preferred methods
    if (preferences.preferredMethods?.length > 0) {
      const method = preferences.preferredMethods[0];
      if (method) return method;
    }

    // Default based on context
    if (context.isExecutiveMode) {
      return 'dynamic-island';
    }

    return 'toast';
  }

  private async deliverNotification(
    notification: UnifiedNotification,
    context: NotificationContext,
    handler: DeliveryHandler
  ) {
    try {
      const success = await handler.deliver(notification, context);
      
      if (success) {
        notification.status = 'delivered';
        this.eventEmitter.emit('delivered', notification, context);
        this.updateDeliveryAnalytics(notification.deliveryMethod, true);
      } else {
        throw new Error('Delivery handler returned false');
      }
    } catch (error) {
      console.error('[NotificationOrchestrator] Delivery failed:', error);
      notification.status = 'failed';
      this.eventEmitter.emit('failed', notification, context);
      this.updateDeliveryAnalytics(notification.deliveryMethod, false);
      throw error;
    }
  }

  private getUserPreferences(userId: string): UserNotificationPreferences {
    return this.userPreferences.get(userId) || DEFAULT_USER_PREFERENCES;
  }

  private initializeAnalytics(): NotificationAnalytics {
    return {
      totalDelivered: 0,
      deliveryRate: 0,
      engagementRate: 0,
      averageTimeToAction: 0,
      dismissalRate: 0,
      categoryBreakdown: {
        economic: 0,
        diplomatic: 0,
        governance: 0,
        social: 0,
        security: 0,
        system: 0,
        achievement: 0,
        crisis: 0,
        opportunity: 0,
        policy: 0,
        intelligence: 0,
        global: 0,
        military: 0,
      } as Record<NotificationCategory, number>,
      methodEffectiveness: {
        'dynamic-island': { delivered: 0, engaged: 0, rate: 0 },
        'toast': { delivered: 0, engaged: 0, rate: 0 },
        'modal': { delivered: 0, engaged: 0, rate: 0 },
        'command-palette': { delivered: 0, engaged: 0, rate: 0 },
        'badge': { delivered: 0, engaged: 0, rate: 0 },
        'silent': { delivered: 0, engaged: 0, rate: 0 },
        'push': { delivered: 0, engaged: 0, rate: 0 },
      } as Record<DeliveryMethod, { delivered: number, engaged: number, rate: number }>,
    };
  }

  private calculateEngagementRate(): number {
    // Simplified calculation - would be more sophisticated in practice
    const totalMethodDeliveries = Object.values(this.analytics.methodEffectiveness)
      .reduce((sum, method) => sum + method.delivered, 0);
    const totalMethodEngagements = Object.values(this.analytics.methodEffectiveness)
      .reduce((sum, method) => sum + method.engaged, 0);
    
    return totalMethodDeliveries > 0 ? (totalMethodEngagements / totalMethodDeliveries) * 100 : 0;
  }

  private updateDeliveryAnalytics(method: DeliveryMethod, success: boolean) {
    if (success) {
      this.analytics.methodEffectiveness[method].delivered++;
    }
    
    // Update delivery rate
    const totalDelivered = Object.values(this.analytics.methodEffectiveness)
      .reduce((sum, method) => sum + method.delivered, 0);
    this.analytics.deliveryRate = (totalDelivered / this.analytics.totalDelivered) * 100;
  }
}

// Singleton instance
let orchestratorInstance: NotificationOrchestrator | null = null;

/**
 * Get the singleton notification orchestrator instance
 */
export function getNotificationOrchestrator(config?: Partial<OrchestratorConfig>): NotificationOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new NotificationOrchestrator(config);
  }
  return orchestratorInstance;
}

export default NotificationOrchestrator;