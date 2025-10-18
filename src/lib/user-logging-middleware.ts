/**
 * User Logging Middleware for tRPC
 * 
 * This middleware automatically captures user actions and logs them
 * with proper context and categorization.
 */

import { TRPCError } from "@trpc/server";
import { UserLogger, type UserLogContext, type UserAction } from "./user-logger";
import { ErrorLogger } from "./error-logger";

export interface UserLoggingConfig {
  enabled: boolean;
  logLevel: 'ALL' | 'MUTATIONS_ONLY' | 'SENSITIVE_ONLY';
  excludePaths: string[];
  includeMetadata: boolean;
  logPerformance: boolean;
}

const DEFAULT_CONFIG: UserLoggingConfig = {
  enabled: true,
  logLevel: 'MUTATIONS_ONLY',
  logPerformance: true,
  excludePaths: [
    'users.getProfile',
    'countries.getCountryData',
    'ixtime.getCurrentTime',
    'system.health'
  ],
  includeMetadata: true
};

export function createUserLoggingMiddleware(config: Partial<UserLoggingConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async ({ ctx, next, path, input, type }: {
    ctx: any;
    next: () => Promise<any>;
    path: string;
    input: any;
    type: string;
  }) => {
    if (!finalConfig.enabled) {
      return next();
    }

    // Skip if path is excluded
    if (finalConfig.excludePaths.includes(path)) {
      return next();
    }

    // Skip if no user context
    if (!ctx.auth?.userId || !ctx.user) {
      return next();
    }

    const startTime = Date.now();
    let result;
    let error: Error | null = null;
    let success = true;

    // Create user log context
    const userContext: UserLogContext = {
      userId: ctx.user.id,
      clerkUserId: ctx.auth.userId,
      countryId: ctx.user.countryId || undefined,
      roleId: ctx.user.roleId || undefined,
      sessionId: ctx.headers?.get('x-session-id') || undefined,
      ipAddress: ctx.headers?.get('x-forwarded-for') || ctx.headers?.get('x-real-ip') || undefined,
      userAgent: ctx.headers?.get('user-agent') || undefined,
      endpoint: path,
      method: 'tRPC',
      requestId: ctx.headers?.get('x-request-id') || undefined,
      traceId: ctx.headers?.get('x-trace-id') || undefined,
      metadata: finalConfig.includeMetadata ? {
        input: sanitizeInput(input),
        userRole: ctx.user.role?.name,
        membershipTier: ctx.user.membershipTier
      } : undefined
    };

    try {
      result = await next();
    } catch (err) {
      error = err as Error;
      success = false;
      throw err;
    } finally {
      const duration = Date.now() - startTime;

      // Determine if we should log this action
      const shouldLog = shouldLogAction(path, type, finalConfig);

      if (shouldLog) {
        try {
          const action = createUserAction(path, type, success, error, duration, input);
          await UserLogger.logUserAction(userContext, action);
        } catch (logError) {
          // Don't fail the request if logging fails
          ErrorLogger.logError(logError as Error, {
            component: 'UserLoggingMiddleware',
            action: 'LOG_USER_ACTION',
            userId: ctx.auth.userId
          });
        }
      }
    }

    return result;
  };
}

/**
 * Determine if an action should be logged based on configuration
 */
function shouldLogAction(path: string, type: string, config: UserLoggingConfig): boolean {
  if (config.logLevel === 'ALL') {
    return true;
  }

  if (config.logLevel === 'MUTATIONS_ONLY') {
    return type === 'mutation';
  }

  if (config.logLevel === 'SENSITIVE_ONLY') {
    return isSensitiveAction(path);
  }

  return false;
}

/**
 * Check if an action is considered sensitive
 */
function isSensitiveAction(path: string): boolean {
  const sensitivePatterns = [
    'execute',
    'create',
    'update',
    'delete',
    'admin',
    'auth',
    'security',
    'intelligence',
    'diplomatic',
    'economic',
    'settings'
  ];

  return sensitivePatterns.some(pattern => 
    path.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Create user action from tRPC context
 */
function createUserAction(
  path: string,
  type: string,
  success: boolean,
  error: Error | null,
  duration: number,
  input: any
): UserAction {
  const action = extractActionName(path);
  const category = determineCategory(path);
  const severity = determineSeverity(path, success, error);

  return {
    action,
    category,
    severity,
    description: generateDescription(path, type, success, error),
    success,
    errorMessage: error?.message,
    duration: duration > 1000 ? duration : undefined, // Only log if > 1s
    metadata: {
      path,
      type,
      inputKeys: input ? Object.keys(input) : []
    }
  };
}

/**
 * Extract action name from path
 */
function extractActionName(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1]?.toUpperCase() || 'UNKNOWN';
}

/**
 * Determine action category from path
 */
function determineCategory(path: string): UserAction['category'] {
  const pathLower = path.toLowerCase();

  if (pathLower.includes('auth') || pathLower.includes('login') || pathLower.includes('logout')) {
    return 'AUTH';
  }
  if (pathLower.includes('admin') || pathLower.includes('system')) {
    return 'ADMIN';
  }
  if (pathLower.includes('intelligence') || pathLower.includes('intel')) {
    return 'INTELLIGENCE';
  }
  if (pathLower.includes('diplomatic') || pathLower.includes('embassy')) {
    return 'DIPLOMATIC';
  }
  if (pathLower.includes('economic') || pathLower.includes('budget') || pathLower.includes('finance')) {
    return 'ECONOMIC';
  }
  if (pathLower.includes('social') || pathLower.includes('thinkpages') || pathLower.includes('thinktank')) {
    return 'SOCIAL';
  }
  if (pathLower.includes('settings') || pathLower.includes('preferences')) {
    return 'SETTINGS';
  }
  if (pathLower.includes('create') || pathLower.includes('update') || pathLower.includes('delete')) {
    return 'DATA_MODIFICATION';
  }
  if (pathLower.includes('get') || pathLower.includes('list') || pathLower.includes('search')) {
    return 'DATA_ACCESS';
  }

  return 'DATA_ACCESS';
}

/**
 * Determine severity based on action and outcome
 */
function determineSeverity(path: string, success: boolean, error: Error | null): UserAction['severity'] {
  if (error) {
    return 'HIGH';
  }

  if (!success) {
    return 'MEDIUM';
  }

  const pathLower = path.toLowerCase();

  // Critical actions
  if (pathLower.includes('admin') || pathLower.includes('security') || pathLower.includes('delete')) {
    return 'HIGH';
  }

  // Sensitive actions
  if (pathLower.includes('execute') || pathLower.includes('intelligence') || pathLower.includes('diplomatic')) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Generate human-readable description
 */
function generateDescription(path: string, type: string, success: boolean, error: Error | null): string {
  const action = extractActionName(path);
  const resource = extractResourceName(path);
  
  let description = `${action} operation on ${resource}`;
  
  if (type === 'mutation') {
    description = `Modified ${resource}`;
  } else if (type === 'query') {
    description = `Accessed ${resource}`;
  }

  if (!success) {
    description += ` (failed: ${error?.message || 'unknown error'})`;
  }

  return description;
}

/**
 * Extract resource name from path
 */
function extractResourceName(path: string): string {
  const parts = path.split('.');
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return 'unknown resource';
}

/**
 * Sanitize input for logging (remove sensitive data)
 */
function sanitizeInput(input: any): any {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
  const sanitized = { ...input };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Limit object depth and size
  return limitObjectDepth(sanitized, 3);
}

/**
 * Limit object depth to prevent huge log entries
 */
function limitObjectDepth(obj: any, maxDepth: number, currentDepth = 0): any {
  if (currentDepth >= maxDepth || !obj || typeof obj !== 'object') {
    return '[MAX_DEPTH_REACHED]';
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map(item => limitObjectDepth(item, maxDepth, currentDepth + 1));
  }

  const limited: any = {};
  const keys = Object.keys(obj).slice(0, 20); // Limit to 20 keys

  for (const key of keys) {
    limited[key] = limitObjectDepth(obj[key], maxDepth, currentDepth + 1);
  }

  return limited;
}

/**
 * Create specialized middleware for different action types
 */
export const userLoggingMiddleware = {
  // Standard middleware for all procedures
  standard: createUserLoggingMiddleware(),

  // Middleware for mutations only
  mutations: createUserLoggingMiddleware({
    logLevel: 'MUTATIONS_ONLY'
  }),

  // Middleware for sensitive operations only
  sensitive: createUserLoggingMiddleware({
    logLevel: 'SENSITIVE_ONLY'
  }),

  // Middleware for all operations
  comprehensive: createUserLoggingMiddleware({
    logLevel: 'ALL'
  }),

  // Middleware with performance logging
  withPerformance: createUserLoggingMiddleware({
    logLevel: 'ALL',
    logPerformance: true
  }),

  // Middleware for admin operations
  admin: createUserLoggingMiddleware({
    logLevel: 'ALL',
    includeMetadata: true
  })
};

export default userLoggingMiddleware;
