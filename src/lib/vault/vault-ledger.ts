import { type Prisma, type PrismaClient, type VaultTransactionType } from "@prisma/client";
import { getVaultConfig, type VaultConfig } from "~/lib/vault/vault-perks";
import { catchUpPassiveIncome } from "~/lib/vault/vault-passive-income";

type LedgerErrorCode =
  | "MAINTENANCE"
  | "EARNING_DISABLED"
  | "STORE_DISABLED"
  | "PACKS_DISABLED"
  | "INVALID_AMOUNT"
  | "DAILY_CAP_REACHED"
  | "INSUFFICIENT_CREDITS";

/**
 * Thrown by the *Tx ledger functions. A caller running inside a Prisma
 * interactive transaction lets it propagate so the whole transaction rolls back.
 * `balance` carries the balance known at the time of the failure (0 if unknown).
 */
export class LedgerError extends Error {
  readonly code: LedgerErrorCode;
  readonly balance: number;

  constructor(code: LedgerErrorCode, message: string, balance = 0) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.balance = balance;
  }
}

export interface LedgerEarnInput {
  userId: string;
  amount: number;
  type: VaultTransactionType;
  source: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  idempotencyKey?: string;
}

export type LedgerSpendInput = Omit<LedgerEarnInput, "createdAt">;

interface LedgerTxResult {
  newBalance: number;
  amount: number;
}

/**
 * Get or create a vault for a user
 */
export async function getOrCreateVault(userIdOrClerkId: string, db: Prisma.TransactionClient) {
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
async function checkAndResetDailyEarnings(
  vault: { id: string; lastDailyReset: Date },
  db: Prisma.TransactionClient
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
  db: Prisma.TransactionClient
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
 * Earn types the global earning kill switch stops. REFUND is deliberately exempt: a refund
 * returns credits the user already paid, it doesn't mint new ones, so it must still land
 * while earning is off. ADMIN_ADJUSTMENT stays open so admins can still correct balances.
 * EARN_EXCHANGE (Sovereigns converted back to IxCredits) is stopped too.
 */
const KILL_SWITCHED_EARN_TYPES: ReadonlySet<VaultTransactionType> = new Set([
  "EARN_ACTIVE",
  "EARN_SOCIAL",
  "EARN_PASSIVE",
  "EARN_BONUS",
  "EARN_CARDS",
  "EARN_EXCHANGE",
]);

function assertEarnAllowed(config: VaultConfig, type: VaultTransactionType): void {
  if (config.isMaintenanceMode) {
    throw new LedgerError("MAINTENANCE", "Vault economy is currently in maintenance mode.");
  }
  if (!config.isEarningEnabled && KILL_SWITCHED_EARN_TYPES.has(type)) {
    throw new LedgerError("EARNING_DISABLED", "Earning credits is currently disabled globally.");
  }
}

function assertSpendAllowed(config: VaultConfig, type: VaultTransactionType): void {
  if (config.isMaintenanceMode) {
    throw new LedgerError("MAINTENANCE", "Vault economy is currently in maintenance mode.");
  }
  if (!config.isStoreEnabled && (type === "SPEND_COSMETIC" || type === "SPEND_BOOST")) {
    throw new LedgerError(
      "STORE_DISABLED",
      "Storefront purchases are currently disabled globally."
    );
  }
  if (!config.isPacksEnabled && type === "SPEND_PACKS") {
    throw new LedgerError("PACKS_DISABLED", "Card pack purchases are currently disabled globally.");
  }
}

/**
 * Earn IxCredits inside the caller's transaction.
 *
 * Throws LedgerError on any business failure so the surrounding transaction
 * rolls back.
 */
export async function earnCreditsTx(
  tx: Prisma.TransactionClient,
  input: LedgerEarnInput
): Promise<LedgerTxResult> {
  const { userId, type, source, metadata, createdAt } = input;
  let amount = input.amount;

  assertEarnAllowed(await getVaultConfig(tx), type);
  if (amount <= 0) {
    throw new LedgerError("INVALID_AMOUNT", "Amount must be positive");
  }

  const vault = await getOrCreateVault(userId, tx);

  if (type === "EARN_ACTIVE" || type === "EARN_SOCIAL") {
    // Lock the vault row so the daily cap is not check-then-act across concurrent earns
    await tx.$queryRaw`SELECT id FROM "my_vault" WHERE id = ${vault.id} FOR UPDATE`;
    const capCheck = await checkDailyCap(userId, type, tx);
    if (!capCheck.canEarn) {
      throw new LedgerError(
        "DAILY_CAP_REACHED",
        `Daily earning cap reached (${capCheck.cap} IxC/day for ${type === "EARN_ACTIVE" ? "active gameplay" : "social activities"})`
      );
    }
    if (amount > capCheck.remaining) {
      amount = capCheck.remaining;
      console.log(`[Vault Service] Capped earning amount to ${amount} (remaining allowance)`);
    }
  }

  await checkAndResetDailyEarnings(vault, tx);

  // Sovereigns converted back are the user's own credits returning, not play: no XP, not
  // "earned today" (otherwise round trips through the Exchange would buy vault levels).
  const counts = type !== "EARN_EXCHANGE";
  const updatedVault = await tx.myVault.update({
    where: { id: vault.id },
    data: {
      credits: { increment: amount },
      lifetimeEarned: { increment: amount },
      todayEarned: { increment: counts ? amount : 0 },
      vaultXp: { increment: counts ? Math.floor(amount) : 0 },
    },
  });

  await tx.vaultTransaction.create({
    data: {
      vaultId: vault.id,
      credits: amount,
      balanceAfter: updatedVault.credits,
      type,
      source,
      metadata: metadata ? (JSON.stringify(metadata) as any) : null,
      createdAt: createdAt ?? new Date(),
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  return { newBalance: updatedVault.credits, amount };
}

/**
 * Spend IxCredits inside the caller's transaction.
 *
 * Throws LedgerError (INSUFFICIENT_CREDITS carries the known balance) so the
 * surrounding transaction rolls back.
 */
export async function spendCreditsTx(
  tx: Prisma.TransactionClient,
  input: LedgerSpendInput
): Promise<LedgerTxResult> {
  const { userId, amount, type, source, metadata } = input;

  assertSpendAllowed(await getVaultConfig(tx), type);
  if (amount <= 0) {
    throw new LedgerError("INVALID_AMOUNT", "Amount must be positive");
  }

  const vault = await getOrCreateVault(userId, tx);
  if (vault.credits < amount) {
    throw new LedgerError(
      "INSUFFICIENT_CREDITS",
      `Insufficient credits. You have ${vault.credits} IxC but need ${amount} IxC`,
      vault.credits
    );
  }

  // Conditional decrement: only succeeds if the row still covers the amount
  const { count } = await tx.myVault.updateMany({
    where: {
      id: vault.id,
      credits: { gte: amount },
    },
    data: {
      credits: { decrement: amount },
      lifetimeSpent: { increment: amount },
    },
  });
  if (count !== 1) {
    throw new LedgerError("INSUFFICIENT_CREDITS", "Insufficient credits for transaction.");
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
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  return { newBalance: updatedVault.credits, amount };
}

/**
 * Earn IxCredits with transaction logging (for callers holding a plain client).
 * Runs earnCreditsTx in its own transaction and maps LedgerError to { success: false }.
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
    const r = await db.$transaction((tx) =>
      earnCreditsTx(tx, { userId, amount, type, source, metadata, createdAt })
    );

    console.log(
      `[Vault Service] User ${userId} earned ${r.amount} IxC (${type}) - New balance: ${r.newBalance}`
    );

    return { success: true, newBalance: r.newBalance };
  } catch (error) {
    if (error instanceof LedgerError) {
      return { success: false, newBalance: error.balance, message: error.message };
    }
    console.error(`[Vault Service] Failed to earn credits for ${userId}:`, error);
    return { success: false, newBalance: 0, message: "Failed to earn credits" };
  }
}

/**
 * Spend IxCredits with validation and transaction logging (for callers holding a plain client).
 * Runs spendCreditsTx in its own transaction and maps LedgerError to { success: false }.
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
    const r = await db.$transaction((tx) =>
      spendCreditsTx(tx, { userId, amount, type, source, metadata })
    );

    console.log(
      `[Vault Service] User ${userId} spent ${r.amount} IxC (${type}) - New balance: ${r.newBalance}`
    );

    return { success: true, newBalance: r.newBalance };
  } catch (error) {
    if (error instanceof LedgerError) {
      return { success: false, newBalance: error.balance, message: error.message };
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
      // A failed read cannot know whether today's claim was taken, so never offer one.
      canClaimDailyBonus: false,
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
