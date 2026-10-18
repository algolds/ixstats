/**
 * How the card surfaces name players (card sheets, showcases, trades and their history), many at once, by one rule
 * (`playerDisplayName`). One read of the players, then one of the verified ixwiki names and one of the nations of those
 * with no stored handle, however many rows name them; only the handle chain's resolve-back check runs per player.
 */
import { db } from "~/server/db";
import { passportHandleOf, type PassportHandleUser } from "./identity.passport-handle";
import { LISTED_NATION_WHERE, NATIONS_LARGEST_FIRST } from "./identity.selects";

/** A player as the card surfaces name them. */
export interface PlayerName {
  /** Their passport handle (`passportHandleOf`), for a Passport link: it may be their Clerk id, which still resolves. */
  handle: string;
  /** What other players read (`playerDisplayName`); null reads "a player". */
  displayName: string | null;
}

/**
 * The one rule naming a player to others: "@handle" while their passport handle is a real name (anything but their
 * own Clerk id, the chain's last link), else the nation they hold, else null ("a player").
 */
export function playerDisplayName(player: {
  handle: string;
  clerkUserId: string;
  nation: string | null;
}): string | null {
  if (player.handle !== player.clerkUserId) return `@${player.handle}`;
  return player.nation || null;
}

/** The first value each user has, in the rows' order. */
function firstPerUser(rows: ReadonlyArray<readonly [string | null, string]>): Map<string, string> {
  const first = new Map<string, string>();
  for (const [userId, value] of rows) {
    if (userId && !first.has(userId)) first.set(userId, value);
  }
  return first;
}

/** The verified ixwiki name of each player who has one (the first link found, as `loadVerifiedWikiName` takes). */
async function verifiedWikiNames(userIds: readonly string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const links = await db.wikiAccountLink
    .findMany({
      where: { userId: { in: [...userIds] }, source: "ixwiki", verifiedAt: { not: null } },
      select: { userId: true, username: true },
    })
    .catch(() => []);
  return firstPerUser(links.map((link) => [link.userId, link.username] as const));
}

/** The nation each player's passport lists first (as `resolveIdentityNations` lists them); a failed read names none. */
async function nationNames(userIds: readonly string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const nations = await db.country
    .findMany({
      where: { ownerUserId: { in: [...userIds] }, ...LISTED_NATION_WHERE },
      select: { ownerUserId: true, name: true },
      orderBy: NATIONS_LARGEST_FIRST,
    })
    .catch(() => []);
  return firstPerUser(nations.map((nation) => [nation.ownerUserId, nation.name] as const));
}

/** The name of each player with one of these ids; an id that names no player is left out. */
export async function loadPlayerNames(
  userIds: readonly string[]
): Promise<Map<string, PlayerName>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const users: PassportHandleUser[] = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, clerkUserId: true, handle: true, forumUsername: true },
  });
  // Only a player with no stored handle reaches the wiki name, or past it to the Clerk id and their nation.
  const unhandled = users.filter((u) => !u.handle).map((u) => u.id);
  const [wikiNames, nations] = await Promise.all([
    verifiedWikiNames(unhandled),
    nationNames(unhandled),
  ]);
  const named = await Promise.all(
    users.map(async (user): Promise<[string, PlayerName]> => {
      const handle = await passportHandleOf(user, wikiNames.get(user.id) ?? null);
      const nation = nations.get(user.id) ?? null;
      return [
        user.id,
        {
          handle,
          displayName: playerDisplayName({ handle, clerkUserId: user.clerkUserId, nation }),
        },
      ];
    })
  );
  return new Map(named);
}
