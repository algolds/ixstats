/**
 * Query Performance Optimizations
 * Addresses slow compilation and query performance issues
 */

import type { PrismaClient } from '@prisma/client';

// Global cache for expensive queries
const queryCache = new Map<string, {
  data: any;
  timestamp: number;
  ttl: number;
}>();

// Cache configuration
const CACHE_CONFIGS = {
  globalStats: 60000,      // 1 minute
  countryList: 30000,      // 30 seconds  
  userProfile: 10000,      // 10 seconds
  notifications: 5000,     // 5 seconds
} as const;

// Cache utilities
export function getCacheKey(operation: string, params: any = {}): string {
  return `${operation}_${JSON.stringify(params)}`;
}

export function getCachedResult<T>(key: string): T | null {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }
  if (cached) {
    queryCache.delete(key);
  }
  return null;
}

export function setCachedResult<T>(key: string, data: T, ttlMs: number): void {
  queryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
}

// Cleanup expired cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > value.ttl) {
      queryCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Optimized query functions
export async function getOptimizedCountryList(db: PrismaClient, params: {
  limit?: number;
  offset?: number;
  search?: string;
  continent?: string;
  economicTier?: string;
} = {}) {
  const cacheKey = getCacheKey('countryList', params);
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  const where: any = {};
  if (params.search) {
    where.name = { contains: params.search, mode: 'insensitive' };
  }
  if (params.continent) {
    where.continent = params.continent;
  }
  if (params.economicTier) {
    where.economicTier = params.economicTier;
  }

  // Optimized query - only select necessary fields
  const result = await db.country.findMany({
    where,
    select: {
      id: true,
      name: true,
      continent: true,
      region: true,
      flag: true,
      leader: true,
      currentPopulation: true,
      currentGdpPerCapita: true,
      currentTotalGdp: true,
      economicTier: true,
      populationTier: true,
      adjustedGdpGrowth: true,
      populationGrowthRate: true,
      lastCalculated: true,
    },
    orderBy: { name: 'asc' },
    take: params.limit || 100,
    skip: params.offset || 0,
  });

  setCachedResult(cacheKey, result, CACHE_CONFIGS.countryList);
  return result;
}

export async function getOptimizedGlobalStats(db: PrismaClient) {
  const cacheKey = getCacheKey('globalStats');
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  // Use a more efficient aggregation query
  const result = await db.$queryRaw`
    SELECT 
      COUNT(*) as totalCountries,
      COALESCE(SUM(currentPopulation), 0) as totalPopulation,
      COALESCE(SUM(currentTotalGdp), 0) as totalGdp,
      COALESCE(SUM(landArea), 0) as totalLand,
      COUNT(CASE WHEN economicTier = 'Impoverished' THEN 1 END) as impoverishedCount,
      COUNT(CASE WHEN economicTier = 'Developing' THEN 1 END) as developingCount,
      COUNT(CASE WHEN economicTier = 'Developed' THEN 1 END) as developedCount,
      COUNT(CASE WHEN economicTier = 'Healthy' THEN 1 END) as healthyCount,
      COUNT(CASE WHEN economicTier = 'Strong' THEN 1 END) as strongCount,
      COUNT(CASE WHEN economicTier = 'Very Strong' THEN 1 END) as veryStrongCount,
      COUNT(CASE WHEN economicTier = 'Extravagant' THEN 1 END) as extravagantCount,
      COUNT(CASE WHEN populationTier = '1' THEN 1 END) as popTier1Count,
      COUNT(CASE WHEN populationTier = '2' THEN 1 END) as popTier2Count,
      COUNT(CASE WHEN populationTier = '3' THEN 1 END) as popTier3Count,
      COUNT(CASE WHEN populationTier = '4' THEN 1 END) as popTier4Count,
      COUNT(CASE WHEN populationTier = '5' THEN 1 END) as popTier5Count,
      COUNT(CASE WHEN populationTier = '6' THEN 1 END) as popTier6Count,
      COUNT(CASE WHEN populationTier = '7' THEN 1 END) as popTier7Count,
      COUNT(CASE WHEN populationTier = 'X' THEN 1 END) as popTierXCount
    FROM Country
  ` as any[];

  const stats = result[0];
  setCachedResult(cacheKey, stats, CACHE_CONFIGS.globalStats);
  return stats;
}

export async function getOptimizedUserNotifications(db: PrismaClient, params: {
  userId: string;
  countryId?: string;
  limit?: number;
  unreadOnly?: boolean;
}) {
  const cacheKey = getCacheKey('notifications', params);
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  const where: any = {
    OR: [
      { userId: params.userId },
      { countryId: params.countryId },
      { AND: [{ userId: null }, { countryId: null }] } // Global notifications
    ]
  };

  if (params.unreadOnly) {
    where.read = false;
  }

  const result = await db.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: params.limit || 5,
    select: {
      id: true,
      title: true,
      description: true,
      read: true,
      href: true,
      type: true,
      createdAt: true,
    }
  });

  // Shorter cache for notifications
  setCachedResult(cacheKey, result, CACHE_CONFIGS.notifications);
  return result;
}

export async function getOptimizedUserProfile(db: PrismaClient, userId: string) {
  const cacheKey = getCacheKey('userProfile', { userId });
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  const result = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      clerkUserId: true,
      countryId: true,
      roleId: true,
      isActive: true,
      createdAt: true,
      country: {
        select: {
          id: true,
          name: true,
          flag: true,
          leader: true,
          currentGdpPerCapita: true,
          currentPopulation: true,
          economicTier: true,
          populationTier: true,
        }
      },
      role: {
        select: {
          id: true,
          name: true,
          displayName: true,
          level: true,
        }
      }
    }
  });

  setCachedResult(cacheKey, result, CACHE_CONFIGS.userProfile);
  return result;
}

// Batch query optimization
export async function getOptimizedCountryBatch(db: PrismaClient, countryIds: string[]) {
  if (countryIds.length === 0) return [];
  
  const cacheKey = getCacheKey('countryBatch', { ids: countryIds.sort() });
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  const result = await db.country.findMany({
    where: {
      id: { in: countryIds }
    },
    select: {
      id: true,
      name: true,
      flag: true,
      leader: true,
      currentGdpPerCapita: true,
      currentPopulation: true,
      currentTotalGdp: true,
      economicTier: true,
      adjustedGdpGrowth: true,
    }
  });

  setCachedResult(cacheKey, result, 30000); // 30 second cache
  return result;
}

// Database index suggestions
export const SUGGESTED_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_country_name_search ON Country(name)',
  'CREATE INDEX IF NOT EXISTS idx_country_continent ON Country(continent)',
  'CREATE INDEX IF NOT EXISTS idx_country_economic_tier ON Country(economicTier)',
  'CREATE INDEX IF NOT EXISTS idx_country_population_tier ON Country(populationTier)',
  'CREATE INDEX IF NOT EXISTS idx_notification_user_created ON Notification(userId, createdAt DESC)',
  'CREATE INDEX IF NOT EXISTS idx_notification_country_created ON Notification(countryId, createdAt DESC)',
  'CREATE INDEX IF NOT EXISTS idx_user_clerk_country ON User(clerkUserId, countryId)',
  'CREATE INDEX IF NOT EXISTS idx_dm_inputs_active_country ON DmInputs(isActive, countryId, ixTimeTimestamp DESC)',
] as const;

// Performance monitoring
export function logSlowQuery(operation: string, duration: number, threshold = 1000) {
  if (duration > threshold) {
    console.warn(`[SLOW QUERY] ${operation} took ${duration}ms (threshold: ${threshold}ms)`);
  }
}

// Query wrapper with performance monitoring
export async function withQueryLogging<T>(
  operation: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await queryFn();
    const duration = Date.now() - start;
    logSlowQuery(operation, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[QUERY ERROR] ${operation} failed after ${duration}ms:`, error);
    throw error;
  }
}