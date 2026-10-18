/**
 * The one passport handle chain every display and share surface uses (getStatus, getPassport, the
 * passport card, the History join event and a realm's inviter): the stored handle, else the verified
 * ixwiki name while the holder shows wiki attribution (`showWikiAttribution`), else the forum name,
 * else the Clerk id. A computed name is used only when it resolves back to the same user (another
 * user may hold it as a handle or name), so every handle this returns opens this user's passport.
 *
 * The handle is the same for every viewer, the owner included: share and invite links carry it, so
 * with wiki attribution off it never names the holder by their wiki name, even in the owner's own
 * copy. The owner still sees their wiki name where only they see it (the passport's wiki block,
 * identity.link-privacy.ts, and Settings). A switch that cannot be read counts as off. A link that
 * carries the wiki name (an old one) resolves to the holder only while the switch is on
 * (identity.resolve.ts).
 */
import { db } from "~/server/db";
import { switchIsOn, withoutHiddenWikiNames } from "~/server/shared/privacy-permissions";
import { resolveHandleUser } from "./identity.resolve";

/** The user columns the chain reads. */
export interface PassportHandleUser {
  id: string;
  clerkUserId: string;
  handle: string | null;
  forumUsername: string | null;
}

/** The user's verified ixwiki link name, or null. Only this proves a wiki account is theirs. */
export async function loadVerifiedWikiName(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const link = await db.wikiAccountLink
    .findFirst({
      where: { userId, source: "ixwiki", verifiedAt: { not: null } },
      select: { username: true },
    })
    .catch(() => null);
  return link?.username ?? null;
}

/** Whether the user shows wiki attribution (`showWikiAttribution`); a read error counts as off. */
async function showsWikiAttribution(clerkUserId: string): Promise<boolean> {
  return switchIsOn(db, clerkUserId, "showWikiAttribution").catch(() => false);
}

async function resolvesTo(name: string, userId: string): Promise<boolean> {
  const owner = await resolveHandleUser(name).catch(() => null);
  return owner?.id === userId;
}

/** The chain past the stored handle, given the wiki name it may use (null when it may not). */
async function passportHandleOf(
  user: PassportHandleUser,
  allowedWikiName: string | null
): Promise<string> {
  for (const name of [allowedWikiName, user.forumUsername]) {
    if (name && (await resolvesTo(name, user.id))) return name;
  }
  return user.clerkUserId;
}

/**
 * The user's passport handle. With no stored handle it reads the wiki attribution switch and the
 * verified ixwiki name; a caller that already read that name passes it as `known`.
 */
export async function loadPassportHandle(
  user: PassportHandleUser,
  known?: { verifiedWikiName: string | null }
): Promise<string> {
  if (user.handle) return user.handle;
  const [verifiedWikiName, attributed] = await Promise.all([
    known ? known.verifiedWikiName : loadVerifiedWikiName(user.id),
    showsWikiAttribution(user.clerkUserId),
  ]);
  return passportHandleOf(user, attributed ? verifiedWikiName : null);
}

/**
 * The passport handles of many users at once, in their order, by `loadPassportHandle`'s rule, given the verified
 * ixwiki names already read for them: one read of the wiki attribution switch for the batch, for the users a wiki
 * name could name (no stored handle, a verified name). A switch that cannot be read hides every wiki name.
 */
export async function loadPassportHandles(
  users: readonly PassportHandleUser[],
  verifiedWikiNames: ReadonlyMap<string, string>
): Promise<string[]> {
  const allowed = await withoutHiddenWikiNames(
    db,
    users.map((user) => ({
      ...user,
      wikiUsername: user.handle ? null : (verifiedWikiNames.get(user.id) ?? null),
    }))
  );
  return Promise.all(
    allowed.map((user) => user.handle || passportHandleOf(user, user.wikiUsername))
  );
}

/** The passport handle of the user with this id (`loadPassportHandle`); null when there is no such user. */
export async function loadPassportHandleById(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, clerkUserId: true, handle: true, forumUsername: true },
  });
  return user ? loadPassportHandle(user) : null;
}
