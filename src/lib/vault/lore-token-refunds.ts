/**
 * Lore request tokens are retired with paid lore requests (cards refresh spec §2.2). Every token a player bought and
 * never used is refunded at what they paid for it, through the retired-store-item refund path
 * (`applyRetiredItemRefund`, key `retired_item_refund:<purchase id>`). Used tokens are spent oldest purchase first,
 * across every purchase that granted tokens, except that a retired item's tokens are spent last: its own script
 * refunds that purchase in full, so used tokens land on lore token purchases first and this script never refunds a
 * used token. (Used tokens beyond those fall on retired items, which their script refunds in full anyway.) A token
 * granted free (an admin grant charges 0) is never refunded.
 */
import type { Prisma } from "@prisma/client";
import { isJsonObject } from "~/lib/cards/ns-facts";
import { round2 } from "~/lib/exchange/amounts";
import {
  correctionsByPurchase,
  isRetiredStoreItem,
  ledgerMetadata,
  retiredItemRefundKey,
  type LedgerCorrectionRow,
  type RetiredItemRefund,
} from "./retired-store-items";

/** The store items sold as lore tokens. Other items carrying a `loreTokens` perk got it by mistake. */
export const LORE_TOKEN_ITEM_IDS: readonly string[] = ["upgrade_lore_token"];

export interface TokenPurchase {
  id: string;
  vaultId: string;
  userId: string;
  itemId: string;
  /** The purchase's ledger amount (negative; 0 for an admin grant). */
  credits: number;
  tokens: number;
  createdAt: Date;
}

export interface LoreTokenRefund extends RetiredItemRefund {
  /** The purchase's unused tokens this refund pays for. */
  tokens: number;
}

/** The tokens an item grants per purchase (`effects.perks.loreTokens`). */
export function loreTokensOf(effects: Prisma.JsonValue | null): number {
  const perks = ledgerMetadata(effects).perks;
  const tokens = isJsonObject(perks) ? perks.loreTokens : undefined;
  return typeof tokens === "number" ? Math.max(0, tokens) : 0;
}

/**
 * Tokens per purchase of each store item carrying the perk. Throws when no lore token item reports a count (its row
 * deleted or its perk edited away), since planning from that would silently refund nothing.
 */
export function tokensByItem(
  items: ReadonlyArray<{ id: string; effects: Prisma.JsonValue | null }>
): Map<string, number> {
  const tokens = new Map<string, number>();
  for (const item of items) {
    const count = loreTokensOf(item.effects);
    if (count > 0) tokens.set(item.id, count);
  }
  if (!LORE_TOKEN_ITEM_IDS.some((id) => tokens.has(id))) {
    throw new Error(
      `No lore token item (${LORE_TOKEN_ITEM_IDS.join(", ")}) has a loreTokens perk, so no refund can be planned. ` +
        `Restore its effects to {"perks":{"loreTokens":1}} and re-run; nothing was written.`
    );
  }
  return tokens;
}

/** Tokens a vault used: request markers that spent one, less those a rejected request gave back. */
export function tokensUsed(markers: ReadonlyArray<{ metadata: Prisma.JsonValue | null }>): number {
  let used = 0;
  for (const { metadata } of markers) {
    const meta = ledgerMetadata(metadata);
    if (meta.useToken === true) used++;
    else if (meta.tokenRefund === true) used--;
  }
  return Math.max(0, used);
}

const retiredLast = (purchase: TokenPurchase) => (isRetiredStoreItem(purchase.itemId) ? 1 : 0);

/** Retired items last, then oldest first; a tie on time goes by id, so every run spends the same purchases. */
const bySpendOrder = (a: TokenPurchase, b: TokenPurchase) =>
  retiredLast(a) - retiredLast(b) ||
  a.createdAt.getTime() - b.createdAt.getTime() ||
  a.id.localeCompare(b.id);

/**
 * One refund per Lore Request Token purchase with unused tokens, for its share of what was paid net of the exploit
 * corrections applied to it (as `planRetiredItemRefunds` counts them).
 */
export function planLoreTokenRefunds(
  purchases: readonly TokenPurchase[],
  usedByVault: ReadonlyMap<string, number>,
  corrections: readonly LedgerCorrectionRow[]
): LoreTokenRefund[] {
  const correctedBy = correctionsByPurchase(corrections);
  const byVault = new Map<string, TokenPurchase[]>();
  for (const purchase of purchases) {
    byVault.set(purchase.vaultId, [...(byVault.get(purchase.vaultId) ?? []), purchase]);
  }

  const refunds: LoreTokenRefund[] = [];
  for (const [vaultId, vaultPurchases] of byVault) {
    let used = usedByVault.get(vaultId) ?? 0;
    for (const purchase of [...vaultPurchases].sort(bySpendOrder)) {
      const spent = Math.min(purchase.tokens, used);
      used -= spent;
      const unspent = purchase.tokens - spent;
      if (!LORE_TOKEN_ITEM_IDS.includes(purchase.itemId) || unspent <= 0) continue;
      const paid = -purchase.credits - (correctedBy.get(purchase.id) ?? 0);
      const amount = round2((paid * unspent) / purchase.tokens);
      if (amount <= 0) continue;
      refunds.push({
        vaultId,
        userId: purchase.userId,
        itemId: purchase.itemId,
        sourceTransactionId: purchase.id,
        amount,
        tokens: unspent,
        idempotencyKey: retiredItemRefundKey(purchase.id),
      });
    }
  }
  return refunds;
}
