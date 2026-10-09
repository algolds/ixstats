/**
 * Automatic site bans from warning points (owner decisions, M2, M3): 5 active points bring a 7-day ban, 10 a
 * 30-day one. The ban is issued by the moderator whose warning crossed the tier; a later tier extends the active
 * automatic ban instead of stacking a second; when points fall below the tier the ban was set for, it is lifted.
 * Both run inside the warning's transaction and log there.
 */
import type { PrismaClient } from "@prisma/client";
import { autoBanTier, DAY_MS, MODERATION_POLICY } from "~/lib/thinkpages-forum/moderation-policy";
import type { ForumViewer } from "./access";
import { liftBanTx } from "./mod-bans";
import { logModAction, type ModLogDetail } from "./mod-log";

export type AutoBanTx = Pick<PrismaClient, "forumBan" | "forumModLog">;
export type AutoBanOutcome = { banId: string; days: number; extended: boolean } | null;

interface AutoBan {
  id: string;
  userId: string;
  scope: string;
  scopeId: string | null;
  createdAt: Date;
  expiresAt: Date;
}

/** The user's live automatic site ban; automatic bans always end, so the query only finds dated ones. */
async function activeAutoBan(
  tx: Pick<AutoBanTx, "forumBan">,
  userId: string,
  now: Date
): Promise<AutoBan | null> {
  const ban = await tx.forumBan.findFirst({
    where: { userId, scope: "site", auto: true, liftedAt: null, expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
    select: {
      id: true,
      userId: true,
      scope: true,
      scopeId: true,
      createdAt: true,
      expiresAt: true,
    },
  });
  return ban?.expiresAt ? { ...ban, expiresAt: ban.expiresAt } : null;
}

/** The tier an automatic ban was set for, read from its length (an extension only lengthens it). */
function autoBanTierDays(ban: AutoBan): number {
  const length = Math.round((ban.expiresAt.getTime() - ban.createdAt.getTime()) / DAY_MS);
  const tiers = MODERATION_POLICY.autoBanTiers.map((t) => t.days);
  return tiers.find((days) => days <= length) ?? Math.min(...tiers);
}

/** Creates the automatic site ban for the tier `points` reach, or extends the active one (M2, M3); never stacks. */
export async function applyAutoBan(
  tx: AutoBanTx,
  issuer: NonNullable<ForumViewer>,
  userId: string,
  points: number,
  now: Date
): Promise<AutoBanOutcome> {
  const tier = autoBanTier(points);
  if (!tier) return null;
  const expiresAt = new Date(now.getTime() + tier.days * DAY_MS);
  const reason = `Automatic: ${points} active warning points`;
  const detail = { days: tier.days, points, trigger: "warning" };
  const entry = {
    actorId: issuer.id,
    targetType: "user",
    targetId: userId,
    scope: { kind: "site" },
  } as const;
  const current = await activeAutoBan(tx, userId, now);
  if (!current) {
    const ban = await tx.forumBan.create({
      data: {
        userId,
        scope: "site",
        scopeId: null,
        reason,
        expiresAt,
        auto: true,
        issuedBy: issuer.id,
      },
    });
    await logModAction(tx, { ...entry, action: "ban.auto", detail: { banId: ban.id, ...detail } });
    return { banId: ban.id, days: tier.days, extended: false };
  }
  if (current.expiresAt.getTime() >= expiresAt.getTime()) return null;
  await tx.forumBan.update({ where: { id: current.id }, data: { expiresAt, reason } });
  await logModAction(tx, {
    ...entry,
    action: "ban.extend",
    detail: {
      banId: current.id,
      ...detail,
      from: current.expiresAt.toISOString(),
      to: expiresAt.toISOString(),
    },
  });
  return { banId: current.id, days: tier.days, extended: true };
}

/** M3: lifts the active automatic ban when `points` no longer reach the tier it was set for; returns its id. */
export async function liftOutgrownAutoBan(
  tx: AutoBanTx,
  actor: NonNullable<ForumViewer>,
  userId: string,
  points: number,
  now: Date,
  detail: ModLogDetail
): Promise<string | null> {
  const ban = await activeAutoBan(tx, userId, now);
  const tier = autoBanTier(points);
  if (!ban || (tier !== null && tier.days >= autoBanTierDays(ban))) return null;
  await liftBanTx(tx, actor, ban, { ...detail, points });
  return ban.id;
}
