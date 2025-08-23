// User utilities for safe tRPC query handling

/**
 * Safely gets user ID for tRPC queries
 * Returns undefined if user or user.id is invalid
 */
export function getSafeUserId(user: { id?: string } | null | undefined): string | undefined {
  if (!user?.id || user.id.trim() === '') {
    return undefined;
  }
  return user.id;
}

/**
 * Creates safe parameters for users.getProfile query
 * Returns both the input parameters and the enabled condition
 */
export function createUserProfileQueryParams(user: { id?: string } | null | undefined) {
  const userId = getSafeUserId(user);
  return {
    input: { userId: userId || '' },
    enabled: !!userId
  };
}