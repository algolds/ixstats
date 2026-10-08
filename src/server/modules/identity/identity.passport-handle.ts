/**
 * The one passport handle chain every display and share surface uses (getStatus, getPassport, the
 * passport card and a realm's inviter): the stored handle, else the verified ixwiki name, else the
 * forum name, else the Clerk id. A computed name is used only when it resolves back to the same user
 * (another user may hold it as a handle or name), so every handle this returns opens this user's
 * passport.
 */
import { db } from "~/server/db";
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

async function resolvesTo(name: string, userId: string): Promise<boolean> {
  const owner = await resolveHandleUser(name).catch(() => null);
  return owner?.id === userId;
}

/** The user's passport handle, given their verified ixwiki name (null when they have none). */
export async function passportHandleOf(
  user: PassportHandleUser,
  verifiedWikiName: string | null
): Promise<string> {
  if (user.handle) return user.handle;
  for (const name of [verifiedWikiName, user.forumUsername]) {
    if (name && (await resolvesTo(name, user.id))) return name;
  }
  return user.clerkUserId;
}

/** `passportHandleOf`, reading the verified ixwiki name only when no handle is stored. */
export async function loadPassportHandle(user: PassportHandleUser): Promise<string> {
  if (user.handle) return user.handle;
  return passportHandleOf(user, await loadVerifiedWikiName(user.id));
}
