/**
 * Production-optimized console utilities
 * Prevents console.log statements from appearing in production builds
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Development-only console.log
 * Automatically stripped in production builds
 */
export const devLog = (...args: any[]) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

/**
 * Development-only console.warn
 * Automatically stripped in production builds
 */
export const devWarn = (...args: any[]) => {
  if (isDevelopment) {
    console.warn(...args);
  }
};

/**
 * Development-only console.error
 * Automatically stripped in production builds
 */
export const devError = (...args: any[]) => {
  if (isDevelopment) {
    console.error(...args);
  }
};

/**
 * Production-safe console.log with environment check
 * Only logs in development, warns in production
 */
export const safeLog = (...args: any[]) => {
  if (isDevelopment) {
    console.log(...args);
  } else {
    // In production, use proper logging system
    console.warn('[PRODUCTION] Console.log detected, use proper logging system');
  }
};

/**
 * Production-safe console.warn
 * Always logs warnings regardless of environment
 */
export const safeWarn = (...args: any[]) => {
  console.warn(...args);
};

/**
 * Production-safe console.error
 * Always logs errors regardless of environment
 */
export const safeError = (...args: any[]) => {
  console.error(...args);
};

/**
 * Debug logging with component context
 */
export const debugLog = (component: string, message: string, ...args: any[]) => {
  if (isDevelopment) {
    console.log(`[${component}] ${message}`, ...args);
  }
};

/**
 * Performance logging (always enabled for monitoring)
 */
export const perfLog = (message: string, ...args: any[]) => {
  console.log(`[PERF] ${message}`, ...args);
};

/**
 * Security logging (always enabled for audit trail)
 */
export const securityLog = (message: string, ...args: any[]) => {
  console.warn(`[SECURITY] ${message}`, ...args);
};
