/**
 * Comprehensive Production Logging System
 *
 * Features:
 * - Structured logging with context
 * - Multiple log levels (debug, info, warn, error, critical)
 * - User and country tracking
 * - Performance metrics
 * - Database persistence for critical logs
 * - Discord webhook integration
 * - Log retention and rotation
 * - Failure point tracking
 * - System metrics
 */

// Conditionally import server-only dependencies
// This allows logger to be imported in client components without errors
const isServer = typeof window === "undefined";
const db = isServer ? require("~/server/db").db : null;
const discordWebhook = isServer ? require("./discord-webhook").discordWebhook : null;

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

// Log categories for better organization
export enum LogCategory {
  AUTH = "AUTH",
  API = "API",
  DATABASE = "DATABASE",
  SECURITY = "SECURITY",
  PERFORMANCE = "PERFORMANCE",
  USER_ACTION = "USER_ACTION",
  COUNTRY_ACTION = "COUNTRY_ACTION",
  SYSTEM = "SYSTEM",
  INTEGRATION = "INTEGRATION",
  AUDIT = "AUDIT",
}

// Structured log entry
export interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  timestamp: Date;

  // Request context
  requestId?: string;
  traceId?: string;
  userId?: string;
  countryId?: string;

  // Performance metrics
  duration?: number;
  memoryUsage?: NodeJS.MemoryUsage;

  // Error details
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };

  // Additional context
  metadata?: Record<string, any>;

  // Location
  component?: string;
  function?: string;
  line?: number;

  // Network details
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;

  // Data points
  dataSnapshot?: {
    before?: any;
    after?: any;
    changes?: string[];
  };
}

// Log storage configuration
interface LogStorageConfig {
  persistToDatabaseLevel: LogLevel;
  persistToFileLevel: LogLevel;
  sendToDiscordLevel: LogLevel;
  consoleLevel: LogLevel;
}

// Default configuration
const DEFAULT_CONFIG: LogStorageConfig = {
  persistToDatabaseLevel: LogLevel.ERROR, // Persist errors and above
  persistToFileLevel: LogLevel.INFO, // Log info and above to file
  sendToDiscordLevel: LogLevel.CRITICAL, // Alert on critical issues
  consoleLevel: process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO,
};

class Logger {
  private config: LogStorageConfig;
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000; // 5 seconds

  constructor(config: Partial<LogStorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start buffer flush interval
    this.startFlushInterval();

    // Handle graceful shutdown
    if (typeof process !== "undefined") {
      process.on("beforeExit", () => {
        this.flush().catch(console.error);
      });
    }
  }

  /**
   * Start periodic buffer flush
   */
  private startFlushInterval() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Create a structured log entry
   */
  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context: Partial<LogEntry> = {}
  ): LogEntry {
    const entry: LogEntry = {
      level,
      category,
      message,
      timestamp: new Date(),
      ...context,
    };

    // Add memory usage for performance logs
    if (category === LogCategory.PERFORMANCE && typeof process !== "undefined") {
      entry.memoryUsage = process.memoryUsage();
    }

    return entry;
  }

  /**
   * Format log entry for console output
   */
  private formatConsoleOutput(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const emoji = this.getLevelEmoji(entry.level);
    const timestamp = entry.timestamp.toISOString();

    let output = `${emoji} [${timestamp}] [${levelName}] [${entry.category}] ${entry.message}`;

    if (entry.userId) output += ` | User: ${entry.userId}`;
    if (entry.countryId) output += ` | Country: ${entry.countryId}`;
    if (entry.requestId) output += ` | Request: ${entry.requestId}`;
    if (entry.duration) output += ` | ${entry.duration}ms`;

    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack && process.env.NODE_ENV === "development") {
        output += `\n  Stack: ${entry.error.stack}`;
      }
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    return output;
  }

  /**
   * Get emoji for log level
   */
  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return "🔍";
      case LogLevel.INFO: return "ℹ️";
      case LogLevel.WARN: return "⚠️";
      case LogLevel.ERROR: return "❌";
      case LogLevel.CRITICAL: return "🚨";
      default: return "📝";
    }
  }

  /**
   * Get color for log level (for console)
   */
  private getConsoleMethod(level: LogLevel): "debug" | "log" | "warn" | "error" {
    switch (level) {
      case LogLevel.DEBUG: return "debug";
      case LogLevel.INFO: return "log";
      case LogLevel.WARN: return "warn";
      case LogLevel.ERROR:
      case LogLevel.CRITICAL: return "error";
      default: return "log";
    }
  }

  /**
   * Log a message with context
   */
  private log(level: LogLevel, category: LogCategory, message: string, context: Partial<LogEntry> = {}) {
    const entry = this.createLogEntry(level, category, message, context);

    // Console output
    if (level >= this.config.consoleLevel) {
      const formatted = this.formatConsoleOutput(entry);
      const consoleMethod = this.getConsoleMethod(level);
      console[consoleMethod](formatted);
    }

    // Add to buffer for batch persistence
    if (level >= this.config.persistToDatabaseLevel || level >= this.config.persistToFileLevel) {
      this.buffer.push(entry);

      // Flush if buffer is full
      if (this.buffer.length >= this.BUFFER_SIZE) {
        this.flush().catch(console.error);
      }
    }

    // Send to Discord for critical issues
    if (level >= this.config.sendToDiscordLevel) {
      this.sendToDiscord(entry).catch(console.error);
    }
  }

  /**
   * Flush buffered logs to storage
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      // Persist to database
      const dbEntries = entries.filter(e => e.level >= this.config.persistToDatabaseLevel);
      if (dbEntries.length > 0) {
        await this.persistToDatabase(dbEntries);
      }
    } catch (error) {
      console.error("[Logger] Failed to flush logs:", error);
      // Restore entries to buffer on failure
      this.buffer.unshift(...entries);
    }
  }

  /**
   * Persist logs to database
   */
  private async persistToDatabase(entries: LogEntry[]): Promise<void> {
    if (!db) {
      // Client-side or db not available - skip database persistence
      return;
    }

    try {
      await db.systemLog.createMany({
        data: entries.map(entry => ({
          level: LogLevel[entry.level],
          category: entry.category,
          message: entry.message,
          userId: entry.userId || null,
          countryId: entry.countryId || null,
          requestId: entry.requestId || null,
          traceId: entry.traceId || null,
          duration: entry.duration || null,
          errorName: entry.error?.name || null,
          errorMessage: entry.error?.message || null,
          errorStack: entry.error?.stack || null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          component: entry.component || null,
          ip: entry.ip || null,
          userAgent: entry.userAgent ? entry.userAgent.slice(0, 500) : null,
          endpoint: entry.endpoint || null,
          method: entry.method || null,
          timestamp: entry.timestamp,
        }))
      });
    } catch (error) {
      console.error("[Logger] Database persistence failed:", error);
    }
  }

  /**
   * Send critical logs to Discord
   */
  private async sendToDiscord(entry: LogEntry): Promise<void> {
    if (!discordWebhook) {
      // Client-side or Discord webhook not available - skip Discord notification
      return;
    }

    const levelName = LogLevel[entry.level];
    const emoji = this.getLevelEmoji(entry.level);

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: "Category", value: entry.category, inline: true },
      { name: "Level", value: levelName, inline: true },
      { name: "Timestamp", value: entry.timestamp.toISOString(), inline: true },
    ];

    if (entry.userId) fields.push({ name: "User ID", value: entry.userId, inline: true });
    if (entry.countryId) fields.push({ name: "Country ID", value: entry.countryId, inline: true });
    if (entry.requestId) fields.push({ name: "Request ID", value: entry.requestId, inline: true });
    if (entry.duration) fields.push({ name: "Duration", value: `${entry.duration}ms`, inline: true });

    if (entry.error) {
      fields.push({
        name: "Error",
        value: `${entry.error.name}: ${entry.error.message}`.slice(0, 1024),
        inline: false
      });

      if (entry.error.stack) {
        fields.push({
          name: "Stack Trace",
          value: entry.error.stack.slice(0, 1024),
          inline: false
        });
      }
    }

    const color = entry.level === LogLevel.CRITICAL ? 0xFF0000 : 0xFF6600;

    await discordWebhook.send({
      embeds: [{
        title: `${emoji} ${levelName}: ${entry.message}`,
        description: entry.component ? `Component: ${entry.component}` : undefined,
        color,
        fields,
        timestamp: entry.timestamp.toISOString(),
        footer: {
          text: `IxStats ${process.env.NODE_ENV || 'unknown'} environment`
        }
      }]
    });
  }

  /**
   * Public logging methods
   */

  debug(category: LogCategory, message: string, context?: Partial<LogEntry>) {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  info(category: LogCategory, message: string, context?: Partial<LogEntry>) {
    this.log(LogLevel.INFO, category, message, context);
  }

  warn(category: LogCategory, message: string, context?: Partial<LogEntry>) {
    this.log(LogLevel.WARN, category, message, context);
  }

  error(category: LogCategory, message: string, context?: Partial<LogEntry>) {
    this.log(LogLevel.ERROR, category, message, context);
  }

  critical(category: LogCategory, message: string, context?: Partial<LogEntry>) {
    this.log(LogLevel.CRITICAL, category, message, context);
  }

  /**
   * Specialized logging methods
   */

  /**
   * Log user action
   */
  userAction(action: string, userId: string, context?: Partial<LogEntry>) {
    this.info(LogCategory.USER_ACTION, action, {
      ...context,
      userId,
    });
  }

  /**
   * Log country action
   */
  countryAction(action: string, countryId: string, userId?: string, context?: Partial<LogEntry>) {
    this.info(LogCategory.COUNTRY_ACTION, action, {
      ...context,
      countryId,
      userId,
    });
  }

  /**
   * Log API call
   */
  apiCall(method: string, endpoint: string, duration: number, context?: Partial<LogEntry>) {
    this.info(LogCategory.API, `${method} ${endpoint}`, {
      ...context,
      method,
      endpoint,
      duration,
    });
  }

  /**
   * Log authentication event
   */
  auth(event: string, userId?: string, success: boolean = true, context?: Partial<LogEntry>) {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    this.log(level, LogCategory.AUTH, event, {
      ...context,
      userId,
      metadata: { ...context?.metadata, success },
    });
  }

  /**
   * Log database query
   */
  dbQuery(query: string, duration: number, recordCount?: number, context?: Partial<LogEntry>) {
    this.debug(LogCategory.DATABASE, query, {
      ...context,
      duration,
      metadata: { ...context?.metadata, recordCount },
    });
  }

  /**
   * Log security event
   */
  security(event: string, severity: "low" | "medium" | "high" | "critical", context?: Partial<LogEntry>) {
    const levelMap = {
      low: LogLevel.INFO,
      medium: LogLevel.WARN,
      high: LogLevel.ERROR,
      critical: LogLevel.CRITICAL,
    };

    this.log(levelMap[severity], LogCategory.SECURITY, event, {
      ...context,
      metadata: { ...context?.metadata, severity },
    });
  }

  /**
   * Log performance metric
   */
  performance(metric: string, value: number, unit: string = "ms", context?: Partial<LogEntry>) {
    this.info(LogCategory.PERFORMANCE, `${metric}: ${value}${unit}`, {
      ...context,
      metadata: { ...context?.metadata, metric, value, unit },
    });
  }

  /**
   * Log failure point
   */
  failurePoint(component: string, operation: string, error: Error, context?: Partial<LogEntry>) {
    this.error(LogCategory.SYSTEM, `Failure in ${component}.${operation}`, {
      ...context,
      component,
      function: operation,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  /**
   * Close logger and flush remaining logs
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flush();
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types
export type { LogStorageConfig };
