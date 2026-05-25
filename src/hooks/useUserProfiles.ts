/**
 * useUserProfiles Hook
 *
 * Fetches multiple user profiles by their clerk user IDs.
 * Used for displaying user information in group chats, messages, etc.
 *
 * @param userIds - Array of clerk user IDs to fetch
 * @returns Map of userId to display name (country name or fallback)
 */

import { useMemo } from "react";
import { api } from "~/trpc/react";

export function useUserProfiles(userIds: string[]) {
  const validIds = useMemo(() => userIds.filter((id) => id && id.trim() !== ""), [userIds]);

  const { data, isLoading, error } = api.users.getProfilesByIds.useQuery(
    { userIds: validIds },
    {
      enabled: validIds.length > 0,
      retry: 1,
      staleTime: 60000, // Cache for 1 minute
    }
  );

  const userDisplayNames = useMemo(() => {
    const map = new Map<string, string>();
    if (data) {
      for (const profile of data) {
        map.set(profile.userId, profile.country?.name ?? `User ${profile.userId.substring(0, 8)}`);
      }
    }
    return map;
  }, [data]);

  return {
    userDisplayNames,
    isLoading,
    hasErrors: !!error,
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
