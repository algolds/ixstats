/**
 * The ActivityFeed row of a committed directive (docs/superpowers/specs/2026-10-10-thinkpages-forum-action-integration-design.md,
 * section 1). Directives wrote no row, so they could not be attached to a forum post; this one public row is the
 * directive's identity for the forum (a completion adds nothing). It says only what the public record already says:
 * the goal, the tier and the category. Best effort: a failure logs and returns null, so a commit is never failed by its
 * row.
 */
import type { PrismaClient } from "@prisma/client";
import { directiveActivityId } from "~/lib/action-links";
import { recordActivity } from "./record";

export type DirectiveActivityDb = Pick<PrismaClient, "activityFeed">;

export interface DirectiveActivityInput {
  intentId: string;
  countryId: string;
  countryName: string;
  /** The declaring user's Clerk id (ActivityFeed.userId). */
  userId: string | null;
  goal: string;
  tier: string;
  category: string;
}

/** The row's id after making sure it exists: the directive's activity id, or null when the write failed. */
export async function declareDirectiveActivity(
  db: DirectiveActivityDb,
  input: DirectiveActivityInput
): Promise<string | null> {
  const id = directiveActivityId(input.intentId);
  const exists = () => db.activityFeed.findUnique({ where: { id }, select: { id: true } });
  try {
    if (await exists()) return id;
    await recordActivity({
      id,
      client: db,
      type: "directive",
      category: "government",
      userId: input.userId,
      countryId: input.countryId,
      title: input.goal,
      description: `${input.countryName} declared a ${input.tier} directive in ${input.category}.`,
      eventType: "directive_declared",
      meta: { intentId: input.intentId, countryId: input.countryId, userId: input.userId },
      priority: "medium",
      related: [input.countryId],
    });
    return id;
  } catch (error) {
    // A concurrent declare wrote the row first: that is the same success.
    if (await exists().catch(() => null)) return id;
    console.error("[Activity] Failed to record the directive activity:", error);
    return null;
  }
}

/** An abandoned directive leaves the public record, so its row leaves with it: cards for it read "Unverified action". */
export async function withdrawDirectiveActivity(
  db: DirectiveActivityDb,
  intentId: string
): Promise<void> {
  try {
    await db.activityFeed.updateMany({
      where: { id: directiveActivityId(intentId) },
      data: { visibility: "private" },
    });
  } catch (error) {
    console.error("[Activity] Failed to withdraw the directive activity:", error);
  }
}
