/**
 * User Activity Analytics Service
 * 
 * Provides comprehensive analytics and insights on user behavior,
 * activity patterns, and system usage for IxStats.
 */

import { db } from "~/server/db";
import { UserLogger, type UserActivitySummary } from "./user-logger";
import { ErrorLogger } from "./error-logger";

export interface UserActivityMetrics {
  userId: string;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  startDate: Date;
  endDate: Date;
  
  // Activity metrics
  totalActions: number;
  uniqueSessions: number;
  averageSessionDuration: number;
  peakActivityHour: number;
  mostActiveDay: string;
  
  // Category breakdown
  categoryBreakdown: Record<string, number>;
  topActions: Array<{ action: string; count: number; percentage: number }>;
  
  // Error metrics
  errorRate: number;
  errorCount: number;
  topErrors: Array<{ error: string; count: number }>;
  
  // Performance metrics
  averageResponseTime: number;
  slowestOperations: Array<{ operation: string; avgDuration: number }>;
  
  // Security metrics
  securityEvents: number;
  suspiciousActivity: number;
  failedAuthAttempts: number;
  
  // Engagement metrics
  dailyActiveMinutes: number;
  featureUsage: Record<string, number>;
  countryInteractions: string[];
  
  // Trends
  activityTrend: 'increasing' | 'decreasing' | 'stable';
  engagementScore: number; // 0-100
}

export interface SystemActivityOverview {
  totalUsers: number;
  activeUsers: number;
  totalActions: number;
  errorRate: number;
  topFeatures: Array<{ feature: string; usage: number }>;
  peakHours: Array<{ hour: number; activity: number }>;
  geographicDistribution: Record<string, number>;
  deviceTypes: Record<string, number>;
  browserTypes: Record<string, number>;
}

export interface UserBehaviorPattern {
  userId: string;
  pattern: 'casual' | 'power' | 'admin' | 'explorer' | 'social' | 'economic';
  confidence: number; // 0-100
  characteristics: string[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export class UserActivityAnalytics {
  /**
   * Get comprehensive user activity metrics
   */
  static async getUserActivityMetrics(
    userId: string,
    period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'week'
  ): Promise<UserActivityMetrics> {
    try {
      const { startDate, endDate } = this.getPeriodDates(period);
      
      // Get user logs for the period
      const logs = await db.systemLog.findMany({
        where: {
          userId,
          timestamp: {
            gte: startDate,
            lte: endDate
          },
          category: 'USER_ACTION'
        },
        orderBy: { timestamp: 'asc' }
      });

      // Calculate basic metrics
      const totalActions = logs.length;
      const uniqueSessions = new Set(logs.map(l => l.requestId).filter(Boolean)).size;
      const errorCount = logs.filter(l => l.level === 'ERROR').length;
      const errorRate = totalActions > 0 ? (errorCount / totalActions) * 100 : 0;

      // Calculate category breakdown
      const categoryBreakdown: Record<string, number> = {};
      const actionCounts: Record<string, number> = {};
      const errorCounts: Record<string, number> = {};
      const durationSum: Record<string, number> = {};
      const durationCount: Record<string, number> = {};

      logs.forEach(log => {
        const metadata = log.metadata ? JSON.parse(log.metadata) : {};
        const category = metadata.category || 'UNKNOWN';
        const action = metadata.action || 'UNKNOWN';
        
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
        actionCounts[action] = (actionCounts[action] || 0) + 1;
        
        if (log.level === 'ERROR') {
          errorCounts[action] = (errorCounts[action] || 0) + 1;
        }
        
        if (log.duration) {
          durationSum[action] = (durationSum[action] || 0) + log.duration;
          durationCount[action] = (durationCount[action] || 0) + 1;
        }
      });

      // Calculate top actions
      const topActions = Object.entries(actionCounts)
        .map(([action, count]) => ({
          action,
          count,
          percentage: (count / totalActions) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate top errors
      const topErrors = Object.entries(errorCounts)
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate performance metrics
      const averageResponseTime = logs.reduce((sum, log) => sum + (log.duration || 0), 0) / logs.length;
      const slowestOperations = Object.entries(durationSum)
        .map(([operation, sum]) => ({
          operation,
          avgDuration: sum / durationCount[operation]
        }))
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, 5);

      // Calculate activity patterns
      const hourCounts: Record<number, number> = {};
      const dayCounts: Record<string, number> = {};
      
      logs.forEach(log => {
        const hour = log.timestamp.getHours();
        const day = log.timestamp.toISOString().split('T')[0];
        
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });

      const peakActivityHour = Object.entries(hourCounts)
        .reduce((max, [hour, count]) => count > hourCounts[max] ? parseInt(hour) : max, 0);

      const mostActiveDay = Object.entries(dayCounts)
        .reduce((max, [day, count]) => count > dayCounts[max] ? day : max, '');

      // Calculate engagement score
      const engagementScore = this.calculateEngagementScore(logs, period);

      // Calculate activity trend
      const activityTrend = await this.calculateActivityTrend(userId, period);

      // Get security metrics
      const securityEvents = logs.filter(l => l.category === 'SECURITY').length;
      const suspiciousActivity = await this.detectSuspiciousActivity(userId, startDate, endDate);
      const failedAuthAttempts = logs.filter(l => 
        l.metadata && JSON.parse(l.metadata).action?.includes('LOGIN_FAILED')
      ).length;

      // Calculate feature usage
      const featureUsage = this.calculateFeatureUsage(logs);

      // Get country interactions
      const countryInteractions = Array.from(new Set(logs.map(l => l.countryId).filter(Boolean))) as string[];

      return {
        userId,
        period,
        startDate,
        endDate,
        totalActions,
        uniqueSessions,
        averageSessionDuration: 0, // TODO: Calculate from session data
        peakActivityHour,
        mostActiveDay,
        categoryBreakdown,
        topActions,
        errorRate,
        errorCount,
        topErrors,
        averageResponseTime,
        slowestOperations,
        securityEvents,
        suspiciousActivity,
        failedAuthAttempts,
        dailyActiveMinutes: 0, // TODO: Calculate from session data
        featureUsage,
        countryInteractions,
        activityTrend,
        engagementScore
      };

    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserActivityAnalytics',
        action: 'GET_USER_ACTIVITY_METRICS',
        userId
      });
      throw error;
    }
  }

  /**
   * Get system-wide activity overview
   */
  static async getSystemActivityOverview(
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<SystemActivityOverview> {
    try {
      const { startDate, endDate } = this.getPeriodDates(period);
      
      // Get all user logs for the period
      const logs = await db.systemLog.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          },
          category: 'USER_ACTION'
        }
      });

      // Calculate basic metrics
      const totalActions = logs.length;
      const uniqueUsers = new Set(logs.map(l => l.userId).filter(Boolean)).size;
      const errorCount = logs.filter(l => l.level === 'ERROR').length;
      const errorRate = totalActions > 0 ? (errorCount / totalActions) * 100 : 0;

      // Get total users from database
      const totalUsers = await db.user.count();
      const activeUsers = uniqueUsers;

      // Calculate feature usage
      const featureUsage: Record<string, number> = {};
      logs.forEach(log => {
        const metadata = log.metadata ? JSON.parse(log.metadata) : {};
        const category = metadata.category || 'UNKNOWN';
        featureUsage[category] = (featureUsage[category] || 0) + 1;
      });

      const topFeatures = Object.entries(featureUsage)
        .map(([feature, usage]) => ({ feature, usage }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 10);

      // Calculate peak hours
      const hourCounts: Record<number, number> = {};
      logs.forEach(log => {
        const hour = log.timestamp.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const peakHours = Object.entries(hourCounts)
        .map(([hour, activity]) => ({ hour: parseInt(hour), activity }))
        .sort((a, b) => b.activity - a.activity)
        .slice(0, 24);

      // Get geographic distribution (from country interactions)
      const geographicDistribution: Record<string, number> = {};
      logs.forEach(log => {
        if (log.countryId) {
          geographicDistribution[log.countryId] = (geographicDistribution[log.countryId] || 0) + 1;
        }
      });

      // Get device and browser types (from user agent)
      const deviceTypes: Record<string, number> = {};
      const browserTypes: Record<string, number> = {};
      
      logs.forEach(log => {
        if (log.userAgent) {
          const deviceType = this.parseDeviceType(log.userAgent);
          const browserType = this.parseBrowserType(log.userAgent);
          
          deviceTypes[deviceType] = (deviceTypes[deviceType] || 0) + 1;
          browserTypes[browserType] = (browserTypes[browserType] || 0) + 1;
        }
      });

      return {
        totalUsers,
        activeUsers,
        totalActions,
        errorRate,
        topFeatures,
        peakHours,
        geographicDistribution,
        deviceTypes,
        browserTypes
      };

    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserActivityAnalytics',
        action: 'GET_SYSTEM_ACTIVITY_OVERVIEW'
      });
      throw error;
    }
  }

  /**
   * Analyze user behavior patterns
   */
  static async analyzeUserBehaviorPattern(userId: string): Promise<UserBehaviorPattern> {
    try {
      const { startDate, endDate } = this.getPeriodDates('month');
      
      const logs = await db.systemLog.findMany({
        where: {
          userId,
          timestamp: {
            gte: startDate,
            lte: endDate
          },
          category: 'USER_ACTION'
        }
      });

      // Analyze patterns
      const patterns = this.identifyBehaviorPatterns(logs);
      const riskLevel = this.assessRiskLevel(logs);
      const recommendations = this.generateRecommendations(patterns, riskLevel);

      return {
        userId,
        pattern: patterns.primary,
        confidence: patterns.confidence,
        characteristics: patterns.characteristics,
        recommendations,
        riskLevel
      };

    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserActivityAnalytics',
        action: 'ANALYZE_USER_BEHAVIOR_PATTERN',
        userId
      });
      throw error;
    }
  }

  /**
   * Get period dates
   */
  private static getPeriodDates(period: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  }

  /**
   * Calculate engagement score
   */
  private static calculateEngagementScore(logs: any[], period: string): number {
    const totalActions = logs.length;
    const uniqueDays = new Set(logs.map(l => l.timestamp.toISOString().split('T')[0])).size;
    const errorRate = logs.filter(l => l.level === 'ERROR').length / totalActions;
    
    // Base score from activity volume
    let score = Math.min(totalActions / 100, 50); // Max 50 points for volume
    
    // Bonus for consistency (daily activity)
    const expectedDays = period === 'week' ? 7 : period === 'month' ? 30 : 1;
    const consistencyBonus = (uniqueDays / expectedDays) * 30; // Max 30 points
    score += consistencyBonus;
    
    // Penalty for errors
    const errorPenalty = errorRate * 20; // Max 20 point penalty
    score -= errorPenalty;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate activity trend
   */
  private static async calculateActivityTrend(
    userId: string,
    period: string
  ): Promise<'increasing' | 'decreasing' | 'stable'> {
    const { startDate, endDate } = this.getPeriodDates(period);
    const midPoint = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);
    
    const firstHalf = await db.systemLog.count({
      where: {
        userId,
        timestamp: {
          gte: startDate,
          lt: midPoint
        },
        category: 'USER_ACTION'
      }
    });
    
    const secondHalf = await db.systemLog.count({
      where: {
        userId,
        timestamp: {
          gte: midPoint,
          lte: endDate
        },
        category: 'USER_ACTION'
      }
    });
    
    const change = (secondHalf - firstHalf) / firstHalf;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Detect suspicious activity
   */
  private static async detectSuspiciousActivity(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Look for patterns that might indicate suspicious activity
    const logs = await db.systemLog.findMany({
      where: {
        userId,
        timestamp: {
          gte: startDate,
          lte: endDate
        },
        category: 'USER_ACTION'
      }
    });

    let suspiciousCount = 0;
    
    // Check for rapid-fire actions (potential bot behavior)
    const timeWindows: Record<string, number> = {};
    logs.forEach(log => {
      const window = Math.floor(log.timestamp.getTime() / (5 * 60 * 1000)); // 5-minute windows
      timeWindows[window] = (timeWindows[window] || 0) + 1;
    });
    
    // If more than 50 actions in a 5-minute window, flag as suspicious
    Object.values(timeWindows).forEach(count => {
      if (count > 50) suspiciousCount++;
    });
    
    // Check for unusual error rates
    const errorRate = logs.filter(l => l.level === 'ERROR').length / logs.length;
    if (errorRate > 0.3) suspiciousCount++;
    
    return suspiciousCount;
  }

  /**
   * Calculate feature usage
   */
  private static calculateFeatureUsage(logs: any[]): Record<string, number> {
    const usage: Record<string, number> = {};
    
    logs.forEach(log => {
      const metadata = log.metadata ? JSON.parse(log.metadata) : {};
      const category = metadata.category || 'UNKNOWN';
      usage[category] = (usage[category] || 0) + 1;
    });
    
    return usage;
  }

  /**
   * Parse device type from user agent
   */
  private static parseDeviceType(userAgent: string): string {
    if (/mobile|android|iphone/i.test(userAgent)) return 'Mobile';
    if (/tablet|ipad/i.test(userAgent)) return 'Tablet';
    return 'Desktop';
  }

  /**
   * Parse browser type from user agent
   */
  private static parseBrowserType(userAgent: string): string {
    if (/chrome/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    return 'Other';
  }

  /**
   * Identify behavior patterns
   */
  private static identifyBehaviorPatterns(logs: any[]): {
    primary: UserBehaviorPattern['pattern'];
    confidence: number;
    characteristics: string[];
  } {
    const categoryCounts: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    
    logs.forEach(log => {
      const metadata = log.metadata ? JSON.parse(log.metadata) : {};
      const category = metadata.category || 'UNKNOWN';
      const action = metadata.action || 'UNKNOWN';
      
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    });
    
    const totalActions = logs.length;
    const characteristics: string[] = [];
    let primaryPattern: UserBehaviorPattern['pattern'] = 'casual';
    let confidence = 50;
    
    // Analyze patterns
    if (categoryCounts.ADMIN > totalActions * 0.3) {
      primaryPattern = 'admin';
      confidence = 90;
      characteristics.push('High admin activity');
    } else if (categoryCounts.ECONOMIC > totalActions * 0.4) {
      primaryPattern = 'economic';
      confidence = 80;
      characteristics.push('Focuses on economic features');
    } else if (categoryCounts.SOCIAL > totalActions * 0.3) {
      primaryPattern = 'social';
      confidence = 75;
      characteristics.push('High social engagement');
    } else if (totalActions > 1000) {
      primaryPattern = 'power';
      confidence = 85;
      characteristics.push('High activity level');
    } else if (categoryCounts.DATA_ACCESS > totalActions * 0.5) {
      primaryPattern = 'explorer';
      confidence = 70;
      characteristics.push('Explores data extensively');
    }
    
    return { primary: primaryPattern, confidence, characteristics };
  }

  /**
   * Assess risk level
   */
  private static assessRiskLevel(logs: any[]): 'low' | 'medium' | 'high' {
    const errorRate = logs.filter(l => l.level === 'ERROR').length / logs.length;
    const securityEvents = logs.filter(l => l.category === 'SECURITY').length;
    
    if (errorRate > 0.2 || securityEvents > 5) return 'high';
    if (errorRate > 0.1 || securityEvents > 2) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations
   */
  private static generateRecommendations(
    patterns: any,
    riskLevel: string
  ): string[] {
    const recommendations: string[] = [];
    
    if (riskLevel === 'high') {
      recommendations.push('Review account for potential security issues');
    }
    
    if (patterns.primary === 'casual') {
      recommendations.push('Consider exploring more advanced features');
    }
    
    if (patterns.primary === 'power') {
      recommendations.push('Consider advanced user training');
    }
    
    return recommendations;
  }
}

export default UserActivityAnalytics;
