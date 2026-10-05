/**
 * Retired Vault store items: sold once, never wired to anything, now withdrawn.
 *
 * `upgrade_archetype_proposal` (Archetype Proposal Token, retired 2026-10-05) promised "submit a
 * custom Archetype proposal for admin review", but no proposal model, form or admin queue exists
 * for archetypes, so buying it did nothing. Building that pipeline would be a new system, so the
 * item is retired instead: hidden from the store, refused at purchase, and every purchase refunded
 * through the ledger by `scripts/migrations/refund-retired-store-items.ts`.
 *
 * Keep the store item row (the ledger and the exploit audit look purchases up by item id).
 */
import type { Prisma } from "@prisma/client";

export const RETIRED_STORE_ITEM_IDS: readonly string[] = ["upgrade_archetype_proposal"];

export const RETIRED_STORE_ITEM_MESSAGE = "This item is retired and no longer sold.";

export function isRetiredStoreItem(itemId: string): boolean {
  return RETIRED_STORE_ITEM_IDS.includes(itemId);
}

/** A store purchase row (`SPEND_COSMETIC` / `SPEND_BOOST`) with its vault owner. */
export interface StorePurchaseRow {
  id: string;
  vaultId: string;
  credits: number;
  metadata: unknown;
  vault: { userId: string };
}

/** An `exploit_correction:*` adjustment, which names the purchase it corrected. */
export interface LedgerCorrectionRow {
  credits: number;
  metadata: unknown;
}

export interface RetiredItemRefund {
  vaultId: string;
  userId: string;
  itemId: string;
  sourceTransactionId: string;
  /** What the holder actually paid: the charge plus any shortfall later taken back. */
  amount: number;
  idempotencyKey: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ledger metadata is stored as a JSON string (older rows: an object). */
function metadataOf(metadata: unknown): Record<string, unknown> {
  let meta = metadata;
  if (typeof meta === "string") {
    try {
      meta = JSON.parse(meta);
    } catch {
      return {};
    }
  }
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
}

export function retiredItemRefundKey(sourceTransactionId: string): string {
  return `retired_item_refund:${sourceTransactionId}`;
}

/**
 * One refund per purchase of a retired item, for what was paid net of the exploit corrections
 * applied to that purchase (a shortfall taken back adds to it; a refund already given reduces it).
 */
export function planRetiredItemRefunds(
  purchases: readonly StorePurchaseRow[],
  corrections: readonly LedgerCorrectionRow[]
): RetiredItemRefund[] {
  const correctedBy = new Map<string, number>();
  for (const row of corrections) {
    const source = metadataOf(row.metadata).sourceTransactionId;
    if (typeof source === "string") {
      correctedBy.set(source, (correctedBy.get(source) ?? 0) + row.credits);
    }
  }

  const refunds: RetiredItemRefund[] = [];
  for (const row of purchases) {
    const itemId = metadataOf(row.metadata).itemId;
    if (typeof itemId !== "string" || !isRetiredStoreItem(itemId)) continue;
    const amount = round2(-row.credits - (correctedBy.get(row.id) ?? 0));
    if (amount <= 0) continue;
    refunds.push({
      vaultId: row.vaultId,
      userId: row.vault.userId,
      itemId,
      sourceTransactionId: row.id,
      amount,
      idempotencyKey: retiredItemRefundKey(row.id),
    });
  }
  return refunds;
}

interface RefundDb {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

/**
 * Credit one refund as a `REFUND` ledger row keyed by its idempotency key; re-running it changes
 * nothing. The refund gives back spending, so it lowers `lifetimeSpent` and is not earned XP.
 */
export async function applyRetiredItemRefund(
  db: RefundDb,
  refund: RetiredItemRefund
): Promise<"applied" | "already_applied"> {
  return db.$transaction(async (tx) => {
    const done = await tx.vaultTransaction.findUnique({
      where: { idempotencyKey: refund.idempotencyKey },
      select: { id: true },
    });
    if (done) return "already_applied" as const;

    await tx.$queryRaw`SELECT id FROM "my_vault" WHERE id = ${refund.vaultId} FOR UPDATE`;
    const vault = await tx.myVault.update({
      where: { id: refund.vaultId },
      data: {
        credits: { increment: refund.amount },
        lifetimeSpent: { decrement: refund.amount },
      },
    });
    await tx.vaultTransaction.create({
      data: {
        vaultId: refund.vaultId,
        credits: refund.amount,
        balanceAfter: vault.credits,
        type: "REFUND",
        source: `retired_item_refund:${refund.itemId}`,
        metadata: JSON.stringify({
          itemId: refund.itemId,
          sourceTransactionId: refund.sourceTransactionId,
          reason: "store item retired",
        }),
        idempotencyKey: refund.idempotencyKey,
      },
    });
    return "applied" as const;
  });
}
