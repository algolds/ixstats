/**
 * Appeal statuses (M12) and the status of each appealed subject on a page, for the moderators' warning and ban
 * lists. Kept apart from mod-appeal-subjects so mod-bans can read statuses without importing the warnings module.
 */
import type { PrismaClient } from "@prisma/client";

/** `moot`: the subject ended (lifted, revoked, expired) before a decision; the appeal is closed, not decided. */
export type AppealStatus = "open" | "upheld" | "overturned" | "moot";

const STATUSES: readonly AppealStatus[] = ["open", "upheld", "overturned", "moot"];

/** A stored status; anything malformed reads as open. */
export const appealStatusOf = (status: string): AppealStatus =>
  STATUSES.find((s) => s === status) ?? "open";

export type AppealStatusDb = Pick<PrismaClient, "forumAppeal">;

/**
 * The appeal status of each subject in `ids`, keyed by subject id, in one query. A subject has at most one appeal
 * (`@@unique([subjectType, subjectId])`); subjects without one are absent.
 */
export async function appealStatusesOf(
  db: AppealStatusDb,
  subjectType: "warning" | "ban",
  ids: readonly string[]
): Promise<Map<string, AppealStatus>> {
  if (ids.length === 0) return new Map();
  const appeals = await db.forumAppeal.findMany({
    where: { subjectType, subjectId: { in: [...ids] } },
    select: { subjectId: true, status: true },
  });
  return new Map(appeals.map((a) => [a.subjectId, appealStatusOf(a.status)]));
}
