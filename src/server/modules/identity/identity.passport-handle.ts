/**
 * The one passport handle chain every display and share surface uses (getStatus, getPassport, the
 * passport card, the History join event and a realm's inviter): the stored handle, else the first
 * approved ixwiki name claim the holder shows (`visible`), else the forum name, else the Clerk id. A
 * computed name is used only when it resolves back to the same user (another user may hold it as a
 * handle or name), so every handle this returns opens this user's passport.
 *
 * The handle is the same for every viewer, the owner included: share and invite links carry it, so a
 * hidden claim never names the holder by their wiki name, even in the owner's own copy. The owner
 * still sees their wiki name where only they see it (the passport's wiki block and Settings). A link
 * that carries a claimed name resolves to the holder only while the claim is shown (identity.resolve.ts).
 */
import { primaryNameOf } from "~/lib/identity/wiki-names";
import { db } from "~/server/db";
import { resolveHandleUser } from "./identity.resolve";

/** The user columns the chain reads. */
export interface PassportHandleUser {
  id: string;
  clerkUserId: string;
  handle: string | null;
  forumUsername: string | null;
}

/**
 * The user's first approved ixwiki name claim they show (a hidden one names them nowhere public), or
 * null; a read error is null. Only an approved claim ties a wiki name to an account.
 */
export async function loadClaimedWikiName(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  return primaryNameOf(db, userId, { shown: true }).catch(() => null);
}

/** The user's own first approved name, hidden or not: what their own passport shows them. Null on a read error. */
export async function loadOwnWikiName(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  return primaryNameOf(db, userId).catch(() => null);
}

async function resolvesTo(name: string, userId: string): Promise<boolean> {
  const owner = await resolveHandleUser(name).catch(() => null);
  return owner?.id === userId;
}

/** The chain past the stored handle, given the user's shown claimed name (null without one). */
async function passportHandleOf(
  user: PassportHandleUser,
  claimedWikiName: string | null
): Promise<string> {
  for (const name of [claimedWikiName, user.forumUsername]) {
    if (name && (await resolvesTo(name, user.id))) return name;
  }
  return user.clerkUserId;
}

/**
 * The user's passport handle. With no stored handle it reads the shown claimed name; a caller that
 * already read that name passes it as `known`.
 */
export async function loadPassportHandle(
  user: PassportHandleUser,
  known?: { claimedWikiName: string | null }
): Promise<string> {
  if (user.handle) return user.handle;
  const claimedWikiName = known ? known.claimedWikiName : await loadClaimedWikiName(user.id);
  return passportHandleOf(user, claimedWikiName);
}

/**
 * The passport handles of many users at once, in their order, by `loadPassportHandle`'s rule, given the shown claimed
 * names already read for them.
 */
export async function loadPassportHandles(
  users: readonly PassportHandleUser[],
  claimedWikiNames: ReadonlyMap<string, string>
): Promise<string[]> {
  return Promise.all(
    users.map(
      (user) => user.handle || passportHandleOf(user, claimedWikiNames.get(user.id) ?? null)
    )
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
