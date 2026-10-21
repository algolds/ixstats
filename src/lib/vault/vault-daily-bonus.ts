import { type CardFinish, type Prisma, type PrismaClient } from "@prisma/client";
import { earnCreditsTx, getOrCreateVault, LedgerError } from "~/lib/vault/vault-ledger";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { assertCapacityTx, CapacityError } from "~/lib/cards/capacity";
import { dailyRarityOdds, getEconomyConfig } from "~/lib/cards/economy-config";
import { mintCopy } from "~/lib/cards/mint";
import {
  createPoolDrawer,
  DAILY_POOL_WHERE,
  oddsWithCards,
  rollRarity,
  tierCounts,
} from "~/lib/cards/pool-draw";
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";
import { computeNextStreak, levelMultiplier, streakMultiplier } from "~/lib/vault/daily-roll";

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

interface ClaimableVault {
  id: string;
  lastLoginDate: Date | null;
  loginStreak: number;
}

/** Atomically take today's claim slot. `claimed` is false if it was already taken today. */
export async function claimDailySlot(
  db: Prisma.TransactionClient,
  vault: ClaimableVault,
  now: Date
): Promise<{ claimed: boolean; streak: number }> {
  const streak = computeNextStreak(vault.lastLoginDate, vault.loginStreak, now);
  const res = await db.myVault.updateMany({
    where: {
      id: vault.id,
      OR: [{ lastLoginDate: null }, { lastLoginDate: { lt: startOfUtcDay(now) } }],
    },
    data: { lastLoginDate: now, loginStreak: streak },
  });
  return { claimed: res.count === 1, streak };
}

/**
 * Update login streak (increments or resets based on last login)
 */
export async function updateLoginStreak(userId: string, db: PrismaClient): Promise<number> {
  try {
    const vault = await getOrCreateVault(userId, db);
    const now = new Date();
    const newStreak = computeNextStreak(vault.lastLoginDate, vault.loginStreak, now);

    await db.myVault.update({
      where: { id: vault.id },
      data: {
        loginStreak: newStreak,
        lastLoginDate: now,
      },
    });

    console.log(`[Vault Service] Updated login streak for ${userId}: ${newStreak}`);
    return newStreak;
  } catch (error) {
    console.error(`[Vault Service] Failed to update login streak for ${userId}:`, error);
    return 1;
  }
}

type SlotPayout =
  | { status: "already-claimed"; streak: number }
  | { status: "earn-failed"; streak: number; message: string }
  | { status: "paid"; streak: number; amount: number };

/**
 * Take today's slot and pay `amountFor(streak)` in one transaction. A ledger
 * failure throws inside the transaction, so the slot is rolled back with it and
 * the user can retry.
 */
async function claimSlotAndEarn(
  db: PrismaClient,
  userId: string,
  vault: ClaimableVault,
  now: Date,
  source: string,
  amountFor: (streak: number) => number
): Promise<SlotPayout> {
  try {
    const payout = await db.$transaction(async (tx): Promise<SlotPayout> => {
      const slot = await claimDailySlot(tx, vault, now);
      if (!slot.claimed) return { status: "already-claimed", streak: vault.loginStreak };

      const earned = await earnCreditsTx(tx, {
        userId,
        amount: amountFor(slot.streak),
        type: "EARN_ACTIVE",
        source,
        metadata: { streak: slot.streak },
      });
      return { status: "paid", streak: slot.streak, amount: earned.amount };
    });

    return payout;
  } catch (error) {
    if (error instanceof LedgerError) {
      return { status: "earn-failed", streak: vault.loginStreak, message: error.message };
    }
    throw error;
  }
}

function rollDailyCredits(streak: number, vaultLevel: number): number {
  const roll = Math.random() * 100;
  let baseCredits = 0;
  if (roll < 0.1) {
    baseCredits = Math.floor(Math.random() * 5000) + 5000;
  } else if (roll < 1.1) {
    baseCredits = Math.floor(Math.random() * 4000) + 1000;
  } else if (roll < 6.1) {
    baseCredits = Math.floor(Math.random() * 800) + 200;
  } else {
    baseCredits = Math.floor(Math.random() * 190) + 10;
  }

  return Math.min(
    10000,
    Math.floor(baseCredits * streakMultiplier(streak) * levelMultiplier(vaultLevel))
  );
}

/** No card can be drawn (an empty pool); the claim is kept. */
class DailyCardError extends Error {}

type DailyVault = Awaited<ReturnType<typeof getOrCreateVault>>;

/**
 * The daily card in one transaction: today's slot, capacity under the owner's lock (before the mint's serial lock), a
 * draw from any realm by the daily odds shared over the rarities that have cards (cards refresh §4, Q3), a copy with a
 * rolled finish, its XP and the ledger marker. A full collection or an empty pool throws, which rolls the slot back, so
 * the player can still take credits today.
 */
async function claimDailyCard(db: PrismaClient, vault: DailyVault, now: Date) {
  return db.$transaction(async (tx) => {
    const slot = await claimDailySlot(tx, vault, now);
    if (!slot.claimed) return null;
    await assertCapacityTx(tx, vault.userId, 1);
    const counts = await tierCounts(tx, DAILY_POOL_WHERE);
    const odds = oddsWithCards(dailyRarityOdds(await getEconomyConfig(tx)), counts);
    const card = await createPoolDrawer(tx, DAILY_POOL_WHERE, counts).draw(rollRarity(odds));
    if (!card) {
      throw new DailyCardError("There is no card to draw right now. Take the credits instead.");
    }
    const copy = await mintCopy(tx, {
      cardId: card.id,
      ownerId: vault.userId,
      source: "DAILY_CLAIM",
    });
    await grantCardXp(tx, copy.id, "DAILY_CLAIM", JSON.stringify({ cardId: card.id }), now);
    await tx.vaultTransaction.create({
      data: {
        vaultId: vault.id,
        credits: 0,
        balanceAfter: vault.credits,
        type: "EARN_ACTIVE",
        source: "DAILY_LOGIN_CARD",
        metadata: JSON.stringify({ cardId: card.id, cardTitle: card.title, finish: copy.finish }),
      },
    });
    return { streak: slot.streak, card, copy };
  });
}

/**
 * Claim combined daily claim (credits jackpot OR random card of the day)
 */
export async function claimCombinedDailyClaim(
  userId: string,
  choice: "CREDITS" | "CARD",
  db: PrismaClient
): Promise<{
  success: boolean;
  rewardType: "credits" | "card";
  creditsAwarded?: number;
  cardAwarded?: {
    id: string;
    ownershipId: string;
    title: string;
    rarity: string;
    artwork: string;
    finish: CardFinish;
  };
  streak: number;
  message?: string;
}> {
  const rewardType: "credits" | "card" = choice === "CREDITS" ? "credits" : "card";
  try {
    const vault = await getOrCreateVault(userId, db);
    const now = new Date();
    const alreadyClaimed = {
      success: false,
      rewardType,
      streak: vault.loginStreak,
      message: "Daily claim already made today",
    };

    if (choice === "CREDITS") {
      const payout = await claimSlotAndEarn(
        db,
        userId,
        vault,
        now,
        "DAILY_LOGIN_CREDITS",
        (streak) => rollDailyCredits(streak, vault.vaultLevel)
      );

      if (payout.status === "already-claimed") return alreadyClaimed;
      if (payout.status === "earn-failed") {
        return { success: false, rewardType, streak: payout.streak, message: payout.message };
      }

      return {
        success: true,
        rewardType,
        creditsAwarded: payout.amount,
        streak: payout.streak,
        message: `Claimed ${payout.amount} IxC daily bonus!`,
      };
    }

    let outcome: Awaited<ReturnType<typeof claimDailyCard>>;
    try {
      outcome = await claimDailyCard(db, vault, now);
    } catch (error) {
      if (error instanceof CapacityError || error instanceof DailyCardError) {
        return { success: false, rewardType, streak: vault.loginStreak, message: error.message };
      }
      throw error;
    }
    if (outcome === null) return alreadyClaimed;

    const { card, copy, streak } = outcome;
    return {
      success: true,
      rewardType,
      cardAwarded: {
        id: card.id,
        ownershipId: copy.id,
        title: card.title,
        rarity: card.rarity,
        artwork: card.artwork || CARD_ARTWORK_PLACEHOLDER,
        finish: copy.finish,
      },
      streak,
      message: `Claimed daily card: ${card.title}!`,
    };
  } catch (error) {
    console.error("[Vault Service] Failed to claim combined daily claim:", error);
    return {
      success: false,
      rewardType,
      streak: 0,
      message: "Failed to claim daily reward",
    };
  }
}
