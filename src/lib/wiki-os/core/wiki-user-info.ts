/**
 * wiki-user-info.ts — what WikiOS knows about a wiki account, from Postgres alone.
 *
 * The edit count is the account's revisions in `wiki_revisions` (a parked MediaWiki edit is still an
 * edit the account made); the registration date is the one recorded when the account's wiki link was
 * proven, else the date of its first revision, else (for a linked WikiOS user) the WikiOS account's
 * creation; the groups are the rights engine's (explicit `wiki_user_groups` rows, implicit groups and
 * the IxStates role). The account exists when it has revisions, a verified wiki link, Lorewards
 * activity or group memberships. The MediaWiki user id is known only from a verified link; otherwise
 * it is 0 ("unknown"), never an estimate.
 */

import { db } from "~/server/db";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { loadTargetPermissions } from "~/lib/wiki-os/rights";

export interface WikiUserInfo {
  exists: boolean;
  userId: number;
  username: string;
  editCount: number;
  registration: string | null;
  groups: string[];
  user_id: number;
  user_name: string;
  user_editcount: number;
  user_registration: string;
}

interface Facts {
  canonicalName: string;
  userId: number;
  editCount: number;
  registration: Date | null;
  groups: string[];
  exists: boolean;
}

function toInfo(facts: Facts): WikiUserInfo {
  return {
    exists: facts.exists,
    userId: facts.userId,
    username: facts.canonicalName,
    editCount: facts.editCount,
    registration: facts.registration?.toISOString() ?? null,
    groups: facts.groups,
    user_id: facts.userId,
    user_name: facts.canonicalName,
    user_editcount: facts.editCount,
    user_registration: facts.registration?.toISOString() ?? "",
  };
}

/** `name` with its percent-escapes decoded; a name that is not valid percent-encoding is taken as it is. */
function decodeName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** The account `username` (a name as typed: underscores, any case) as WikiOS knows it. Null for a blank name. */
export async function loadWikiUserInfo(username: string): Promise<WikiUserInfo | null> {
  const typed = decodeName(username).replace(/^@/, "").trim();
  if (!typed) return null;
  const name = normalizeWikiUsername(typed);

  const link = await db.wikiAccountLink.findFirst({
    where: { source: "ixwiki", username: name, verifiedAt: { not: null } },
    select: {
      userId: true,
      username: true,
      wikiUserId: true,
      mwRegisteredAt: true,
      user: { select: { createdAt: true } },
    },
  });
  const byAuthor = link
    ? { OR: [{ author: { equals: name, mode: "insensitive" as const } }, { authorId: link.userId }] }
    : { author: { equals: name, mode: "insensitive" as const } };

  const [editCount, firstRevision, stats, permissions] = await Promise.all([
    db.wikiRevision.count({ where: byAuthor }),
    db.wikiRevision.findFirst({
      where: byAuthor,
      orderBy: { createdAt: "asc" },
      select: { author: true, createdAt: true },
    }),
    db.lorewardUserStats.findFirst({
      where: { username: { equals: name, mode: "insensitive" } },
      select: { username: true },
    }),
    loadTargetPermissions({ userId: link?.userId ?? null, wikiUsername: name }),
  ]);

  const exists =
    editCount > 0 || link !== null || stats !== null || permissions.groups.some((g) => g !== "*");
  const groups = exists && !permissions.groups.includes("user")
    ? [...permissions.groups, "user"]
    : permissions.groups;
  return toInfo({
    canonicalName: link?.username ?? firstRevision?.author ?? stats?.username ?? name,
    userId: link?.wikiUserId ?? 0,
    editCount,
    registration:
      link?.mwRegisteredAt ?? firstRevision?.createdAt ?? link?.user.createdAt ?? null,
    groups: exists ? groups : [],
    exists,
  });
}
