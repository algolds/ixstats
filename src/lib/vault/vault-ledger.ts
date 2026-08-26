import { type PrismaClient, type VaultTransactionType } from "@prisma/client";
import { syncUserToForum } from "~/server/modules/forum";
import { getVaultConfig } from "~/lib/vault/vault-perks";
import { catchUpPassiveIncome } from "~/lib/vault/vault-passive-income";

/**
 * Get or create a vault for a user
 */
export async function getOrCreateVault(userIdOrClerkId: string, db: PrismaClient) {
  try {
    const user = await db.user.findFirst({
      where: {
        OR: [{ id: userIdOrClerkId }, { clerkUserId: userIdOrClerkId }],
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userIdOrClerkId}`);
    }

    const vault = await db.myVault.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        credits: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        todayEarned: 0,
        lastDailyReset: new Date(),
        loginStreak: 0,
        vaultLevel: 1,
        vaultXp: 0,
      },
    });

    return vault;
  } catch (error) {
    console.error(`[Vault Service] Failed to get/create vault for ${userIdOrClerkId}:`, error);
    throw new Error("Failed to access vault", { cause: error });
  }
}

/**
 * Reset daily earning totals if it's a new day
 */
export async function checkAndResetDailyEarnings(
  vault: { id: string; lastDailyReset: Date },
  db: PrismaClient
) {
  try {
    const lastReset = new Date(vault.lastDailyReset);
    const now = new Date();

    const isDifferentDay =
      lastReset.getUTCFullYear() !== now.getUTCFullYear() ||
      lastReset.getUTCMonth() !== now.getUTCMonth() ||
      lastReset.getUTCDate() !== now.getUTCDate();

    if (isDifferentDay) {
      await db.myVault.update({
        where: { id: vault.id },
        data: {
          todayEarned: 0,
          lastDailyReset: now,
        },
      });
      console.log(`[Vault Service] Reset daily earnings for vault ${vault.id}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[Vault Service] Failed to reset daily earnings:`, error);
    return false;
  }
}

/**
 * Check if user has hit daily earning cap for a specific type
 */
export async function checkDailyCap(
  userId: string,
  earnType: "EARN_ACTIVE" | "EARN_SOCIAL",
  db: PrismaClient
): Promise<{ canEarn: boolean; remaining: number; cap: number }> {
  try {
    const vault = await getOrCreateVault(userId, db);
    await checkAndResetDailyEarnings(vault, db);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const todayTransactions = await db.vaultTransaction.findMany({
      where: {
        vaultId: vault.id,
        type: earnType,
        createdAt: {
          gte: startOfDay,
        },
      },
    });

    const todayEarnings = todayTransactions.reduce((sum, tx) => sum + tx.credits, 0);

    const vaultCfg = await getVaultConfig(db);
    const cap = earnType === "EARN_ACTIVE" ? vaultCfg.activeDailyCap : vaultCfg.socialDailyCap;
    const remaining = Math.max(0, cap - todayEarnings);

    return {
      canEarn: remaining > 0,
      remaining,
      cap,
    };
  } catch (error) {
    console.error(`[Vault Service] Failed to check daily cap:`, error);
    return { canEarn: false, remaining: 0, cap: 0 };
  }
}

/**
 * Earn IxCredits with transaction logging
 */
export async function earnCredits(
  userId: string,
  amount: number,
  type: VaultTransactionType,
  source: string,
  db: PrismaClient,
  metadata?: Record<string, unknown>,
  createdAt?: Date
): Promise<{ success: boolean; newBalance: number; message?: string }> {
  try {
    const config = await getVaultConfig(db);
    if (config.isMaintenanceMode) {
      return {
        success: false,
        newBalance: 0,
        message: "Vault economy is currently in maintenance mode.",
      };
    }
    if (
      !config.isEarningEnabled &&
      (type === "EARN_ACTIVE" || type === "EARN_SOCIAL" || type === "EARN_PASSIVE")
    ) {
      return {
        success: false,
        newBalance: 0,
        message: "Earning credits is currently disabled globally.",
      };
    }

    if (amount <= 0) {
      return { success: false, newBalance: 0, message: "Amount must be positive" };
    }

    if (type === "EARN_ACTIVE" || type === "EARN_SOCIAL") {
      const capCheck = await checkDailyCap(userId, type, db);
      if (!capCheck.canEarn) {
        return {
          success: false,
          newBalance: 0,
          message: `Daily earning cap reached (${capCheck.cap} IxC/day for ${type === "EARN_ACTIVE" ? "active gameplay" : "social activities"})`,
        };
      }

      if (amount > capCheck.remaining) {
        amount = capCheck.remaining;
        console.log(`[Vault Service] Capped earning amount to ${amount} (remaining allowance)`);
      }
    }

    const vault = await getOrCreateVault(userId, db);
    await checkAndResetDailyEarnings(vault, db);

    const finalAmount = amount;

    const result = await db.$transaction(async (tx) => {
      const updatedVault = await tx.myVault.update({
        where: { id: vault.id },
        data: {
          credits: { increment: finalAmount },
          lifetimeEarned: { increment: finalAmount },
          todayEarned: { increment: finalAmount },
          vaultXp: { increment: Math.floor(finalAmount) },
        },
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId: vault.id,
          credits: finalAmount,
          balanceAfter: updatedVault.credits,
          type,
          source,
          metadata: metadata ? (JSON.stringify(metadata) as any) : null,
          createdAt: createdAt ?? new Date(),
        },
      });

      return updatedVault;
    });

    console.log(
      `[Vault Service] User ${userId} earned ${finalAmount} IxC (${type}) - New balance: ${result.credits}`
    );

    syncUserToForum(userId).catch(() => {});

    return { success: true, newBalance: result.credits };
  } catch (error) {
    console.error(`[Vault Service] Failed to earn credits for ${userId}:`, error);
    return { success: false, newBalance: 0, message: "Failed to earn credits" };
  }
}

/**
 * Spend IxCredits with validation and transaction logging
 */
export async function spendCredits(
  userId: string,
  amount: number,
  type: VaultTransactionType,
  source: string,
  db: PrismaClient,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; newBalance: number; message?: string }> {
  try {
    const config = await getVaultConfig(db);
    if (config.isMaintenanceMode) {
      return {
        success: false,
        newBalance: 0,
        message: "Vault economy is currently in maintenance mode.",
      };
    }

    if (!config.isStoreEnabled && (type === "SPEND_COSMETIC" || type === "SPEND_BOOST")) {
      return {
        success: false,
        newBalance: 0,
        message: "Storefront purchases are currently disabled globally.",
      };
    }

    if (!config.isPacksEnabled && type === "SPEND_PACKS") {
      return {
        success: false,
        newBalance: 0,
        message: "Card pack purchases are currently disabled globally.",
      };
    }

    if (amount <= 0) {
      return { success: false, newBalance: 0, message: "Amount must be positive" };
    }

    const vault = await getOrCreateVault(userId, db);

    if (vault.credits < amount) {
      return {
        success: false,
        newBalance: vault.credits,
        message: `Insufficient credits. You have ${vault.credits} IxC but need ${amount} IxC`,
      };
    }

    const result = await db.$transaction(async (tx) => {
      const updateResult = await tx.myVault.updateMany({
        where: {
          id: vault.id,
          credits: { gte: amount },
        },
        data: {
          credits: { decrement: amount },
          lifetimeSpent: { increment: amount },
        },
      });

      if (updateResult.count === 0) {
        throw new Error("INSUFFICIENT_CREDITS_RACE_CONDITION");
      }

      const updatedVault = await tx.myVault.findUniqueOrThrow({
        where: { id: vault.id },
      });

      await tx.vaultTransaction.create({
        data: {
          vaultId: vault.id,
          credits: -amount,
          balanceAfter: updatedVault.credits,
          type,
          source,
          metadata: metadata ? (JSON.stringify(metadata) as any) : null,
        },
      });

      return updatedVault;
    });

    console.log(
      `[Vault Service] User ${userId} spent ${amount} IxC (${type}) - New balance: ${result.credits}`
    );

    syncUserToForum(userId).catch(() => {});

    return { success: true, newBalance: result.credits };
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS_RACE_CONDITION") {
      return {
        success: false,
        newBalance: 0,
        message: "Insufficient credits for transaction.",
      };
    }
    console.error(`[Vault Service] Failed to spend credits for ${userId}:`, error);
    return { success: false, newBalance: 0, message: "Failed to spend credits" };
  }
}

/**
 * Get current vault balance and stats
 */
export async function getBalance(userId: string, db: PrismaClient) {
  try {
    const vault = await getOrCreateVault(userId, db);
    await checkAndResetDailyEarnings(vault, db);

    await catchUpPassiveIncome(userId, db);

    const updatedVault =
      (await db.myVault.findUnique({
        where: { id: vault.id },
      })) || vault;

    const vaultCfg = await getVaultConfig(db);
    const calculatedLevel = Math.floor(updatedVault.vaultXp / vaultCfg.xpPerLevel) + 1;

    if (calculatedLevel !== updatedVault.vaultLevel) {
      await db.myVault.update({
        where: { id: updatedVault.id },
        data: { vaultLevel: calculatedLevel },
      });
    }

    const lastLoginDate = updatedVault.lastLoginDate ? new Date(updatedVault.lastLoginDate) : null;
    const now = new Date();
    const canClaimDailyBonus =
      !lastLoginDate ||
      lastLoginDate.getUTCFullYear() !== now.getUTCFullYear() ||
      lastLoginDate.getUTCMonth() !== now.getUTCMonth() ||
      lastLoginDate.getUTCDate() !== now.getUTCDate();

    return {
      credits: updatedVault.credits,
      lifetimeEarned: updatedVault.lifetimeEarned,
      lifetimeSpent: updatedVault.lifetimeSpent,
      todayEarned: updatedVault.todayEarned,
      vaultLevel: calculatedLevel,
      vaultXp: updatedVault.vaultXp,
      loginStreak: updatedVault.loginStreak,
      canClaimDailyBonus,
      premiumMultiplier: vaultCfg.premiumMultiplier,
      isPremium: false,
    };
  } catch (error) {
    console.error(`[Vault Service] Failed to get balance for ${userId}:`, error);
    return {
      credits: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      todayEarned: 0,
      vaultLevel: 1,
      vaultXp: 0,
      loginStreak: 0,
      canClaimDailyBonus: true,
      premiumMultiplier: 1.0,
      isPremium: false,
    };
  }
}

/**
 * Get transaction history with pagination
 */
export async function getTransactionHistory(
  userId: string,
  db: PrismaClient,
  limit: number = 50,
  offset: number = 0,
  type?: VaultTransactionType
) {
  try {
    const vault = await getOrCreateVault(userId, db);

    const transactions = await db.vaultTransaction.findMany({
      where: {
        vaultId: vault.id,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      skip: offset,
    });

    return transactions.map((tx) => ({
      id: tx.id,
      amount: tx.credits,
      credits: tx.credits,
      balanceAfter: tx.balanceAfter,
      type: tx.type,
      source: tx.source,
      metadata: tx.metadata as Record<string, unknown> | null,
      createdAt: new Date(tx.createdAt),
    }));
  } catch (error) {
    console.error(`[Vault Service] Failed to get transaction history for ${userId}:`, error);
    return [];
  }
}

/**
 * Get earnings summary for today
 */
export async function getEarningsSummary(userId: string, db: PrismaClient) {
  try {
    const vault = await getOrCreateVault(userId, db);
    await checkAndResetDailyEarnings(vault, db);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const todayTransactions = await db.vaultTransaction.findMany({
      where: {
        vaultId: vault.id,
        createdAt: { gte: startOfDay },
        credits: { gt: 0 },
      },
    });

    const breakdown = todayTransactions.reduce(
      (acc, tx) => {
        const type = tx.type;
        if (!acc[type]) {
          acc[type] = 0;
        }
        acc[type] += tx.credits;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total: vault.todayEarned,
      breakdown,
      transactionCount: todayTransactions.length,
    };
  } catch (error) {
    console.error(`[Vault Service] Failed to get earnings summary for ${userId}:`, error);
    return {
      total: 0,
      breakdown: {},
      transactionCount: 0,
    };
  }
}
