/**
 * One-time backfill: mint a trophy card for every recorded Loreward place back to 2017 and give each to its
 * winner when that wiki account has a verified link. No IxCredits are paid.
 *
 * Usage:
 *   bun run scripts/backfill-loreward-trophy-cards.ts            # dry run: prints what is missing
 *   bun run scripts/backfill-loreward-trophy-cards.ts --dry-run  # same
 *   bun run scripts/backfill-loreward-trophy-cards.ts --apply    # actually write
 *
 * Idempotent: a place with a card is skipped, and a card granted before is never granted again.
 */
import { PrismaClient } from "@prisma/client";
import { backfillTrophyCards } from "~/lib/lorewards/trophy-cards";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply") && !process.argv.includes("--dry-run");

async function main() {
  const report = await backfillTrophyCards(prisma, APPLY);
  const total = Object.values(report.missing).reduce((sum, n) => sum + n, 0);
  console.log(`Trophy cards missing: ${total}`, report.missing);
  if (APPLY) console.log(`Minted ${report.minted}, granted ${report.granted} to linked winners.`);
  else if (total > 0) console.log("Dry run: nothing written. Re-run with --apply to mint them.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
