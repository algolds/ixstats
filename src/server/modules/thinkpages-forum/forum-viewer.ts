/**
 * The signed-in user as the forum module's viewer (M10): their ids, nation and role, plus what they moderate (site
 * admins cost no moderator query). Used by the forum routers and by other lists of forum content (the stash, I5).
 */
import type { ModeratorContext } from "./access";
import { moderatorContext, type ScopeDb } from "./mod-scope";
import type { ForumActor } from "./writes";

export interface ForumUserSource {
  id: string;
  clerkUserId: string;
  countryId?: string | null;
  role?: { name: string; level: number } | null;
}

/** The user as a member, without what they moderate: for calls that never read it (M16). */
export function forumMemberOf(user: ForumUserSource): ForumActor {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    countryId: user.countryId ?? null,
    role: user.role ? { name: user.role.name, level: user.role.level } : null,
  };
}

/** The user with what they moderate. */
export async function forumActorOf(
  db: ScopeDb,
  user: ForumUserSource
): Promise<ForumActor & { mod: ModeratorContext }> {
  const actor = forumMemberOf(user);
  return { ...actor, mod: await moderatorContext(db, actor) };
}
