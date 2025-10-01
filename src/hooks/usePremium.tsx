"use client";

import React, { useEffect, useState } from 'react';
import { useUser } from '~/context/auth-context';
import { api } from '~/trpc/react';

export interface PremiumFeatures {
  sdi: boolean;
  eci: boolean;
  intelligence: boolean;
  advancedAnalytics: boolean;
}

export interface PremiumStatus {
  isPremium: boolean;
  tier: 'basic' | 'mycountry_premium';
  features: PremiumFeatures;
  isLoading: boolean;
}

/**
 * Hook to check user's premium membership status and available features
 */
export function usePremium(): PremiumStatus {
  const { user, isLoaded, isSignedIn } = useUser();
  const [userRecordCreated, setUserRecordCreated] = useState(false);

  // Determine if we should query membership - but always call the hook
  const shouldQueryMembership = Boolean(
    isLoaded &&
    isSignedIn &&
    user?.id &&
    user.id.trim() !== ''
  );

  // First, ensure user record exists in database
  const { mutate: createUserRecord, isPending: isCreatingUser } = api.users.createUserRecord.useMutation({
    onSuccess: () => {
      console.log('[usePremium] User record created successfully');
      setUserRecordCreated(true);
    },
    onError: (error) => {
      console.error('[usePremium] Failed to create user record:', error);
      // Even if creation fails, mark as attempted to prevent infinite retries
      setUserRecordCreated(true);
    }
  });

  // Auto-create user record when needed - only once per user session
  useEffect(() => {
    if (shouldQueryMembership && !userRecordCreated && !isCreatingUser) {
      // Attempt to create user record (will succeed only if user doesn't exist)
      createUserRecord();
    }
  }, [shouldQueryMembership, userRecordCreated, isCreatingUser, createUserRecord]);

  // Always call the query hook to maintain hook order consistency
  const { data: membershipData, isLoading: membershipLoading, error } = api.users.getMembershipStatus.useQuery(
    undefined,
    {
      enabled: shouldQueryMembership,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      retry: (failureCount, error) => {
        // Retry once if user not found (after we try to create the user record)
        return failureCount < 1 && error.message?.includes('User not found in system');
      },
      retryDelay: 1000, // Wait 1 second before retry
    }
  );

  // Log errors for debugging (only when we expected the query to work)
  if (error && shouldQueryMembership) {
    console.error('[usePremium] Membership query failed:', error);
  }

  const isLoading = !isLoaded || membershipLoading || isCreatingUser;

  // Default to basic membership if not ready or no data
  if (!shouldQueryMembership || isLoading || !membershipData) {
    return {
      isPremium: false,
      tier: 'basic',
      features: {
        sdi: false,
        eci: false,
        intelligence: false,
        advancedAnalytics: false,
      },
      isLoading,
    };
  }

  return {
    isPremium: membershipData.isPremium,
    tier: membershipData.tier,
    features: membershipData.features,
    isLoading: false,
  };
}

/**
 * Hook to check if user has access to a specific premium feature
 */
export function useFeatureAccess(feature: keyof PremiumFeatures): boolean {
  const { features } = usePremium();
  return features[feature];
}

/**
 * Hook that returns a component to render premium gates
 */
export function usePremiumGate() {
  const premium = usePremium();

  const requirePremium = (feature: keyof PremiumFeatures, component: React.ReactNode, fallback?: React.ReactNode) => {
    if (premium.isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60"></div>
        </div>
      );
    }

    if (premium.features[feature]) {
      return component;
    }

    return fallback || null;
  };

  return {
    ...premium,
    requirePremium,
  };
}