/**
 * Intelligent Notification Grouping and Batching System
 * Advanced algorithms for clustering, batching, and optimizing notification delivery
 */

import type {
  UnifiedNotification,
  NotificationContext,
  NotificationCategory,
  NotificationPriority,
  UserNotificationPreferences,
} from '~/types/unified-notifications';
import type { NotificationCluster } from './EnhancedNotificationPriority';

// Grouping strategy configuration
export interface GroupingStrategy {
  name: string;
  description: string;
  clustersBy: ClusteringDimension[];
  maxClusterSize: number;
  timeWindow: number; // milliseconds
  batchingRules: BatchingRule[];
  deliveryOptimization: DeliveryOptimization;
}

// Dimensions for clustering notifications
export type ClusteringDimension = 
  | 'category'     // Group by category
  | 'priority'     // Group by priority
  | 'source'       // Group by source system
  | 'user'         // Group by target user
  | 'temporal'     // Group by time proximity
  | 'semantic'     // Group by content similarity
  | 'context'      // Group by user context
  | 'impact';      // Group by business impact

// Batching rules for different scenarios
export interface BatchingRule {
  condition: BatchingCondition;
  action: BatchingAction;
  timing: BatchingTiming;
  maxDelay: number; // milliseconds
  priority: number; // Higher = more important rule
}

export interface BatchingCondition {
  type: 'load' | 'priority' | 'category' | 'time' | 'user_state';
  operator: 'gt' | 'lt' | 'eq' | 'in' | 'contains';
  value: any;
  description: string;
}

export interface BatchingAction {
  type: 'batch' | 'delay' | 'promote' | 'suppress' | 'redirect';
  parameters: Record<string, any>;
  description: string;
}

export interface BatchingTiming {
  strategy: 'immediate' | 'fixed_delay' | 'smart_delay' | 'next_window' | 'user_activity';
  delay?: number;
  window?: { start: number; end: number };
  conditions?: string[];
}

// Delivery optimization settings
export interface DeliveryOptimization {
  respectQuietHours: boolean;
  avoidOverload: boolean;
  prioritizeEngagement: boolean;
  adaptToUserBehavior: boolean;
  minimizeInterruption: boolean;
  maximizeAttention: boolean;
}

// Batch composition analysis
export interface BatchAnalysis {
  id: string;
  notifications: UnifiedNotification[];
  cohesion: number; // 0-1, how well notifications fit together
  urgency: number; // 0-1, overall batch urgency
  userRelevance: number; // 0-1, relevance to user
  optimalDeliveryTime: number; // timestamp
  estimatedEngagement: number; // 0-1, predicted user engagement
  deliveryMethod: string;
  reasoning: string[];
}

export class NotificationGrouping {
  private strategies: Map<string, GroupingStrategy> = new Map();
  private activeBatches: Map<string, BatchAnalysis> = new Map();
  private userBehaviorProfiles: Map<string, UserBehaviorProfile> = new Map();
  private semanticSimilarity: SemanticAnalyzer;

  constructor() {
    this.initializeGroupingStrategies();
    this.semanticSimilarity = new SemanticAnalyzer();
  }

  /**
   * Intelligently group notifications using multiple clustering strategies
   */
  async groupNotifications(
    notifications: UnifiedNotification[],
    context: NotificationContext,
    preferences: UserNotificationPreferences,
    strategyName?: string
  ): Promise<NotificationCluster[]> {
    const strategy = this.strategies.get(strategyName || 'adaptive') 
                  || this.strategies.get('adaptive')!;

    // Apply multi-dimensional clustering
    const clusters = await this.applyMultiDimensionalClustering(
      notifications,
      strategy,
      context
    );

    // Optimize cluster composition
    const optimizedClusters = await this.optimizeClusterComposition(
      clusters,
      context,
      preferences
    );

    // Apply batching rules
    const batchedClusters = await this.applyBatchingRules(
      optimizedClusters,
      strategy.batchingRules,
      context
    );

    // Calculate delivery timing
    const timedClusters = await this.calculateOptimalDeliveryTiming(
      batchedClusters,
      context,
      preferences,
      strategy.deliveryOptimization
    );

    return timedClusters;
  }

  /**
   * Smart batching with user behavior adaptation
   */
  async createSmartBatches(
    clusters: NotificationCluster[],
    context: NotificationContext,
    preferences: UserNotificationPreferences
  ): Promise<BatchAnalysis[]> {
    const userProfile = await this.getUserBehaviorProfile(context.userId);
    const batches: BatchAnalysis[] = [];

    for (const cluster of clusters) {
      const batch = await this.analyzeBatchComposition(cluster, userProfile, context);
      
      // Apply smart timing optimization
      batch.optimalDeliveryTime = await this.calculateSmartDeliveryTime(
        batch,
        userProfile,
        context,
        preferences
      );

      // Estimate user engagement
      batch.estimatedEngagement = await this.predictUserEngagement(
        batch,
        userProfile,
        context
      );

      batches.push(batch);
    }

    // Sort by delivery priority
    return batches.sort((a, b) => {
      const scoreA = a.urgency * 0.4 + a.userRelevance * 0.3 + a.estimatedEngagement * 0.3;
      const scoreB = b.urgency * 0.4 + b.userRelevance * 0.3 + b.estimatedEngagement * 0.3;
      return scoreB - scoreA;
    });
  }

  /**
   * Adaptive load balancing to prevent notification overflow
   */
  async balanceNotificationLoad(
    batches: BatchAnalysis[],
    context: NotificationContext,
    preferences: UserNotificationPreferences
  ): Promise<BatchAnalysis[]> {
    const maxNotificationsPerHour = preferences.maxNotificationsPerHour;
    const currentHourNotifications = await this.getCurrentHourNotificationCount(context.userId);
    const availableSlots = Math.max(0, maxNotificationsPerHour - currentHourNotifications);

    if (availableSlots >= batches.length) {
      return batches; // No balancing needed
    }

    // Prioritize most important batches
    const prioritizedBatches = batches.slice(0, availableSlots);
    const deferredBatches = batches.slice(availableSlots);

    // Reschedule deferred batches
    for (const batch of deferredBatches) {
      batch.optimalDeliveryTime = this.calculateNextAvailableSlot(
        batch.optimalDeliveryTime,
        preferences
      );
      batch.reasoning.push('Deferred due to notification load balancing');
    }

    return [...prioritizedBatches, ...deferredBatches];
  }

  // Private implementation methods

  private initializeGroupingStrategies() {
    // Adaptive strategy - automatically adjusts based on context
    this.strategies.set('adaptive', {
      name: 'Adaptive Clustering',
      description: 'Automatically adapts clustering based on user context and notification patterns',
      clustersBy: ['category', 'priority', 'temporal', 'semantic'],
      maxClusterSize: 5,
      timeWindow: 15 * 60 * 1000, // 15 minutes
      batchingRules: [
        {
          condition: {
            type: 'load',
            operator: 'gt',
            value: 5,
            description: 'High notification load detected'
          },
          action: {
            type: 'batch',
            parameters: { aggressive: true },
            description: 'Aggressively batch similar notifications'
          },
          timing: {
            strategy: 'smart_delay',
            delay: 5 * 60 * 1000 // 5 minutes
          },
          maxDelay: 30 * 60 * 1000, // 30 minutes
          priority: 8
        },
        {
          condition: {
            type: 'priority',
            operator: 'eq',
            value: 'critical',
            description: 'Critical priority notification'
          },
          action: {
            type: 'promote',
            parameters: { bypass_batching: true },
            description: 'Deliver immediately without batching'
          },
          timing: {
            strategy: 'immediate'
          },
          maxDelay: 0,
          priority: 10
        }
      ],
      deliveryOptimization: {
        respectQuietHours: true,
        avoidOverload: true,
        prioritizeEngagement: true,
        adaptToUserBehavior: true,
        minimizeInterruption: true,
        maximizeAttention: false
      }
    });

    // Executive strategy - optimized for executive/admin users
    this.strategies.set('executive', {
      name: 'Executive Focus',
      description: 'Optimized for executive users with focus on strategic notifications',
      clustersBy: ['category', 'impact', 'priority'],
      maxClusterSize: 3,
      timeWindow: 10 * 60 * 1000, // 10 minutes
      batchingRules: [
        {
          condition: {
            type: 'category',
            operator: 'in',
            value: ['economic', 'diplomatic', 'governance', 'crisis'],
            description: 'Strategic category notification'
          },
          action: {
            type: 'promote',
            parameters: { executive_priority: true },
            description: 'Promote strategic notifications'
          },
          timing: {
            strategy: 'immediate'
          },
          maxDelay: 2 * 60 * 1000, // 2 minutes
          priority: 9
        }
      ],
      deliveryOptimization: {
        respectQuietHours: false,
        avoidOverload: false,
        prioritizeEngagement: true,
        adaptToUserBehavior: true,
        minimizeInterruption: false,
        maximizeAttention: true
      }
    });

    // Casual strategy - optimized for general users
    this.strategies.set('casual', {
      name: 'Casual User',
      description: 'Optimized for casual users with focus on minimal interruption',
      clustersBy: ['category', 'temporal'],
      maxClusterSize: 8,
      timeWindow: 30 * 60 * 1000, // 30 minutes
      batchingRules: [
        {
          condition: {
            type: 'user_state',
            operator: 'eq',
            value: 'inactive',
            description: 'User is inactive'
          },
          action: {
            type: 'delay',
            parameters: { wait_for_activity: true },
            description: 'Wait for user activity before delivering'
          },
          timing: {
            strategy: 'user_activity'
          },
          maxDelay: 2 * 60 * 60 * 1000, // 2 hours
          priority: 7
        }
      ],
      deliveryOptimization: {
        respectQuietHours: true,
        avoidOverload: true,
        prioritizeEngagement: false,
        adaptToUserBehavior: true,
        minimizeInterruption: true,
        maximizeAttention: false
      }
    });
  }

  private async applyMultiDimensionalClustering(
    notifications: UnifiedNotification[],
    strategy: GroupingStrategy,
    context: NotificationContext
  ): Promise<NotificationCluster[]> {
    const clusters: Map<string, NotificationCluster> = new Map();

    for (const notification of notifications) {
      const clusterKey = await this.generateMultiDimensionalKey(
        notification,
        strategy.clustersBy,
        context
      );

      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, {
          id: `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          category: notification.category,
          priority: notification.priority,
          notifications: [],
          aggregatedScore: 0,
          representativeNotification: notification,
          batchingStrategy: 'immediate',
          deliveryWindow: { start: Date.now(), end: Date.now() + strategy.timeWindow }
        });
      }

      const cluster = clusters.get(clusterKey)!;
      
      // Check cluster size limit
      if (cluster.notifications.length < strategy.maxClusterSize) {
        cluster.notifications.push(notification);
        
        // Update representative notification
        if (notification.relevanceScore > cluster.representativeNotification.relevanceScore) {
          cluster.representativeNotification = notification;
        }
      } else {
        // Create overflow cluster
        const overflowKey = `${clusterKey}-overflow-${clusters.size}`;
        clusters.set(overflowKey, {
          id: `cluster-overflow-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          category: notification.category,
          priority: notification.priority,
          notifications: [notification],
          aggregatedScore: 0,
          representativeNotification: notification,
          batchingStrategy: 'delayed',
          deliveryWindow: { 
            start: Date.now() + (5 * 60 * 1000), 
            end: Date.now() + strategy.timeWindow + (5 * 60 * 1000)
          }
        });
      }
    }

    return Array.from(clusters.values());
  }

  private async generateMultiDimensionalKey(
    notification: UnifiedNotification,
    dimensions: ClusteringDimension[],
    context: NotificationContext
  ): Promise<string> {
    const keyParts: string[] = [];

    for (const dimension of dimensions) {
      switch (dimension) {
        case 'category':
          keyParts.push(`cat-${notification.category}`);
          break;
        case 'priority':
          keyParts.push(`pri-${notification.priority}`);
          break;
        case 'source':
          keyParts.push(`src-${notification.source}`);
          break;
        case 'temporal':
          const timeSlot = Math.floor(Date.now() / (15 * 60 * 1000)); // 15-minute slots
          keyParts.push(`time-${timeSlot}`);
          break;
        case 'semantic':
          const semanticGroup = await this.semanticSimilarity.getSemanticGroup(notification);
          keyParts.push(`sem-${semanticGroup}`);
          break;
        case 'context':
          keyParts.push(`ctx-${context.isExecutiveMode ? 'exec' : 'normal'}`);
          break;
        case 'impact':
          const impactLevel = this.calculateBusinessImpact(notification);
          keyParts.push(`imp-${impactLevel}`);
          break;
      }
    }

    return keyParts.join('|');
  }

  private async optimizeClusterComposition(
    clusters: NotificationCluster[],
    context: NotificationContext,
    preferences: UserNotificationPreferences
  ): Promise<NotificationCluster[]> {
    return clusters.map(cluster => {
      // Calculate cohesion score
      const cohesion = this.calculateClusterCohesion(cluster);
      
      // If cohesion is low, consider splitting
      if (cohesion < 0.6 && cluster.notifications.length > 2) {
        // Would implement cluster splitting logic here
      }
      
      // Calculate aggregated score
      cluster.aggregatedScore = this.calculateAggregatedScore(cluster);
      
      return cluster;
    });
  }

  private calculateClusterCohesion(cluster: NotificationCluster): number {
    if (cluster.notifications.length <= 1) return 1.0;

    let cohesionScore = 0;
    const notifications = cluster.notifications;

    // Category cohesion (40% weight)
    const categories = new Set(notifications.map(n => n.category));
    const categoryScore = 1 - (categories.size - 1) / notifications.length;
    cohesionScore += categoryScore * 0.4;

    // Priority cohesion (30% weight)
    const priorities = new Set(notifications.map(n => n.priority));
    const priorityScore = 1 - (priorities.size - 1) / notifications.length;
    cohesionScore += priorityScore * 0.3;

    // Temporal cohesion (20% weight)
    const timestamps = notifications.map(n => n.timestamp);
    const timeSpread = Math.max(...timestamps) - Math.min(...timestamps);
    const maxTimeSpread = 30 * 60 * 1000; // 30 minutes
    const temporalScore = Math.max(0, 1 - timeSpread / maxTimeSpread);
    cohesionScore += temporalScore * 0.2;

    // Semantic cohesion (10% weight)
    const semanticScore = this.calculateSemanticCohesion(notifications);
    cohesionScore += semanticScore * 0.1;

    return Math.min(1.0, Math.max(0.0, cohesionScore));
  }

  private calculateSemanticCohesion(notifications: UnifiedNotification[]): number {
    // Simple semantic similarity based on keyword overlap
    const allKeywords = notifications.flatMap(n => 
      `${n.title} ${n.message}`.toLowerCase().split(/\s+/)
    );
    
    const uniqueKeywords = new Set(allKeywords);
    const overlap = (allKeywords.length - uniqueKeywords.size) / allKeywords.length;
    
    return Math.min(1.0, overlap * 2); // Boost the score
  }

  private calculateAggregatedScore(cluster: NotificationCluster): number {
    const avgRelevance = cluster.notifications.reduce(
      (sum, n) => sum + n.relevanceScore, 0
    ) / cluster.notifications.length;
    
    const priorityBonus = this.getPriorityBonus(cluster.priority);
    const cohesion = this.calculateClusterCohesion(cluster);
    const sizeBonus = Math.min(10, cluster.notifications.length * 2);
    
    return avgRelevance * cohesion + priorityBonus + sizeBonus;
  }

  private getPriorityBonus(priority: NotificationPriority): number {
    const bonuses = { critical: 20, high: 15, medium: 10, low: 5 };
    return bonuses[priority] || 5;
  }

  private calculateBusinessImpact(notification: UnifiedNotification): 'low' | 'medium' | 'high' | 'critical' {
    if (notification.category === 'crisis' || notification.priority === 'critical') {
      return 'critical';
    }
    if (['economic', 'diplomatic'].includes(notification.category) && notification.priority === 'high') {
      return 'high';
    }
    if (notification.priority === 'medium') {
      return 'medium';
    }
    return 'low';
  }

  private async applyBatchingRules(
    clusters: NotificationCluster[],
    rules: BatchingRule[],
    context: NotificationContext
  ): Promise<NotificationCluster[]> {
    // Sort rules by priority
    const sortedRules = rules.sort((a, b) => b.priority - a.priority);

    return clusters.map(cluster => {
      for (const rule of sortedRules) {
        if (this.evaluateBatchingCondition(rule.condition, cluster, context)) {
          cluster = this.applyBatchingAction(cluster, rule.action, rule.timing);
          break; // Apply only the highest priority matching rule
        }
      }
      return cluster;
    });
  }

  private evaluateBatchingCondition(
    condition: BatchingCondition,
    cluster: NotificationCluster,
    context: NotificationContext
  ): boolean {
    switch (condition.type) {
      case 'load':
        const currentLoad = this.getCurrentNotificationLoad(context.userId);
        return this.compareValues(currentLoad, condition.operator, condition.value);
      case 'priority':
        return this.compareValues(cluster.priority, condition.operator, condition.value);
      case 'category':
        return this.compareValues(cluster.category, condition.operator, condition.value);
      default:
        return false;
    }
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'gt': return actual > expected;
      case 'lt': return actual < expected;
      case 'eq': return actual === expected;
      case 'in': return Array.isArray(expected) && expected.includes(actual);
      case 'contains': return String(actual).includes(String(expected));
      default: return false;
    }
  }

  private applyBatchingAction(
    cluster: NotificationCluster,
    action: BatchingAction,
    timing: BatchingTiming
  ): NotificationCluster {
    switch (action.type) {
      case 'batch':
        cluster.batchingStrategy = 'delayed';
        break;
      case 'delay':
        cluster.deliveryWindow.start += timing.delay || 5 * 60 * 1000;
        break;
      case 'promote':
        cluster.batchingStrategy = 'immediate';
        cluster.deliveryWindow.start = Date.now();
        break;
    }
    return cluster;
  }

  private async calculateOptimalDeliveryTiming(
    clusters: NotificationCluster[],
    context: NotificationContext,
    preferences: UserNotificationPreferences,
    optimization: DeliveryOptimization
  ): Promise<NotificationCluster[]> {
    const userProfile = await this.getUserBehaviorProfile(context.userId);

    return clusters.map(cluster => {
      let optimalTime = cluster.deliveryWindow.start;

      if (optimization.respectQuietHours && preferences.quietHours) {
        optimalTime = this.adjustForQuietHours(optimalTime, preferences.quietHours);
      }

      if (optimization.adaptToUserBehavior) {
        optimalTime = this.adjustForUserBehavior(optimalTime, userProfile);
      }

      if (optimization.minimizeInterruption) {
        optimalTime = this.adjustForMinimalInterruption(optimalTime, context);
      }

      cluster.deliveryWindow.start = optimalTime;
      return cluster;
    });
  }

  private async analyzeBatchComposition(
    cluster: NotificationCluster,
    userProfile: UserBehaviorProfile,
    context: NotificationContext
  ): Promise<BatchAnalysis> {
    const cohesion = this.calculateClusterCohesion(cluster);
    const urgency = this.calculateBatchUrgency(cluster);
    const userRelevance = this.calculateUserRelevance(cluster, userProfile);

    return {
      id: cluster.id,
      notifications: cluster.notifications,
      cohesion,
      urgency,
      userRelevance,
      optimalDeliveryTime: cluster.deliveryWindow.start,
      estimatedEngagement: 0, // Will be calculated later
      deliveryMethod: 'toast', // Will be determined later
      reasoning: [
        `Cohesion: ${(cohesion * 100).toFixed(0)}%`,
        `Urgency: ${(urgency * 100).toFixed(0)}%`,
        `User relevance: ${(userRelevance * 100).toFixed(0)}%`
      ]
    };
  }

  private calculateBatchUrgency(cluster: NotificationCluster): number {
    const priorityScores = { critical: 1.0, high: 0.8, medium: 0.5, low: 0.2 };
    const avgPriorityScore = cluster.notifications.reduce((sum, n) => 
      sum + (priorityScores[n.priority] || 0.2), 0
    ) / cluster.notifications.length;

    return avgPriorityScore;
  }

  private calculateUserRelevance(
    cluster: NotificationCluster,
    userProfile: UserBehaviorProfile
  ): number {
    // Simplified relevance calculation
    const categoryPreference = userProfile.categoryPreferences.get(cluster.category) || 0.5;
    const avgRelevanceScore = cluster.notifications.reduce((sum, n) => 
      sum + n.relevanceScore, 0
    ) / cluster.notifications.length;

    return (categoryPreference + avgRelevanceScore / 100) / 2;
  }

  // Helper methods and stubs
  private getCurrentNotificationLoad(userId: string): number {
    // Would implement actual load calculation
    return 3;
  }

  private async getUserBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
    // Stub implementation
    return {
      categoryPreferences: new Map([
        ['economic', 0.8],
        ['diplomatic', 0.6],
        ['governance', 0.7]
      ]),
      optimalDeliveryTimes: [9, 13, 17], // Hours
      engagementPatterns: new Map(),
      averageResponseTime: 300000 // 5 minutes
    };
  }

  private async calculateSmartDeliveryTime(
    batch: BatchAnalysis,
    userProfile: UserBehaviorProfile,
    context: NotificationContext,
    preferences: UserNotificationPreferences
  ): Promise<number> {
    // Simplified smart timing calculation
    return Math.max(batch.optimalDeliveryTime, Date.now() + 60000); // At least 1 minute
  }

  private async predictUserEngagement(
    batch: BatchAnalysis,
    userProfile: UserBehaviorProfile,
    context: NotificationContext
  ): Promise<number> {
    // Simplified engagement prediction
    return batch.userRelevance * batch.urgency;
  }

  private async getCurrentHourNotificationCount(userId: string): Promise<number> {
    // Stub - would query actual notification store
    return 2;
  }

  private calculateNextAvailableSlot(
    preferredTime: number,
    preferences: UserNotificationPreferences
  ): number {
    // Simplified next slot calculation
    return preferredTime + (60 * 60 * 1000); // 1 hour later
  }

  private adjustForQuietHours(time: number, quietHours: { start: string; end: string }): number {
    // Stub implementation
    return time;
  }

  private adjustForUserBehavior(time: number, userProfile: UserBehaviorProfile): number {
    // Stub implementation
    return time;
  }

  private adjustForMinimalInterruption(time: number, context: NotificationContext): number {
    // Stub implementation
    return time;
  }
}

// Supporting interfaces
interface UserBehaviorProfile {
  categoryPreferences: Map<NotificationCategory, number>;
  optimalDeliveryTimes: number[]; // Hours of day
  engagementPatterns: Map<string, number>;
  averageResponseTime: number;
}

class SemanticAnalyzer {
  async getSemanticGroup(notification: UnifiedNotification): Promise<string> {
    // Simplified semantic grouping
    const text = `${notification.title} ${notification.message}`.toLowerCase();
    if (text.includes('economic') || text.includes('gdp') || text.includes('market')) {
      return 'economic';
    }
    if (text.includes('diplomatic') || text.includes('treaty') || text.includes('relations')) {
      return 'diplomatic';
    }
    return 'general';
  }
}

// Create singleton instance for export
const groupingInstance = new NotificationGrouping({
  enableGrouping: true,
  maxGroupSize: 5,
  timeWindow: 300000,
  groupByCategory: true,
  groupBySeverity: false
});

// Export convenience functions
export const groupNotifications = async (
  notifications: UnifiedNotification[],
  preferences: GroupingPreferences
): Promise<NotificationGroup[]> => {
  return await groupingInstance.groupNotifications(notifications, preferences);
};

export const createSmartBatches = async (
  groups: NotificationGroup[],
  context: DeliveryContext
): Promise<NotificationBatch[]> => {
  return await groupingInstance.createSmartBatches(groups, context);
};

export default NotificationGrouping;