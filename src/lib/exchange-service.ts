/**
 * Exchange Service
 *
 * Centralized logic for the Sovereign (₷) economy — Exchange's own currency,
 * isolated from MyVault/IxCredits so market volatility never touches the card
 * economy. Mirrors the structure of vault-service.ts.
 *
 *   - getOrCreateWallet / getBalance
 *   - earn / spend with atomic balance update + ExchangeTransaction ledger row
 *
 * Convert (the IxCredits ⇄ Sovereign bridge) is added in M4 and is the ONLY valve
 * between the two economies.
 *
 * Usage:
 *   import { exchangeService } from '~/lib/exchange-service';
 *   await exchangeService.earn(userId, 100, 'CONTRACT_PAYOUT', 'CONTRACT:abc', db);
 */

import { type PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { getExchangeConfig } from "~/lib/exchange-config";

/** Sovereign ledger transaction types (stored as String, matching VaultTransaction.type). */
export type ExchangeTxType =
  | "CONVERT_IN"
  | "CONVERT_OUT"
  | "CHARTER_FEE"
  | "SHARE_BUY"
  | "SHARE_SELL"
  | "SECTOR_BUY"
  | "SECTOR_SELL"
  | "CONTRACT_PAYOUT"
  | "ADMIN_ADJUSTMENT"
  | "TRAINING_FEE"
  | "TEAM_TRAINING"
  | "PREDICTION_STAKE"
  | "PREDICTION_PAYOUT";

export interface ExchangeMutationResult {
  success: boolean;
  newBalance: number;
  message?: string;
}

export class ExchangeService {
  /**
   * Get or create a user's Sovereign wallet. Accepts a database User.id or a Clerk id.
   * Seeds the wallet with the configured starter balance on first creation.
   */
  async getOrCreateWallet(userIdOrClerkId: string, db: PrismaClient) {
    const user = await db.user.findFirst({
      where: { OR: [{ id: userIdOrClerkId }, { clerkUserId: userIdOrClerkId }] },
      select: { id: true },
    });
    if (!user) throw new Error(`User not found: ${userIdOrClerkId}`);

    const existing = await db.exchangeWallet.findUnique({ where: { userId: user.id } });
    if (existing) return existing;

    const cfg = await getExchangeConfig(db);
    const seed = Math.max(0, cfg.seedSovereigns);

    // Upsert avoids a race if two requests create the wallet at once.
    const wallet = await db.exchangeWallet.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        sovereigns: seed,
        lifetimeEarned: seed,
        lifetimeSpent: 0,
      },
    });

    if (seed > 0) {
      await db.exchangeTransaction.create({
        data: {
          walletId: wallet.id,
          sovereigns: seed,
          balanceAfter: wallet.sovereigns,
          type: "ADMIN_ADJUSTMENT",
          source: "WALLET_SEED",
          ixTime: IxTime.getCurrentIxTime(),
        },
      });
    }

    return wallet;
  }

  /** Current balance + lifetime stats for a user's Sovereign wallet. */
  async getBalance(userIdOrClerkId: string, db: PrismaClient) {
    const wallet = await this.getOrCreateWallet(userIdOrClerkId, db);
    return {
      sovereigns: wallet.sovereigns,
      lifetimeEarned: wallet.lifetimeEarned,
      lifetimeSpent: wallet.lifetimeSpent,
    };
  }

  /** Credit Sovereigns to a wallet and log the ledger row atomically. */
  async earn(
    userIdOrClerkId: string,
    amount: number,
    type: ExchangeTxType,
    source: string,
    db: PrismaClient,
    metadata?: Record<string, unknown>
  ): Promise<ExchangeMutationResult> {
    try {
      if (!(amount > 0))
        return { success: false, newBalance: 0, message: "Amount must be positive" };
      const wallet = await this.getOrCreateWallet(userIdOrClerkId, db);

      const updated = await db.$transaction(async (tx) => {
        const w = await tx.exchangeWallet.update({
          where: { id: wallet.id },
          data: { sovereigns: { increment: amount }, lifetimeEarned: { increment: amount } },
        });
        await tx.exchangeTransaction.create({
          data: {
            walletId: wallet.id,
            sovereigns: amount,
            balanceAfter: w.sovereigns,
            type,
            source,
            metadata: metadata ? (JSON.parse(JSON.stringify(metadata)) as object) : undefined,
            ixTime: IxTime.getCurrentIxTime(),
          },
        });
        return w;
      });

      return { success: true, newBalance: updated.sovereigns };
    } catch (error) {
      console.error(`[Exchange Service] Failed to earn for ${userIdOrClerkId}:`, error);
      return { success: false, newBalance: 0, message: "Failed to credit Sovereigns" };
    }
  }

  /** Debit Sovereigns from a wallet (checks balance) and log the ledger row atomically. */
  async spend(
    userIdOrClerkId: string,
    amount: number,
    type: ExchangeTxType,
    source: string,
    db: PrismaClient,
    metadata?: Record<string, unknown>
  ): Promise<ExchangeMutationResult> {
    try {
      if (!(amount > 0))
        return { success: false, newBalance: 0, message: "Amount must be positive" };
      const wallet = await this.getOrCreateWallet(userIdOrClerkId, db);

      if (wallet.sovereigns < amount) {
        return {
          success: false,
          newBalance: wallet.sovereigns,
          message: `Insufficient Sovereigns. You have ₷${wallet.sovereigns.toLocaleString()} but need ₷${amount.toLocaleString()}`,
        };
      }

      const updated = await db.$transaction(async (tx) => {
        const w = await tx.exchangeWallet.update({
          where: { id: wallet.id },
          data: { sovereigns: { decrement: amount }, lifetimeSpent: { increment: amount } },
        });
        await tx.exchangeTransaction.create({
          data: {
            walletId: wallet.id,
            sovereigns: -amount,
            balanceAfter: w.sovereigns,
            type,
            source,
            metadata: metadata ? (JSON.parse(JSON.stringify(metadata)) as object) : undefined,
            ixTime: IxTime.getCurrentIxTime(),
          },
        });
        return w;
      });

      return { success: true, newBalance: updated.sovereigns };
    } catch (error) {
      console.error(`[Exchange Service] Failed to spend for ${userIdOrClerkId}:`, error);
      return { success: false, newBalance: 0, message: "Failed to debit Sovereigns" };
    }
  }
}

export const exchangeService = new ExchangeService();
