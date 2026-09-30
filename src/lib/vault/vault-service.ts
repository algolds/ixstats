/**
 * MyVault Service Facade
 *
 * Re-exports sub-domain functionality from src/lib/vault/ while maintaining
 * complete backwards compatibility for all tRPC routers and background workers.
 */

import { Prisma, type PrismaClient, type VaultTransactionType } from "@prisma/client";
import { ConflictError } from "~/lib/app-error";
import { syncUserToForum } from "~/server/modules/forum";
import {
  checkDailyCap as ledgerCheckDailyCap,
  earnCredits as ledgerEarnCredits,
  spendCredits as ledgerSpendCredits,
  earnCreditsTx as ledgerEarnCreditsTx,
  spendCreditsTx as ledgerSpendCreditsTx,
  LedgerError,
  type LedgerEarnInput,
  type LedgerSpendInput,
  getBalance as ledgerGetBalance,
  getTransactionHistory as ledgerGetTransactionHistory,
  getEarningsSummary as ledgerGetEarningsSummary,
} from "./vault-ledger";
import {
  claimDailyBonus as bonusClaimDailyBonus,
  claimCombinedDailyClaim as bonusClaimCombinedDailyClaim,
  updateLoginStreak as bonusUpdateLoginStreak,
} from "./vault-daily-bonus";
import {
  calculatePassiveIncome as incomeCalculatePassiveIncome,
  catchUpPassiveIncome as incomeCatchUpPassiveIncome,
} from "./vault-passive-income";
import {
  getPurchasedItemsEffects as perksGetPurchasedItemsEffects,
  clearUserPerksCache as perksClearUserPerksCache,
  getCardCapacityBoost as perksGetCardCapacityBoost,
  getYieldBoostMultiplier as perksGetYieldBoostMultiplier,
  getLoreTokensBalance as perksGetLoreTokensBalance,
  getVaultConfig,
  invalidateVaultConfigCache,
  type VaultEffectPerks,
  type VaultEffectItem,
  type VaultConfig,
} from "./vault-perks";

export type { VaultEffectPerks, VaultEffectItem, VaultConfig };
export { getVaultConfig, invalidateVaultConfigCache };
export { LedgerError };
export type { LedgerEarnInput, LedgerSpendInput };

export interface EarnOnceResult {
  success: boolean;
  alreadyApplied: boolean;
  newBalance: number;
  message?: string;
}

/**
 * Earn IxCredits at most once per `idempotencyKey`.
 *
 * Inside one transaction: a ledger row already carrying the key means the grant
 * was applied before, so nothing is written; otherwise the row is written with
 * the key. The unique index on `vault_transactions.idempotencyKey` is the
 * backstop for a concurrent duplicate: the losing insert raises P2002, which
 * aborts and rolls back that whole transaction (balance included), and is
 * reported here as `alreadyApplied`. Through `~/server/db` the violation
 * surfaces as `ConflictError`; through a raw client as
 * `PrismaClientKnownRequestError` P2002 — both are recognised. Never catch the
 * duplicate inside the transaction callback (Postgres rejects further
 * statements in an aborted transaction).
 */
export async function earnCreditsOnce(
  db: PrismaClient,
  input: LedgerEarnInput & { idempotencyKey: string }
): Promise<EarnOnceResult> {
  try {
    const r = await db.$transaction(async (tx) => {
      const existing = await tx.vaultTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { balanceAfter: true },
      });
      if (existing) return { newBalance: existing.balanceAfter, alreadyApplied: true };
      const { newBalance } = await ledgerEarnCreditsTx(tx, input);
      return { newBalance, alreadyApplied: false };
    });
    if (!r.alreadyApplied) syncUserToForum(input.userId).catch(() => {});
    return { success: true, alreadyApplied: r.alreadyApplied, newBalance: r.newBalance };
  } catch (error) {
    const duplicate =
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
      error instanceof ConflictError;
    if (duplicate) return { success: true, alreadyApplied: true, newBalance: 0 };
    if (error instanceof LedgerError) {
      return {
        success: false,
        alreadyApplied: false,
        newBalance: error.balance,
        message: error.message,
      };
    }
    console.error(`[Vault Service] Failed idempotent earn ${input.idempotencyKey}:`, error);
    return {
      success: false,
      alreadyApplied: false,
      newBalance: 0,
      message: "Failed to earn credits",
    };
  }
}

export class VaultService {
  checkDailyCap(userId: string, earnType: "EARN_ACTIVE" | "EARN_SOCIAL", db: PrismaClient) {
    return ledgerCheckDailyCap(userId, earnType, db);
  }

  earnCredits(
    userId: string,
    amount: number,
    type: VaultTransactionType,
    source: string,
    db: PrismaClient,
    metadata?: Record<string, unknown>,
    createdAt?: Date
  ) {
    return ledgerEarnCredits(userId, amount, type, source, db, metadata, createdAt);
  }

  spendCredits(
    userId: string,
    amount: number,
    type: VaultTransactionType,
    source: string,
    db: PrismaClient,
    metadata?: Record<string, unknown>
  ) {
    return ledgerSpendCredits(userId, amount, type, source, db, metadata);
  }

  /** Earn inside the caller's transaction; throws LedgerError (rolls the transaction back). */
  earnCreditsTx(tx: Prisma.TransactionClient, input: LedgerEarnInput) {
    return ledgerEarnCreditsTx(tx, input);
  }

  /** Earn at most once per idempotencyKey; a duplicate reports { alreadyApplied: true }. */
  earnCreditsOnce(db: PrismaClient, input: LedgerEarnInput & { idempotencyKey: string }) {
    return earnCreditsOnce(db, input);
  }

  /** Spend inside the caller's transaction; throws LedgerError (rolls the transaction back). */
  spendCreditsTx(tx: Prisma.TransactionClient, input: LedgerSpendInput) {
    return ledgerSpendCreditsTx(tx, input);
  }

  getBalance(userId: string, db: PrismaClient) {
    return ledgerGetBalance(userId, db);
  }

  getTransactionHistory(
    userId: string,
    db: PrismaClient,
    limit: number = 50,
    offset: number = 0,
    type?: VaultTransactionType
  ) {
    return ledgerGetTransactionHistory(userId, db, limit, offset, type);
  }

  claimDailyBonus(userId: string, db: PrismaClient) {
    return bonusClaimDailyBonus(userId, db);
  }

  claimCombinedDailyClaim(userId: string, choice: "CREDITS" | "CARD", db: PrismaClient) {
    return bonusClaimCombinedDailyClaim(userId, choice, db);
  }

  updateLoginStreak(userId: string, db: PrismaClient) {
    return bonusUpdateLoginStreak(userId, db);
  }

  calculatePassiveIncome(countryId: string, db: PrismaClient) {
    return incomeCalculatePassiveIncome(countryId, db);
  }

  catchUpPassiveIncome(userId: string, db: PrismaClient) {
    return incomeCatchUpPassiveIncome(userId, db);
  }

  getEarningsSummary(userId: string, db: PrismaClient) {
    return ledgerGetEarningsSummary(userId, db);
  }

  getPurchasedItemsEffects(userId: string, db: PrismaClient) {
    return perksGetPurchasedItemsEffects(userId, db);
  }

  clearUserPerksCache(userId?: string): void {
    perksClearUserPerksCache(userId);
  }

  getCardCapacityBoost(userId: string, db: PrismaClient) {
    return perksGetCardCapacityBoost(userId, db);
  }

  getYieldBoostMultiplier(userId: string, db: PrismaClient) {
    return perksGetYieldBoostMultiplier(userId, db);
  }

  getLoreTokensBalance(userId: string, db: PrismaClient) {
    return perksGetLoreTokensBalance(userId, db);
  }
}

export const vaultService = new VaultService();
