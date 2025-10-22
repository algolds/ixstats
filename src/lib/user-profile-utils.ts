// src/lib/user-profile-utils.ts
// User profile lookup utility for ThinkTanks and ThinkShare components
// Provides caching and batch lookup capabilities for user display names

import { db } from "~/server/db";

/**
 * User profile data structure for display purposes
 */
export interface UserProfile {
  clerkUserId: string;
  countryId: string | null;
  countryName: string | null;
  displayName: string;
  isActive: boolean;
  membershipTier: string;
}

/**
 * In-memory cache for user profiles
 * TTL: 5 minutes (300000ms)
 */
class UserProfileCache {
  private cache: Map<string, { profile: UserProfile; timestamp: number }> = new Map();
  private readonly TTL = 300000; // 5 minutes

  set(clerkUserId: string, profile: UserProfile): void {
    this.cache.set(clerkUserId, {
      profile,
      timestamp: Date.now(),
    });
  }

  get(clerkUserId: string): UserProfile | null {
    const cached = this.cache.get(clerkUserId);
    if (!cached) return null;

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(clerkUserId);
      return null;
    }

    return cached.profile;
  }

  has(clerkUserId: string): boolean {
    const cached = this.cache.get(clerkUserId);
    if (!cached) return false;

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(clerkUserId);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }
}

// Global cache instance
const profileCache = new UserProfileCache();

/**
 * Format user display name with fallback logic
 * Priority: Country name > Clerk user ID (truncated)
 */
export function formatUserDisplay(profile: UserProfile | null): string {
  if (!profile) {
    return "Unknown User";
  }

  if (profile.countryName) {
    return profile.countryName;
  }

  // Fallback to truncated Clerk user ID
  return `User ${profile.clerkUserId.substring(0, 8)}`;
}

/**
 * Fetch a single user profile with country information
 * Uses cache when available
 *
 * @param clerkUserId - Clerk user ID to look up
 * @returns UserProfile or null if not found
 */
export async function getUserProfile(clerkUserId: string): Promise<UserProfile | null> {
  try {
    // Check cache first
    const cached = profileCache.get(clerkUserId);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const user = await db.user.findUnique({
      where: { clerkUserId },
      include: {
        country: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Build profile object
    const profile: UserProfile = {
      clerkUserId: user.clerkUserId,
      countryId: user.countryId,
      countryName: user.country?.name ?? null,
      displayName: user.country?.name ?? `User ${user.clerkUserId.substring(0, 8)}`,
      isActive: user.isActive,
      membershipTier: user.membershipTier,
    };

    // Cache the result
    profileCache.set(clerkUserId, profile);

    return profile;
  } catch (error) {
    console.error(`[user-profile-utils] Error fetching user profile for ${clerkUserId}:`, error);
    return null;
  }
}

/**
 * Batch fetch multiple user profiles
 * Efficiently handles cache hits and minimizes database queries
 *
 * @param clerkUserIds - Array of Clerk user IDs to look up
 * @returns Map of clerkUserId to UserProfile
 */
export async function getUserProfiles(clerkUserIds: string[]): Promise<Map<string, UserProfile>> {
  const results = new Map<string, UserProfile>();
  const idsToFetch: string[] = [];

  // Check cache for each user
  for (const userId of clerkUserIds) {
    if (profileCache.has(userId)) {
      const cached = profileCache.get(userId);
      if (cached) {
        results.set(userId, cached);
      }
    } else {
      idsToFetch.push(userId);
    }
  }

  // If all users were in cache, return early
  if (idsToFetch.length === 0) {
    return results;
  }

  try {
    // Batch fetch missing users
    const users = await db.user.findMany({
      where: {
        clerkUserId: { in: idsToFetch },
      },
      include: {
        country: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Process fetched users
    for (const user of users) {
      const profile: UserProfile = {
        clerkUserId: user.clerkUserId,
        countryId: user.countryId,
        countryName: user.country?.name ?? null,
        displayName: user.country?.name ?? `User ${user.clerkUserId.substring(0, 8)}`,
        isActive: user.isActive,
        membershipTier: user.membershipTier,
      };

      // Cache and add to results
      profileCache.set(user.clerkUserId, profile);
      results.set(user.clerkUserId, profile);
    }

    return results;
  } catch (error) {
    console.error(`[user-profile-utils] Error batch fetching user profiles:`, error);
    return results;
  }
}

/**
 * Get user display name directly (convenience function)
 *
 * @param clerkUserId - Clerk user ID to look up
 * @returns Display name string
 */
export async function getUserDisplayName(clerkUserId: string): Promise<string> {
  const profile = await getUserProfile(clerkUserId);
  return formatUserDisplay(profile);
}

/**
 * Clear the user profile cache
 * Useful for testing or when fresh data is needed
 */
export function clearUserProfileCache(): void {
  profileCache.clear();
}

/**
 * Get current cache statistics
 * Useful for debugging and monitoring
 */
export function getUserProfileCacheStats(): { size: number; ttl: number } {
  return {
    size: profileCache.getSize(),
    ttl: 300000, // 5 minutes
  };
}

/**
 * Preload user profiles into cache
 * Useful for components that will display many users
 *
 * @param clerkUserIds - Array of Clerk user IDs to preload
 */
export async function preloadUserProfiles(clerkUserIds: string[]): Promise<void> {
  await getUserProfiles(clerkUserIds);
}
