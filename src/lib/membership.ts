import { currentUser } from '@clerk/nextjs/server';
import { db } from '~/server/db';

export type MembershipTier = 'basic' | 'mycountry_premium';

export interface PremiumFeatures {
  sdi: boolean;
  eci: boolean;
  intelligence: boolean;
  advancedAnalytics: boolean;
}

/**
 * Get user's membership tier and premium features
 */
export async function getUserMembership(clerkUserId?: string): Promise<{
  tier: MembershipTier;
  isPremium: boolean;
  features: PremiumFeatures;
}> {
  // If no user ID provided, try to get current user
  let userId = clerkUserId;
  if (!userId) {
    const user = await currentUser();
    if (!user) {
      return {
        tier: 'basic',
        isPremium: false,
        features: {
          sdi: false,
          eci: false,
          intelligence: false,
          advancedAnalytics: false,
        },
      };
    }
    userId = user.id;
  }

  try {
    // Get user from database
    const dbUser = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { membershipTier: true },
    });

    const tier = (dbUser?.membershipTier as MembershipTier) ?? 'basic';
    const isPremium = tier === 'mycountry_premium';

    return {
      tier,
      isPremium,
      features: {
        sdi: isPremium,
        eci: isPremium,
        intelligence: isPremium,
        advancedAnalytics: isPremium,
      },
    };
  } catch (error) {
    console.error('Error fetching user membership:', error);
    return {
      tier: 'basic',
      isPremium: false,
      features: {
        sdi: false,
        eci: false,
        intelligence: false,
        advancedAnalytics: false,
      },
    };
  }
}

/**
 * Check if user has access to premium features
 */
export async function checkPremiumAccess(clerkUserId?: string): Promise<boolean> {
  const membership = await getUserMembership(clerkUserId);
  return membership.isPremium;
}

/**
 * Check if user has access to a specific feature
 */
export async function checkFeatureAccess(
  feature: keyof PremiumFeatures,
  clerkUserId?: string
): Promise<boolean> {
  const membership = await getUserMembership(clerkUserId);
  return membership.features[feature];
}

/**
 * Middleware to protect premium routes
 */
export async function requirePremium(): Promise<boolean> {
  const user = await currentUser();
  if (!user) {
    return false;
  }

  return await checkPremiumAccess(user.id);
}