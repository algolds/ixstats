/**
 * How a foreign-policy action's economic effects end. Enacting one leaves a GDP level effect on both nations, keyed by
 * the action (`foreignPolicyEffectKey`) and phased in over FP_EFFECT_YEARS. A hostile action ends when its initiator
 * lifts it ("lifted") or when that window closes ("expired"): either way the effects unwind from now on (no
 * rewritten past) and the action leaves the active list, so it no longer blocks a new one.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { endStorytellerEffects } from "~/lib/economy/storyteller-effects";
import { COOPERATIVE_FP_TYPES } from "~/lib/diplomacy/proposal-lifecycle";

/** IxTime years over which a foreign-policy action's GDP impact phases in: also a hostile action's lifetime. */
export const FP_EFFECT_YEARS = 4;

/** `createdBy` of the StorytellerEffects a foreign-policy action leaves on both nations. */
export const foreignPolicyEffectKey = (actionId: string) => `fp:${actionId}`;

const COOPERATIVE = new Set<string>(COOPERATIVE_FP_TYPES);

export const isCooperativeForeignPolicy = (actionType: string) => COOPERATIVE.has(actionType);

/** Description of the initiator's effect row (also how rows written before the action key are found). */
export function initiatorEffectDescription(action: {
  actionType: string;
  severity: string;
  target: { name: string };
}): string {
  const preposition = isCooperativeForeignPolicy(action.actionType) ? "with" : "against";
  return `Foreign policy: ${action.actionType} (${action.severity}) ${preposition} ${action.target.name}`;
}

/** Description of the target's effect row. */
export function targetEffectDescription(action: {
  actionType: string;
  severity: string;
  initiator: { name: string };
}): string {
  return `Affected by ${action.initiator.name}: ${action.actionType} (${action.severity})`;
}

interface EndableAction {
  id: string;
  initiatorId: string;
  targetId: string;
  actionType: string;
  severity: string;
  initiator: { name: string };
  target: { name: string };
}

/**
 * The effect rows an action left. Rows written before effects were keyed by the action carry the actor's user id, so
 * they are matched by nation and description (their "Ended:" rows too, so an ended group is never unwound twice).
 */
export function foreignPolicyEffectWhere(
  action: EndableAction
): Prisma.StorytellerEffectWhereInput {
  const own = initiatorEffectDescription(action);
  const theirs = targetEffectDescription(action);
  return {
    OR: [
      { createdBy: foreignPolicyEffectKey(action.id) },
      { countryId: action.initiatorId, description: { in: [own, `Ended: ${own}`] } },
      { countryId: action.targetId, description: { in: [theirs, `Ended: ${theirs}`] } },
    ],
  };
}

const ACTION_PARTIES = {
  initiator: { select: { name: true } },
  target: { select: { name: true } },
} as const;

/**
 * Moves an active action to `status` and unwinds its effects, in one transaction. False when it was no longer active
 * (lifted or expired by someone else first), in which case nothing is written.
 */
export async function endForeignPolicyAction(
  db: PrismaClient,
  actionId: string,
  status: "lifted" | "expired"
): Promise<boolean> {
  const action = await db.foreignPolicyAction.findUnique({
    where: { id: actionId },
    include: ACTION_PARTIES,
  });
  if (!action || action.status !== "active") return false;
  return db.$transaction(async (tx) => {
    const claimed = await tx.foreignPolicyAction.updateMany({
      where: { id: action.id, status: "active" },
      data: { status },
    });
    if (claimed.count === 0) return false;
    await endStorytellerEffects(tx, foreignPolicyEffectWhere(action));
    return true;
  });
}

/** Real-world instant before which an action enacted then has run its FP_EFFECT_YEARS IxTime window. */
export function hostileActionExpiryCutoff(ixNow: number = IxTime.getCurrentIxTime()): Date {
  return new Date(IxTime.convertFromIxTime(IxTime.addYears(ixNow, -FP_EFFECT_YEARS)));
}

/** When a hostile action enacted at `enactedAt` (real time) reaches the end of its effect window. */
export function hostileActionExpiresAt(enactedAt: Date): Date {
  const enactedIx = IxTime.convertToIxTime(enactedAt.getTime());
  return new Date(IxTime.convertFromIxTime(IxTime.addYears(enactedIx, FP_EFFECT_YEARS)));
}

/** Expires every hostile action whose effect window has closed (the diplomatic-drift cron runs it). */
export async function expireHostileForeignPolicyActions(db: PrismaClient): Promise<number> {
  const due = await db.foreignPolicyAction.findMany({
    where: {
      status: "active",
      actionType: { notIn: [...COOPERATIVE_FP_TYPES] },
      createdAt: { lte: hostileActionExpiryCutoff() },
    },
    select: { id: true },
  });
  let expired = 0;
  for (const { id } of due) {
    if (await endForeignPolicyAction(db, id, "expired")) expired++;
  }
  return expired;
}
