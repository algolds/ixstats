/**
 * IxnayID — Wiki Account Linking Service
 *
 * Links IxStats users to their MediaWiki accounts via direct MySQL lookup.
 * Follows the same pattern as xenforo-user-sync.ts:
 *   - lookupWikiUser: find wiki user by username
 *   - linkWikiAccount: validate + store link
 */

import { db } from "~/server/db";
import { getUserInfo } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { isSystemOwner } from "~/lib/auth";

// ---------------------------------------------------------------------------
// Alt Account Mappings & Aliases
// ---------------------------------------------------------------------------

/**
 * Curated MediaWiki alt account aliases.
 * Key: Alt account username -> Value: Primary canonical author username
 */
export const KNOWN_WIKI_ALTS: Record<string, string> = {
  Carthinova: "Kir",
  "ixnet>Drunk Uncle Kir": "Kir",
};

/**
 * Resolve any alt account alias to its primary canonical wiki username.
 */
export function resolvePrimaryWikiUsername(username: string): string {
  if (!username) return username;
  const trimmed = username.trim();
  return KNOWN_WIKI_ALTS[trimmed] || trimmed;
}

/**
 * Get all known alt aliases for a given primary wiki username.
 */
export function getWikiAltsForUser(primaryUsername: string): string[] {
  const alts: string[] = [];
  const normalizedPrimary = primaryUsername.trim().toLowerCase();
  for (const [alt, primary] of Object.entries(KNOWN_WIKI_ALTS)) {
    if (primary.toLowerCase() === normalizedPrimary) {
      alts.push(alt);
    }
  }
  return alts;
}

/**
 * Look up a MediaWiki user by username (resolving alts if applicable).
 * Returns user info or null if not found.
 */
export async function lookupWikiUser(
  username: string
): Promise<{
  userId: number;
  username: string;
  editCount: number;
  groups: string[];
  primaryUsername: string;
  isAlt: boolean;
} | null> {
  try {
    const primaryName = resolvePrimaryWikiUsername(username);
    const info = await getUserInfo(primaryName);

    if (!info || !info.exists) return null;

    return {
      userId: info.userId ?? info.user_id ?? 0,
      username: info.username ?? info.user_name ?? primaryName,
      editCount: info.editCount ?? info.user_editcount ?? 0,
      groups: info.groups ?? [],
      primaryUsername: primaryName,
      isAlt: primaryName.toLowerCase() !== username.trim().toLowerCase(),
    };
  } catch (error) {
    console.error("[Wiki Sync] User lookup error:", error);
    return null;
  }
}

/**
 * Link or claim an IxStats user to their MediaWiki account.
 * Validates the wiki user exists and checks for duplicate links.
 */
export async function linkWikiAccount(
  userId: string,
  wikiUsername: string,
  clerkUserId?: string
): Promise<{ success: boolean; wikiUsername?: string; wikiUserId?: number; error?: string }> {
  const canonicalUsername = resolvePrimaryWikiUsername(wikiUsername);

  // Look up the wiki user
  const wikiUser = await lookupWikiUser(canonicalUsername);
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
        error: "This wiki account is already claimed by another IxStats user",
      };
    }
  }

  // Store the link & wikiUserId
  await db.user.update({
    where: { id: userId },
    data: {
      wikiUsername: wikiUser.username,
      wikiUserId: wikiUser.userId > 0 ? wikiUser.userId : undefined,
      lastWikiSync: new Date(),
    },
  });

  return { success: true, wikiUsername: wikiUser.username, wikiUserId: wikiUser.userId };
}
