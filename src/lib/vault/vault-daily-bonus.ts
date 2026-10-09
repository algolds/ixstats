import { type Prisma, type PrismaClient } from "@prisma/client";
import { earnCreditsTx, getOrCreateVault, LedgerError } from "~/lib/vault/vault-ledger";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { allocateSerialNumberTx } from "~/lib/cards/serial-number";
import { newCardOwnershipId } from "~/lib/cards/ownership-id";
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY
  );
}

/**
 * Streak after a claim at `now`: +1 on the next UTC calendar day, reset to 1 after
 * a missed day, unchanged on the same day. No previous login starts at 1.
 */
export function computeNextStreak(
  lastLoginDate: Date | null,
  currentStreak: number,
  now: Date
): number {
  if (!lastLoginDate) return 1;
  const daysDiff = utcDayNumber(now) - utcDayNumber(new Date(lastLoginDate));
  if (daysDiff === 1) return currentStreak + 1;
  if (daysDiff > 1) return 1;
  return currentStreak;
}

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

/**
 * Claim daily login bonus with streak tracking
 */
export async function claimDailyBonus(
  userId: string,
  db: PrismaClient
): Promise<{ success: boolean; bonus: number; streak: number; message?: string }> {
  try {
    const vault = await getOrCreateVault(userId, db);
    const vaultCfg = await getVaultConfig(db);

    const payout = await claimSlotAndEarn(db, userId, vault, new Date(), "DAILY_LOGIN", (streak) =>
      Math.min(streak, vaultCfg.maxStreakBonus)
    );

    if (payout.status === "already-claimed") {
      return {
        success: false,
        bonus: 0,
        streak: payout.streak,
        message: "Daily bonus already claimed today",
      };
    }
    if (payout.status === "earn-failed") {
      return { success: false, bonus: 0, streak: payout.streak, message: payout.message };
    }

    console.log(
      `[Vault Service] User ${userId} claimed daily bonus: ${payout.amount} IxC (streak: ${payout.streak})`
    );

    return { success: true, bonus: payout.amount, streak: payout.streak };
  } catch (error) {
    console.error(`[Vault Service] Failed to claim daily login bonus for ${userId}:`, error);
    return {
      success: false,
      bonus: 0,
      streak: 0,
      message: "Failed to claim daily bonus",
    };
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

  const streakMultiplier = 1 + Math.min(streak * 0.05, 1.5);
  const levelMultiplier = 1 + Math.min(vaultLevel * 0.02, 1.0);
  return Math.min(10000, Math.floor(baseCredits * streakMultiplier * levelMultiplier));
}

/** Random non-retired card, falling back to any card; null when none exist. */
async function pickRandomCard(db: PrismaClient) {
  const activeCount = await db.card.count({ where: { isRetired: false } });
  const total = activeCount > 0 ? activeCount : await db.card.count();
  if (total === 0) return null;

  return db.card.findFirst({
    where: activeCount > 0 ? { isRetired: false } : {},
    skip: Math.floor(Math.random() * total),
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
  cardAwarded?: { id: string; title: string; rarity: string; artwork: string };
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

    const card = await pickRandomCard(db);
    if (!card) {
      return {
        success: false,
        rewardType,
        streak: vault.loginStreak,
        message: "No cards exist in the database to award.",
      };
    }

    // Slot, serial allocation, ownership, transfer event, XP and ledger row: one transaction
    const streak = await db.$transaction(async (tx) => {
      const slot = await claimDailySlot(tx, vault, now);
      if (!slot.claimed) return null;

      const serialNumber = await allocateSerialNumberTx(tx, card.id);

      const ownership = await tx.cardOwnership.create({
        data: {
          id: newCardOwnershipId(),
          userId: vault.userId,
          cardId: card.id,
          ownerId: vault.userId,
          serialNumber,
          level: 1,
          experience: 0,
        },
      });

      await tx.cardTransferEvent.create({
        data: {
          ownershipId: ownership.id,
          toUserId: vault.userId,
          action: "DAILY_CLAIM",
        },
      });

      await grantCardXp(
        tx as PrismaClient,
        ownership.id,
        10,
        "DAILY_CLAIM",
        JSON.stringify({ cardId: card.id })
      );

      await tx.vaultTransaction.create({
        data: {
          vaultId: vault.id,
          credits: 0,
          balanceAfter: vault.credits,
          type: "EARN_ACTIVE",
          source: "DAILY_LOGIN_CARD",
          metadata: JSON.stringify({ cardId: card.id, cardTitle: card.title }),
        },
      });

      return slot.streak;
    });

    if (streak === null) return alreadyClaimed;

    return {
      success: true,
      rewardType,
      cardAwarded: {
        id: card.id,
        title: card.title,
        rarity: card.rarity,
        artwork: card.artwork || CARD_ARTWORK_PLACEHOLDER,
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
