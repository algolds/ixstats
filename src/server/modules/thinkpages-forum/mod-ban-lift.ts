/**
 * A moderator lifts a ban (phase 3): scope first, never their own (M12), then the lift and its log row under the
 * member's lock. Lifting a manual site ban re-tiers the member's automatic ban in the same transaction (follow-up
 * M2), since the lifted ban may have covered a tier their warning points still meet.
 */
import type { PrismaClient } from "@prisma/client";
import type { BanScope } from "~/lib/thinkpages-forum/moderation-policy";
import type { ForumViewer } from "./access";
import { ForumError } from "./errors";
import { autoBanAfterLift, type AutoBanChange } from "./mod-auto-bans";
import { assertBanScope, liftBanTx, type BansDb } from "./mod-bans";
import { modNote } from "./mod-log";
import { banScopeOf } from "./mod-scope";

export type LiftBanDb = BansDb & Pick<PrismaClient, "forumWarning">;

export interface LiftedBan {
  userId: string;
  scope: BanScope;
  scopeId: string | null;
  /** The re-tier the lift caused (M2), for the member's notice; null when none. */
  autoBan: AutoBanChange | null;
}

export async function liftBan(
  db: LiftBanDb,
  actor: ForumViewer,
  input: { banId: string; note?: string }
): Promise<LiftedBan> {
  const ban = await db.forumBan.findUnique({
    where: { id: input.banId },
    select: { id: true, userId: true, scope: true, scopeId: true, auto: true },
  });
  if (!ban) throw new ForumError("NOT_FOUND", "Ban not found.");
  const lifter = await assertBanScope(db, actor, ban);
  // The different-reviewer rule (M12) for lifts: a member promoted since cannot free themselves.
  if (lifter.id === ban.userId) throw new ForumError("FORBIDDEN", "You can't lift your own ban.");
  const note = modNote(input.note);
  const autoBan = await db.$transaction(async (tx) => {
    const now = await liftBanTx(tx, lifter, ban, { note });
    return autoBanAfterLift(tx, ban, now);
  });
  return { userId: ban.userId, scope: banScopeOf(ban.scope), scopeId: ban.scopeId, autoBan };
}
