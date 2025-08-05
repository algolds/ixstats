/**
 * React Key Validation Utilities
 * Comprehensive utilities to prevent duplicate/empty key errors
 */

/**
 * Generate a safe React key that is guaranteed to be unique and non-empty
 * @param id - Primary identifier (can be undefined, null, or empty string)
 * @param fallbackPrefix - Prefix for fallback key
 * @param index - Array index for fallback uniqueness
 * @param additionalContext - Additional context for uniqueness
 * @returns A valid, unique React key
 */
export function generateSafeKey(
  id: string | undefined | null,
  fallbackPrefix: string,
  index: number,
  additionalContext?: string | number
): string {
  // Validate and clean the primary ID
  const cleanId = id && typeof id === 'string' ? id.trim() : '';
  
  // If we have a valid ID, use it with prefix
  if (cleanId && cleanId.length > 0) {
    const baseKey = `${fallbackPrefix}-${cleanId}`;
    // Add additional context if provided for extra uniqueness
    return additionalContext !== undefined 
      ? `${baseKey}-${additionalContext}`
      : baseKey;
  }
  
  // Generate fallback key with timestamp and index for guaranteed uniqueness
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substr(2, 5);
  const contextSuffix = additionalContext !== undefined ? `-${additionalContext}` : '';
  
  return `${fallbackPrefix}-fallback-${index}-${timestamp}-${randomSuffix}${contextSuffix}`;
}

/**
 * Generate keys for array items with guaranteed uniqueness
 * @param items - Array of items
 * @param getIdFn - Function to extract ID from item
 * @param prefix - Prefix for keys
 * @returns Array of unique keys matching the items array
 */
export function generateArrayKeys<T>(
  items: T[],
  getIdFn: (item: T) => string | undefined | null,
  prefix: string
): string[] {
  const usedKeys = new Set<string>();
  const keys: string[] = [];
  
  items.forEach((item, index) => {
    let key = generateSafeKey(getIdFn(item), prefix, index);
    
    // Ensure absolute uniqueness even if generateSafeKey somehow produces duplicates
    let counter = 0;
    const originalKey = key;
    while (usedKeys.has(key)) {
      counter++;
      key = `${originalKey}-duplicate-${counter}`;
    }
    
    usedKeys.add(key);
    keys.push(key);
  });
  
  return keys;
}

/**
 * Validate that a key is safe for React
 * @param key - The key to validate
 * @returns True if key is safe, false otherwise
 */
export function isValidReactKey(key: any): key is string {
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Clean and validate an existing key, generating fallback if needed
 * @param key - Existing key
 * @param fallbackPrefix - Prefix for fallback
 * @param index - Index for fallback
 * @returns Valid React key
 */
export function ensureValidKey(
  key: any,
  fallbackPrefix: string,
  index: number
): string {
  if (isValidReactKey(key)) {
    return key;
  }
  
  return generateSafeKey(null, fallbackPrefix, index);
}

/**
 * Create a key validator for specific component types
 * @param componentName - Name of the component for debugging
 * @returns Key validation function
 */
export function createKeyValidator(componentName: string) {
  const usedKeys = new Set<string>();
  
  return function validateKey(
    key: string,
    itemDescription: string = 'item'
  ): string {
    if (!isValidReactKey(key)) {
      console.warn(`[${componentName}] Invalid key for ${itemDescription}:`, key);
      throw new Error(`Invalid React key in ${componentName}: key must be a non-empty string`);
    }
    
    if (usedKeys.has(key)) {
      console.error(`[${componentName}] Duplicate key detected:`, key, 'for', itemDescription);
      throw new Error(`Duplicate React key in ${componentName}: ${key}`);
    }
    
    usedKeys.add(key);
    return key;
  };
}

/**
 * Generate unique keys for notification-like objects
 * @param notifications - Array of notification objects
 * @returns Array of unique keys
 */
export function generateNotificationKeys(
  notifications: Array<{ id?: string | null; [key: string]: any }>
): string[] {
  return generateArrayKeys(
    notifications,
    (notification) => notification.id,
    'notification'
  );
}

/**
 * Generate unique keys for intelligence insights
 * @param insights - Array of insight objects
 * @returns Array of unique keys
 */
export function generateInsightKeys(
  insights: Array<{ id?: string | null; [key: string]: any }>
): string[] {
  return generateArrayKeys(
    insights,
    (insight) => insight.id,
    'insight'
  );
}

/**
 * Generate unique keys for milestone objects
 * @param milestones - Array of milestone objects
 * @returns Array of unique keys
 */
export function generateMilestoneKeys(
  milestones: Array<{ id?: string | null; [key: string]: any }>
): string[] {
  return generateArrayKeys(
    milestones,
    (milestone) => milestone.id,
    'milestone'
  );
}

/**
 * Advanced key generation with context awareness
 * @param item - The item to generate key for
 * @param context - Context information
 * @returns Unique key
 */
export function generateContextualKey(
  item: { id?: string | null; [key: string]: any },
  context: {
    prefix: string;
    index: number;
    parentId?: string;
    timestamp?: number;
    additionalIdentifiers?: (string | number)[];
  }
): string {
  const { prefix, index, parentId, timestamp, additionalIdentifiers = [] } = context;
  
  // Build context parts
  const contextParts = [
    parentId && `parent-${parentId}`,
    timestamp && `ts-${timestamp}`,
    ...additionalIdentifiers.map(id => `ctx-${id}`)
  ].filter(Boolean);
  
  const contextString = contextParts.length > 0 ? contextParts.join('-') : '';
  
  return generateSafeKey(
    item.id,
    prefix,
    index,
    contextString
  );
}

/**
 * Debugging utility to analyze key issues in development
 * @param keys - Array of keys to analyze
 * @param componentName - Component name for logging
 */
export function debugKeyIssues(keys: string[], componentName: string): void {
  if (process.env.NODE_ENV !== 'development') return;
  
  const keyCount = new Map<string, number>();
  const emptyKeys: number[] = [];
  
  keys.forEach((key, index) => {
    if (!isValidReactKey(key)) {
      emptyKeys.push(index);
    }
    
    const count = keyCount.get(key) || 0;
    keyCount.set(key, count + 1);
  });
  
  const duplicates = Array.from(keyCount.entries())
    .filter(([key, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
  
  if (emptyKeys.length > 0) {
    console.warn(`[${componentName}] Empty/invalid keys at indices:`, emptyKeys);
  }
  
  if (duplicates.length > 0) {
    console.warn(`[${componentName}] Duplicate keys found:`, duplicates);
  }
  
  if (emptyKeys.length === 0 && duplicates.length === 0) {
    console.log(`[${componentName}] All keys are valid and unique ✓`);
  }
}

export default {
  generateSafeKey,
  generateArrayKeys,
  isValidReactKey,
  ensureValidKey,
  createKeyValidator,
  generateNotificationKeys,
  generateInsightKeys,
  generateMilestoneKeys,
  generateContextualKey,
  debugKeyIssues,
};