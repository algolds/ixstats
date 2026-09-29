/**
 * IxnayID — Wiki Account Linking Service
 *
 * Links IxStats users to their MediaWiki accounts via direct MySQL lookup.
 * Follows the same pattern as xenforo-user-sync.ts:
 *   - lookupWikiUser: find wiki user by username
 *   - findLinkableWikiAccount: validate an admin link (the write is the wiki-links service's adminVerify)
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
 * Admin-only (the admin `linkUserWiki` mutation — self-service linking is token-on-user-page verification):
 * validate that the wiki user exists and that no other IxStats user holds it. Writes nothing — the admin router
 * then records the link through the wiki-links service (`adminVerify`), which writes the verified WikiAccountLink
 * row and the legacy User columns in one transaction, so a refusal there leaves nothing half-written (ruling F-2).
 */
export async function findLinkableWikiAccount(
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

  return { success: true, wikiUsername: wikiUser.username, wikiUserId: wikiUser.userId };
}
