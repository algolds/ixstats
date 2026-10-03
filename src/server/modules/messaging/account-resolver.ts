/**
 * Batch Account Resolver for Messaging (Plan 163)
 *
 * Efficiently batch-resolves clerkUserIds, countryIds, forum keys, and wiki usernames
 * in a single round-trip without N+1 queries.
 */

import type { UserAccount } from "./contracts";
import {
  pickDisplayName,
  resolveDisplayNames,
  UNKNOWN_DISPLAY_NAME,
} from "~/server/shared/display-names";

type AccountMap = Map<string, UserAccount>;

const COUNTRY_INCLUDE = { country: { select: { slug: true, name: true, flag: true } } };

function account(
  id: string,
  username: string,
  displayName: string,
  profileImageUrl: string | null = null
): UserAccount {
  return { id, username, displayName, profileImageUrl, accountType: "country" };
}

async function resolveClerkAccounts(realIds: string[], db: any, map: AccountMap) {
  const users =
    (await db.user.findMany({
      where: { clerkUserId: { in: realIds } },
      include: COUNTRY_INCLUDE,
    })) ?? [];
  for (const u of users) {
    map.set(
      u.clerkUserId,
      account(
        u.clerkUserId,
        u.country?.slug ?? u.clerkUserId,
        pickDisplayName(u) ?? UNKNOWN_DISPLAY_NAME,
        u.country?.flag
      )
    );
  }

  const unresolvedReal = realIds.filter((id) => !map.has(id));
  if (unresolvedReal.length > 0) {
    const countries =
      (await db.country.findMany({
        where: { id: { in: unresolvedReal } },
        select: { id: true, slug: true, name: true, flag: true },
      })) ?? [];
    for (const c of countries) map.set(c.id, account(c.id, c.slug, c.name, c.flag));
  }

  // Users with no linked name, or with only a ThinkPages account: resolve through identity.
  const unnamed = realIds.filter(
    (id) => (map.get(id)?.displayName ?? UNKNOWN_DISPLAY_NAME) === UNKNOWN_DISPLAY_NAME
  );
  if (unnamed.length === 0) return;

  const names = await resolveDisplayNames(db, unnamed);
  for (const id of unnamed) {
    const displayName = names.get(id) ?? UNKNOWN_DISPLAY_NAME;
    const existing = map.get(id);
    if (existing) existing.displayName = displayName;
    else if (displayName !== UNKNOWN_DISPLAY_NAME) map.set(id, account(id, id, displayName));
  }
}

async function resolveForumAccounts(
  forumKeys: { key: string; raw: string }[],
  db: any,
  map: AccountMap
) {
  const numericIds = forumKeys.map((f) => parseInt(f.raw, 10)).filter((n) => !isNaN(n));
  if (numericIds.length > 0) {
    const forumUsers =
      (await db.user.findMany({
        where: { forumUserId: { in: numericIds } },
        include: COUNTRY_INCLUDE,
      })) ?? [];
    for (const u of forumUsers) {
      const key = `forum:${u.forumUserId}`;
      map.set(
        key,
        account(
          key,
          u.forumUsername ?? u.country?.slug ?? `forum-${u.forumUserId}`,
          u.forumUsername ?? u.country?.name ?? `Forum User`,
          u.country?.flag
        )
      );
    }
  }

  for (const f of forumKeys) {
    if (!map.has(f.key)) map.set(f.key, account(f.key, f.raw, f.raw));
  }
}

export async function batchResolveMessagingAccounts(
  userIds: string[],
  db: any
): Promise<AccountMap> {
  const map: AccountMap = new Map();
  if (userIds.length === 0) return map;

  const realIds: string[] = [];
  const forumKeys: { key: string; raw: string }[] = [];

  for (const id of new Set(userIds)) {
    if (id.startsWith("forum:")) {
      forumKeys.push({ key: id, raw: id.slice(6) });
    } else if (id.startsWith("wiki:")) {
      map.set(id, account(id, id.slice(5), id.slice(5)));
    } else {
      realIds.push(id);
    }
  }

  if (realIds.length > 0) await resolveClerkAccounts(realIds, db, map);
  if (forumKeys.length > 0) await resolveForumAccounts(forumKeys, db, map);

  return map;
}
