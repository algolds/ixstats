/**
 * Member notices (M13): a notification to the member on a warning, a ban, a lifted ban and an appeal decision,
 * linking to their standing on the forum home. The router sends them after the moderation transaction commits.
 * Best effort: a failed lookup or notification is logged and swallowed, so a notice never fails the action.
 */
import type { PrismaClient } from "@prisma/client";
import { notificationAPI } from "~/lib/notifications/api";
import { formatBanDate, type BanScope } from "~/lib/thinkpages-forum/moderation-policy";
import type { AppealOutcome, AppealSubjectType } from "./mod-appeal-subjects";

export type NoticesDb = Pick<PrismaClient, "user">;

/** A ban as a notice names it; `scopeName` is the realm's or category's name when the router has it. */
export interface NoticeBan {
  scope: BanScope;
  scopeName?: string | null;
  expiresAt: Date | null;
  reason: string;
}

interface Notice {
  title: string;
  message: string;
  type: "warning" | "info";
}

const STANDING_HREF = "/thinkpages/forum#standing";

/** Looks up the member's Clerk id (notifications are addressed by it) and sends; never throws. */
async function send(db: NoticesDb, userId: string, notice: Notice): Promise<void> {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { clerkUserId: true } });
    if (!user) return;
    await notificationAPI.create({
      userId: user.clerkUserId,
      ...notice,
      category: "social",
      href: STANDING_HREF,
      source: "thinkpages-forum",
      actionable: true,
    });
  } catch (error) {
    console.error("[thinkpages-forum] Member notice failed:", error);
  }
}

const pointsText = (points: number) => `${points} ${points === 1 ? "point" : "points"}`;

function placeOf(ban: Pick<NoticeBan, "scope" | "scopeName">): string {
  if (ban.scope === "site") return "the forum";
  if (ban.scope === "realm") return ban.scopeName ? `${ban.scopeName}'s forum` : "a realm's forum";
  return ban.scopeName ? `the ${ban.scopeName} category` : "a forum category";
}

export function notifyWarning(
  db: NoticesDb,
  input: { userId: string; points: number; reason: string; activePoints: number }
): Promise<void> {
  return send(db, input.userId, {
    title: "You received a forum warning",
    message: `A moderator gave you ${pointsText(input.points)} (${input.activePoints} active now). Reason: ${input.reason}`,
    type: "warning",
  });
}

export function notifyBan(db: NoticesDb, input: { userId: string; ban: NoticeBan }): Promise<void> {
  const { ban } = input;
  const until = ban.expiresAt ? formatBanDate(ban.expiresAt) : "a moderator lifts the ban";
  return send(db, input.userId, {
    title: "You are banned from posting",
    message: `You can't post in ${placeOf(ban)} until ${until}. Reason: ${ban.reason}`,
    type: "warning",
  });
}

export function notifyBanLifted(
  db: NoticesDb,
  input: { userId: string; ban: Pick<NoticeBan, "scope" | "scopeName"> }
): Promise<void> {
  return send(db, input.userId, {
    title: "Your forum ban was lifted",
    message: `You can post in ${placeOf(input.ban)} again.`,
    type: "info",
  });
}

export function notifyAppealDecision(
  db: NoticesDb,
  input: {
    userId: string;
    subjectType: AppealSubjectType;
    outcome: AppealOutcome;
    response: string;
  }
): Promise<void> {
  const overturned = input.outcome === "overturned";
  return send(db, input.userId, {
    title: overturned ? "Your appeal was accepted" : "Your appeal was declined",
    message: `Your ${input.subjectType} ${overturned ? "was overturned" : "stands"}. Response: ${input.response}`,
    type: "info",
  });
}
