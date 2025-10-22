/**
 * Per-User/Account Logging System for IxStats
 * 
 * This system provides comprehensive user-specific logging that:
 * - Tracks all user actions and activities
 * - Maintains per-user log files and database records
 * - Provides user activity analytics and insights
 * - Supports compliance and audit requirements
 * - Integrates with existing SystemLog infrastructure
 * 
 * Features:
 * - User session tracking
 * - Action-based logging with context
 * - Per-user log aggregation
 * - Activity pattern analysis
 * - Privacy-compliant data retention
 */

import { db } from "~/server/db";
import { logger, LogLevel, LogCategory } from "./logger";
import { ErrorLogger } from "./error-logger";
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface UserLogContext {
  userId: string;
  clerkUserId: string;
  countryId?: string;
  roleId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  requestId?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

export interface UserAction {
  action: string;
  category: 'AUTH' | 'NAVIGATION' | 'DATA_ACCESS' | 'DATA_MODIFICATION' | 'SETTINGS' | 'SOCIAL' | 'ECONOMIC' | 'DIPLOMATIC' | 'INTELLIGENCE' | 'ADMIN' | 'ERROR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  targetResource?: string;
  targetId?: string;
  beforeState?: any;
  afterState?: any;
  changes?: string[];
  success: boolean;
  errorMessage?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface UserActivitySummary {
  userId: string;
  date: string;
  totalActions: number;
  uniqueSessions: number;
  categories: Record<string, number>;
  topActions: Array<{ action: string; count: number }>;
  errorCount: number;
  averageSessionDuration: number;
  peakActivityHour: number;
  countriesAccessed: string[];
  securityEvents: number;
}

export class UserLogger {
  private static readonly LOG_DIR = join(process.cwd(), 'logs', 'users');
  private static readonly MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly LOG_RETENTION_DAYS = 90;
  private static readonly ACTIVITY_SUMMARY_RETENTION_DAYS = 365;
  private static initialized = false;

  private static safeParseMetadata(metadata: unknown): Record<string, any> | null {
    if (!metadata) {
      return null;
    }

    if (typeof metadata === 'object') {
      return metadata as Record<string, any>;
    }

    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata);
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Initialize user logging system
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      if (!existsSync(this.LOG_DIR)) {
        mkdirSync(this.LOG_DIR, { recursive: true });
      }

      logger.info(LogCategory.SYSTEM, 'User logging system initialized', {
        component: 'UserLogger',
        metadata: { logDir: this.LOG_DIR }
      });

      this.initialized = true;
    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserLogger',
        action: 'INITIALIZATION'
      });
    }
  }

  /**
   * Log a user action with full context
   */
  static async logUserAction(
    context: UserLogContext,
    action: UserAction
  ): Promise<void> {
    try {
      const timestamp = new Date();
      const logEntry = {
        timestamp: timestamp.toISOString(),
        ...context,
        ...action,
        logId: this.generateLogId()
      };

      // Log to console with user context
      const logMessage = `[USER:${context.clerkUserId}] ${action.action}: ${action.description}`;
      const logLevel = this.getLogLevel(action.severity);
      
      // Use the appropriate logger method based on level
      switch (logLevel) {
        case LogLevel.DEBUG:
          logger.debug(LogCategory.USER_ACTION, logMessage, {
            userId: context.userId,
            countryId: context.countryId,
            requestId: context.requestId,
            metadata: {
              action: action.action,
              category: action.category,
              severity: action.severity,
              success: action.success,
              duration: action.duration,
              ...context.metadata
            }
          });
          break;
        case LogLevel.INFO:
          logger.info(LogCategory.USER_ACTION, logMessage, {
            userId: context.userId,
            countryId: context.countryId,
            requestId: context.requestId,
            metadata: {
              action: action.action,
              category: action.category,
              severity: action.severity,
              success: action.success,
              duration: action.duration,
              ...context.metadata
            }
          });
          break;
        case LogLevel.WARN:
          logger.warn(LogCategory.USER_ACTION, logMessage, {
            userId: context.userId,
            countryId: context.countryId,
            requestId: context.requestId,
            metadata: {
              action: action.action,
              category: action.category,
              severity: action.severity,
              success: action.success,
              duration: action.duration,
              ...context.metadata
            }
          });
          break;
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
          logger.error(LogCategory.USER_ACTION, logMessage, {
            userId: context.userId,
            countryId: context.countryId,
            requestId: context.requestId,
            metadata: {
              action: action.action,
              category: action.category,
              severity: action.severity,
              success: action.success,
              duration: action.duration,
              ...context.metadata
            }
          });
          break;
      }

      // Persist to database
      await this.persistToDatabase(logEntry);

      // Write to user-specific log file
      await this.writeToUserLogFile(context.clerkUserId, logEntry);

      // Update user session activity
      await this.updateUserSession(context);

      // Log security events
      if (action.severity === 'CRITICAL' || action.category === 'AUTH') {
        await this.logSecurityEvent(context, action);
      }

    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserLogger',
        action: 'LOG_USER_ACTION',
        userId: context.userId
      });
    }
  }

  /**
   * Log user authentication events
   */
  static async logAuthEvent(
    context: UserLogContext,
    event: 'LOGIN' | 'LOGOUT' | 'SESSION_EXPIRED' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'ROLE_CHANGE',
    success: boolean,
    details?: Record<string, any>
  ): Promise<void> {
    const action: UserAction = {
      action: event,
      category: 'AUTH',
      severity: success ? 'MEDIUM' : 'HIGH',
      description: this.getAuthEventDescription(event, success),
      success,
      metadata: details
    };

    await this.logUserAction(context, action);
  }

  /**
   * Log user navigation and page access
   */
  static async logNavigation(
    context: UserLogContext,
    page: string,
    referrer?: string,
    duration?: number
  ): Promise<void> {
    const action: UserAction = {
      action: 'PAGE_ACCESS',
      category: 'NAVIGATION',
      severity: 'LOW',
      description: `Accessed page: ${page}`,
      targetResource: page,
      success: true,
      duration,
      metadata: { referrer }
    };

    await this.logUserAction(context, action);
  }

  /**
   * Log data access operations
   */
  static async logDataAccess(
    context: UserLogContext,
    resource: string,
    resourceId: string,
    operation: 'READ' | 'SEARCH' | 'EXPORT',
    recordCount?: number
  ): Promise<void> {
    const action: UserAction = {
      action: `DATA_${operation}`,
      category: 'DATA_ACCESS',
      severity: 'LOW',
      description: `${operation} operation on ${resource}`,
      targetResource: resource,
      targetId: resourceId,
      success: true,
      metadata: { recordCount }
    };

    await this.logUserAction(context, action);
  }

  /**
   * Log data modification operations
   */
  static async logDataModification(
    context: UserLogContext,
    resource: string,
    resourceId: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    beforeState?: any,
    afterState?: any,
    changes?: string[]
  ): Promise<void> {
    const action: UserAction = {
      action: `DATA_${operation}`,
      category: 'DATA_MODIFICATION',
      severity: 'MEDIUM',
      description: `${operation} operation on ${resource}`,
      targetResource: resource,
      targetId: resourceId,
      beforeState,
      afterState,
      changes,
      success: true
    };

    await this.logUserAction(context, action);
  }

  /**
   * Log economic actions
   */
  static async logEconomicAction(
    context: UserLogContext,
    action: string,
    description: string,
    impact?: Record<string, any>
  ): Promise<void> {
    const userAction: UserAction = {
      action,
      category: 'ECONOMIC',
      severity: 'MEDIUM',
      description,
      success: true,
      metadata: { impact }
    };

    await this.logUserAction(context, userAction);
  }

  /**
   * Log diplomatic actions
   */
  static async logDiplomaticAction(
    context: UserLogContext,
    action: string,
    description: string,
    targetCountry?: string,
    details?: Record<string, any>
  ): Promise<void> {
    const userAction: UserAction = {
      action,
      category: 'DIPLOMATIC',
      severity: 'HIGH',
      description,
      targetId: targetCountry,
      success: true,
      metadata: details
    };

    await this.logUserAction(context, userAction);
  }

  /**
   * Log intelligence operations
   */
  static async logIntelligenceAction(
    context: UserLogContext,
    action: string,
    description: string,
    classification: 'PUBLIC' | 'CONFIDENTIAL' | 'SECRET',
    details?: Record<string, any>
  ): Promise<void> {
    const userAction: UserAction = {
      action,
      category: 'INTELLIGENCE',
      severity: classification === 'SECRET' ? 'CRITICAL' : 'HIGH',
      description,
      success: true,
      metadata: { classification, ...details }
    };

    await this.logUserAction(context, userAction);
  }

  /**
   * Get user activity summary for a date range
   */
  static async getUserActivitySummary(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UserActivitySummary> {
    try {
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

      const summary: UserActivitySummary = {
        userId,
        date: startDate.toISOString().split('T')[0],
        totalActions: logs.length,
        uniqueSessions: new Set(logs.map(l => l.requestId).filter(Boolean)).size,
        categories: {},
        topActions: [],
        errorCount: logs.filter(l => l.level === 'ERROR').length,
        averageSessionDuration: 0,
        peakActivityHour: 0,
        countriesAccessed: [],
        securityEvents: logs.filter(l => l.category === 'SECURITY').length
      };

      // Analyze categories
      logs.forEach(log => {
        const metadata = this.safeParseMetadata(log.metadata);
        const category = metadata?.category ?? 'UNKNOWN';
        summary.categories[category] = (summary.categories[category] || 0) + 1;
      });

      // Find top actions
      const actionCounts: Record<string, number> = {};
      logs.forEach(log => {
        const metadata = this.safeParseMetadata(log.metadata);
        const action = metadata?.action ?? 'UNKNOWN';
        actionCounts[action] = (actionCounts[action] || 0) + 1;
      });

      summary.topActions = Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate peak activity hour
      const hourCounts: Record<number, number> = {};
      logs.forEach(log => {
        const hour = log.timestamp.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      summary.peakActivityHour = Object.entries(hourCounts)
        .reduce((max, [hour, count]) => count > hourCounts[max] ? parseInt(hour) : max, 0);

      return summary;

    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserLogger',
        action: 'GET_ACTIVITY_SUMMARY',
        userId
      });
      throw error;
    }
  }

  /**
   * Get user log file path
   */
  private static getUserLogFilePath(clerkUserId: string): string {
    // Sanitize the user ID to prevent illegal path characters
    const sanitizedUserId = clerkUserId.replace(/[<>:"/\\|?*]/g, '_');
    return join(this.LOG_DIR, `user-${sanitizedUserId}.log`);
  }

  /**
   * Write log entry to user-specific file
   */
  private static async writeToUserLogFile(clerkUserId: string, logEntry: any): Promise<void> {
    try {
      const filePath = this.getUserLogFilePath(clerkUserId);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      appendFileSync(filePath, logLine);

      // Check file size and rotate if necessary
      const stats = require('fs').statSync(filePath);
      if (stats.size > this.MAX_LOG_FILE_SIZE) {
        await this.rotateUserLogFile(clerkUserId);
      }
    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserLogger',
        action: 'WRITE_USER_LOG_FILE',
        userId: clerkUserId
      });
    }
  }

  /**
   * Rotate user log file when it gets too large
   */
  private static async rotateUserLogFile(clerkUserId: string): Promise<void> {
    try {
      const filePath = this.getUserLogFilePath(clerkUserId);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = `${filePath}.${timestamp}`;
      
      require('fs').renameSync(filePath, rotatedPath);
      
      // Compress old log files
      this.compressLogFile(rotatedPath);
    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserLogger',
        action: 'ROTATE_USER_LOG_FILE',
        userId: clerkUserId
      });
    }
  }

  /**
   * Compress log file to save space
   */
  private static compressLogFile(filePath: string): void {
    try {
      const gzip = require('zlib').createGzip();
      const fs = require('fs');
      const input = fs.createReadStream(filePath);
      const output = fs.createWriteStream(`${filePath}.gz`);
      
      input.pipe(gzip).pipe(output);
      
      output.on('finish', () => {
        fs.unlinkSync(filePath); // Remove original file
      });
    } catch (error) {
      // Silent fail for compression
    }
  }

  /**
   * Persist log entry to database
   */
  private static async persistToDatabase(logEntry: any): Promise<void> {
    try {
      await db.systemLog.create({
        data: {
          level: this.getLogLevelString(logEntry.severity),
          category: 'USER_ACTION',
          message: `${logEntry.action}: ${logEntry.description}`,
          userId: logEntry.userId,
          countryId: logEntry.countryId,
          requestId: logEntry.requestId,
          traceId: logEntry.traceId,
          duration: logEntry.duration,
          errorMessage: logEntry.errorMessage,
          metadata: JSON.stringify({
            action: logEntry.action,
            category: logEntry.category,
            severity: logEntry.severity,
            targetResource: logEntry.targetResource,
            targetId: logEntry.targetId,
            success: logEntry.success,
            changes: logEntry.changes,
            ...logEntry.metadata
          }),
          component: 'UserLogger',
          ip: logEntry.ipAddress,
          userAgent: logEntry.userAgent,
          endpoint: logEntry.endpoint,
          method: logEntry.method,
          timestamp: new Date(logEntry.timestamp)
        }
      });
    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserLogger',
        action: 'PERSIST_TO_DATABASE'
      });
    }
  }

  /**
   * Update user session activity
   */
  private static async updateUserSession(context: UserLogContext): Promise<void> {
    try {
      if (!context.sessionId) return;

      await db.userSession.updateMany({
        where: {
          clerkUserId: context.clerkUserId,
          isActive: true
        },
        data: {
          lastActivity: new Date(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        }
      });
    } catch (error) {
      // Silent fail for session updates
    }
  }

  /**
   * Log security events
   */
  private static async logSecurityEvent(context: UserLogContext, action: UserAction): Promise<void> {
    try {
      await db.systemLog.create({
        data: {
          level: 'WARN',
          category: 'SECURITY',
          message: `Security event: ${action.action} by user ${context.clerkUserId}`,
          userId: context.userId,
          countryId: context.countryId,
          requestId: context.requestId,
          metadata: JSON.stringify({
            action: action.action,
            severity: action.severity,
            success: action.success,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent
          }),
          component: 'UserLogger',
          ip: context.ipAddress,
          userAgent: context.userAgent,
          timestamp: new Date()
        }
      });
    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserLogger',
        action: 'LOG_SECURITY_EVENT'
      });
    }
  }

  /**
   * Generate unique log ID
   */
  private static generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get log level from severity
   */
  private static getLogLevel(severity: string): LogLevel {
    switch (severity) {
      case 'LOW': return LogLevel.INFO;
      case 'MEDIUM': return LogLevel.INFO;
      case 'HIGH': return LogLevel.WARN;
      case 'CRITICAL': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  /**
   * Get log level string from severity
   */
  private static getLogLevelString(severity: string): string {
    switch (severity) {
      case 'LOW': return 'INFO';
      case 'MEDIUM': return 'INFO';
      case 'HIGH': return 'WARN';
      case 'CRITICAL': return 'ERROR';
      default: return 'INFO';
    }
  }

  /**
   * Get authentication event description
   */
  private static getAuthEventDescription(event: string, success: boolean): string {
    const descriptions = {
      LOGIN: success ? 'User logged in successfully' : 'Login attempt failed',
      LOGOUT: 'User logged out',
      SESSION_EXPIRED: 'User session expired',
      LOGIN_FAILED: 'Failed login attempt',
      PASSWORD_CHANGE: 'Password changed',
      ROLE_CHANGE: 'User role changed'
    };
    return descriptions[event as keyof typeof descriptions] || event;
  }

  /**
   * Clean up old user logs
   */
  static async cleanupOldLogs(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.LOG_RETENTION_DAYS);

      // Delete old database logs
      await db.systemLog.deleteMany({
        where: {
          category: 'USER_ACTION',
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      // Clean up old log files
      const fs = require('fs');
      const files = fs.readdirSync(this.LOG_DIR);
      
      for (const file of files) {
        const filePath = join(this.LOG_DIR, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
        }
      }

      logger.info(LogCategory.SYSTEM, 'User logs cleanup completed', {
        component: 'UserLogger',
        metadata: { cutoffDate: cutoffDate.toISOString() }
      });
    } catch (error) {
      ErrorLogger.logError(error as Error, {
        component: 'UserLogger',
        action: 'CLEANUP_OLD_LOGS'
      });
    }
  }
}

// Initialize on import
UserLogger.initialize();

export default UserLogger;
