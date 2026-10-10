/**
 * Automatic site bans from warning points (owner decisions, M2, M3): 5 active points bring a 7-day ban, 10 a
 * 30-day one. The ban is issued by the moderator whose warning crossed the tier and stores that tier (`autoTier`,
 * the points threshold). A warning only ever moves the active automatic ban up: crossing a higher tier extends it
 * to that tier's full length from the moment of crossing (never a second ban). A revoke only moves it down, to the
 * highest tier still met, measured from the ban's original start, and lifts it when no tier is met or that length
 * has already run out. All of it runs inside the warning's transaction, under the member's lock, and logs there.
 * When a manual site ban that covered a tier (M-2) is lifted or overturned, the tier is applied at once by the system
 * (follow-up M2, owner ruling), logged as `ban.retier`.
 */
import type { PrismaClient } from "@prisma/client";
import { activePoints, autoBanTier, DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import type { ForumViewer } from "./access";
import { liftBanTx } from "./mod-bans";
import { logModAction, type ModLogDetail } from "./mod-log";

export type AutoBanTx = Pick<
  PrismaClient,
  "forumBan" | "forumAppeal" | "forumModLog" | "$executeRaw"
>;
export type RetierTx = AutoBanTx & Pick<PrismaClient, "forumWarning">;
export type AutoBanChange =
  | {
      kind: "issued" | "extended" | "shortened";
      banId: string;
      autoTier: number;
      days: number;
      expiresAt: Date;
      /** The ban's stored reason, for the member's notice. */
      reason: string;
    }
  | { kind: "lifted"; banId: string };

type Actor = Pick<NonNullable<ForumViewer>, "id">;
type Tier = { points: number; days: number };
/** Who raises a tier and how it is logged: a warning's issuer, or the system on a re-tier (M2). */
interface Raise {
  actor: Actor;
  context: ModLogDetail;
  retier: boolean;
}

/** M2: a re-tier after a lift is nobody's warning, so the system issues it (as the board-ban migration does). */
const SYSTEM: Actor = { id: "system" };

/** A member's live warning points, sitewide (M4). */
export async function activePointsOf(
  db: Pick<RetierTx, "forumWarning">,
  userId: string,
  now: Date = new Date()
): Promise<number> {
  const rows = await db.forumWarning.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    select: { points: true, expiresAt: true, revokedAt: true },
  });
  return activePoints(rows, now);
}

interface AutoBan {
  id: string;
  userId: string;
  scope: string;
  scopeId: string | null;
  createdAt: Date;
  expiresAt: Date;
  autoTier: number | null;
}

/** The user's live automatic site ban; the query only finds dated ones, as automatic bans always end. */
async function activeAutoBan(
  tx: Pick<AutoBanTx, "forumBan">,
  userId: string,
  now: Date
): Promise<AutoBan | null> {
  const ban = await tx.forumBan.findFirst({
    where: { userId, scope: "site", auto: true, liftedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      scope: true,
      scopeId: true,
      createdAt: true,
      expiresAt: true,
      autoTier: true,
    },
  });
  return ban?.expiresAt ? { ...ban, expiresAt: ban.expiresAt } : null;
}

const autoBanReason = (points: number): string => `Automatic: ${points} active warning points`;
const tierEnd = (start: Date, tier: Tier): Date => new Date(start.getTime() + tier.days * DAY_MS);
const siteEntry = (actor: Actor, userId: string) =>
  ({ actorId: actor.id, targetType: "user", targetId: userId, scope: { kind: "site" } }) as const;

async function issueAutoBan(
  tx: AutoBanTx,
  by: Raise,
  userId: string,
  tier: Tier,
  points: number,
  now: Date
): Promise<AutoBanChange> {
  const expiresAt = tierEnd(now, tier);
  const reason = autoBanReason(points);
  const ban = await tx.forumBan.create({
    data: {
      userId,
      scope: "site",
      scopeId: null,
      reason,
      expiresAt,
      auto: true,
      autoTier: tier.points,
      issuedBy: by.actor.id,
      createdAt: now,
    },
  });
  await logModAction(tx, {
    ...siteEntry(by.actor, userId),
    action: by.retier ? "ban.retier" : "ban.auto",
    detail: { banId: ban.id, days: tier.days, points, autoTier: tier.points, ...by.context },
  });
  return {
    kind: "issued",
    banId: ban.id,
    autoTier: tier.points,
    days: tier.days,
    expiresAt,
    reason,
  };
}

function logActionOf(kind: "extended" | "shortened", retier: boolean): string {
  if (kind === "shortened") return "ban.shorten";
  return retier ? "ban.retier" : "ban.extend";
}

/**
 * Sets the active automatic ban to the highest tier `points` still meet (M3): up → that tier's full length from now
 * (never earlier than it already ends); down → that tier's length from the ban's original start.
 */
async function reconcileAutoBan(
  tx: AutoBanTx,
  by: Raise,
  ban: AutoBan,
  points: number,
  now: Date
): Promise<AutoBanChange | null> {
  const { actor, context } = by;
  const tier = autoBanTier(points);
  const lift = async (): Promise<AutoBanChange> => {
    await liftBanTx(tx, actor, ban, { ...context, points }, now);
    return { kind: "lifted", banId: ban.id };
  };
  if (!tier) return lift();
  if (tier.points === ban.autoTier) return null;
  const kind = tier.points > (ban.autoTier ?? 0) ? "extended" : "shortened";
  const expiresAt =
    kind === "extended"
      ? new Date(Math.max(ban.expiresAt.getTime(), tierEnd(now, tier).getTime()))
      : tierEnd(ban.createdAt, tier);
  if (expiresAt.getTime() <= now.getTime()) return lift();
  const reason = autoBanReason(points);
  await tx.forumBan.update({
    where: { id: ban.id },
    data: { autoTier: tier.points, expiresAt, reason },
  });
  await logModAction(tx, {
    ...siteEntry(actor, ban.userId),
    action: logActionOf(kind, by.retier),
    detail: {
      banId: ban.id,
      days: tier.days,
      points,
      autoTier: tier.points,
      previousTier: ban.autoTier,
      expiresAt: expiresAt.toISOString(),
      ...context,
    },
  });
  return { kind, banId: ban.id, autoTier: tier.points, days: tier.days, expiresAt, reason };
}

/**
 * M-2: a live manual site ban lasting at least until `end` (a permanent one always does) already keeps the member
 * out for the tier's length, so no automatic ban is issued or extended under it (and no notice contradicts it).
 */
async function coveredByManualBan(
  tx: Pick<AutoBanTx, "forumBan">,
  userId: string,
  end: Date
): Promise<boolean> {
  const manual = await tx.forumBan.findMany({
    where: { userId, scope: "site", auto: false, liftedAt: null },
    select: { expiresAt: true },
  });
  return manual.some((ban) => ban.expiresAt === null || ban.expiresAt >= end);
}

/**
 * After a warning: issue the tier's ban, or move the active one up a tier (never a second ban, M3), unless a manual
 * site ban already covers the tier (M-2). A warning never shortens or lifts a ban, even when expired points leave
 * fewer than the ban's tier; only a revoke does.
 */
export function autoBanAfterWarning(
  tx: AutoBanTx,
  actor: Actor,
  userId: string,
  points: number,
  now: Date,
  context: ModLogDetail
): Promise<AutoBanChange | null> {
  return raiseAutoBan(tx, { actor, context, retier: false }, userId, points, now);
}

async function raiseAutoBan(
  tx: AutoBanTx,
  by: Raise,
  userId: string,
  points: number,
  now: Date
): Promise<AutoBanChange | null> {
  const tier = autoBanTier(points);
  if (!tier) return null;
  const current = await activeAutoBan(tx, userId, now);
  if (current && tier.points <= (current.autoTier ?? 0)) return null;
  if (await coveredByManualBan(tx, userId, tierEnd(now, tier))) return null;
  if (!current) return issueAutoBan(tx, by, userId, tier, points, now);
  return reconcileAutoBan(tx, by, current, points, now);
}

/**
 * M2 (owner ruling): after a manual site ban is lifted or overturned, inside that transaction and at its `now`,
 * apply the tier the member's points meet, which the ban may have covered (M-2): issue it, or raise a lower
 * automatic ban to it, from now. The system is its issuer and the row is `ban.retier`. Other bans change nothing.
 */
export async function autoBanAfterLift(
  tx: RetierTx,
  ban: { id: string; userId: string; scope: string; auto: boolean },
  now: Date
): Promise<AutoBanChange | null> {
  if (ban.scope !== "site" || ban.auto) return null;
  const points = await activePointsOf(tx, ban.userId, now);
  const context = { trigger: "ban lifted", liftedBanId: ban.id };
  return raiseAutoBan(tx, { actor: SYSTEM, context, retier: true }, ban.userId, points, now);
}

/**
 * After a revoke: move the active automatic ban down a tier or lift it; never issues or extends one. Points still at
 * or above its tier (e.g. a higher tier a live manual site ban covers, M-2) leave it alone: only a new warning, or
 * the re-tier when that manual ban ends (M2), raises a tier.
 */
export async function autoBanAfterRevoke(
  tx: AutoBanTx,
  actor: Actor,
  userId: string,
  points: number,
  now: Date,
  context: ModLogDetail
): Promise<AutoBanChange | null> {
  const current = await activeAutoBan(tx, userId, now);
  if (!current) return null;
  const tier = autoBanTier(points);
  if (tier && tier.points >= (current.autoTier ?? 0)) return null;
  return reconcileAutoBan(tx, { actor, context, retier: false }, current, points, now);
}
