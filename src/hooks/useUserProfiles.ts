/**
 * useUserProfiles Hook
 *
 * Fetches multiple user profiles by their clerk user IDs.
 * Used for displaying user information in group chats, messages, etc.
 *
 * @param userIds - Array of clerk user IDs to fetch
 * @returns Map of userId to display name (country name or fallback)
 */

import { api } from "~/trpc/react";

export function useUserProfiles(userIds: string[]) {
  // Fetch all user profiles in parallel
  const queries = userIds.map((userId) =>
    api.users.getProfileById.useQuery(
      { userId },
      {
        enabled: !!userId && userId.trim() !== "",
        retry: 1,
        staleTime: 60000, // Cache for 1 minute
      }
    )
  );

  // Build a map of userId to display name
  const userDisplayNames = new Map<string, string>();

  queries.forEach((query, index) => {
    const userId = userIds[index];
    if (!userId) return;

    if (query.data?.country?.name) {
      userDisplayNames.set(userId, query.data.country.name);
    } else {
      // Fallback to shortened user ID if no country
      userDisplayNames.set(userId, `User ${userId.substring(0, 8)}`);
    }
  });

  const isLoading = queries.some((q) => q.isLoading);
  const hasErrors = queries.some((q) => q.error);

  return {
    userDisplayNames,
    isLoading,
    hasErrors,
  };
}

/**
 * useUserProfile Hook (single user)
 *
 * Fetches a single user profile by clerk user ID.
 *
 * @param userId - Clerk user ID to fetch
 * @returns User display name (country name or fallback)
 */
export function useUserProfile(userId: string | null | undefined) {
  const { data, isLoading, error } = api.users.getProfileById.useQuery(
    { userId: userId || "" },
    {
      enabled: !!userId && userId.trim() !== "",
      retry: 1,
      staleTime: 60000, // Cache for 1 minute
    }
  );

  const displayName =
    data?.country?.name || (userId ? `User ${userId.substring(0, 8)}` : "Unknown User");

  return {
    displayName,
    country: data?.country,
    isLoading,
    error,
  };
}
