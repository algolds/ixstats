/**
 * Member notices (M13): a notification to the member on a warning, a ban, a shortened automatic ban, a lifted ban
 * and an appeal decision,
 * linking to their standing on the forum home. The router sends them after the moderation transaction commits.
 * Best effort: a failed lookup or notification is logged and swallowed, so a notice never fails the action.
 */
import type { PrismaClient } from "@prisma/client";
import { notificationAPI } from "~/lib/notifications/api";
import { STANDING_HREF } from "~/lib/thinkpages-forum/links";
import { formatBanDate, type BanScope } from "~/lib/thinkpages-forum/moderation-policy";
import type { AppealDecision, AppealSubjectType } from "./mod-appeal-subjects";

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

/** M5 (owner wording): a revoke that shortens the automatic ban says so, never as a new ban. */
export function notifyAutoBanShortened(
  db: NoticesDb,
  input: { userId: string; expiresAt: Date }
): Promise<void> {
  return send(db, input.userId, {
    title: "Your forum ban was shortened",
    message: `Your automatic forum ban was shortened; it now ends on ${formatBanDate(input.expiresAt)}.`,
    type: "info",
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

const DECISION_COPY: Record<
  AppealDecision,
  { title: string; result: (subject: string) => string }
> = {
  overturned: {
    title: "Your appeal was accepted",
    result: (subject) => `Your ${subject} was overturned.`,
  },
  upheld: { title: "Your appeal was declined", result: (subject) => `Your ${subject} stands.` },
  moot: {
    title: "Your appeal was closed",
    result: (subject) => `Your ${subject} had already ended, so there was nothing left to decide.`,
  },
};

/** The review's decision; `moot` says the warning or ban had already ended (never that it stands). */
export function notifyAppealDecision(
  db: NoticesDb,
  input: {
    userId: string;
    subjectType: AppealSubjectType;
    outcome: AppealDecision;
    response: string;
  }
): Promise<void> {
  const copy = DECISION_COPY[input.outcome];
  return send(db, input.userId, {
    title: copy.title,
    message: `${copy.result(input.subjectType)} Response: ${input.response}`,
    type: "info",
  });
}
