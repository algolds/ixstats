/**
 * useUserCountry Hook
 *
 * Centralized hook for fetching user profile and associated country data.
 * Eliminates code duplication across 7+ files by providing a single source
 * of truth for user-country data fetching.
 *
 * @returns {Object} User and country data with loading states
 * - user: Clerk user object
 * - userProfile: User profile from database
 * - country: Associated country data (from getByIdAtTime)
 * - isLoading: Combined loading state
 * - profileLoading: User profile loading state
 * - countryLoading: Country data loading state
 * - error: Combined error state
 * - hasCountry: Boolean indicating if user has a country assigned
 */

import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";

export function useUserCountry() {
  const { user, isLoaded } = useUser();

  const {
    data: userProfile,
    isLoading: profileLoading,
    error: profileError,
  } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  const {
    data: country,
    isLoading: countryLoading,
    error: countryError,
  } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId ?? "" },
    {
      enabled: !!userProfile?.countryId && userProfile.countryId.trim() !== "",
      retry: false,
    }
  );

  return {
    user,
    isLoaded,
    userProfile,
    country,
    isLoading: profileLoading || countryLoading,
    profileLoading,
    countryLoading,
    error: profileError ?? countryError,
    hasCountry: !!country,
  };
}
