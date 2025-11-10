/**
 * MyVault Service
 *
 * Provides centralized logic for managing IxCredits economy, including:
 * - Credit earning and spending with transaction logging
 * - Daily bonus and login streak management
 * - Earning caps enforcement (active 100 IxC/day, social 50 IxC/day)
 * - Passive income calculation from nation performance
 * - Balance and transaction history queries
 *
 * Usage:
 *   import { vaultService } from '~/lib/vault-service';
 *   await vaultService.earnCredits(userId, 10, 'EARN_ACTIVE', 'MISSION_COMPLETE', db);
 */

import { type PrismaClient } from "@prisma/client";
import { type VaultTransactionType } from "@prisma/client";

/**
 * Vault Service
 * Handles all IxCredits economy operations
 */
export class VaultService {
  /**
   * Get or create a vault for a user
   * @param userIdOrClerkId Database User.id or Clerk user ID
   * @param db Prisma database client
   * @returns MyVault record
   */
  private async getOrCreateVault(userIdOrClerkId: string, db: PrismaClient) {
    try {
      // First, try to find the User record (handles both database id and clerkUserId)
      let user = await db.user.findFirst({
        where: {
          OR: [
            { id: userIdOrClerkId },
            { clerkUserId: userIdOrClerkId },
          ],
        },
      });

      if (!user) {
        throw new Error(`User not found: ${userIdOrClerkId}`);
      }

      // Now find or create vault using the database User.id
      let vault = await db.myVault.findUnique({
        where: { userId: user.id },
      });

      if (!vault) {
        // Create new vault with default values
        vault = await db.myVault.create({
          data: {
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
        console.log(`[Vault Service] Created new vault for user ${user.id} (Clerk: ${user.clerkUserId})`);
      }

      return vault;
    } catch (error) {
      console.error(`[Vault Service] Failed to get/create vault for ${userIdOrClerkId}:`, error);
      throw new Error("Failed to access vault");
    }
  }

  /**
   * Reset daily earning totals if it's a new day
   * @param vault MyVault record
   * @param db Prisma database client
   */
  private async checkAndResetDailyEarnings(vault: any, db: PrismaClient) {
    try {
      const lastReset = new Date(vault.lastDailyReset);
      const now = new Date();

      // Check if it's a new day (UTC)
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
   * @param userId Clerk user ID
   * @param earnType Transaction type (EARN_ACTIVE or EARN_SOCIAL)
   * @param db Prisma database client
   * @returns Object with canEarn boolean and remaining amount
   */
  async checkDailyCap(
    userId: string,
    earnType: "EARN_ACTIVE" | "EARN_SOCIAL",
    db: PrismaClient
  ): Promise<{ canEarn: boolean; remaining: number; cap: number }> {
    try {
      const vault = await this.getOrCreateVault(userId, db);
      await this.checkAndResetDailyEarnings(vault, db);

      // Get today's earnings for this type
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

      // Define caps
      const cap = earnType === "EARN_ACTIVE" ? 100 : 50;
      const remaining = Math.max(0, cap - todayEarnings);

      return {
        canEarn: remaining > 0,
        remaining,
        cap,
      };
    } catch (error) {
      console.error(`[Vault Service] Failed to check daily cap:`, error);
      // Return conservative values on error
      return { canEarn: false, remaining: 0, cap: 0 };
    }
  }

  /**
   * Earn IxCredits with transaction logging
   * @param userId Clerk user ID
   * @param amount Amount of credits to earn
   * @param type Transaction type
   * @param source Source description
   * @param db Prisma database client
   * @param metadata Optional metadata
   * @returns Updated vault balance
   */
  async earnCredits(
    userId: string,
    amount: number,
    type: VaultTransactionType,
    source: string,
    db: PrismaClient,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; newBalance: number; message?: string }> {
    try {
      // Validate amount
      if (amount <= 0) {
        return { success: false, newBalance: 0, message: "Amount must be positive" };
      }

      // Check daily caps for active and social earnings
      if (type === "EARN_ACTIVE" || type === "EARN_SOCIAL") {
        const capCheck = await this.checkDailyCap(userId, type, db);
        if (!capCheck.canEarn) {
          return {
            success: false,
            newBalance: 0,
            message: `Daily earning cap reached (${capCheck.cap} IxC/day for ${type === "EARN_ACTIVE" ? "active gameplay" : "social activities"})`,
          };
        }

        // Cap the amount to remaining allowance
        if (amount > capCheck.remaining) {
          amount = capCheck.remaining;
          console.log(`[Vault Service] Capped earning amount to ${amount} (remaining allowance)`);
        }
      }

      const vault = await this.getOrCreateVault(userId, db);
      await this.checkAndResetDailyEarnings(vault, db);

      // TODO: Apply premium multiplier when premium system is implemented
      const finalAmount = amount;

      // Update vault and create transaction in a transaction
      const result = await db.$transaction(async (tx) => {
        const updatedVault = await tx.myVault.update({
          where: { id: vault.id },
          data: {
            credits: { increment: finalAmount },
            lifetimeEarned: { increment: finalAmount },
            todayEarned: { increment: finalAmount },
            vaultXp: { increment: Math.floor(finalAmount) }, // XP = credits earned
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
          },
        });

        return updatedVault;
      });

      console.log(
        `[Vault Service] User ${userId} earned ${finalAmount} IxC (${type}) - New balance: ${result.credits}`
      );

      return { success: true, newBalance: result.credits };
    } catch (error) {
      console.error(`[Vault Service] Failed to earn credits for ${userId}:`, error);
      return { success: false, newBalance: 0, message: "Failed to earn credits" };
    }
  }

  /**
   * Spend IxCredits with validation and transaction logging
   * @param userId Clerk user ID
   * @param amount Amount of credits to spend
   * @param type Transaction type
   * @param source Source description
   * @param db Prisma database client
   * @param metadata Optional metadata
   * @returns Updated vault balance or error
   */
  async spendCredits(
    userId: string,
    amount: number,
    type: VaultTransactionType,
    source: string,
    db: PrismaClient,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; newBalance: number; message?: string }> {
    try {
      // Validate amount
      if (amount <= 0) {
        return { success: false, newBalance: 0, message: "Amount must be positive" };
      }

      const vault = await this.getOrCreateVault(userId, db);

      // Check sufficient balance
      if (vault.credits < amount) {
        return {
          success: false,
          newBalance: vault.credits,
          message: `Insufficient credits. You have ${vault.credits} IxC but need ${amount} IxC`,
        };
      }

      // Update vault and create transaction in a transaction
      const result = await db.$transaction(async (tx) => {
        const updatedVault = await tx.myVault.update({
          where: { id: vault.id },
          data: {
            credits: { decrement: amount },
            lifetimeSpent: { increment: amount },
          },
        });

        await tx.vaultTransaction.create({
          data: {
            vaultId: vault.id,
            credits: -amount, // Negative for spending
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

      return { success: true, newBalance: result.credits };
    } catch (error) {
      console.error(`[Vault Service] Failed to spend credits for ${userId}:`, error);
      return { success: false, newBalance: 0, message: "Failed to spend credits" };
    }
  }

  /**
   * Get current vault balance and stats
   * @param userId Clerk user ID
   * @param db Prisma database client
   * @returns Vault balance and stats
   */
  async getBalance(userId: string, db: PrismaClient) {
    try {
      const vault = await this.getOrCreateVault(userId, db);
      await this.checkAndResetDailyEarnings(vault, db);

      // Calculate vault level (1000 XP per level)
      const calculatedLevel = Math.floor(vault.vaultXp / 1000) + 1;

      // Update level if it changed
      if (calculatedLevel !== vault.vaultLevel) {
        await db.myVault.update({
          where: { id: vault.id },
          data: { vaultLevel: calculatedLevel },
        });
      }

      // Check if daily bonus can be claimed
      const lastLoginDate = vault.lastLoginDate ? new Date(vault.lastLoginDate) : null;
      const now = new Date();
      const canClaimDailyBonus = !lastLoginDate || (
        lastLoginDate.getUTCFullYear() !== now.getUTCFullYear() ||
        lastLoginDate.getUTCMonth() !== now.getUTCMonth() ||
        lastLoginDate.getUTCDate() !== now.getUTCDate()
      );

      return {
        credits: vault.credits,
        lifetimeEarned: vault.lifetimeEarned,
        lifetimeSpent: vault.lifetimeSpent,
        todayEarned: vault.todayEarned,
        vaultLevel: calculatedLevel,
        vaultXp: vault.vaultXp,
        loginStreak: vault.loginStreak,
        canClaimDailyBonus,
        premiumMultiplier: 1.0, // TODO: Implement premium system
        isPremium: false, // TODO: Implement premium system
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
   * @param userId Clerk user ID
   * @param db Prisma database client
   * @param limit Maximum number of transactions to return
   * @param offset Offset for pagination
   * @param type Optional filter by transaction type
   * @returns Array of transactions
   */
  async getTransactionHistory(
    userId: string,
    db: PrismaClient,
    limit: number = 50,
    offset: number = 0,
    type?: VaultTransactionType
  ) {
    try {
      const vault = await this.getOrCreateVault(userId, db);

      const transactions = await db.vaultTransaction.findMany({
        where: {
          vaultId: vault.id,
          ...(type ? { type } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100), // Cap at 100
        skip: offset,
      });

      return transactions.map((tx) => ({
        id: tx.id,
        amount: tx.credits, // Map to 'amount' for useRecentActivity hook
        credits: tx.credits,
        balanceAfter: tx.balanceAfter,
        type: tx.type,
        source: tx.source,
        metadata: tx.metadata as Record<string, any> | null,
        createdAt: new Date(tx.createdAt),
      }));
    } catch (error) {
      console.error(`[Vault Service] Failed to get transaction history for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Claim daily login bonus with streak tracking
   * @param userId Clerk user ID
   * @param db Prisma database client
   * @returns Result with bonus amount and new streak
   */
  async claimDailyBonus(
    userId: string,
    db: PrismaClient
  ): Promise<{ success: boolean; bonus: number; streak: number; message?: string }> {
    try {
      const vault = await this.getOrCreateVault(userId, db);

      // Check if already claimed today
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

      // Update login streak
      const newStreak = await this.updateLoginStreak(userId, db);

      // Calculate bonus (1 IxC for day 1, scaling to 10 IxC for day 7+)
      const bonus = Math.min(newStreak, 7);

      // Award bonus
      const earnResult = await this.earnCredits(
        userId,
        bonus,
        "EARN_ACTIVE",
        "DAILY_LOGIN",
        db,
        { streak: newStreak }
      );

      if (!earnResult.success) {
        return {
          success: false,
          bonus: 0,
          streak: newStreak,
          message: earnResult.message,
        };
      }

      console.log(`[Vault Service] User ${userId} claimed daily bonus: ${bonus} IxC (streak: ${newStreak})`);

      return {
        success: true,
        bonus,
        streak: newStreak,
      };
    } catch (error) {
      console.error(`[Vault Service] Failed to claim daily bonus for ${userId}:`, error);
      return {
        success: false,
        bonus: 0,
        streak: 0,
        message: "Failed to claim daily bonus",
      };
    }
  }

  /**
   * Update login streak (increments or resets based on last login)
   * @param userId Clerk user ID
   * @param db Prisma database client
   * @returns New streak count
   */
  async updateLoginStreak(userId: string, db: PrismaClient): Promise<number> {
    try {
      const vault = await this.getOrCreateVault(userId, db);
      const lastLogin = vault.lastLoginDate ? new Date(vault.lastLoginDate) : null;
      const now = new Date();

      let newStreak = 1;

      if (lastLogin) {
        // Calculate days between last login and now
        const daysDiff = Math.floor(
          (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 1) {
          // Consecutive day - increment streak
          newStreak = vault.loginStreak + 1;
        } else if (daysDiff > 1) {
          // Missed a day - reset streak
          newStreak = 1;
        } else {
          // Same day - keep current streak
          newStreak = vault.loginStreak;
        }
      }

      // Update vault
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
   * Calculate passive income based on nation performance
   * Formula: (GDP Per Capita / 10000) * Economic Tier Multiplier + Population Bonus + Growth Bonus
   * @param countryId Country ID
   * @param db Prisma database client
   * @returns Daily dividend amount
   */
  async calculatePassiveIncome(countryId: string, db: PrismaClient): Promise<number> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
      });

      if (!country) {
        console.error(`[Vault Service] Country ${countryId} not found`);
        return 0;
      }

      // Economic tier multipliers
      const tierMultipliers: Record<string, number> = {
        "1": 3.0,
        "2": 2.0,
        "3": 1.5,
        "4": 1.0,
      };

      const tierMultiplier = (tierMultipliers as Record<string, number>)[country.economicTier] || 1.0;

      // Base rate: (GDP Per Capita / 10000) * Economic Tier Multiplier
      const baseRate = (country.currentGdpPerCapita / 10000) * tierMultiplier;

      // Population bonus: +0.01 IxC per 1M citizens
      const populationBonus = (country.currentPopulation / 1000000) * 0.01;

      // Growth bonus: +10% if GDP growth > 3% this quarter
      const growthBonus = (country.adjustedGdpGrowth || 0) > 3 ? baseRate * 0.1 : 0;

      const totalDividend = baseRate + populationBonus + growthBonus;

      console.log(
        `[Vault Service] Calculated passive income for ${countryId}: ${totalDividend.toFixed(2)} IxC ` +
        `(base: ${baseRate.toFixed(2)}, pop: ${populationBonus.toFixed(2)}, growth: ${growthBonus.toFixed(2)})`
      );

      return Math.round(totalDividend * 100) / 100; // Round to 2 decimals
    } catch (error) {
      console.error(`[Vault Service] Failed to calculate passive income for ${countryId}:`, error);
      return 0;
    }
  }

  /**
   * Get today's earnings breakdown by category
   * @param userId Clerk user ID
   * @param db Prisma database client
   * @returns Earnings breakdown
   */
  async getEarningsSummary(userId: string, db: PrismaClient) {
    try {
      const vault = await this.getOrCreateVault(userId, db);
      await this.checkAndResetDailyEarnings(vault, db);

      // Get today's transactions
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const todayTransactions = await db.vaultTransaction.findMany({
        where: {
          vaultId: vault.id,
          createdAt: { gte: startOfDay },
          credits: { gt: 0 }, // Only earnings, not spending
        },
      });

      // Group by type
      const breakdown = todayTransactions.reduce((acc, tx) => {
        const type = tx.type;
        if (!acc[type]) {
          acc[type] = 0;
        }
        acc[type] += tx.credits;
        return acc;
      }, {} as Record<string, number>);

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
}

// Export singleton instance
export const vaultService = new VaultService();
