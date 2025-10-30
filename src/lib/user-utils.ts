// User utilities for safe tRPC query handling

/**
 * Safely gets user ID for tRPC queries
 * Returns undefined if user or user.id is invalid
 */
export function getSafeUserId(user: { id?: string } | null | undefined): string | undefined {
  if (!user?.id || user.id.trim() === "") {
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

  // When no userId is available, we need to provide a valid input that won't be used
  // since enabled is false, but tRPC still validates the input schema
  if (!userId) {
    return {
      input: { userId: "placeholder-disabled" }, // Valid string that won't be used
      enabled: false,
    };
  }

  return {
    input: { userId },
    enabled: true,
  };
}

/**
 * Creates safe query options for users.getProfile - simpler version for direct use
 * Returns the object directly usable in useQuery calls
 */
export function createSafeUserProfileQuery(user: { id?: string } | null | undefined) {
  const userId = getSafeUserId(user);

  if (!userId) {
    return {
      input: { userId: "placeholder-disabled" },
      options: { enabled: false },
    };
  }

  return {
    input: { userId },
    options: { enabled: true },
  };
}
