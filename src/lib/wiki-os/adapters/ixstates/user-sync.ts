/**
 * IxnayID — wiki user lookup: find a MediaWiki user by name (read from PostgreSQL, else through the MediaWiki API).
 * An old IxWiki name joins an account only through a name claim (`~/lib/identity/wiki-names`).
 */

import { getUserInfo } from "~/lib/wiki-os/adapters/mediawiki/bridge";

/**
 * Look up a MediaWiki user by username.
 * Returns user info or null if not found.
 */
export async function lookupWikiUser(username: string): Promise<{
  userId: number;
  username: string;
  editCount: number;
  groups: string[];
} | null> {
  try {
    const name = username.trim();
    const info = await getUserInfo(name);

    if (!info || !info.exists) return null;

    return {
      userId: info.userId ?? info.user_id ?? 0,
      username: info.username ?? info.user_name ?? name,
      editCount: info.editCount ?? info.user_editcount ?? 0,
      groups: info.groups ?? [],
    };
  } catch (error) {
    console.error("[Wiki Sync] User lookup error:", error);
    return null;
  }
}
