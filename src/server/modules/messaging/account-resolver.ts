/**
 * Batch Account Resolver for Messaging (Plan 163)
 *
 * Efficiently batch-resolves clerkUserIds, countryIds, forum keys, and wiki usernames
 * in a single round-trip without N+1 queries.
 */

import type { UserAccount } from "./contracts";

export async function batchResolveMessagingAccounts(
  userIds: string[],
  db: any
): Promise<Map<string, UserAccount>> {
  const map = new Map<string, UserAccount>();
  if (userIds.length === 0) return map;

  const unique = [...new Set(userIds)];
  const realIds: string[] = [];
  const forumKeys: { key: string; raw: string }[] = [];
  const wikiNames: string[] = [];

  for (const id of unique) {
    if (id.startsWith("forum:")) {
      forumKeys.push({ key: id, raw: id.slice(6) });
    } else if (id.startsWith("wiki:")) {
      wikiNames.push(id.slice(5));
    } else {
      realIds.push(id);
    }
  }

  if (realIds.length > 0) {
    const users = (await db.user.findMany({
      where: { clerkUserId: { in: realIds } },
      include: { country: true },
    })) ?? [];
    for (const u of users) {
      map.set(u.clerkUserId, {
        id: u.clerkUserId,
        username: u.country?.slug ?? u.clerkUserId,
        displayName: u.country?.name ?? "Unknown",
        profileImageUrl: u.country?.flag ?? null,
        accountType: "country",
      });
    }

    const unresolvedReal = realIds.filter((id) => !map.has(id));
    if (unresolvedReal.length > 0) {
      const countries = (await db.country.findMany({
        where: { id: { in: unresolvedReal } },
      })) ?? [];
      for (const c of countries) {
        map.set(c.id, {
          id: c.id,
          username: c.slug,
          displayName: c.name,
          profileImageUrl: c.flag ?? null,
          accountType: "country",
        });
      }
    }
  }

  if (forumKeys.length > 0) {
    const numericIds = forumKeys.map((f) => parseInt(f.raw, 10)).filter((n) => !isNaN(n));
    if (numericIds.length > 0) {
      const forumUsers = (await db.user.findMany({
        where: { forumUserId: { in: numericIds } },
        include: { country: true },
      })) ?? [];
      for (const u of forumUsers) {
        map.set(`forum:${u.forumUserId}`, {
          id: `forum:${u.forumUserId}`,
          username: u.forumUsername ?? u.country?.slug ?? `forum-${u.forumUserId}`,
          displayName: u.forumUsername ?? u.country?.name ?? `Forum User`,
          profileImageUrl: u.country?.flag ?? null,
          accountType: "country",
        });
      }
    }

    for (const f of forumKeys) {
      if (!map.has(f.key)) {
        map.set(f.key, {
          id: f.key,
          username: f.raw,
          displayName: f.raw,
          profileImageUrl: null,
          accountType: "country",
        });
      }
    }
  }

  if (wikiNames.length > 0) {
    for (const name of wikiNames) {
      const key = `wiki:${name}`;
      map.set(key, {
        id: key,
        username: name,
        displayName: name,
        profileImageUrl: null,
        accountType: "country",
      });
    }
  }

  return map;
}
