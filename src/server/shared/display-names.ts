/**
 * Display names for signed-in users, resolved from their linked identities.
 *
 * Order: nation name, forum username, wiki username, then the user's first active ThinkPages
 * account. Never an ID fragment: anyone with no linked name reads as UNKNOWN_DISPLAY_NAME.
 */
import type { PrismaClient } from "@prisma/client";

/** Shown when a user has no linked name anywhere. */
export const UNKNOWN_DISPLAY_NAME = "Unknown user";

export interface DisplayNameSources {
  country?: { name: string | null } | null;
  forumUsername?: string | null;
  wikiUsername?: string | null;
  thinkpagesDisplayName?: string | null;
}

/** The best linked name for one user, or null when none is linked. */
export function pickDisplayName(sources: DisplayNameSources): string | null {
  return (
    sources.country?.name ||
    sources.forumUsername ||
    sources.wikiUsername ||
    sources.thinkpagesDisplayName ||
    null
  );
}

/** The two delegates the resolver reads; accepts the Prisma client or a transaction client. */
export type DisplayNameDb = Pick<PrismaClient, "user" | "thinkpagesAccount">;

/**
 * Batch-resolve display names for Clerk user IDs: one users query, plus one ThinkPages query
 * only for IDs that still have no name. Every requested ID is in the returned map.
 */
export async function resolveDisplayNames(
  db: DisplayNameDb,
  clerkUserIds: Iterable<string>
): Promise<Map<string, string>> {
  const ids = [...new Set(clerkUserIds)].filter(Boolean);
  const names = new Map<string, string>();
  if (ids.length === 0) return names;

  const users = await db.user.findMany({
    where: { clerkUserId: { in: ids } },
    select: {
      clerkUserId: true,
      forumUsername: true,
      wikiUsername: true,
      country: { select: { name: true } },
    },
  });
  for (const user of users) {
    const name = pickDisplayName(user);
    if (name) names.set(user.clerkUserId, name);
  }

  const missing = ids.filter((id) => !names.has(id));
  if (missing.length > 0) {
    const accounts = await db.thinkpagesAccount.findMany({
      where: { clerkUserId: { in: missing }, isActive: true },
      select: { clerkUserId: true, displayName: true, username: true },
      orderBy: { createdAt: "asc" },
    });
    for (const account of accounts) {
      if (!names.has(account.clerkUserId)) {
        const name = account.displayName || account.username;
        if (name) names.set(account.clerkUserId, name);
      }
    }
  }

  for (const id of ids) {
    if (!names.has(id)) names.set(id, UNKNOWN_DISPLAY_NAME);
  }
  return names;
}

/** Single-user convenience over resolveDisplayNames. */
export async function resolveDisplayName(db: DisplayNameDb, clerkUserId: string): Promise<string> {
  return (await resolveDisplayNames(db, [clerkUserId])).get(clerkUserId) ?? UNKNOWN_DISPLAY_NAME;
}
