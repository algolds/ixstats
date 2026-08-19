/**
 * Centralized System Owner Constants
 *
 * SECURITY: System owner IDs are loaded from environment variables.
 * Set SYSTEM_OWNER_IDS as a comma-separated list of Clerk user IDs.
 *
 * Example in .env.production.local:
 * SYSTEM_OWNER_IDS="user_abc123,user_def456"
 */

/**
 * Get system owner IDs from environment variable
 * Falls back to empty array if not configured (no system owners)
 */
function loadSystemOwnerIds(): readonly string[] {
  const envValue = process.env.SYSTEM_OWNER_IDS || "";
  const ids = envValue
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.startsWith("user_"));

  // Log warning in development if no system owners configured
  if (ids.length === 0 && process.env.NODE_ENV === "development") {
    console.warn(
      "[SECURITY] No SYSTEM_OWNER_IDS configured. Set this environment variable for admin access."
    );
  }

  return Object.freeze(ids);
}

// System owner Clerk IDs loaded from environment
export const SYSTEM_OWNER_IDS: readonly string[] = loadSystemOwnerIds();

// System owner role name
export const SYSTEM_OWNER_ROLE = "owner" as const;

// System owner role level (0 = highest privilege)
export const SYSTEM_OWNER_ROLE_LEVEL = 0 as const;

/**
 * Check if a Clerk user ID is a system owner
 * Also logs the check for audit purposes in production
 */
export function isSystemOwner(clerkUserId: string): boolean {
  const isOwner = SYSTEM_OWNER_IDS.includes(clerkUserId);

  // Audit log system owner access attempts in production
  if (isOwner && process.env.NODE_ENV === "production") {
    console.log(
      `[AUDIT] System owner access: userId=${clerkUserId}, timestamp=${new Date().toISOString()}`
    );
  }

  return isOwner;
}

/**
 * Get system owner IDs for validation
 * Returns a frozen copy to prevent modification
 */
export function getSystemOwnerIds(): readonly string[] {
  return SYSTEM_OWNER_IDS;
}
