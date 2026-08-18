/**
 * MyVault Service Facade
 *
 * Re-exports sub-domain functionality from src/lib/vault/ while maintaining
 * complete backwards compatibility for all tRPC routers and background workers.
 */

import { type PrismaClient, type VaultTransactionType } from "@prisma/client";
import {
  checkDailyCap as ledgerCheckDailyCap,
  earnCredits as ledgerEarnCredits,
  spendCredits as ledgerSpendCredits,
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
