/**
 * Automatic site bans from warning points (owner decisions, M2, M3): 5 active points bring a 7-day ban, 10 a
 * 30-day one. The ban is issued by the moderator whose warning crossed the tier and stores that tier (`autoTier`,
 * the points threshold). A warning only ever moves the active automatic ban up: crossing a higher tier extends it
 * to that tier's full length from the moment of crossing (never a second ban). A revoke re-tiers it to the highest
 * tier still met, measured from the ban's original start, and lifts it when no tier is met or that length has
 * already run out. All of it runs inside the warning's transaction, under the member's lock, and logs there.
 */
import type { PrismaClient } from "@prisma/client";
import { autoBanTier, DAY_MS } from "~/lib/thinkpages-forum/moderation-policy";
import type { ForumViewer } from "./access";
import { liftBanTx } from "./mod-bans";
import { logModAction, type ModLogDetail } from "./mod-log";

export type AutoBanTx = Pick<
  PrismaClient,
  "forumBan" | "forumAppeal" | "forumModLog" | "$executeRaw"
>;
export type AutoBanChange =
  | {
      kind: "issued" | "extended" | "shortened";
      banId: string;
      autoTier: number;
      days: number;
      expiresAt: Date;
    }
  | { kind: "lifted"; banId: string };

type Actor = NonNullable<ForumViewer>;
type Tier = { points: number; days: number };

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

const tierEnd = (start: Date, tier: Tier): Date => new Date(start.getTime() + tier.days * DAY_MS);
const siteEntry = (actor: Actor, userId: string) =>
  ({ actorId: actor.id, targetType: "user", targetId: userId, scope: { kind: "site" } }) as const;

async function issueAutoBan(
  tx: AutoBanTx,
  actor: Actor,
  userId: string,
  tier: Tier,
  points: number,
  now: Date,
  context: ModLogDetail
): Promise<AutoBanChange> {
  const expiresAt = tierEnd(now, tier);
  const ban = await tx.forumBan.create({
    data: {
      userId,
      scope: "site",
      scopeId: null,
      reason: `Automatic: ${points} active warning points`,
      expiresAt,
      auto: true,
      autoTier: tier.points,
      issuedBy: actor.id,
      createdAt: now,
    },
  });
  await logModAction(tx, {
    ...siteEntry(actor, userId),
    action: "ban.auto",
    detail: { banId: ban.id, days: tier.days, points, autoTier: tier.points, ...context },
  });
  return { kind: "issued", banId: ban.id, autoTier: tier.points, days: tier.days, expiresAt };
}

/**
 * Sets the active automatic ban to the highest tier `points` still meet (M3): up → that tier's full length from now
 * (never earlier than it already ends); down → that tier's length from the ban's original start.
 */
async function reconcileAutoBan(
  tx: AutoBanTx,
  actor: Actor,
  ban: AutoBan,
  points: number,
  now: Date,
  context: ModLogDetail
): Promise<AutoBanChange | null> {
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
  await tx.forumBan.update({
    where: { id: ban.id },
    data: {
      autoTier: tier.points,
      expiresAt,
      reason: `Automatic: ${points} active warning points`,
    },
  });
  await logModAction(tx, {
    ...siteEntry(actor, ban.userId),
    action: kind === "extended" ? "ban.extend" : "ban.shorten",
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
  return { kind, banId: ban.id, autoTier: tier.points, days: tier.days, expiresAt };
}

/**
 * After a warning: issue the tier's ban, or move the active one up a tier (never a second ban, M3). A warning never
 * shortens or lifts a ban, even when expired points leave fewer than the ban's tier; only a revoke does.
 */
export async function autoBanAfterWarning(
  tx: AutoBanTx,
  actor: Actor,
  userId: string,
  points: number,
  now: Date,
  context: ModLogDetail
): Promise<AutoBanChange | null> {
  const current = await activeAutoBan(tx, userId, now);
  const tier = autoBanTier(points);
  if (!tier) return null;
  if (!current) return issueAutoBan(tx, actor, userId, tier, points, now, context);
  if (tier.points <= (current.autoTier ?? 0)) return null;
  return reconcileAutoBan(tx, actor, current, points, now, context);
}

/** After a revoke: re-tier or lift the active automatic ban; never issues one. */
export async function autoBanAfterRevoke(
  tx: AutoBanTx,
  actor: Actor,
  userId: string,
  points: number,
  now: Date,
  context: ModLogDetail
): Promise<AutoBanChange | null> {
  const current = await activeAutoBan(tx, userId, now);
  return current ? reconcileAutoBan(tx, actor, current, points, now, context) : null;
}
