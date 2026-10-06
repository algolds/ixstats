/**
 * Exchange Service
 *
 * The Sovereign (₷) wallet ledger: the Exchange's own currency, isolated from
 * MyVault/IxCredits so market activity never touches the card economy. Conversion
 * (src/lib/exchange/conversion.ts) is the only valve between the two.
 *
 * Money safety (code audit VT-16):
 *   - Debits are conditional decrements (`sovereigns >= amount` in the UPDATE), so a
 *     wallet can't go negative and two concurrent spends can't both pass a stale check.
 *   - A move with an `idempotencyKey` is applied once: a ledger row already carrying the
 *     key means it ran before; the unique index on `exchange_transactions.idempotencyKey`
 *     is the backstop for a concurrent duplicate (the losing insert rolls its transaction
 *     back, balance change included).
 *   - Every move writes an ExchangeTransaction row (the audit log) with balanceAfter.
 *
 * Usage:
 *   import { exchangeService } from '~/lib/vault/exchange-service';
 *   await exchangeService.spend(userId, 100, 'CHARTER_FEE', 'LEAGUE_CREATE:abc', db);
 *   // inside your own transaction, throwing ExchangeError so it rolls back:
 *   await spendSovereignsTx(tx, { userId, amount, type, source, idempotencyKey });
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { ConflictError } from "~/lib/app-error";
import { IxTime } from "~/lib/ixtime";
import { getExchangeConfig } from "./exchange-config";

/** Sovereign ledger transaction types (stored as String, matching VaultTransaction.type). */
export type ExchangeTxType =
  | "CONVERT_IN"
  | "CONVERT_OUT"
  | "CHARTER_FEE"
  | "COMPANY_DEPOSIT"
  | "COMPANY_WITHDRAW"
  | "SHARE_BUY"
  | "SHARE_SELL"
  | "SECTOR_BUY"
  | "SECTOR_SELL"
  | "CONTRACT_PAYOUT"
  | "ADMIN_ADJUSTMENT"
  | "TRAINING_FEE"
  | "TEAM_TRAINING"
  | "STADIUM_UPGRADE"
  | "PREDICTION_STAKE"
  | "PREDICTION_PAYOUT";

export type ExchangeErrorCode =
  | "INVALID_AMOUNT"
  | "INSUFFICIENT_SOVEREIGNS"
  | "USER_NOT_FOUND"
  | "DISABLED"
  | "MAINTENANCE"
  | "DAILY_CAP_REACHED"
  | "LIMIT_REACHED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT";

/**
 * A business failure in the Exchange. Thrown by the *Tx functions so a surrounding
 * transaction rolls back; `balance` is the wallet balance known at the time (0 if unknown).
 */
export class ExchangeError extends Error {
  readonly code: ExchangeErrorCode;
  readonly balance: number;

  constructor(code: ExchangeErrorCode, message: string, balance = 0) {
    super(message);
    this.name = "ExchangeError";
    this.code = code;
    this.balance = balance;
  }
}

type Db = PrismaClient | Prisma.TransactionClient;

export interface SovereignMoveInput {
  /** Database User.id or Clerk id. */
  userId: string;
  amount: number;
  type: ExchangeTxType;
  source: string;
  metadata?: Record<string, unknown>;
  /** Apply at most once per key; namespace it, e.g. "exchange:convert:<userId>:<requestId>". */
  idempotencyKey?: string;
}

export interface SovereignMoveResult {
  newBalance: number;
  /** True when a move with the same idempotencyKey had already been applied (nothing written). */
  alreadyApplied: boolean;
}

interface ExchangeMutationResult {
  success: boolean;
  newBalance: number;
  alreadyApplied?: boolean;
  message?: string;
}

interface MoveOptions {
  idempotencyKey?: string;
}

/** A unique-index violation, raw (P2002) or mapped by `~/server/db` (ConflictError). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
    error instanceof ConflictError
  );
}

function hasOwnTransaction(db: Db): db is PrismaClient {
  return "$transaction" in db && typeof db.$transaction === "function";
}

function toJson(metadata?: Record<string, unknown>) {
  return metadata ? (JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonObject) : undefined;
}

function formatSovereigns(n: number): string {
  return `₷${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/**
 * Get or create a user's Sovereign wallet (database User.id or Clerk id). A new wallet
 * gets the configured starter balance once: the insert skips duplicates, so of two
 * concurrent first visits only the one that created the row writes the seed ledger row.
 */
export async function getOrCreateWallet(userIdOrClerkId: string, db: Db) {
  const user = await db.user.findFirst({
    where: { OR: [{ id: userIdOrClerkId }, { clerkUserId: userIdOrClerkId }] },
    select: { id: true },
  });
  if (!user) throw new ExchangeError("USER_NOT_FOUND", `User not found: ${userIdOrClerkId}`);

  const existing = await db.exchangeWallet.findUnique({ where: { userId: user.id } });
  if (existing) return existing;

  const cfg = await getExchangeConfig(db);
  const seed = Math.max(0, cfg.seedSovereigns);

  const { count } = await db.exchangeWallet.createMany({
    data: [{ userId: user.id, sovereigns: seed, lifetimeEarned: seed, lifetimeSpent: 0 }],
    skipDuplicates: true,
  });
  const wallet = await db.exchangeWallet.findUniqueOrThrow({ where: { userId: user.id } });

  if (count === 1 && seed > 0) {
    await db.exchangeTransaction.create({
      data: {
        walletId: wallet.id,
        sovereigns: seed,
        balanceAfter: seed,
        type: "ADMIN_ADJUSTMENT",
        source: "WALLET_SEED",
        ixTime: IxTime.getCurrentIxTime(),
        idempotencyKey: `exchange:wallet_seed:${user.id}`,
      },
    });
  }

  return wallet;
}

/** Row-lock a wallet until the surrounding transaction ends (re-entrant within it). */
async function lockWalletRow(tx: Db, walletId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "exchange_wallets" WHERE id = ${walletId} FOR UPDATE`;
}

/**
 * Get or create the user's wallet and lock its row until the transaction ends, so
 * per-user check-then-act steps are serialised. Must run inside an interactive transaction.
 */
export async function lockWallet(tx: Db, userIdOrClerkId: string) {
  const wallet = await getOrCreateWallet(userIdOrClerkId, tx);
  await lockWalletRow(tx, wallet.id);
  return wallet;
}

function assertAmount(amount: number): void {
  if (!Number.isFinite(amount) || !(amount > 0)) {
    throw new ExchangeError("INVALID_AMOUNT", "Amount must be positive");
  }
}

/**
 * Resolve the wallet and, for a keyed move, lock its row and look the key up. The lock
 * makes a same-key retry wait for the first attempt's transaction and then find its
 * ledger row, instead of racing it; the unique index stays as the backstop.
 */
async function beginMove(tx: Db, input: SovereignMoveInput) {
  assertAmount(input.amount);
  const wallet = await getOrCreateWallet(input.userId, tx);
  if (!input.idempotencyKey) return { wallet, applied: null };
  await lockWalletRow(tx, wallet.id);
  const applied = await tx.exchangeTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { balanceAfter: true },
  });
  return { wallet, applied };
}

/**
 * Credit Sovereigns inside the caller's transaction. Throws ExchangeError on a bad amount.
 * With an idempotencyKey already in the ledger it writes nothing and reports alreadyApplied.
 */
export async function earnSovereignsTx(
  tx: Db,
  input: SovereignMoveInput
): Promise<SovereignMoveResult> {
  const { wallet, applied } = await beginMove(tx, input);
  if (applied) return { newBalance: applied.balanceAfter, alreadyApplied: true };

  const updated = await tx.exchangeWallet.update({
    where: { id: wallet.id },
    data: {
      sovereigns: { increment: input.amount },
      lifetimeEarned: { increment: input.amount },
    },
    select: { sovereigns: true },
  });
  await tx.exchangeTransaction.create({
    data: {
      walletId: wallet.id,
      sovereigns: input.amount,
      balanceAfter: updated.sovereigns,
      type: input.type,
      source: input.source,
      metadata: toJson(input.metadata),
      ixTime: IxTime.getCurrentIxTime(),
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });
  return { newBalance: updated.sovereigns, alreadyApplied: false };
}

/**
 * Debit Sovereigns inside the caller's transaction with a conditional decrement: the
 * UPDATE only matches while the wallet still covers the amount, so the balance never goes
 * negative and concurrent spends can't overdraw it. Throws ExchangeError
 * (INSUFFICIENT_SOVEREIGNS carries the balance) so the caller's transaction rolls back.
 */
export async function spendSovereignsTx(
  tx: Db,
  input: SovereignMoveInput
): Promise<SovereignMoveResult> {
  const { wallet, applied } = await beginMove(tx, input);
  if (applied) return { newBalance: applied.balanceAfter, alreadyApplied: true };

  const { count } = await tx.exchangeWallet.updateMany({
    where: { id: wallet.id, sovereigns: { gte: input.amount } },
    data: {
      sovereigns: { decrement: input.amount },
      lifetimeSpent: { increment: input.amount },
    },
  });
  const after = await tx.exchangeWallet.findUnique({
    where: { id: wallet.id },
    select: { sovereigns: true },
  });
  const balance = after?.sovereigns ?? 0;
  if (count !== 1) {
    throw new ExchangeError(
      "INSUFFICIENT_SOVEREIGNS",
      `Insufficient Sovereigns. You have ${formatSovereigns(balance)} but need ${formatSovereigns(input.amount)}`,
      balance
    );
  }

  await tx.exchangeTransaction.create({
    data: {
      walletId: wallet.id,
      sovereigns: -input.amount,
      balanceAfter: balance,
      type: input.type,
      source: input.source,
      metadata: toJson(input.metadata),
      ixTime: IxTime.getCurrentIxTime(),
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });
  return { newBalance: balance, alreadyApplied: false };
}

class ExchangeService {
  /** Get or create a user's Sovereign wallet. Accepts a database User.id or a Clerk id. */
  getOrCreateWallet(userIdOrClerkId: string, db: Db) {
    return getOrCreateWallet(userIdOrClerkId, db);
  }

  /** Current balance + lifetime stats for a user's Sovereign wallet. */
  async getBalance(userIdOrClerkId: string, db: Db) {
    const wallet = await getOrCreateWallet(userIdOrClerkId, db);
    return {
      sovereigns: wallet.sovereigns,
      lifetimeEarned: wallet.lifetimeEarned,
      lifetimeSpent: wallet.lifetimeSpent,
    };
  }

  /**
   * Run a move in its own transaction (plain client) or in the caller's (transaction
   * client), and map failures to { success: false }. A concurrent duplicate of an
   * idempotent move is reported as applied when it ran in its own transaction; inside a
   * caller's transaction the unique violation has aborted that transaction, so it is a
   * failure the caller must surface.
   */
  private async run(
    db: Db,
    userIdOrClerkId: string,
    move: (tx: Db) => Promise<SovereignMoveResult>
  ): Promise<ExchangeMutationResult> {
    const ownTransaction = hasOwnTransaction(db);
    try {
      const r = ownTransaction ? await db.$transaction((tx) => move(tx)) : await move(db);
      return { success: true, newBalance: r.newBalance, alreadyApplied: r.alreadyApplied };
    } catch (error) {
      if (error instanceof ExchangeError) {
        return { success: false, newBalance: error.balance, message: error.message };
      }
      if (isUniqueViolation(error)) {
        return ownTransaction
          ? { success: true, newBalance: 0, alreadyApplied: true }
          : { success: false, newBalance: 0, message: "Duplicate request" };
      }
      console.error(`[Exchange Service] Sovereign move failed for ${userIdOrClerkId}:`, error);
      return { success: false, newBalance: 0, message: "Failed to update Sovereigns" };
    }
  }

  /** Credit Sovereigns to a wallet and log the ledger row atomically. */
  earn(
    userIdOrClerkId: string,
    amount: number,
    type: ExchangeTxType,
    source: string,
    db: Db,
    metadata?: Record<string, unknown>,
    options?: MoveOptions
  ): Promise<ExchangeMutationResult> {
    return this.run(db, userIdOrClerkId, (tx) =>
      earnSovereignsTx(tx, {
        userId: userIdOrClerkId,
        amount,
        type,
        source,
        metadata,
        idempotencyKey: options?.idempotencyKey,
      })
    );
  }

  /** Debit Sovereigns (conditional decrement; never below zero) and log the ledger row atomically. */
  spend(
    userIdOrClerkId: string,
    amount: number,
    type: ExchangeTxType,
    source: string,
    db: Db,
    metadata?: Record<string, unknown>,
    options?: MoveOptions
  ): Promise<ExchangeMutationResult> {
    return this.run(db, userIdOrClerkId, (tx) =>
      spendSovereignsTx(tx, {
        userId: userIdOrClerkId,
        amount,
        type,
        source,
        metadata,
        idempotencyKey: options?.idempotencyKey,
      })
    );
  }

  /** Most recent ledger rows for a user's wallet. */
  async getTransactions(userIdOrClerkId: string, db: Db, limit = 20) {
    const wallet = await getOrCreateWallet(userIdOrClerkId, db);
    return db.exchangeTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        sovereigns: true,
        balanceAfter: true,
        type: true,
        source: true,
        createdAt: true,
      },
    });
  }
}

export const exchangeService = new ExchangeService();
