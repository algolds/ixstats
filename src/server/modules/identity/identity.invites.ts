/**
 * Realm invites (`/r/{slug}?via={handle}`) on the identity side: the user an invite's handle names, the
 * inviter a realm's Join panel shows, and how many players the passport holder recruited.
 */
import { db } from "~/server/db";
import { DEFAULT_REALM_ID, isIxWorldView } from "~/lib/realms/realm-ids";
import { countRecruits } from "~/lib/realms/recruits";
import { loadPersonalPersona } from "./identity.loaders";
import { loadPassportHandle } from "./identity.passport-handle";
import { resolveHandleUser } from "./identity.resolve";

/** The inviter as the Join panel shows them: "@{handle} invited you". */
export interface RealmInviter {
  handle: string;
  displayName: string;
}

/** The user (User.id) an invite's `via` handle names, for the claim's inviter checks; null when nobody. */
export async function resolveInviterUserId(via: string): Promise<string | null> {
  return (await resolveHandleUser(via))?.id ?? null;
}

/**
 * The inviter a realm's Join panel names: only a user holding a nation (`Country.ownerUserId`) in that realm
 * while it takes claims. Null otherwise, so a `via` naming anyone else, or a draft or generating realm's
 * member, shows nothing.
 */
export async function resolveRealmInviter(
  realmSlug: string,
  via: string
): Promise<RealmInviter | null> {
  const user = await resolveHandleUser(via);
  if (!user) return null;
  // The claims rule (realms.access `isRealmOpen`): IxWorld is always open, even without a realm row; any
  // other realm only while active. Unlisted realms count: they are reachable by link.
  const inRealm = isIxWorldView(realmSlug)
    ? { realmId: DEFAULT_REALM_ID }
    : { realm: { slug: realmSlug, status: "active" } };
  const member = await db.country.findFirst({
    where: { ownerUserId: user.id, ...inRealm },
    select: { id: true },
  });
  if (!member) return null;
  const [persona, handle] = await Promise.all([loadPersonalPersona(user), loadPassportHandle(user)]);
  return { handle, displayName: persona?.displayName || user.forumUsername || handle };
}

/** The holder's distinct recruits (`countRecruits`); 0 without a user or when the count fails. */
export async function loadRecruitedCount(userId: string | null | undefined): Promise<number> {
  if (!userId) return 0;
  try {
    return await countRecruits(db, userId);
  } catch {
    return 0;
  }
}
