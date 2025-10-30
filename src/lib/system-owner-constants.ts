/**
 * Centralized System Owner Constants
 *
 * This file contains all system owner IDs and related constants to ensure
 * consistent handling across the entire application.
 */

// System owner Clerk IDs for dev and prod environments
export const SYSTEM_OWNER_IDS = [
  "user_2zqmDdZvhpNQWGLdAIj2YwH8MLo", // Dev environment owner
  "user_3078Ja62W7yJDlBjjwNppfzceEz", // Production environment owner
] as const;

// System owner role name
export const SYSTEM_OWNER_ROLE = "owner" as const;

// System owner role level (0 = highest privilege)
export const SYSTEM_OWNER_ROLE_LEVEL = 0 as const;

/**
 * Check if a Clerk user ID is a system owner
 */
export function isSystemOwner(clerkUserId: string): boolean {
  return SYSTEM_OWNER_IDS.includes(clerkUserId as any);
}

/**
 * Get system owner IDs for validation
 */
export function getSystemOwnerIds(): readonly string[] {
  return SYSTEM_OWNER_IDS;
}
