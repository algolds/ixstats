/**
 * Credit rewards for action-linked posts. A post's newly created links may each earn the flat reward when the action
 * has never been paid and the country is under its daily cap. Everything runs in one transaction whose first statement
 * is a per-country advisory lock, so two posts racing for the last slot of the day queue behind each other and the
 * cap count that follows is exact.
 *
 * Bookkeeping is the `ForumActionReward` table, never deleted: its primary key (the activity id) is the "one payout
 * per action ever" guarantee, and the cap counts its rows for the country since midnight UTC. A link row cannot carry
 * that, because every edit deletes and recreates link rows. The ledger key `forum_action:<activityId>` is a second
 * guard that survives even the reward row. An activity pays only when it still matches `pickableActivityWhere` (the
 * nation's own public action, not an Onoma, founding, tier or achievement row) and its link to this post still exists.
 *
 * The credit goes through `earnCreditsTx`, so the earning kill switch, maintenance mode and the user's social daily cap
 * all apply; a refusal (LedgerError) pays nothing and is not an error, and a truncated credit reports what was paid.
 *
 * The caller awaits this inline because the post's response carries the reward. It therefore must never fail or
 * hold a post: the transaction has a short wait and timeout, and any failure (timeout, lock queue, ledger, a duplicate
 * key, a thrown error) reads as "no reward" (0). The post is already saved before this runs.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type { PostSource } from "~/lib/action-links";
import {
  ACTION_REWARD_SOURCE,
  ACTION_REWARD_TYPE,
  actionRewardKey,
  actionRewardLockKey,
  startOfUtcDay,
} from "~/lib/action-rewards";
import { ConflictError } from "~/lib/app-error";
import { getBonusConfig } from "~/lib/vault/vault-bonus";
import { LedgerError, vaultService } from "~/lib/vault/vault-service";
import { pickableActivityWhere } from "./links";

export type RewardDb = Pick<PrismaClient, "$transaction" | "systemConfig">;

export interface RewardInput {
  /** The posting user's id (the reward is theirs, even for a persona post). */
  userId: string;
  countryId: string;
  postSource: PostSource;
  postRef: string;
  /** The activities whose links this post just created. */
  activityIds: readonly string[];
}

interface Rule {
  amount: number;
  /** Whole rewards a country may earn per UTC day. */
  cap: number;
}

type Tx = Prisma.TransactionClient;

/** The most the caller waits for a connection, and the transaction may run, before the post goes out unrewarded. */
const TX_OPTIONS = { maxWait: 2000, timeout: 5000 } as const;

/** The activities, in the post's order, that may still pay: every rule except the daily cap. */
async function payableActivityIds(
  tx: Tx,
  input: RewardInput,
  ids: readonly string[]
): Promise<string[]> {
  const { countryId, postSource, postRef } = input;
  const actions = await tx.activityFeed.findMany({
    where: { AND: [{ id: { in: [...ids] } }, pickableActivityWhere(countryId)] },
    select: { id: true },
  });
  const links = await tx.postActionLink.findMany({
    where: { postSource, postRef, countryId, activityId: { in: [...ids] } },
    select: { activityId: true },
  });
  const rewarded = await tx.forumActionReward.findMany({
    where: { activityId: { in: [...ids] } },
    select: { activityId: true },
  });
  const keyed = await tx.vaultTransaction.findMany({
    where: { idempotencyKey: { in: ids.map(actionRewardKey) } },
    select: { idempotencyKey: true },
  });
  const isAction = new Set(actions.map((row) => row.id));
  const isLinked = new Set(links.map((row) => row.activityId));
  const isPaid = new Set(rewarded.map((row) => row.activityId));
  const isKeyed = new Set(keyed.map((row) => row.idempotencyKey));
  return ids.filter(
    (id) =>
      isAction.has(id) && isLinked.has(id) && !isPaid.has(id) && !isKeyed.has(actionRewardKey(id))
  );
}

/** One action's payout: the credits actually paid, or null when the ledger refuses (nothing was written). */
async function payOne(
  tx: Tx,
  input: RewardInput,
  activityId: string,
  rule: Rule,
  now: Date
): Promise<number | null> {
  const { userId, countryId, postRef } = input;
  let paid: number;
  try {
    const earned = await vaultService.earnCreditsTx(tx, {
      userId,
      amount: rule.amount,
      type: ACTION_REWARD_TYPE,
      source: ACTION_REWARD_SOURCE,
      metadata: { activityId, countryId, postRef },
      idempotencyKey: actionRewardKey(activityId),
    });
    paid = earned.amount;
  } catch (error) {
    // The ledger checks its switches and caps before it writes anything, so a refusal leaves the transaction usable.
    if (error instanceof LedgerError) return null;
    throw error;
  }
  if (paid <= 0) return null;
  await tx.forumActionReward.create({
    data: { activityId, countryId, userId, amount: paid, createdAt: now },
  });
  return paid;
}

/** The locked part: slots left today, the payable actions, and one credit for each while slots and the ledger allow. */
async function payInLock(tx: Tx, input: RewardInput, rule: Rule, now: Date): Promise<number> {
  const { countryId } = input;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actionRewardLockKey(countryId)}))`;
  const paidToday = await tx.forumActionReward.count({
    where: { countryId, createdAt: { gte: startOfUtcDay(now) } },
  });
  let slots = Math.floor(rule.cap) - paidToday;
  if (slots <= 0) return 0;
  const payable = await payableActivityIds(tx, input, [...new Set(input.activityIds)]);
  let total = 0;
  for (const activityId of payable) {
    if (slots <= 0) break;
    const paid = await payOne(tx, input, activityId, rule, now);
    if (paid === null) {
      // A refusal ends the run (the switch, maintenance or the social cap holds for the rest too). One more statement
      // proves the transaction is still alive, so credits paid before it are never reported from a rolled-back one.
      if (total > 0) await tx.$executeRaw`SELECT 1`;
      break;
    }
    total += paid;
    slots -= 1;
  }
  return total;
}

/** A duplicate key means the payout already exists: expected under a race, not worth an error line. */
function isDuplicate(error: Error): boolean {
  if (error instanceof ConflictError) return true;
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Pays the new links of one post and returns the credits paid in total (0 for none). Never throws. The bonus master
 * toggle, a reward of 0 and a cap of 0 switch it off before any transaction opens.
 */
export async function grantActionLinkRewards(db: RewardDb, input: RewardInput): Promise<number> {
  if (input.activityIds.length === 0) return 0;
  try {
    const cfg = await getBonusConfig(db);
    const rule = { amount: cfg.forumActionReward, cap: cfg.forumActionDailyCap };
    if (!cfg.enabled || rule.amount <= 0 || rule.cap < 1) return 0;
    return await db.$transaction((tx) => payInLock(tx, input, rule, new Date()), TX_OPTIONS);
  } catch (error) {
    if (!(error instanceof Error && isDuplicate(error))) {
      console.error("[action-links] Reward failed:", error);
    }
    return 0;
  }
}
