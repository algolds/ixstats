/**
 * Notification Delivery Optimization System
 * Context-aware delivery optimization with user behavior adaptation
 */

import type {
  UnifiedNotification,
  NotificationContext,
  UserNotificationPreferences,
  DeliveryMethod,
  NotificationPriority,
  NotificationCategory,
} from '~/types/unified-notifications';
import type { BatchAnalysis } from './NotificationGrouping';

// Delivery optimization configuration
export interface DeliveryOptimizationConfig {
  enableAdaptiveTiming: boolean;
  enableContextAwareness: boolean;
  enableBehaviorLearning: boolean;
  enableLoadBalancing: boolean;
  maxDeliveryDelay: number; // milliseconds
  minDeliveryInterval: number; // milliseconds between notifications
  urgencyOverrides: boolean;
}

// User attention state analysis
export interface AttentionState {
  level: 'focused' | 'partial' | 'distracted' | 'away';
  confidence: number; // 0-1
  indicators: AttentionIndicator[];
  lastUpdate: number;
  predictedDuration: number; // how long this state will last (ms)
}

export interface AttentionIndicator {
  type: 'mouse_activity' | 'keyboard_activity' | 'tab_focus' | 'scroll_activity' | 'page_visibility';
  strength: number; // 0-1
  timestamp: number;
}

// Delivery optimization result
export interface DeliveryOptimization {
  originalDeliveryTime: number;
  optimizedDeliveryTime: number;
  selectedMethod: DeliveryMethod;
  confidence: number; // 0-1, confidence in optimization
  reasoning: OptimizationReasoning[];
  alternativeOptions: DeliveryOption[];
  estimatedEngagement: number; // 0-1
  fallbackStrategies: FallbackStrategy[];
}

export interface OptimizationReasoning {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface DeliveryOption {
  method: DeliveryMethod;
  timing: number;
  score: number;
  pros: string[];
  cons: string[];
}

export interface FallbackStrategy {
  condition: string;
  action: 'retry' | 'escalate' | 'redirect' | 'delay';
  parameters: Record<string, any>;
  maxAttempts: number;
}

// User behavior patterns
export interface UserBehaviorPattern {
  userId: string;
  patterns: {
    dailyActiveHours: number[]; // Hours when user is typically active
    weeklyPattern: number[]; // 0=Sunday, activity level 0-1
    responseTimeByCategory: Map<NotificationCategory, number>;
    responseTimeByPriority: Map<NotificationPriority, number>;
    preferredDeliveryMethods: Map<NotificationCategory, DeliveryMethod[]>;
    engagementByTimeOfDay: Map<number, number>; // hour -> engagement rate
    dismissalPatterns: DismissalPattern[];
  };
  lastUpdated: number;
  confidenceLevel: number; // 0-1, how reliable these patterns are
}

export interface DismissalPattern {
  category: NotificationCategory;
  timeWindow: { start: number; end: number }; // hours
  dismissalRate: number; // 0-1
  reasons: string[];
}

export class NotificationDeliveryOptimization {
  private config: DeliveryOptimizationConfig;
  private userBehaviorPatterns: Map<string, UserBehaviorPattern> = new Map();
  private attentionStates: Map<string, AttentionState> = new Map();
  private deliveryQueue: Map<string, DeliveryQueueItem[]> = new Map();
  private performanceMetrics: Map<string, DeliveryMetrics> = new Map();

  constructor(config: Partial<DeliveryOptimizationConfig> = {}) {
    this.config = {
      enableAdaptiveTiming: true,
      enableContextAwareness: true,
      enableBehaviorLearning: true,
      enableLoadBalancing: true,
      maxDeliveryDelay: 2 * 60 * 60 * 1000, // 2 hours
      minDeliveryInterval: 30 * 1000, // 30 seconds
      urgencyOverrides: true,
      ...config
    };
  }

  /**
   * Optimize notification delivery based on user context and behavior
   */
  async optimizeDelivery(
    notification: UnifiedNotification,
    context: NotificationContext,
    preferences: UserNotificationPreferences,
    batch?: BatchAnalysis
  ): Promise<DeliveryOptimization> {
    // Analyze current user attention state
    const attentionState = await this.analyzeUserAttention(context);
    
    // Get user behavior patterns
    const behaviorPattern = await this.getUserBehaviorPattern(context.userId);
    
    // Calculate optimal delivery timing
    const optimalTiming = await this.calculateOptimalTiming(
      notification,
      context,
      preferences,
      attentionState,
      behaviorPattern
    );
    
    // Select best delivery method
    const deliveryMethod = await this.selectOptimalDeliveryMethod(
      notification,
      context,
      preferences,
      attentionState,
      behaviorPattern
    );
    
    // Generate alternative options
    const alternatives = await this.generateAlternativeOptions(
      notification,
      context,
      preferences,
      attentionState
    );
    
    // Calculate confidence and engagement prediction
    const confidence = this.calculateOptimizationConfidence(
      notification,
      context,
      behaviorPattern,
      attentionState
    );
    
    const estimatedEngagement = await this.predictEngagement(
      notification,
      context,
      behaviorPattern,
      attentionState,
      deliveryMethod
    );
    
    // Generate reasoning
    const reasoning = this.generateOptimizationReasoning(
      notification,
      context,
      attentionState,
      behaviorPattern,
      optimalTiming
    );
    
    // Create fallback strategies
    const fallbackStrategies = this.createFallbackStrategies(
      notification,
      context,
      deliveryMethod
    );

    return {
      originalDeliveryTime: Date.now(),
      optimizedDeliveryTime: optimalTiming,
      selectedMethod: deliveryMethod,
      confidence,
      reasoning,
      alternativeOptions: alternatives,
      estimatedEngagement,
      fallbackStrategies
    };
  }

  /**
   * Adaptive load balancing across multiple users and time windows
   */
  async balanceDeliveryLoad(
    optimizations: DeliveryOptimization[],
    globalConstraints?: {
      maxConcurrentDeliveries?: number;
      systemLoadThreshold?: number;
      maintenanceWindows?: { start: number; end: number }[];
    }
  ): Promise<DeliveryOptimization[]> {
    const constraints = globalConstraints || {};
    const maxConcurrent = constraints.maxConcurrentDeliveries || 100;
    
    // Group optimizations by time windows
    const timeWindows = this.groupByTimeWindows(optimizations, 5 * 60 * 1000); // 5-minute windows
    
    const balancedOptimizations: DeliveryOptimization[] = [];
    
    for (const [windowStart, windowOptimizations] of timeWindows) {
      if (windowOptimizations.length <= maxConcurrent) {
        balancedOptimizations.push(...windowOptimizations);
        continue;
      }
      
      // Apply load balancing within the window
      const prioritized = this.prioritizeWithinWindow(windowOptimizations);
      const immediate = prioritized.slice(0, maxConcurrent);
      const deferred = prioritized.slice(maxConcurrent);
      
      // Reschedule deferred notifications
      const rescheduled = await this.rescheduleDeferred(deferred, windowStart);
      
      balancedOptimizations.push(...immediate, ...rescheduled);
    }
    
    return balancedOptimizations.sort((a, b) => 
      a.optimizedDeliveryTime - b.optimizedDeliveryTime
    );
  }

  /**
   * Real-time user attention monitoring
   */
  async updateUserAttention(
    userId: string,
    indicators: AttentionIndicator[]
  ): Promise<AttentionState> {
    const currentState = this.attentionStates.get(userId) || {
      level: 'partial',
      confidence: 0.5,
      indicators: [],
      lastUpdate: Date.now(),
      predictedDuration: 5 * 60 * 1000 // 5 minutes default
    };
    
    // Merge new indicators with recent ones
    const cutoffTime = Date.now() - (5 * 60 * 1000); // 5 minutes
    const recentIndicators = currentState.indicators.filter(i => i.timestamp > cutoffTime);
    const allIndicators = [...recentIndicators, ...indicators];
    
    // Analyze attention level
    const attentionLevel = this.calculateAttentionLevel(allIndicators);
    const confidence = this.calculateAttentionConfidence(allIndicators);
    const predictedDuration = this.predictAttentionDuration(allIndicators, attentionLevel);
    
    const newState: AttentionState = {
      level: attentionLevel,
      confidence,
      indicators: allIndicators,
      lastUpdate: Date.now(),
      predictedDuration
    };
    
    this.attentionStates.set(userId, newState);
    return newState;
  }

  /**
   * Learn from delivery outcomes to improve future optimizations
   */
  async learnFromDeliveryOutcome(
    notification: UnifiedNotification,
    optimization: DeliveryOptimization,
    outcome: DeliveryOutcome
  ): Promise<void> {
    if (!this.config.enableBehaviorLearning) return;
    
    const userId = outcome.userId;
    let pattern = this.userBehaviorPatterns.get(userId);
    
    if (!pattern) {
      pattern = this.initializeUserBehaviorPattern(userId);
    }
    
    // Update response time patterns
    if (outcome.responseTime && outcome.action !== 'dismissed') {
      this.updateResponseTimePatterns(pattern, notification, outcome.responseTime);
    }
    
    // Update engagement patterns
    this.updateEngagementPatterns(pattern, notification, outcome, optimization);
    
    // Update dismissal patterns
    if (outcome.action === 'dismissed') {
      this.updateDismissalPatterns(pattern, notification, outcome);
    }
    
    // Update delivery method preferences
    this.updateDeliveryMethodPreferences(pattern, notification, outcome, optimization);
    
    pattern.lastUpdated = Date.now();
    pattern.confidenceLevel = this.calculatePatternConfidence(pattern);
    
    this.userBehaviorPatterns.set(userId, pattern);
  }

  // Private implementation methods

  private async analyzeUserAttention(context: NotificationContext): Promise<AttentionState> {
    const userId = context.userId;
    const existingState = this.attentionStates.get(userId);
    
    if (existingState && Date.now() - existingState.lastUpdate < 60000) { // 1 minute
      return existingState;
    }
    
    // Generate indicators from context
    const indicators: AttentionIndicator[] = [];
    
    if (context.focusMode) {
      indicators.push({
        type: 'tab_focus',
        strength: 0.9,
        timestamp: Date.now()
      });
    }
    
    if (context.recentActions.length > 0) {
      indicators.push({
        type: 'mouse_activity',
        strength: Math.min(1.0, context.recentActions.length / 10),
        timestamp: Date.now()
      });
    }
    
    const attentionLevel = this.calculateAttentionLevel(indicators);
    const confidence = this.calculateAttentionConfidence(indicators);
    
    const state: AttentionState = {
      level: attentionLevel,
      confidence,
      indicators,
      lastUpdate: Date.now(),
      predictedDuration: 5 * 60 * 1000 // 5 minutes default
    };
    
    this.attentionStates.set(userId, state);
    return state;
  }

  private calculateAttentionLevel(indicators: AttentionIndicator[]): 'focused' | 'partial' | 'distracted' | 'away' {
    if (indicators.length === 0) return 'away';
    
    const avgStrength = indicators.reduce((sum, i) => sum + i.strength, 0) / indicators.length;
    const recentActivity = indicators.filter(i => Date.now() - i.timestamp < 60000).length;
    
    if (avgStrength > 0.8 && recentActivity > 2) return 'focused';
    if (avgStrength > 0.5 && recentActivity > 0) return 'partial';
    if (recentActivity > 0) return 'distracted';
    return 'away';
  }

  private calculateAttentionConfidence(indicators: AttentionIndicator[]): number {
    if (indicators.length === 0) return 0.3;
    
    const recency = indicators.reduce((sum, i) => {
      const age = Date.now() - i.timestamp;
      return sum + Math.max(0, 1 - age / (5 * 60 * 1000)); // Decay over 5 minutes
    }, 0) / indicators.length;
    
    const diversity = new Set(indicators.map(i => i.type)).size / 5; // 5 possible types
    
    return Math.min(1.0, (recency + diversity) / 2);
  }

  private predictAttentionDuration(
    indicators: AttentionIndicator[],
    level: AttentionState['level']
  ): number {
    // Simplified prediction based on attention level
    const baseDurations = {
      focused: 15 * 60 * 1000,   // 15 minutes
      partial: 10 * 60 * 1000,   // 10 minutes
      distracted: 5 * 60 * 1000,  // 5 minutes
      away: 30 * 60 * 1000       // 30 minutes
    };
    
    return baseDurations[level];
  }

  private async getUserBehaviorPattern(userId: string): Promise<UserBehaviorPattern> {
    let pattern = this.userBehaviorPatterns.get(userId);
    
    if (!pattern) {
      pattern = this.initializeUserBehaviorPattern(userId);
      this.userBehaviorPatterns.set(userId, pattern);
    }
    
    return pattern;
  }

  private initializeUserBehaviorPattern(userId: string): UserBehaviorPattern {
    return {
      userId,
      patterns: {
        dailyActiveHours: [9, 10, 11, 12, 13, 14, 15, 16, 17], // Default business hours
        weeklyPattern: [0.3, 0.8, 0.9, 0.9, 0.9, 0.9, 0.4], // Lower on weekends
        responseTimeByCategory: new Map(),
        responseTimeByPriority: new Map(),
        preferredDeliveryMethods: new Map(),
        engagementByTimeOfDay: new Map(),
        dismissalPatterns: []
      },
      lastUpdated: Date.now(),
      confidenceLevel: 0.1 // Low initial confidence
    };
  }

  private async calculateOptimalTiming(
    notification: UnifiedNotification,
    context: NotificationContext,
    preferences: UserNotificationPreferences,
    attentionState: AttentionState,
    behaviorPattern: UserBehaviorPattern
  ): Promise<number> {
    let optimalTime = Date.now();
    
    // Critical notifications get immediate delivery
    if (notification.priority === 'critical' && this.config.urgencyOverrides) {
      return optimalTime;
    }
    
    // Consider user attention state
    if (attentionState.level === 'away' && notification.priority !== 'high') {
      optimalTime += attentionState.predictedDuration * 0.5; // Wait for user to return
    }
    
    // Consider user behavior patterns
    const currentHour = new Date().getHours();
    if (!behaviorPattern.patterns.dailyActiveHours.includes(currentHour)) {
      // Delay until next active hour
      const nextActiveHour = this.findNextActiveHour(currentHour, behaviorPattern);
      optimalTime = this.getNextHourTimestamp(nextActiveHour);
    }
    
    // Consider quiet hours
    if (preferences.quietHours && this.isInQuietHours(preferences.quietHours)) {
      if (notification.priority !== 'critical') {
        optimalTime = this.getQuietHoursEndTime(preferences.quietHours);
      }
    }
    
    // Apply minimum delivery interval
    const lastDeliveryTime = this.getLastDeliveryTime(context.userId);
    const minNextDelivery = lastDeliveryTime + this.config.minDeliveryInterval;
    optimalTime = Math.max(optimalTime, minNextDelivery);
    
    // Respect maximum delay
    const maxDeliveryTime = Date.now() + this.config.maxDeliveryDelay;
    optimalTime = Math.min(optimalTime, maxDeliveryTime);
    
    return optimalTime;
  }

  private async selectOptimalDeliveryMethod(
    notification: UnifiedNotification,
    context: NotificationContext,
    preferences: UserNotificationPreferences,
    attentionState: AttentionState,
    behaviorPattern: UserBehaviorPattern
  ): Promise<DeliveryMethod> {
    // Check user preferences first
    const categoryPrefs = preferences.categories[notification.category];
    if (categoryPrefs?.deliveryMethods?.length > 0) {
      return categoryPrefs.deliveryMethods[0];
    }
    
    // Critical notifications use most prominent method
    if (notification.priority === 'critical') {
      return attentionState.level === 'focused' ? 'dynamic-island' : 'modal';
    }
    
    // Adapt based on attention state
    switch (attentionState.level) {
      case 'focused':
        return notification.priority === 'high' ? 'dynamic-island' : 'toast';
      case 'partial':
        return 'toast';
      case 'distracted':
        return notification.priority === 'high' ? 'badge' : 'silent';
      case 'away':
        return 'badge';
    }
  }

  private async generateAlternativeOptions(
    notification: UnifiedNotification,
    context: NotificationContext,
    preferences: UserNotificationPreferences,
    attentionState: AttentionState
  ): Promise<DeliveryOption[]> {
    const options: DeliveryOption[] = [];
    const methods: DeliveryMethod[] = ['dynamic-island', 'toast', 'modal', 'badge', 'silent'];
    
    for (const method of methods) {
      const score = this.scoreDeliveryMethod(method, notification, attentionState);
      const timing = Date.now() + (method === 'silent' ? 0 : 30000); // Delay for non-silent
      
      options.push({
        method,
        timing,
        score,
        pros: this.getMethodPros(method, notification, attentionState),
        cons: this.getMethodCons(method, notification, attentionState)
      });
    }
    
    return options.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  private scoreDeliveryMethod(
    method: DeliveryMethod,
    notification: UnifiedNotification,
    attentionState: AttentionState
  ): number {
    let score = 50; // Base score
    
    // Priority adjustments
    const priorityScores = { critical: 90, high: 70, medium: 50, low: 30 };
    score += (priorityScores[notification.priority] - 50) * 0.5;
    
    // Attention state adjustments
    const attentionBonus = {
      focused: { 'dynamic-island': 20, toast: 15, modal: -10 },
      partial: { toast: 20, 'dynamic-island': 10, badge: 5 },
      distracted: { badge: 15, silent: 10, toast: -5 },
      away: { badge: 20, silent: 15, toast: -10 }
    };
    
    score += attentionBonus[attentionState.level]?.[method] || 0;
    
    return Math.max(0, Math.min(100, score));
  }

  private getMethodPros(
    method: DeliveryMethod,
    notification: UnifiedNotification,
    attentionState: AttentionState
  ): string[] {
    const pros: Record<DeliveryMethod, string[]> = {
      'dynamic-island': ['Highly visible', 'Interactive', 'Modern UX'],
      'toast': ['Non-intrusive', 'Auto-dismiss', 'Good visibility'],
      'modal': ['Guaranteed attention', 'Action required', 'Clear message'],
      'badge': ['Persistent', 'Low interruption', 'Cumulative info'],
      'silent': ['Zero interruption', 'Background processing', 'Batch friendly'],
      'command-palette': ['Contextual', 'User-initiated', 'Organized'],
      'push': ['Works offline', 'System native', 'High reach']
    };
    
    return pros[method] || [];
  }

  private getMethodCons(
    method: DeliveryMethod,
    notification: UnifiedNotification,
    attentionState: AttentionState
  ): string[] {
    const cons: Record<DeliveryMethod, string[]> = {
      'dynamic-island': ['Requires modern browser', 'Can be missed'],
      'toast': ['Temporary', 'Can be dismissed quickly'],
      'modal': ['Highly intrusive', 'Blocks workflow'],
      'badge': ['Easy to ignore', 'No immediate action'],
      'silent': ['No immediate awareness', 'Delay in response'],
      'command-palette': ['Requires user action', 'Not immediate'],
      'push': ['Permission required', 'Platform dependent']
    };
    
    return cons[method] || [];
  }

  private calculateOptimizationConfidence(
    notification: UnifiedNotification,
    context: NotificationContext,
    behaviorPattern: UserBehaviorPattern,
    attentionState: AttentionState
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence with more behavior data
    confidence += behaviorPattern.confidenceLevel * 0.3;
    
    // Higher confidence with recent attention data
    confidence += attentionState.confidence * 0.2;
    
    // Lower confidence for edge cases
    if (notification.priority === 'critical') confidence += 0.2;
    if (context.isExecutiveMode) confidence += 0.1;
    
    return Math.min(1.0, Math.max(0.1, confidence));
  }

  private async predictEngagement(
    notification: UnifiedNotification,
    context: NotificationContext,
    behaviorPattern: UserBehaviorPattern,
    attentionState: AttentionState,
    deliveryMethod: DeliveryMethod
  ): Promise<number> {
    let engagement = 0.5; // Base engagement
    
    // Adjust based on attention state
    const attentionMultiplier = {
      focused: 0.9,
      partial: 0.7,
      distracted: 0.4,
      away: 0.2
    };
    engagement *= attentionMultiplier[attentionState.level];
    
    // Adjust based on delivery method effectiveness
    const methodMultiplier = {
      'dynamic-island': 0.8,
      'toast': 0.7,
      'modal': 0.9,
      'badge': 0.4,
      'silent': 0.1
    };
    engagement *= methodMultiplier[deliveryMethod] || 0.5;
    
    // Adjust based on historical engagement
    const hourlyEngagement = behaviorPattern.patterns.engagementByTimeOfDay.get(
      new Date().getHours()
    );
    if (hourlyEngagement !== undefined) {
      engagement = (engagement + hourlyEngagement) / 2;
    }
    
    return Math.min(1.0, Math.max(0.0, engagement));
  }

  private generateOptimizationReasoning(
    notification: UnifiedNotification,
    context: NotificationContext,
    attentionState: AttentionState,
    behaviorPattern: UserBehaviorPattern,
    optimalTiming: number
  ): OptimizationReasoning[] {
    const reasoning: OptimizationReasoning[] = [];
    
    if (optimalTiming > Date.now()) {
      reasoning.push({
        factor: 'Timing Optimization',
        impact: 'positive',
        weight: 0.3,
        description: `Delayed delivery to improve user engagement based on ${attentionState.level} attention state`
      });
    }
    
    if (attentionState.confidence > 0.7) {
      reasoning.push({
        factor: 'Attention Analysis',
        impact: 'positive',
        weight: 0.4,
        description: `High confidence (${Math.round(attentionState.confidence * 100)}%) in attention state analysis`
      });
    }
    
    if (behaviorPattern.confidenceLevel > 0.5) {
      reasoning.push({
        factor: 'Behavior Learning',
        impact: 'positive',
        weight: 0.3,
        description: `Leveraging learned user behavior patterns with ${Math.round(behaviorPattern.confidenceLevel * 100)}% confidence`
      });
    }
    
    return reasoning;
  }

  private createFallbackStrategies(
    notification: UnifiedNotification,
    context: NotificationContext,
    deliveryMethod: DeliveryMethod
  ): FallbackStrategy[] {
    const strategies: FallbackStrategy[] = [];
    
    // Retry strategy for failed deliveries
    strategies.push({
      condition: 'delivery_failed',
      action: 'retry',
      parameters: { delay: 60000, alternativeMethod: 'toast' },
      maxAttempts: 3
    });
    
    // Escalation for critical notifications
    if (notification.priority === 'critical') {
      strategies.push({
        condition: 'no_user_response_5min',
        action: 'escalate',
        parameters: { method: 'modal', sound: true },
        maxAttempts: 2
      });
    }
    
    // Redirect for overloaded methods
    strategies.push({
      condition: 'method_overloaded',
      action: 'redirect',
      parameters: { fallbackMethods: ['toast', 'badge'] },
      maxAttempts: 1
    });
    
    return strategies;
  }

  // Helper methods (simplified implementations)
  
  private groupByTimeWindows(
    optimizations: DeliveryOptimization[],
    windowSize: number
  ): Map<number, DeliveryOptimization[]> {
    const windows = new Map<number, DeliveryOptimization[]>();
    
    for (const optimization of optimizations) {
      const windowStart = Math.floor(optimization.optimizedDeliveryTime / windowSize) * windowSize;
      
      if (!windows.has(windowStart)) {
        windows.set(windowStart, []);
      }
      
      windows.get(windowStart)!.push(optimization);
    }
    
    return windows;
  }

  private prioritizeWithinWindow(optimizations: DeliveryOptimization[]): DeliveryOptimization[] {
    return optimizations.sort((a, b) => {
      // Sort by estimated engagement * confidence
      const scoreA = a.estimatedEngagement * a.confidence;
      const scoreB = b.estimatedEngagement * b.confidence;
      return scoreB - scoreA;
    });
  }

  private async rescheduleDeferred(
    deferred: DeliveryOptimization[],
    originalWindow: number
  ): Promise<DeliveryOptimization[]> {
    const rescheduled = deferred.map((opt, index) => ({
      ...opt,
      optimizedDeliveryTime: originalWindow + (index + 1) * 5 * 60 * 1000, // 5-minute intervals
      reasoning: [
        ...opt.reasoning,
        {
          factor: 'Load Balancing',
          impact: 'neutral' as const,
          weight: 0.2,
          description: 'Rescheduled due to delivery load constraints'
        }
      ]
    }));
    
    return rescheduled;
  }

  private findNextActiveHour(currentHour: number, pattern: UserBehaviorPattern): number {
    const activeHours = pattern.patterns.dailyActiveHours;
    
    // Find next active hour today
    for (let hour = currentHour + 1; hour < 24; hour++) {
      if (activeHours.includes(hour)) {
        return hour;
      }
    }
    
    // Return first active hour of next day
    return activeHours[0] || 9;
  }

  private getNextHourTimestamp(hour: number): number {
    const now = new Date();
    const nextTime = new Date(now);
    
    if (hour <= now.getHours()) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
    
    nextTime.setHours(hour, 0, 0, 0);
    return nextTime.getTime();
  }

  private isInQuietHours(quietHours: { start: string; end: string }): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMinute] = quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = quietHours.end.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  private getQuietHoursEndTime(quietHours: { start: string; end: string }): number {
    const now = new Date();
    const [endHour, endMinute] = quietHours.end.split(':').map(Number);
    
    const endTime = new Date(now);
    endTime.setHours(endHour, endMinute, 0, 0);
    
    if (endTime <= now) {
      endTime.setDate(endTime.getDate() + 1);
    }
    
    return endTime.getTime();
  }

  private getLastDeliveryTime(userId: string): number {
    // Stub - would query actual delivery history
    return Date.now() - (2 * 60 * 1000); // 2 minutes ago
  }

  private calculatePatternConfidence(pattern: UserBehaviorPattern): number {
    // Simplified confidence calculation
    const dataAge = Date.now() - pattern.lastUpdated;
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    return Math.max(0.1, 1 - dataAge / maxAge);
  }

  private updateResponseTimePatterns(
    pattern: UserBehaviorPattern,
    notification: UnifiedNotification,
    responseTime: number
  ): void {
    const categoryTimes = pattern.patterns.responseTimeByCategory;
    const priorityTimes = pattern.patterns.responseTimeByPriority;
    
    // Update category response time (exponential moving average)
    const currentCategoryTime = categoryTimes.get(notification.category) || responseTime;
    const newCategoryTime = currentCategoryTime * 0.8 + responseTime * 0.2;
    categoryTimes.set(notification.category, newCategoryTime);
    
    // Update priority response time
    const currentPriorityTime = priorityTimes.get(notification.priority) || responseTime;
    const newPriorityTime = currentPriorityTime * 0.8 + responseTime * 0.2;
    priorityTimes.set(notification.priority, newPriorityTime);
  }

  private updateEngagementPatterns(
    pattern: UserBehaviorPattern,
    notification: UnifiedNotification,
    outcome: DeliveryOutcome,
    optimization: DeliveryOptimization
  ): void {
    const hour = new Date(outcome.timestamp).getHours();
    const engagementByHour = pattern.patterns.engagementByTimeOfDay;
    
    const engagement = outcome.action === 'action-taken' ? 1.0 :
                      outcome.action === 'clicked' ? 0.8 :
                      outcome.action === 'viewed' ? 0.5 : 0.0;
    
    const currentEngagement = engagementByHour.get(hour) || 0.5;
    const newEngagement = currentEngagement * 0.9 + engagement * 0.1;
    engagementByHour.set(hour, newEngagement);
  }

  private updateDismissalPatterns(
    pattern: UserBehaviorPattern,
    notification: UnifiedNotification,
    outcome: DeliveryOutcome
  ): void {
    const hour = new Date(outcome.timestamp).getHours();
    const dismissalPatterns = pattern.patterns.dismissalPatterns;
    
    // Find or create dismissal pattern for this category and time
    let dismissalPattern = dismissalPatterns.find(p => 
      p.category === notification.category &&
      hour >= p.timeWindow.start && hour <= p.timeWindow.end
    );
    
    if (!dismissalPattern) {
      dismissalPattern = {
        category: notification.category,
        timeWindow: { start: hour, end: hour },
        dismissalRate: 1.0,
        reasons: ['User dismissed notification']
      };
      dismissalPatterns.push(dismissalPattern);
    } else {
      // Update dismissal rate (exponential moving average)
      dismissalPattern.dismissalRate = dismissalPattern.dismissalRate * 0.9 + 1.0 * 0.1;
    }
  }

  private updateDeliveryMethodPreferences(
    pattern: UserBehaviorPattern,
    notification: UnifiedNotification,
    outcome: DeliveryOutcome,
    optimization: DeliveryOptimization
  ): void {
    const methodPrefs = pattern.patterns.preferredDeliveryMethods;
    
    if (outcome.action === 'action-taken' || outcome.action === 'clicked') {
      // Positive outcome - reinforce this method for this category
      const currentMethods = methodPrefs.get(notification.category) || [];
      if (!currentMethods.includes(optimization.selectedMethod)) {
        currentMethods.unshift(optimization.selectedMethod);
        methodPrefs.set(notification.category, currentMethods.slice(0, 3)); // Keep top 3
      }
    }
  }
}

// Supporting interfaces
interface DeliveryQueueItem {
  optimization: DeliveryOptimization;
  notification: UnifiedNotification;
  context: NotificationContext;
  attempts: number;
  lastAttempt?: number;
}

interface DeliveryMetrics {
  userId: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  averageResponseTime: number;
  engagementRate: number;
  dismissalRate: number;
  methodEffectiveness: Map<DeliveryMethod, number>;
}

interface DeliveryOutcome {
  userId: string;
  timestamp: number;
  action: 'viewed' | 'clicked' | 'dismissed' | 'action-taken' | 'expired';
  responseTime?: number; // milliseconds from delivery to action
  deliveryMethod: DeliveryMethod;
}

// Create singleton instance for export
const deliveryOptimizationInstance = new NotificationDeliveryOptimization();

// Export convenience functions
export const optimizeDelivery = async (
  notification: UnifiedNotification,
  context: DeliveryContext
): Promise<{ method: DeliveryMethod; shouldDefer: boolean; timing: number }> => {
  return await deliveryOptimizationInstance.optimizeDelivery(notification, context);
};

export const updateUserAttention = async (
  action: string,
  context: DeliveryContext
): Promise<void> => {
  return await deliveryOptimizationInstance.updateUserAttention(action, context);
};

export default NotificationDeliveryOptimization;