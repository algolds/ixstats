// scripts/cards/refund-lore-tokens.ts
/**
 * One-off (cards refresh spec §2.2): refund every unused lore request token a player bought, at what they paid, and
 * withdraw the lore token items from the store. Tokens granted free get nothing, and old paid requests get no refund
 * (they became free suggestions).
 *
 *   bun scripts/cards/refund-lore-tokens.ts            # dry run
 *   bun scripts/cards/refund-lore-tokens.ts --apply    # write
 *
 * Idempotent: each refund is a REFUND ledger row keyed `retired_item_refund:<purchase id>`, so a re-run refunds
 * nothing twice. Run it after `audit:vault-exploits:apply` (the shortfalls it took back count as paid), and take a
 * `bun run db:backup` first.
 */
import { PrismaClient } from "@prisma/client";
import { round2 } from "~/lib/exchange/amounts";
import {
  LORE_TOKEN_ITEM_IDS,
  planLoreTokenRefunds,
  tokensByItem,
  tokensUsed,
  type LoreTokenRefund,
  type TokenPurchase,
} from "~/lib/vault/lore-token-refunds";
import {
  applyRetiredItemRefund,
  isRetiredStoreItem,
  ledgerMetadata,
} from "~/lib/vault/retired-store-items";
import { clearVaultCaches } from "~/lib/vault/vault-cache";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function itemOutcome(itemId: string): string {
  if (LORE_TOKEN_ITEM_IDS.includes(itemId)) return "unused tokens refunded";
  if (isRetiredStoreItem(itemId)) return "retired, its own script refunds it in full";
  return "perk no longer used, not refunded";
}

async function tokenPurchases(perItem: ReadonlyMap<string, number>): Promise<TokenPurchase[]> {
  const rows = await db.vaultTransaction.findMany({
    where: { type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] } },
    select: {
      id: true,
      vaultId: true,
      credits: true,
      metadata: true,
      createdAt: true,
      vault: { select: { userId: true } },
    },
  });
  return rows.flatMap((row) => {
    const itemId = ledgerMetadata(row.metadata).itemId;
    if (typeof itemId !== "string") return [];
    const tokens = perItem.get(itemId) ?? 0;
    const { id, vaultId, credits, createdAt } = row;
    return tokens > 0
      ? [{ id, vaultId, userId: row.vault.userId, itemId, credits, tokens, createdAt }]
      : [];
  });
}

async function tokensUsedByVault(): Promise<Map<string, number>> {
  const markers = await db.vaultTransaction.findMany({
    where: { source: "LORE_CARD_REQUEST" },
    select: { vaultId: true, metadata: true },
  });
  const byVault = new Map<string, typeof markers>();
  for (const marker of markers) {
    byVault.set(marker.vaultId, [...(byVault.get(marker.vaultId) ?? []), marker]);
  }
  return new Map([...byVault].map(([vaultId, list]) => [vaultId, tokensUsed(list)] as const));
}

async function main() {
  const items = await db.vaultStoreItem.findMany({
    select: { id: true, name: true, effects: true },
  });
  // Throws (before anything is written) when no lore token item reports a token count.
  const perItem = tokensByItem(items);
  for (const item of items.filter((row) => perItem.has(row.id))) {
    const tokens = perItem.get(item.id);
    console.log(
      `Item ${item.id} (${item.name}): ${tokens} token(s) per purchase, ${itemOutcome(item.id)}`
    );
  }

  if (APPLY) {
    // Withdraw before reading purchases, so no token is sold while the refunds are worked out.
    await db.vaultStoreItem.updateMany({
      where: { id: { in: [...LORE_TOKEN_ITEM_IDS] } },
      data: { isActive: false },
    });
  }

  const [purchases, used, corrections] = await Promise.all([
    tokenPurchases(perItem),
    tokensUsedByVault(),
    db.vaultTransaction.findMany({
      where: { type: "ADMIN_ADJUSTMENT", source: { startsWith: "exploit_correction:" } },
      select: { credits: true, metadata: true },
    }),
  ]);
  const refunds = planLoreTokenRefunds(purchases, used, corrections);
  report(purchases, used, refunds);

  if (!APPLY) {
    console.log("Dry run: nothing written. Re-run with --apply.");
    return;
  }
  let applied = 0;
  const refunded = new Set<string>();
  for (const refund of refunds) {
    if ((await applyRetiredItemRefund(db, refund)) !== "applied") continue;
    applied++;
    refunded.add(refund.userId);
  }
  const users = await db.user.findMany({
    where: { id: { in: [...refunded] } },
    select: { id: true, clerkUserId: true },
  });
  await clearVaultCaches(...users);
  console.log(
    `Applied ${applied} refunds (${refunds.length - applied} were already applied); lore tokens are no longer sold.`
  );
}

function report(
  purchases: readonly TokenPurchase[],
  used: ReadonlyMap<string, number>,
  refunds: readonly LoreTokenRefund[]
) {
  const refundedIds = new Set(refunds.map((refund) => refund.sourceTransactionId));
  const usedTotal = [...used.values()].reduce((sum, n) => sum + n, 0);
  console.log(`${purchases.length} token purchases; ${usedTotal} tokens used on requests.`);
  for (const purchase of purchases.filter((p) => !refundedIds.has(p.id))) {
    console.log(
      `  not refunded: ${purchase.id}  user ${purchase.userId}  ${purchase.itemId}  charged ${-purchase.credits} IxC`
    );
  }
  const players = new Set(refunds.map((refund) => refund.userId)).size;
  const tokens = refunds.reduce((sum, refund) => sum + refund.tokens, 0);
  const total = round2(refunds.reduce((sum, refund) => sum + refund.amount, 0));
  console.log(`Refunds: ${players} players, ${tokens} tokens, ${total} IxC.`);
  for (const refund of refunds) {
    console.log(
      `  ${refund.sourceTransactionId}  user ${refund.userId}  ${refund.tokens} token(s)  +${refund.amount} IxC`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // The vault cache's Redis clients would otherwise keep the process alive.
  .finally(async () => {
    await db.$disconnect();
    process.exit();
  });
