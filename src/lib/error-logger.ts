/**
 * Error Logging System for Production
 *
 * Provides comprehensive error logging with Discord webhook integration,
 * file logging, and structured error tracking for production environments.
 */

import { db } from "~/server/db";

export interface ErrorContext {
  userId?: string;
  countryId?: string;
  path?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export interface LoggedError {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  stack?: string;
  context?: ErrorContext;
  userAgent?: string;
  ip?: string;
}

/**
 * Main error logger - logs to console, file (via PM2), and optionally Discord
 */
export class ErrorLogger {
  private static discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  private static discordEnabled = process.env.DISCORD_WEBHOOK_ENABLED === 'true';
  private static environment = process.env.NODE_ENV || 'development';

  /**
   * Log an error with full context
   */
  static async logError(
    error: Error | string,
    context?: ErrorContext,
    level: 'ERROR' | 'WARN' | 'INFO' = 'ERROR'
  ): Promise<void> {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;

    const logEntry: LoggedError = {
      timestamp: new Date().toISOString(),
      level,
      message: errorMessage,
      stack,
      context,
    };

    // Console logging with proper formatting
    const logPrefix = `[${level}] [${this.environment.toUpperCase()}]`;

    if (level === 'ERROR') {
      console.error(logPrefix, errorMessage);
      if (stack) console.error('Stack:', stack);
    } else if (level === 'WARN') {
      console.warn(logPrefix, errorMessage);
    } else {
      console.log(logPrefix, errorMessage);
    }

    if (context) {
      console.log('Context:', JSON.stringify(context, null, 2));
    }

    // Persist critical errors to database (async, don't await)
    if (level === 'ERROR' && this.environment === 'production') {
      this.persistErrorToDatabase(logEntry).catch(dbError => {
        console.error('[ERROR_LOGGER] Failed to persist error to database:', dbError);
      });
    }

    // Send to Discord webhook for production errors
    if (this.discordEnabled && level === 'ERROR' && this.environment === 'production') {
      this.sendToDiscord(logEntry).catch(discordError => {
        console.error('[ERROR_LOGGER] Failed to send to Discord:', discordError);
      });
    }
  }

  /**
   * Persist error to database for audit trail using SystemLog model
   */
  private static async persistErrorToDatabase(logEntry: LoggedError): Promise<void> {
    try {
      await db.systemLog.create({
        data: {
          level: logEntry.level,
          category: logEntry.context?.action || 'GENERAL',
          message: logEntry.message.slice(0, 1000), // Limit message length
          errorStack: logEntry.stack?.slice(0, 5000), // Limit stack length
          userId: logEntry.context?.userId || null,
          countryId: logEntry.context?.countryId || null,
          endpoint: logEntry.context?.path || null,
          component: logEntry.context?.component || null,
          metadata: logEntry.context?.metadata ? JSON.stringify(logEntry.context.metadata) : null,
          userAgent: logEntry.userAgent?.slice(0, 500) || null, // Limit to 500 chars
          ip: logEntry.ip || null,
          timestamp: new Date(logEntry.timestamp),
        }
      });
    } catch (error) {
      // Silent fail - don't throw in error logger
      console.error('[ERROR_LOGGER] Database persist failed:', error);
    }
  }

  /**
   * Send error notification to Discord webhook
   */
  private static async sendToDiscord(logEntry: LoggedError): Promise<void> {
    if (!this.discordWebhookUrl) return;

    const embed = {
      title: `🚨 ${logEntry.level}: ${logEntry.message.slice(0, 100)}`,
      description: logEntry.message.slice(0, 2000),
      color: logEntry.level === 'ERROR' ? 0xff0000 : 0xffa500,
      fields: [
        {
          name: 'Environment',
          value: this.environment,
          inline: true
        },
        {
          name: 'Timestamp',
          value: logEntry.timestamp,
          inline: true
        }
      ],
      timestamp: logEntry.timestamp
    };

    // Add context fields if available
    if (logEntry.context?.userId) {
      embed.fields.push({
        name: 'User ID',
        value: logEntry.context.userId.slice(0, 50),
        inline: true
      });
    }

    if (logEntry.context?.countryId) {
      embed.fields.push({
        name: 'Country ID',
        value: logEntry.context.countryId.slice(0, 50),
        inline: true
      });
    }

    if (logEntry.context?.path) {
      embed.fields.push({
        name: 'Path',
        value: logEntry.context.path.slice(0, 100),
        inline: false
      });
    }

    if (logEntry.stack) {
      embed.fields.push({
        name: 'Stack Trace',
        value: '```\n' + logEntry.stack.slice(0, 900) + '\n```',
        inline: false
      });
    }

    try {
      await fetch(this.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'IxStats Error Logger',
          embeds: [embed]
        })
      });
    } catch (error) {
      // Silent fail - don't throw in error logger
      console.error('[ERROR_LOGGER] Discord webhook failed:', error);
    }
  }

  /**
   * Log a warning
   */
  static warn(message: string, context?: ErrorContext): void {
    this.logError(message, context, 'WARN');
  }

  /**
   * Log an info message
   */
  static info(message: string, context?: ErrorContext): void {
    this.logError(message, context, 'INFO');
  }

  /**
   * Log CRUD operation failures
   */
  static async logCRUDError(
    operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    entity: string,
    error: Error,
    context?: ErrorContext
  ): Promise<void> {
    await this.logError(
      `CRUD ${operation} failed for ${entity}: ${error.message}`,
      {
        ...context,
        action: `${operation}_${entity}`,
      },
      'ERROR'
    );
  }

  /**
   * Log authentication/authorization errors
   */
  static async logAuthError(
    message: string,
    userId?: string,
    context?: ErrorContext
  ): Promise<void> {
    await this.logError(
      message,
      {
        ...context,
        userId,
        action: 'AUTH_ERROR',
      },
      'ERROR'
    );
  }

  /**
   * Log API/tRPC errors
   */
  static async logAPIError(
    endpoint: string,
    error: Error,
    context?: ErrorContext
  ): Promise<void> {
    await this.logError(
      `API Error [${endpoint}]: ${error.message}`,
      {
        ...context,
        path: endpoint,
        action: 'API_ERROR',
      },
      'ERROR'
    );
  }
}

/**
 * Global error handler for uncaught errors
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  window.addEventListener('error', (event) => {
    ErrorLogger.logError(event.error || event.message, {
      component: 'Global Error Handler',
      path: window.location.pathname,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    ErrorLogger.logError(
      event.reason instanceof Error ? event.reason : String(event.reason),
      {
        component: 'Unhandled Promise Rejection',
        path: window.location.pathname,
      }
    );
  });
}

export default ErrorLogger;
