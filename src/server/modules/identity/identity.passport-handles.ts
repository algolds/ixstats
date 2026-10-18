/**
 * Many players' passport handles at once (`loadPassportHandleById`, batched), for lists that name players: trades and
 * their history. One read of the players and one of the verified ixwiki names of those with no stored handle, however
 * many rows name them; only the chain's resolve-back check runs per player.
 */
import { db } from "~/server/db";
import { passportHandleOf, type PassportHandleUser } from "./identity.passport-handle";

/** The verified ixwiki name of each player who has one (the first link found, as `loadVerifiedWikiName` takes). */
async function verifiedWikiNames(userIds: readonly string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const links = await db.wikiAccountLink
    .findMany({
      where: { userId: { in: [...userIds] }, source: "ixwiki", verifiedAt: { not: null } },
      select: { userId: true, username: true },
    })
    .catch(() => []);
  const names = new Map<string, string>();
  for (const link of links) {
    if (!names.has(link.userId)) names.set(link.userId, link.username);
  }
  return names;
}

/** The passport handle of each player with one of these ids; an id that names no player is left out. */
export async function loadPassportHandlesById(
  userIds: readonly string[]
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const users: PassportHandleUser[] = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, clerkUserId: true, handle: true, forumUsername: true },
  });
  const wikiNames = await verifiedWikiNames(users.filter((u) => !u.handle).map((u) => u.id));
  const named = await Promise.all(
    users.map(
      async (user) =>
        [user.id, await passportHandleOf(user, wikiNames.get(user.id) ?? null)] as const
    )
  );
  return new Map(named);
}
