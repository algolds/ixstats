/**
 * One-off: refund every purchase of a retired Vault store item (today only the Archetype Proposal
 * Token, `upgrade_archetype_proposal`, retired 2026-10-05; see src/lib/vault/retired-store-items.ts).
 *
 *   bun run db:refund-retired-store-items            # dry run: list the planned refunds
 *   bun run db:refund-retired-store-items -- --apply # write them
 *
 * Each purchase is refunded once, for what the holder actually paid (the charge plus any shortfall
 * the exploit audit took back), as a `REFUND` ledger row with the idempotency key
 * `retired_item_refund:<purchase id>`. Re-running after --apply changes nothing. Run it after
 * `audit:vault-exploits:apply`, and take a `bun run db:backup` first.
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import {
  RETIRED_STORE_ITEM_IDS,
  applyRetiredItemRefund,
  planRetiredItemRefunds,
  type StorePurchaseRow,
} from "../../src/lib/vault/retired-store-items";

dotenv.config({ path: ".env.local.dev" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const [purchases, corrections] = await Promise.all([
    db.vaultTransaction.findMany({
      where: { type: { in: ["SPEND_COSMETIC", "SPEND_BOOST"] } },
      select: {
        id: true,
        vaultId: true,
        credits: true,
        metadata: true,
        vault: { select: { userId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.vaultTransaction.findMany({
      where: { type: "ADMIN_ADJUSTMENT", source: { startsWith: "exploit_correction:" } },
      select: { credits: true, metadata: true },
    }),
  ]);

  const refunds = planRetiredItemRefunds(purchases as StorePurchaseRow[], corrections);
  const total = refunds.reduce((sum, r) => sum + r.amount, 0);
  console.log(`Retired items: ${RETIRED_STORE_ITEM_IDS.join(", ")}`);
  console.log(`${refunds.length} purchases to refund, ${total} IxC in all.`);
  for (const r of refunds) {
    console.log(`  ${r.sourceTransactionId}  user ${r.userId}  ${r.itemId}  +${r.amount} IxC`);
  }

  if (!apply) {
    console.log("DRY RUN: nothing written. Pass --apply to credit these refunds.");
    return;
  }

  let applied = 0;
  let skipped = 0;
  for (const refund of refunds) {
    const status = await applyRetiredItemRefund(db, refund);
    if (status === "applied") applied++;
    else skipped++;
  }
  console.log(`Applied ${applied} refunds; ${skipped} were already applied.`);
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
