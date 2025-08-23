/**
 * Context Intelligence Engine
 * Analyzes user context and provides intelligent recommendations for notification delivery
 */

import { IxTime } from '~/lib/ixtime';
import type {
  NotificationContext,
  UnifiedNotification,
  DeliveryMethod,
  NotificationPriority,
  NotificationCategory,
  UserNotificationPreferences,
  NotificationEngagement,
} from '~/types/unified-notifications';

// Context analysis results
interface ContextAnalysis {
  userState: UserState;
  environmentalFactors: EnvironmentalFactors;
  recommendedDeliveryMethod: DeliveryMethod;
  urgencyMultiplier: number; // 0.1 - 2.0
  suppressionRecommendation: SuppressionRecommendation;
  contextualRelevance: number; // 0-100
}

interface UserState {
  focusLevel: FocusLevel;
  activityPattern: ActivityPattern;
  currentEngagement: EngagementLevel;
  sessionContext: SessionContext;
  cognitiveLoad: CognitiveLoad;
}

interface EnvironmentalFactors {
  timeOfDay: TimeContext;
  dayOfWeek: DayContext;
  ixTimeContext: IxTimeContext;
  systemLoad: SystemLoad;
  networkCondition: NetworkCondition;
}

interface SuppressionRecommendation {
  shouldSuppress: boolean;
  reason: string;
  alternativeDeliveryTime?: number;
  batchingRecommendation?: BatchingRecommendation;
}

interface BatchingRecommendation {
  shouldBatch: boolean;
  batchWith: string[]; // Categories to batch with
  maxBatchSize: number;
  batchWindow: number; // milliseconds
}

type FocusLevel = 'deep-work' | 'focused' | 'normal' | 'browsing' | 'distracted';
type ActivityPattern = 'highly-active' | 'active' | 'moderate' | 'passive' | 'idle';
type EngagementLevel = 'high' | 'medium' | 'low' | 'disengaged';
type CognitiveLoad = 'overloaded' | 'high' | 'moderate' | 'low' | 'available';
type TimeContext = 'deep-work-hours' | 'business-hours' | 'evening' | 'night' | 'early-morning';
type DayContext = 'weekday' | 'weekend' | 'holiday';
type SystemLoad = 'heavy' | 'moderate' | 'light';
type NetworkCondition = 'excellent' | 'good' | 'poor' | 'offline';

interface SessionContext {
  duration: number; // milliseconds
  pageViews: number;
  actionCount: number;
  lastInteraction: number;
  routeStability: number; // How long on current route
}

interface IxTimeContext {
  currentGameYear: number;
  timeMultiplier: number;
  recentTimeChanges: boolean;
  gameEventsActive: boolean;
}

// Learning data storage
interface UserBehaviorPattern {
  userId: string;
  preferredDeliveryTimes: number[]; // Hours of day
  responseTimes: Map<DeliveryMethod, number[]>; // Response times in ms
  dismissalPatterns: Map<NotificationCategory, number>; // Dismissal rate by category
  contextualPreferences: Map<string, DeliveryMethod>; // Context -> preferred method
  lastUpdated: number;
}

export class ContextIntelligenceEngine {
  private userPatterns: Map<string, UserBehaviorPattern> = new Map();
  private contextHistory: Map<string, NotificationContext[]> = new Map();
  private engagementHistory: Map<string, NotificationEngagement[]> = new Map();
  private readonly LEARNING_WINDOW = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly MIN_SAMPLES_FOR_LEARNING = 10;

  constructor() {
    console.log('[ContextIntelligenceEngine] Initialized');
  }

  /**
   * Analyze context and provide recommendations for notification delivery
   */
  async analyzeContext(
    notification: UnifiedNotification,
    context: NotificationContext,
    userPreferences: UserNotificationPreferences
  ): Promise<ContextAnalysis> {
    const userState = this.analyzeUserState(context);
    const environmentalFactors = this.analyzeEnvironmentalFactors(context);
    
    const contextualRelevance = this.calculateContextualRelevance(
      notification,
      context,
      userState,
      environmentalFactors
    );

    const recommendedDeliveryMethod = this.recommendDeliveryMethod(
      notification,
      context,
      userState,
      environmentalFactors,
      userPreferences
    );

    const urgencyMultiplier = this.calculateUrgencyMultiplier(
      notification,
      userState,
      environmentalFactors
    );

    const suppressionRecommendation = this.evaluateSuppressionNeed(
      notification,
      context,
      userState,
      environmentalFactors
    );

    return {
      userState,
      environmentalFactors,
      recommendedDeliveryMethod,
      urgencyMultiplier,
      suppressionRecommendation,
      contextualRelevance,
    };
  }

  /**
   * Record user engagement for learning
   */
  recordEngagement(
    notification: UnifiedNotification,
    context: NotificationContext,
    engagement: NotificationEngagement
  ) {
    const userId = context.userId;
    
    // Store engagement history
    if (!this.engagementHistory.has(userId)) {
      this.engagementHistory.set(userId, []);
    }
    this.engagementHistory.get(userId)!.push(engagement);

    // Update user behavior patterns
    this.updateUserBehaviorPattern(userId, notification, context, engagement);

    // Store context history
    if (!this.contextHistory.has(userId)) {
      this.contextHistory.set(userId, []);
    }
    this.contextHistory.get(userId)!.push({ ...context });

    // Cleanup old data
    this.cleanupOldData(userId);
  }

  /**
   * Get learned preferences for a user
   */
  getLearnedPreferences(userId: string): Partial<UserNotificationPreferences> | null {
    const pattern = this.userPatterns.get(userId);
    if (!pattern || !this.hasEnoughDataForLearning(pattern)) {
      return null;
    }

    // Convert learned patterns to preferences
    const learnedPreferences: Partial<UserNotificationPreferences> = {
      preferredMethods: this.extractPreferredMethods(pattern),
      categories: this.extractCategoryPreferences(pattern),
    };

    return learnedPreferences;
  }

  // Private analysis methods

  private analyzeUserState(context: NotificationContext): UserState {
    const focusLevel = this.determineFocusLevel(context);
    const activityPattern = this.determineActivityPattern(context);
    const currentEngagement = this.determineEngagementLevel(context);
    const sessionContext = this.analyzeSessionContext(context);
    const cognitiveLoad = this.assessCognitiveLoad(context, sessionContext);

    return {
      focusLevel,
      activityPattern,
      currentEngagement,
      sessionContext,
      cognitiveLoad,
    };
  }

  private determineFocusLevel(context: NotificationContext): FocusLevel {
    const { recentActions, sessionDuration, currentRoute } = context;
    
    // Deep work indicators
    if (sessionDuration > 30 * 60 * 1000 && // 30+ minutes
        recentActions.length < 5 && // Few actions
        currentRoute.includes('executive')) {
      return 'deep-work';
    }

    // Focused work indicators
    if (recentActions.length < 10 && sessionDuration > 10 * 60 * 1000) {
      return 'focused';
    }

    // Distracted indicators
    if (recentActions.length > 20 && recentActions.includes('tab-switch')) {
      return 'distracted';
    }

    // Browsing indicators
    if (recentActions.includes('navigation') || recentActions.includes('search')) {
      return 'browsing';
    }

    return 'normal';
  }

  private determineActivityPattern(context: NotificationContext): ActivityPattern {
    const actionCount = context.recentActions.length;
    const timeWindow = 10 * 60 * 1000; // 10 minutes
    
    if (actionCount > 30) return 'highly-active';
    if (actionCount > 20) return 'active';
    if (actionCount > 10) return 'moderate';
    if (actionCount > 0) return 'passive';
    return 'idle';
  }

  private determineEngagementLevel(context: NotificationContext): EngagementLevel {
    const lastInteractionAge = Date.now() - (context.sessionDuration - 60000);
    
    if (lastInteractionAge < 30000) return 'high'; // Active in last 30s
    if (lastInteractionAge < 120000) return 'medium'; // Active in last 2min
    if (lastInteractionAge < 300000) return 'low'; // Active in last 5min
    return 'disengaged';
  }

  private analyzeSessionContext(context: NotificationContext): SessionContext {
    return {
      duration: context.sessionDuration,
      pageViews: context.recentActions.filter(a => a === 'navigation').length,
      actionCount: context.recentActions.length,
      lastInteraction: Date.now() - 60000, // Simplified
      routeStability: this.calculateRouteStability(context),
    };
  }

  private calculateRouteStability(context: NotificationContext): number {
    // Simplified route stability calculation
    const navigationActions = context.recentActions.filter(a => a === 'navigation').length;
    return Math.max(0, 10 - navigationActions) * 10; // 0-100 score
  }

  private assessCognitiveLoad(
    context: NotificationContext,
    sessionContext: SessionContext
  ): CognitiveLoad {
    let loadScore = 0;

    // High activity increases load
    if (sessionContext.actionCount > 20) loadScore += 30;
    
    // Multiple tabs/features increase load
    if (context.activeFeatures.length > 3) loadScore += 20;
    
    // Executive mode increases load
    if (context.isExecutiveMode) loadScore += 15;
    
    // Recent page changes increase load
    if (sessionContext.pageViews > 5) loadScore += 20;
    
    // Low route stability increases load
    if (sessionContext.routeStability < 50) loadScore += 15;

    if (loadScore > 80) return 'overloaded';
    if (loadScore > 60) return 'high';
    if (loadScore > 40) return 'moderate';
    if (loadScore > 20) return 'low';
    return 'available';
  }

  private analyzeEnvironmentalFactors(context: NotificationContext): EnvironmentalFactors {
    const timeOfDay = this.analyzeTimeOfDay();
    const dayOfWeek = this.analyzeDayOfWeek();
    const ixTimeContext = this.analyzeIxTimeContext(context);
    const systemLoad = this.assessSystemLoad(context);
    const networkCondition = this.assessNetworkCondition(context);

    return {
      timeOfDay,
      dayOfWeek,
      ixTimeContext,
      systemLoad,
      networkCondition,
    };
  }

  private analyzeTimeOfDay(): TimeContext {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 9) return 'early-morning';
    if (hour >= 9 && hour < 12) return 'deep-work-hours';
    if (hour >= 12 && hour < 17) return 'business-hours';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  private analyzeDayOfWeek(): DayContext {
    const day = new Date().getDay();
    return (day === 0 || day === 6) ? 'weekend' : 'weekday';
  }

  private analyzeIxTimeContext(context: NotificationContext): IxTimeContext {
    return {
      currentGameYear: IxTime.getCurrentGameYear(),
      timeMultiplier: context.timeMultiplier,
      recentTimeChanges: Math.abs(context.timeMultiplier - 4) > 0.1,
      gameEventsActive: context.timeMultiplier > 6, // High time acceleration suggests events
    };
  }

  private assessSystemLoad(context: NotificationContext): SystemLoad {
    // Simplified system load assessment
    const featureCount = context.activeFeatures.length;
    
    if (featureCount > 5) return 'heavy';
    if (featureCount > 3) return 'moderate';
    return 'light';
  }

  private assessNetworkCondition(context: NotificationContext): NetworkCondition {
    // Simplified - in real implementation would check network APIs
    return 'good';
  }

  private calculateContextualRelevance(
    notification: UnifiedNotification,
    context: NotificationContext,
    userState: UserState,
    environmentalFactors: EnvironmentalFactors
  ): number {
    let relevance = 50; // Base relevance

    // Category-route matching
    const routeRelevance = this.calculateRouteRelevance(notification.category, context.currentRoute);
    relevance += routeRelevance * 0.3;

    // Executive mode relevance
    if (context.isExecutiveMode) {
      const executiveCategories = ['economic', 'governance', 'security', 'crisis'];
      if (executiveCategories.includes(notification.category)) {
        relevance += 20;
      }
    }

    // Time-based relevance
    const timeRelevance = this.calculateTimeRelevance(notification, environmentalFactors);
    relevance += timeRelevance * 0.2;

    // User state relevance
    const stateRelevance = this.calculateUserStateRelevance(notification, userState);
    relevance += stateRelevance * 0.2;

    // Priority boost
    const priorityBoost = {
      critical: 30,
      high: 20,
      medium: 10,
      low: 0,
    }[notification.priority];
    relevance += priorityBoost * 0.3;

    return Math.min(100, Math.max(0, relevance));
  }

  private calculateRouteRelevance(category: NotificationCategory, route: string): number {
    const routeMatches: Record<NotificationCategory, string[]> = {
      economic: ['mycountry', 'executive', 'economy', 'trade'],
      governance: ['mycountry', 'executive', 'admin', 'government'],
      diplomatic: ['executive', 'diplomatic', 'relations'],
      security: ['executive', 'security', 'crisis'],
      achievement: ['mycountry', 'achievements', 'rankings'],
      system: ['admin', 'settings'],
      social: ['mycountry', 'social', 'demographics'],
      crisis: ['executive', 'crisis', 'emergency'],
      opportunity: ['mycountry', 'opportunities', 'growth'],
    };

    const relevantRoutes = routeMatches[category] || [];
    return relevantRoutes.some((r: string) => route.includes(r)) ? 30 : 0;
  }

  private calculateTimeRelevance(
    notification: UnifiedNotification,
    factors: EnvironmentalFactors
  ): number {
    let relevance = 10;

    // Business hours boost for important notifications
    if (factors.timeOfDay === 'business-hours' && notification.priority === 'high') {
      relevance += 15;
    }

    // Evening boost for achievements
    if (factors.timeOfDay === 'evening' && notification.category === 'achievement') {
      relevance += 10;
    }

    // Night penalty for non-critical
    if (factors.timeOfDay === 'night' && notification.priority !== 'critical') {
      relevance -= 20;
    }

    return relevance;
  }

  private calculateUserStateRelevance(
    notification: UnifiedNotification,
    userState: UserState
  ): number {
    let relevance = 10;

    // Cognitive load adjustments
    if (userState.cognitiveLoad === 'overloaded' && notification.priority !== 'critical') {
      relevance -= 30;
    }

    if (userState.cognitiveLoad === 'available') {
      relevance += 15;
    }

    // Focus level adjustments
    if (userState.focusLevel === 'deep-work' && notification.priority !== 'critical') {
      relevance -= 25;
    }

    // Engagement level adjustments
    if (userState.currentEngagement === 'high') {
      relevance += 10;
    }

    return relevance;
  }

  private recommendDeliveryMethod(
    notification: UnifiedNotification,
    context: NotificationContext,
    userState: UserState,
    environmentalFactors: EnvironmentalFactors,
    userPreferences: UserNotificationPreferences
  ): DeliveryMethod {
    // Critical always gets dynamic island or modal
    if (notification.priority === 'critical') {
      return userState.focusLevel === 'deep-work' ? 'modal' : 'dynamic-island';
    }

    // Deep work mode - only silent or command-palette
    if (userState.focusLevel === 'deep-work' || userState.cognitiveLoad === 'overloaded') {
      return notification.priority === 'high' ? 'command-palette' : 'silent';
    }

    // Executive mode preferences
    if (context.isExecutiveMode) {
      const executiveCategories = ['economic', 'governance', 'security'];
      if (executiveCategories.includes(notification.category)) {
        return 'dynamic-island';
      }
    }

    // Use category preferences
    const categoryPrefs = userPreferences.categories[notification.category];
    if (categoryPrefs?.deliveryMethods.length > 0) {
      const method = categoryPrefs.deliveryMethods[0];
      if (method) return method;
    }

    // Default based on engagement level
    if (userState.currentEngagement === 'high') {
      return 'dynamic-island';
    }

    return 'toast';
  }

  private calculateUrgencyMultiplier(
    notification: UnifiedNotification,
    userState: UserState,
    environmentalFactors: EnvironmentalFactors
  ): number {
    let multiplier = 1.0;

    // Priority-based base multiplier
    const priorityMultipliers = {
      critical: 2.0,
      high: 1.5,
      medium: 1.0,
      low: 0.7,
    };
    multiplier = priorityMultipliers[notification.priority];

    // User state adjustments
    if (userState.cognitiveLoad === 'overloaded') {
      multiplier *= 0.5; // Reduce urgency when overloaded
    }

    if (userState.focusLevel === 'deep-work') {
      multiplier *= 0.3; // Significantly reduce during deep work
    }

    if (userState.currentEngagement === 'disengaged') {
      multiplier *= 1.2; // Increase urgency to re-engage
    }

    // Time-based adjustments
    if (environmentalFactors.timeOfDay === 'night') {
      multiplier *= 0.5; // Reduce urgency at night
    }

    // IxTime context adjustments
    if (environmentalFactors.ixTimeContext.recentTimeChanges) {
      multiplier *= 1.3; // Increase urgency during time changes
    }

    return Math.min(2.0, Math.max(0.1, multiplier));
  }

  private evaluateSuppressionNeed(
    notification: UnifiedNotification,
    context: NotificationContext,
    userState: UserState,
    environmentalFactors: EnvironmentalFactors
  ): SuppressionRecommendation {
    let shouldSuppress = false;
    let reason = '';
    let alternativeDeliveryTime: number | undefined;
    let batchingRecommendation: BatchingRecommendation | undefined;

    // Deep work suppression
    if (userState.focusLevel === 'deep-work' && notification.priority !== 'critical') {
      shouldSuppress = true;
      reason = 'User in deep work mode';
      alternativeDeliveryTime = Date.now() + (15 * 60 * 1000); // 15 minutes
    }

    // Cognitive overload suppression
    if (userState.cognitiveLoad === 'overloaded' && notification.priority === 'low') {
      shouldSuppress = true;
      reason = 'User cognitive load too high';
      alternativeDeliveryTime = Date.now() + (30 * 60 * 1000); // 30 minutes
    }

    // Night time suppression
    if (environmentalFactors.timeOfDay === 'night' && notification.priority === 'low') {
      shouldSuppress = true;
      reason = 'Night time - low priority notification';
      alternativeDeliveryTime = Date.now() + (8 * 60 * 60 * 1000); // 8 hours
    }

    // Batching recommendation
    const batchableCategories = ['achievement', 'system', 'opportunity'];
    if (batchableCategories.includes(notification.category) && !shouldSuppress) {
      batchingRecommendation = {
        shouldBatch: true,
        batchWith: [notification.category],
        maxBatchSize: 3,
        batchWindow: 2 * 60 * 1000, // 2 minutes
      };
    }

    return {
      shouldSuppress,
      reason,
      alternativeDeliveryTime,
      batchingRecommendation,
    };
  }

  // Learning and pattern recognition methods

  private updateUserBehaviorPattern(
    userId: string,
    notification: UnifiedNotification,
    context: NotificationContext,
    engagement: NotificationEngagement
  ) {
    let pattern = this.userPatterns.get(userId);
    
    if (!pattern) {
      pattern = {
        userId,
        preferredDeliveryTimes: [],
        responseTimes: new Map(),
        dismissalPatterns: new Map(),
        contextualPreferences: new Map(),
        lastUpdated: Date.now(),
      };
      this.userPatterns.set(userId, pattern);
    }

    // Update preferred delivery times
    const hour = new Date().getHours();
    if (engagement.action === 'clicked' || engagement.action === 'action-taken') {
      pattern.preferredDeliveryTimes.push(hour);
    }

    // Update response times
    if (engagement.timeToAction) {
      const method = notification.deliveryMethod;
      if (!pattern.responseTimes.has(method)) {
        pattern.responseTimes.set(method, []);
      }
      pattern.responseTimes.get(method)!.push(engagement.timeToAction);
    }

    // Update dismissal patterns
    if (engagement.action === 'dismissed') {
      const current = pattern.dismissalPatterns.get(notification.category) || 0;
      pattern.dismissalPatterns.set(notification.category, current + 1);
    }

    // Update contextual preferences
    const contextKey = `${context.isExecutiveMode ? 'exec' : 'public'}-${context.currentRoute}`;
    if (engagement.action === 'clicked') {
      pattern.contextualPreferences.set(contextKey, notification.deliveryMethod);
    }

    pattern.lastUpdated = Date.now();
  }

  private cleanupOldData(userId: string) {
    const cutoff = Date.now() - this.LEARNING_WINDOW;

    // Clean engagement history
    const engagements = this.engagementHistory.get(userId);
    if (engagements) {
      const filtered = engagements.filter(e => e.timestamp > cutoff);
      this.engagementHistory.set(userId, filtered);
    }

    // Clean context history
    const contexts = this.contextHistory.get(userId);
    if (contexts) {
      const filtered = contexts.filter(c => c.realTime > cutoff);
      this.contextHistory.set(userId, filtered);
    }
  }

  private hasEnoughDataForLearning(pattern: UserBehaviorPattern): boolean {
    const totalEngagements = Array.from(pattern.responseTimes.values())
      .reduce((sum, times) => sum + times.length, 0);
    
    return totalEngagements >= this.MIN_SAMPLES_FOR_LEARNING;
  }

  private extractPreferredMethods(pattern: UserBehaviorPattern): DeliveryMethod[] {
    const methodScores = new Map<DeliveryMethod, number>();

    // Score methods based on response times (lower is better)
    for (const [method, times] of pattern.responseTimes) {
      const avgResponseTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const score = Math.max(0, 10000 - avgResponseTime); // 10 seconds baseline
      methodScores.set(method, score * times.length); // Weight by sample size
    }

    // Sort by score
    const sorted = Array.from(methodScores.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([method]) => method);

    return sorted.slice(0, 3); // Top 3 methods
  }

  private extractCategoryPreferences(pattern: UserBehaviorPattern): any {
    // Convert dismissal patterns to category preferences
    const preferences: any = {};
    
    for (const [category, dismissals] of pattern.dismissalPatterns) {
      const engagementCount = this.getTotalEngagementsForCategory(pattern, category);
      const dismissalRate = engagementCount > 0 ? dismissals / engagementCount : 0;
      
      preferences[category] = {
        enabled: dismissalRate < 0.7, // Disable if >70% dismissal rate
        minPriority: dismissalRate > 0.5 ? 'high' : 'medium',
      };
    }

    return preferences;
  }

  private getTotalEngagementsForCategory(pattern: UserBehaviorPattern, category: NotificationCategory): number {
    // Simplified - would need more sophisticated tracking in practice
    return 10; // Placeholder
  }
}

// Singleton instance
let intelligenceEngineInstance: ContextIntelligenceEngine | null = null;

/**
 * Get the singleton context intelligence engine instance
 */
export function getContextIntelligenceEngine(): ContextIntelligenceEngine {
  if (!intelligenceEngineInstance) {
    intelligenceEngineInstance = new ContextIntelligenceEngine();
  }
  return intelligenceEngineInstance;
}

export default ContextIntelligenceEngine;