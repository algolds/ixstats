/**
 * IxnayID — Wiki Account Linking Service
 *
 * Links IxStats users to their MediaWiki accounts (read from PostgreSQL, else through the MediaWiki API).
 * Follows the same pattern as xenforo-user-sync.ts:
 *   - lookupWikiUser: find wiki user by username
 *   - findLinkableWikiAccount: validate an admin link (the write is the wiki-links service's adminVerify)
 */

import { db } from "~/server/db";
import { getUserInfo } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { fetchWikiUser } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
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

/** The account as the wiki itself knows it: its name and MediaWiki user id. */
interface WikiAccount {
  username: string;
  userId: number;
}

/**
 * The account `name` as IxWiki's MediaWiki holds it, or null when the wiki has no such account. An
 * admin-triggered account-proof read (`account-proof.ts`): Postgres knows an account only once it has edited,
 * been linked, scored in Lorewards or been given a group, and never its MediaWiki user id. Throws
 * `WikiApiError` when the wiki does not answer.
 */
async function askWikiForAccount(name: string): Promise<WikiAccount | null> {
  const account = await fetchWikiUser("ixwiki", name);
  return account ? { username: account.username, userId: account.userId } : null;
}

/**
 * The account to link for `name`: what WikiOS knows (`lookupWikiUser`), completed by the wiki when WikiOS has
 * nothing (a zero-edit account) or does not know the MediaWiki user id. Null when neither knows the account.
 * Throws `WikiApiError` only when WikiOS knows nothing and the wiki could not be asked.
 */
async function resolveLinkableAccount(name: string): Promise<WikiAccount | null> {
  const known = await lookupWikiUser(name);
  if (known && known.userId > 0) return known;
  try {
    return (await askWikiForAccount(name)) ?? known;
  } catch (err) {
    if (known) return known; // WikiOS's own answer stands; the id is unknown
    throw err;
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

  // Look up the wiki user: WikiOS first, the wiki itself for what WikiOS cannot know
  let wikiUser: WikiAccount | null;
  try {
    wikiUser = await resolveLinkableAccount(canonicalUsername);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "no answer";
    return {
      success: false,
      error: `Wiki user "${wikiUsername}" is not known to WikiOS and the wiki could not be asked (${reason})`,
    };
  }
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
