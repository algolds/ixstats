/**
 * Moot appeals (Task 5 fix round 1, controller ruling): an appeal whose subject ends before a decision is closed as
 * `moot`, never left open. Every lift (`liftBanTx`, so also an automatic ban lifted by a re-tier) and every revoke
 * (`revokeWarningTx`) calls this inside its own transaction, with an `appeal.moot` log row; `reviewedBy` stays null,
 * as nobody reviewed it. A review of an appeal on an ended subject closes it the same way (mod-appeals.ts).
 */
import type { PrismaClient } from "@prisma/client";
import { logModAction } from "./mod-log";
import type { ModScope } from "./mod-scope";

export type MootTx = Pick<PrismaClient, "forumAppeal" | "forumModLog">;

/**
 * Closes the subject's open appeal, if any, as moot and logs it; returns its id, or null when none was open. The
 * caller holds the member's lock (`lockMember`).
 */
export async function mootOpenAppeal(
  tx: MootTx,
  actorId: string,
  subject: { type: "ban" | "warning"; id: string; scope: ModScope; cause: string },
  now: Date
): Promise<string | null> {
  const appeal = await tx.forumAppeal.findFirst({
    where: { subjectType: subject.type, subjectId: subject.id, status: "open" },
    select: { id: true },
  });
  if (!appeal) return null;
  // Filing, review, lifts and revokes all hold the member's lock, so the appeal is still open here.
  await tx.forumAppeal.update({
    where: { id: appeal.id },
    data: { status: "moot", reviewedAt: now },
  });
  await logModAction(tx, {
    actorId,
    action: "appeal.moot",
    targetType: "appeal",
    targetId: appeal.id,
    scope: subject.scope,
    detail: {
      outcome: "moot",
      subjectType: subject.type,
      subjectId: subject.id,
      cause: subject.cause,
    },
  });
  return appeal.id;
}
