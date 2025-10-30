/**
 * Enhanced Notification Priority System
 * Advanced priority calculation, categorization, and intelligent routing
 */

import { IxTime } from "~/lib/ixtime";
import type {
  UnifiedNotification,
  NotificationContext,
  NotificationPriority,
  NotificationCategory,
  NotificationSeverity,
  UserNotificationPreferences,
  NotificationEngagement,
} from "~/types/unified-notifications";

// Enhanced priority scoring with contextual intelligence
export interface EnhancedPriorityScore {
  finalScore: number;
  breakdown: {
    basePriority: number;
    contextualBoost: number;
    urgencyMultiplier: number;
    userRelevance: number;
    temporalFactor: number;
    engagementHistory: number;
  };
  reasoning: string[];
  recommendedDelivery: string;
  suppressionRisk: number; // 0-1, higher = more likely to be ignored
}

// Contextual priority factors
interface ContextualFactors {
  isWorkingHours: boolean;
  isExecutiveSession: boolean;
  userActivity: "high" | "medium" | "low";
  relevantPageFocus: boolean;
  deviceAttention: "focused" | "background" | "away";
  recentNotificationLoad: number;
  criticalSystemEvents: string[];
}

// Notification clustering for intelligent grouping
export interface NotificationCluster {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  notifications: UnifiedNotification[];
  aggregatedScore: number;
  representativeNotification: UnifiedNotification;
  batchingStrategy: "immediate" | "delayed" | "scheduled";
  deliveryWindow: { start: number; end: number };
}

export class EnhancedNotificationPriority {
  private engagementHistory: Map<string, NotificationEngagement[]> = new Map();
  private contextualCache: Map<string, ContextualFactors> = new Map();
  private clusteringRules: Map<NotificationCategory, ClusteringRule> = new Map();

  constructor() {
    this.initializeClusteringRules();
  }

  /**
   * Calculate enhanced priority score with contextual intelligence
   */
  async calculateEnhancedPriority(
    notification: UnifiedNotification,
    context: NotificationContext,
    userPreferences: UserNotificationPreferences
  ): Promise<EnhancedPriorityScore> {
    const contextualFactors = await this.analyzeContextualFactors(context);
    const userEngagement = this.getUserEngagementProfile(context.userId);

    // Base priority scoring (0-100)
    const basePriority = this.calculateBasePriorityScore(notification);

    // Contextual boost based on current situation (0-50)
    const contextualBoost = this.calculateContextualBoost(notification, context, contextualFactors);

    // Urgency multiplier based on time sensitivity (0.5-2.0)
    const urgencyMultiplier = this.calculateUrgencyMultiplier(notification, contextualFactors);

    // User relevance based on preferences and history (0-30)
    const userRelevance = this.calculateUserRelevance(
      notification,
      userPreferences,
      userEngagement
    );

    // Temporal factor based on IxTime context (0-20)
    const temporalFactor = this.calculateTemporalFactor(notification, context);

    // Engagement history influence (-10 to +10)
    const engagementHistory = this.calculateEngagementInfluence(notification, userEngagement);

    // Calculate final score
    const finalScore = Math.min(
      100,
      Math.max(
        0,
        (basePriority + contextualBoost + userRelevance + temporalFactor + engagementHistory) *
          urgencyMultiplier
      )
    );

    // Generate reasoning
    const reasoning = this.generatePriorityReasoning(
      notification,
      {
        basePriority,
        contextualBoost,
        urgencyMultiplier,
        userRelevance,
        temporalFactor,
        engagementHistory,
      },
      contextualFactors
    );

    // Recommend delivery method
    const recommendedDelivery = this.recommendDeliveryMethod(
      finalScore,
      contextualFactors,
      userPreferences
    );

    // Calculate suppression risk
    const suppressionRisk = this.calculateSuppressionRisk(
      finalScore,
      userEngagement,
      contextualFactors
    );

    return {
      finalScore,
      breakdown: {
        basePriority,
        contextualBoost,
        urgencyMultiplier,
        userRelevance,
        temporalFactor,
        engagementHistory,
      },
      reasoning,
      recommendedDelivery,
      suppressionRisk,
    };
  }

  /**
   * Intelligent notification grouping and batching
   */
  async createNotificationClusters(
    notifications: UnifiedNotification[],
    context: NotificationContext
  ): Promise<NotificationCluster[]> {
    const clusters: Map<string, NotificationCluster> = new Map();

    for (const notification of notifications) {
      const clusterKey = this.generateClusterKey(notification, context);

      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, {
          id: `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          category: notification.category,
          priority: notification.priority,
          notifications: [],
          aggregatedScore: 0,
          representativeNotification: notification,
          batchingStrategy: "immediate",
          deliveryWindow: { start: Date.now(), end: Date.now() + 5 * 60 * 1000 }, // 5 min default
        });
      }

      const cluster = clusters.get(clusterKey)!;
      cluster.notifications.push(notification);

      // Update representative notification (highest relevance)
      if (notification.relevanceScore > cluster.representativeNotification.relevanceScore) {
        cluster.representativeNotification = notification;
      }

      // Recalculate aggregated score
      cluster.aggregatedScore = this.calculateClusterScore(cluster);

      // Determine batching strategy
      cluster.batchingStrategy = this.determineBatchingStrategy(cluster, context);

      // Update delivery window
      cluster.deliveryWindow = this.calculateDeliveryWindow(cluster, context);
    }

    return Array.from(clusters.values()).sort((a, b) => b.aggregatedScore - a.aggregatedScore);
  }

  /**
   * Context-aware delivery optimization
   */
  optimizeDeliveryTiming(
    clusters: NotificationCluster[],
    context: NotificationContext,
    userPreferences: UserNotificationPreferences
  ): NotificationCluster[] {
    const contextualFactors = this.contextualCache.get(context.userId);
    if (!contextualFactors) return clusters;

    return clusters.map((cluster) => {
      // Adjust delivery timing based on context
      if (contextualFactors.deviceAttention === "away" && cluster.priority !== "critical") {
        // Delay non-critical notifications until user returns
        cluster.deliveryWindow.start = Math.max(
          cluster.deliveryWindow.start,
          Date.now() + 15 * 60 * 1000 // 15 min delay
        );
      }

      if (contextualFactors.recentNotificationLoad > 5 && cluster.priority === "low") {
        // Batch low priority notifications to reduce noise
        cluster.batchingStrategy = "delayed";
        cluster.deliveryWindow.start = Math.max(
          cluster.deliveryWindow.start,
          Date.now() + 30 * 60 * 1000 // 30 min delay
        );
      }

      if (userPreferences.quietHours && this.isInQuietHours(userPreferences.quietHours)) {
        if (cluster.priority !== "critical") {
          // Delay until quiet hours end
          const now = new Date();
          const quietEnd = new Date();
          const [endHour, endMinute] = userPreferences.quietHours.end.split(":").map(Number);
          if (endHour !== undefined && endMinute !== undefined) {
            quietEnd.setHours(endHour, endMinute, 0, 0);
          }

          if (now < quietEnd) {
            cluster.deliveryWindow.start = Math.max(
              cluster.deliveryWindow.start,
              quietEnd.getTime()
            );
          }
        }
      }

      return cluster;
    });
  }

  // Private helper methods

  private calculateBasePriorityScore(notification: UnifiedNotification): number {
    const priorityScores: Record<NotificationPriority, number> = {
      critical: 90,
      high: 70,
      medium: 50,
      low: 30,
    };

    const severityModifier: Record<NotificationSeverity, number> = {
      urgent: 10,
      important: 5,
      informational: 0,
      info: 0,
    };

    const categoryModifier: Record<NotificationCategory, number> = {
      crisis: 15,
      security: 12,
      achievement: 8,
      economic: 6,
      diplomatic: 4,
      governance: 4,
      social: 2,
      system: 1,
      opportunity: 3,
      policy: 5,
      intelligence: 7,
      global: 2,
      military: 10,
    };

    return (
      (priorityScores[notification.priority] || 30) +
      (severityModifier[notification.severity] || 0) +
      (categoryModifier[notification.category] || 0)
    );
  }

  private calculateContextualBoost(
    notification: UnifiedNotification,
    context: NotificationContext,
    factors: ContextualFactors
  ): number {
    let boost = 0;

    // Executive mode boost for relevant categories
    if (factors.isExecutiveSession) {
      const executiveCategories: NotificationCategory[] = [
        "economic",
        "diplomatic",
        "governance",
        "crisis",
        "achievement",
      ];
      if (executiveCategories.includes(notification.category)) {
        boost += 15;
      }
    }

    // Page relevance boost
    if (factors.relevantPageFocus) {
      boost += 10;
    }

    // High user activity boost
    if (factors.userActivity === "high") {
      boost += 8;
    }

    // Working hours boost for work-related notifications
    if (factors.isWorkingHours && ["economic", "governance"].includes(notification.category)) {
      boost += 5;
    }

    // Critical system events boost
    if (factors.criticalSystemEvents.length > 0 && notification.category === "system") {
      boost += 20;
    }

    return Math.min(50, boost);
  }

  private calculateUrgencyMultiplier(
    notification: UnifiedNotification,
    factors: ContextualFactors
  ): number {
    let multiplier = 1.0;

    // Time-sensitive categories get urgency boost
    if (["crisis", "security"].includes(notification.category)) {
      multiplier += 0.5;
    }

    // High user attention increases urgency
    if (factors.deviceAttention === "focused") {
      multiplier += 0.3;
    }

    // Low notification load allows higher urgency
    if (factors.recentNotificationLoad < 2) {
      multiplier += 0.2;
    }

    // Critical priority always gets max urgency
    if (notification.priority === "critical") {
      multiplier = Math.max(multiplier, 1.8);
    }

    return Math.min(2.0, Math.max(0.5, multiplier));
  }

  private calculateUserRelevance(
    notification: UnifiedNotification,
    preferences: UserNotificationPreferences,
    engagement: NotificationEngagement[]
  ): number {
    let relevance = 0;

    // Category preferences
    const categoryPref = preferences.categories[notification.category];
    if (categoryPref?.enabled) {
      relevance += 15;
    }

    // Historical engagement with similar notifications
    const similarEngagements = engagement.filter((e) =>
      e.notificationId.includes(notification.category)
    );

    if (similarEngagements.length > 0) {
      const avgEngagement =
        similarEngagements.reduce((sum, e) => {
          const score =
            e.action === "action-taken"
              ? 3
              : e.action === "clicked"
                ? 2
                : e.action === "viewed"
                  ? 1
                  : 0;
          return sum + score;
        }, 0) / similarEngagements.length;

      relevance += avgEngagement * 5;
    }

    return Math.min(30, relevance);
  }

  private calculateTemporalFactor(
    notification: UnifiedNotification,
    context: NotificationContext
  ): number {
    // IxTime-based temporal relevance
    const gameHour = new Date(context.ixTime).getHours();
    const isBusinessHours = gameHour >= 9 && gameHour <= 17;

    if (isBusinessHours && ["economic", "governance"].includes(notification.category)) {
      return 15;
    }

    if (!isBusinessHours && ["crisis", "security"].includes(notification.category)) {
      return 10; // Critical events are important regardless of time
    }

    return 5; // Base temporal relevance
  }

  private calculateEngagementInfluence(
    notification: UnifiedNotification,
    engagement: NotificationEngagement[]
  ): number {
    // Recent dismissals decrease priority
    const recentDismissals = engagement.filter(
      (e) => e.action === "dismissed" && Date.now() - e.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    ).length;

    if (recentDismissals > 3) {
      return -10;
    }

    // Recent actions increase priority
    const recentActions = engagement.filter(
      (e) => e.action === "action-taken" && Date.now() - e.timestamp < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    ).length;

    return Math.min(10, recentActions * 2);
  }

  private generateClusterKey(
    notification: UnifiedNotification,
    context: NotificationContext
  ): string {
    // Group by category, priority, and time window
    const timeWindow = Math.floor(Date.now() / (15 * 60 * 1000)); // 15-minute windows
    return `${notification.category}-${notification.priority}-${timeWindow}`;
  }

  private calculateClusterScore(cluster: NotificationCluster): number {
    const avgRelevance =
      cluster.notifications.reduce((sum, n) => sum + n.relevanceScore, 0) /
      cluster.notifications.length;

    const sizeBonus = Math.min(10, cluster.notifications.length * 2);
    const priorityBonus =
      cluster.priority === "critical"
        ? 20
        : cluster.priority === "high"
          ? 15
          : cluster.priority === "medium"
            ? 10
            : 5;

    return avgRelevance + sizeBonus + priorityBonus;
  }

  private determineBatchingStrategy(
    cluster: NotificationCluster,
    context: NotificationContext
  ): "immediate" | "delayed" | "scheduled" {
    if (cluster.priority === "critical") return "immediate";
    if (cluster.notifications.length === 1) return "immediate";
    if (cluster.notifications.length > 5) return "scheduled";
    return "delayed";
  }

  private calculateDeliveryWindow(
    cluster: NotificationCluster,
    context: NotificationContext
  ): { start: number; end: number } {
    const now = Date.now();

    switch (cluster.batchingStrategy) {
      case "immediate":
        return { start: now, end: now + 2 * 60 * 1000 }; // 2 minutes
      case "delayed":
        return { start: now + 5 * 60 * 1000, end: now + 15 * 60 * 1000 }; // 5-15 minutes
      case "scheduled":
        return { start: now + 30 * 60 * 1000, end: now + 60 * 60 * 1000 }; // 30-60 minutes
    }
  }

  private async analyzeContextualFactors(context: NotificationContext): Promise<ContextualFactors> {
    const now = new Date();
    const hour = now.getHours();

    return {
      isWorkingHours: hour >= 9 && hour <= 17,
      isExecutiveSession: context.isExecutiveMode,
      userActivity: this.determineUserActivity(context),
      relevantPageFocus: this.checkPageRelevance(context),
      deviceAttention: this.determineDeviceAttention(context),
      recentNotificationLoad: this.getRecentNotificationLoad(context.userId),
      criticalSystemEvents: [], // Would be populated from system monitoring
    };
  }

  private determineUserActivity(context: NotificationContext): "high" | "medium" | "low" {
    if (context.recentActions.length > 5) return "high";
    if (context.recentActions.length > 2) return "medium";
    return "low";
  }

  private checkPageRelevance(context: NotificationContext): boolean {
    return ["dashboard", "mycountry", "admin"].some((page) => context.currentRoute.includes(page));
  }

  private determineDeviceAttention(
    context: NotificationContext
  ): "focused" | "background" | "away" {
    if (context.focusMode) return "focused";
    if (context.sessionDuration > 30 * 60 * 1000) return "background"; // 30+ minutes
    return "focused";
  }

  private getRecentNotificationLoad(userId: string): number {
    // Would query recent notification count from store
    return 0; // Placeholder
  }

  private getUserEngagementProfile(userId: string): NotificationEngagement[] {
    return this.engagementHistory.get(userId) || [];
  }

  private generatePriorityReasoning(
    notification: UnifiedNotification,
    breakdown: any,
    factors: ContextualFactors
  ): string[] {
    const reasoning: string[] = [];

    if (breakdown.basePriority > 80) {
      reasoning.push(
        `High base priority (${notification.priority}) for ${notification.category} notification`
      );
    }

    if (breakdown.contextualBoost > 10) {
      reasoning.push(`Contextual relevance boost due to current user session`);
    }

    if (breakdown.urgencyMultiplier > 1.3) {
      reasoning.push(`Increased urgency due to user attention and system state`);
    }

    if (factors.isExecutiveSession) {
      reasoning.push(`Executive mode - prioritizing strategic notifications`);
    }

    return reasoning;
  }

  private recommendDeliveryMethod(
    score: number,
    factors: ContextualFactors,
    preferences: UserNotificationPreferences
  ): string {
    if (score > 80) return "dynamic-island";
    if (score > 60) return "toast";
    if (score > 40) return "badge";
    return "silent";
  }

  private calculateSuppressionRisk(
    score: number,
    engagement: NotificationEngagement[],
    factors: ContextualFactors
  ): number {
    let risk = 0;

    if (score < 30) risk += 0.4;
    if (factors.recentNotificationLoad > 8) risk += 0.3;
    if (factors.deviceAttention === "away") risk += 0.2;

    const recentDismissals = engagement.filter(
      (e) => e.action === "dismissed" && Date.now() - e.timestamp < 60 * 60 * 1000 // Last hour
    ).length;

    risk += Math.min(0.5, recentDismissals * 0.1);

    return Math.min(1, risk);
  }

  private isInQuietHours(quietHours: { start: string; end: string }): boolean {
    const now = new Date();
    const [startHour, startMinute] = quietHours.start.split(":").map(Number);
    const [endHour, endMinute] = quietHours.end.split(":").map(Number);

    if (
      startHour === undefined ||
      startMinute === undefined ||
      endHour === undefined ||
      endMinute === undefined
    ) {
      return false;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  private initializeClusteringRules() {
    // Initialize clustering rules for different categories
    // This would be expanded based on specific business logic
  }
}

// Clustering rule interface
interface ClusteringRule {
  maxClusterSize: number;
  timeWindow: number; // milliseconds
  allowCrossPriority: boolean;
  batchingPreference: "immediate" | "delayed" | "scheduled";
}

// Create singleton instance for export
const enhancedPriorityInstance = new EnhancedNotificationPriority();

// Export convenience function
export const calculateEnhancedPriority = async (
  notification: UnifiedNotification,
  context: NotificationContext,
  userPreferences: UserNotificationPreferences
): Promise<EnhancedPriorityScore> => {
  return await enhancedPriorityInstance.calculateEnhancedPriority(
    notification,
    context,
    userPreferences
  );
};

export default EnhancedNotificationPriority;
