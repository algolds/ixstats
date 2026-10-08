/**
 * Realm invites (`/r/{slug}?via={handle}`) on the identity side: the user an invite's handle names, the
 * inviter a realm's Join panel shows, and how many players the passport holder recruited.
 */
import { db } from "~/server/db";
import { DEFAULT_REALM_ID, isIxWorldView } from "~/lib/realms/realm-ids";
import { normalizeHandle } from "./identity.handle";
import { loadPersonalPersona } from "./identity.loaders";
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
 * The inviter a realm's Join panel names: only a user holding a nation in that realm
 * (`Country.ownerUserId`). Null otherwise, so a `via` naming anyone else shows nothing.
 */
export async function resolveRealmInviter(
  realmSlug: string,
  via: string
): Promise<RealmInviter | null> {
  const user = await resolveHandleUser(via);
  if (!user) return null;
  // IxWorld nations count even when IxWorld has no realm row (the relation filter needs one).
  const inRealm = isIxWorldView(realmSlug)
    ? { realmId: DEFAULT_REALM_ID }
    : { realm: { slug: realmSlug } };
  const member = await db.country.findFirst({
    where: { ownerUserId: user.id, ...inRealm },
    select: { id: true },
  });
  if (!member) return null;
  const persona = await loadPersonalPersona(user);
  const handle = user.handle ?? normalizeHandle(via);
  return { handle, displayName: persona?.displayName || user.forumUsername || handle };
}

/** The holder's approved claims that name them as inviter; 0 without a user or when the count fails. */
export async function loadRecruitedCount(userId: string | null | undefined): Promise<number> {
  if (!userId) return 0;
  try {
    return await db.realmClaim.count({ where: { invitedByUserId: userId, status: "approved" } });
  } catch {
    return 0;
  }
}
