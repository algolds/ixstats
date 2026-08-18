/**
 * IxnayID — Wiki Account Linking Service
 *
 * Links IxStats users to their MediaWiki accounts via direct MySQL lookup.
 * Follows the same pattern as xenforo-user-sync.ts:
 *   - lookupWikiUser: find wiki user by username
 *   - linkWikiAccount: validate + store link
 */

import { db } from "~/server/db";
import { getUserInfo } from "./bridge";
import { isSystemOwner } from "~/lib/auth";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a MediaWiki user by username.
 * Returns user info or null if not found.
 */
export async function lookupWikiUser(
  username: string
): Promise<{ userId: number; username: string; editCount: number; groups: string[] } | null> {
  try {
    const info = await getUserInfo(username);

    if (!info.exists) return null;

    // MediaWiki user_id is not directly exposed by getUserInfo's return type,
    // but we can re-query it. For now, use a hash of the canonical username
    // as a stable identifier, since getUserInfo returns the canonical name.
    // We store wikiUsername as the primary key for lookups.
    return {
      userId: 0, // MediaWiki user_id not exposed; we use wikiUsername for linking
      username: info.username,
      editCount: info.editCount,
      groups: info.groups,
    };
  } catch (error) {
    console.error("[Wiki Sync] User lookup error:", error);
    return null;
  }
}

/**
 * Link an IxStats user to their MediaWiki account.
 * Validates the wiki user exists and checks for duplicate links.
 */
export async function linkWikiAccount(
  userId: string,
  wikiUsername: string,
  clerkUserId?: string
): Promise<{ success: boolean; wikiUsername?: string; error?: string }> {
  // Look up the wiki user
  const wikiUser = await lookupWikiUser(wikiUsername);
  if (!wikiUser) {
    return { success: false, error: `Wiki user "${wikiUsername}" not found` };
  }

  // System owners can link the same wiki account to multiple IxStats users
  if (!clerkUserId || !isSystemOwner(clerkUserId)) {
    const existingLink = await db.user.findFirst({
      where: {
        wikiUsername: wikiUser.username,
        id: { not: userId },
      },
      select: { id: true },
    });

    if (existingLink) {
      return {
        success: false,
        error: "This wiki account is already linked to another IxStats user",
      };
    }
  }

  // Store the link
  await db.user.update({
    where: { id: userId },
    data: {
      wikiUsername: wikiUser.username,
      lastWikiSync: new Date(),
    },
  });

  return { success: true, wikiUsername: wikiUser.username };
}
