import { type PrismaClient } from "@prisma/client";
import { getOrCreateVault, earnCredits } from "~/lib/vault/vault-ledger";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { grantCardXp } from "~/lib/cards";

/**
 * Update login streak (increments or resets based on last login)
 */
export async function updateLoginStreak(userId: string, db: PrismaClient): Promise<number> {
  try {
    const vault = await getOrCreateVault(userId, db);
    const lastLogin = vault.lastLoginDate ? new Date(vault.lastLoginDate) : null;
    const now = new Date();

    let newStreak = 1;

    if (lastLogin) {
      const getUTCDaySerialNumber = (date: Date) =>
        Math.floor(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
            (1000 * 60 * 60 * 24)
        );

      const lastLoginDay = getUTCDaySerialNumber(lastLogin);
      const currentDay = getUTCDaySerialNumber(now);
      const daysDiff = currentDay - lastLoginDay;

      if (daysDiff === 1) {
        newStreak = vault.loginStreak + 1;
      } else if (daysDiff > 1) {
        newStreak = 1;
      } else {
        newStreak = vault.loginStreak;
      }
    }

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

/**
 * Claim daily login bonus with streak tracking
 */
export async function claimDailyBonus(
  userId: string,
  db: PrismaClient
): Promise<{ success: boolean; bonus: number; streak: number; message?: string }> {
  try {
    const vault = await getOrCreateVault(userId, db);

    const lastLogin = vault.lastLoginDate ? new Date(vault.lastLoginDate) : null;
    const now = new Date();

    if (lastLogin) {
      const isSameDay =
        lastLogin.getUTCFullYear() === now.getUTCFullYear() &&
        lastLogin.getUTCMonth() === now.getUTCMonth() &&
        lastLogin.getUTCDate() === now.getUTCDate();

      if (isSameDay) {
        return {
          success: false,
          bonus: 0,
          streak: vault.loginStreak,
          message: "Daily bonus already claimed today",
        };
      }
    }

    const newStreak = await updateLoginStreak(userId, db);

    const vaultCfg = await getVaultConfig(db);
    const bonus = Math.min(newStreak, vaultCfg.maxStreakBonus);

    const earnResult = await earnCredits(userId, bonus, "EARN_ACTIVE", "DAILY_LOGIN", db, {
      streak: newStreak,
    });

    if (!earnResult.success) {
      return {
        success: false,
        bonus: 0,
        streak: newStreak,
        message: earnResult.message,
      };
    }

    console.log(
      `[Vault Service] User ${userId} claimed daily bonus: ${bonus} IxC (streak: ${newStreak})`
    );

    return {
      success: true,
      bonus,
      streak: newStreak,
    };
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
  try {
    const vault = await getOrCreateVault(userId, db);

    const lastLogin = vault.lastLoginDate ? new Date(vault.lastLoginDate) : null;
    const now = new Date();

    if (lastLogin) {
      const isSameDay =
        lastLogin.getUTCFullYear() === now.getUTCFullYear() &&
        lastLogin.getUTCMonth() === now.getUTCMonth() &&
        lastLogin.getUTCDate() === now.getUTCDate();

      if (isSameDay) {
        return {
          success: false,
          rewardType: choice === "CREDITS" ? "credits" : "card",
          streak: vault.loginStreak,
          message: "Daily claim already made today",
        };
      }
    }

    const newStreak = await updateLoginStreak(userId, db);

    if (choice === "CREDITS") {
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

      const streakMultiplier = 1 + Math.min(newStreak * 0.05, 1.5);
      const levelMultiplier = 1 + Math.min(vault.vaultLevel * 0.02, 1.0);
      const totalCredits = Math.min(
        10000,
        Math.floor(baseCredits * streakMultiplier * levelMultiplier)
      );

      const earnResult = await earnCredits(
        userId,
        totalCredits,
        "EARN_ACTIVE",
        "DAILY_LOGIN_CREDITS",
        db,
        {
          streak: newStreak,
        }
      );

      if (!earnResult.success) {
        return {
          success: false,
          rewardType: "credits",
          streak: newStreak,
          message: earnResult.message,
        };
      }

      return {
        success: true,
        rewardType: "credits",
        creditsAwarded: totalCredits,
        streak: newStreak,
        message: `Claimed ${totalCredits} IxC daily bonus!`,
      };
    } else {
      const totalCardsCount = await db.card.count({ where: { isRetired: false } });
      let card;
      if (totalCardsCount > 0) {
        const randomOffset = Math.floor(Math.random() * totalCardsCount);
        card = await db.card.findFirst({
          where: { isRetired: false },
          skip: randomOffset,
        });
      } else {
        const fallbackCount = await db.card.count();
        if (fallbackCount === 0) {
          return {
            success: false,
            rewardType: "card",
            streak: newStreak,
            message: "No cards exist in the database to award.",
          };
        }
        const randomOffset = Math.floor(Math.random() * fallbackCount);
        card = await db.card.findFirst({
          skip: randomOffset,
        });
      }

      if (!card) {
        return {
          success: false,
          rewardType: "card",
          streak: newStreak,
          message: "Failed to pick a random card.",
        };
      }

      const maxSerial = await db.cardOwnership.findFirst({
        where: { cardId: card.id },
        orderBy: { serialNumber: "desc" },
        select: { serialNumber: true },
      });
      const nextSerial = (maxSerial?.serialNumber || 0) + 1;

      const ownership = await db.cardOwnership.create({
        data: {
          id: `co_${Date.now()}_${vault.userId}_${card.id}`,
          userId: vault.userId,
          cardId: card.id,
          ownerId: vault.userId,
          serialNumber: nextSerial,
          level: 1,
          experience: 0,
        },
      });

      await db.cardTransferEvent.create({
        data: {
          ownershipId: ownership.id,
          toUserId: vault.userId,
          action: "DAILY_CLAIM",
        },
      });

      await grantCardXp(db, ownership.id, 10, "DAILY_CLAIM", JSON.stringify({ cardId: card.id }));

      await db.vaultTransaction.create({
        data: {
          vaultId: vault.id,
          credits: 0,
          balanceAfter: vault.credits,
          type: "EARN_ACTIVE",
          source: "DAILY_LOGIN_CARD",
          metadata: JSON.stringify({ cardId: card.id, cardTitle: card.title }),
        },
      });

      return {
        success: true,
        rewardType: "card",
        cardAwarded: {
          id: card.id,
          title: card.title,
          rarity: card.rarity,
          artwork: card.artwork || "/images/cards/placeholder-nation.png",
        },
        streak: newStreak,
        message: `Claimed daily card: ${card.title}!`,
      };
    }
  } catch (error) {
    console.error("[Vault Service] Failed to claim combined daily claim:", error);
    return {
      success: false,
      rewardType: choice === "CREDITS" ? "credits" : "card",
      streak: 0,
      message: "Failed to claim daily reward",
    };
  }
}
