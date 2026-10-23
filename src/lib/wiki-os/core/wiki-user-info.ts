/**
 * wiki-user-info.ts — what WikiOS knows about a wiki account, from Postgres alone.
 *
 * The name's account is the one `accountOfWikiName` gives it for anyone to see (an approved claim its owner shows,
 * else the account whose handle the name spells; a hidden claim gives none). The edit count is the name's revisions
 * in `wiki_revisions` plus the account's own (a parked MediaWiki edit is still an edit); the registration date is
 * the date of the first of them, else the account's creation; the groups are the rights engine's (explicit
 * `wiki_user_groups` rows, implicit groups and the IxStates role). The name exists when it has revisions, an
 * account, Lorewards activity or group memberships. The MediaWiki user id is known only from an approved claim that
 * recorded it; otherwise it is 0 ("unknown"), never an estimate.
 */

import { db } from "~/server/db";
import { IXWIKI, accountOfWikiName, claimName } from "~/lib/identity/wiki-names";
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
  const name = claimName(typed);

  const account = await accountOfWikiName(db, name, { shown: true });
  const byName = { author: { equals: name, mode: "insensitive" as const } };
  const byAuthor = account ? { OR: [byName, { authorId: account.userId }] } : byName;

  const [editCount, firstRevision, stats, permissions, claim, user] = await Promise.all([
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
    loadTargetPermissions({ userId: account?.userId ?? null, wikiUsername: name }),
    account
      ? db.wikiNameClaim.findFirst({
          where: { source: IXWIKI, name, status: "APPROVED", visible: true },
          select: { mwUserId: true },
        })
      : null,
    account
      ? db.user.findUnique({ where: { id: account.userId }, select: { createdAt: true } })
      : null,
  ]);

  const exists =
    editCount > 0 ||
    account !== null ||
    stats !== null ||
    permissions.groups.some((g) => g !== "*");
  const groups =
    exists && !permissions.groups.includes("user")
      ? [...permissions.groups, "user"]
      : permissions.groups;
  return toInfo({
    canonicalName: claim ? name : (firstRevision?.author ?? stats?.username ?? name),
    userId: claim?.mwUserId ?? 0,
    editCount,
    registration: firstRevision?.createdAt ?? user?.createdAt ?? null,
    groups: exists ? groups : [],
    exists,
  });
}
