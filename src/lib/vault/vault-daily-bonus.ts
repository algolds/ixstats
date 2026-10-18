import { type Prisma, type PrismaClient } from "@prisma/client";
import { earnCreditsTx, getOrCreateVault, LedgerError } from "~/lib/vault/vault-ledger";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { CardFinish } from "~/lib/cards/enums";
import { mintCopy } from "~/lib/cards/mint";
import { EXCLUDE_RESTRICTED_ART } from "~/lib/cards/art-licence";
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";
import { EXCLUDE_TROPHY_CARDS } from "~/lib/lorewards/trophy-cards";
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

/**
 * The cards a daily claim can draw: live (a card whose art a takedown hid is retired), approved, never a Loreward
 * trophy or restricted-licence art.
 */
const DAILY_POOL = {
  isRetired: false,
  reviewState: "APPROVED",
  ...EXCLUDE_TROPHY_CARDS,
  ...EXCLUDE_RESTRICTED_ART,
} as const;

/** A random card from the pool; null when the pool is empty. */
async function pickRandomCard(db: PrismaClient) {
  const total = await db.card.count({ where: DAILY_POOL });
  if (total === 0) return null;
  return db.card.findFirst({ where: DAILY_POOL, skip: Math.floor(Math.random() * total) });
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
  cardAwarded?: { id: string; ownershipId: string; title: string; rarity: string; artwork: string };
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

    // Slot, mint (serial, copy, mint row), XP and ledger row: one transaction
    const claimed = await db.$transaction(async (tx) => {
      const slot = await claimDailySlot(tx, vault, now);
      if (!slot.claimed) return null;

      // Serial, copy and its mint row (DAILY_CLAIM) through the one mint path
      const ownership = await mintCopy(tx, {
        cardId: card.id,
        ownerId: vault.userId,
        finish: CardFinish.STANDARD,
        source: "DAILY_CLAIM",
      });

      await grantCardXp(tx, ownership.id, "DAILY_CLAIM", JSON.stringify({ cardId: card.id }));

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

      return { streak: slot.streak, ownershipId: ownership.id };
    });

    if (claimed === null) return alreadyClaimed;

    return {
      success: true,
      rewardType,
      cardAwarded: {
        id: card.id,
        ownershipId: claimed.ownershipId,
        title: card.title,
        rarity: card.rarity,
        artwork: card.artwork || CARD_ARTWORK_PLACEHOLDER,
      },
      streak: claimed.streak,
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
