/**
 * One-time backfill: mint a trophy card for every recorded place back to 2017, give each to the account of the name's
 * approved claim (or of the WikiOS edits behind a `wikios>` name); the rest wait unowned, and the claim hook gives them
 * out when a claim is approved. No IxCredits are paid. Run after the weekly merge (scripts/lorewards/merge-weekly-keys.ts).
 *
 * Usage:
 *   bun scripts/backfill-loreward-trophy-cards.ts            # dry run: prints what is missing
 *   bun scripts/backfill-loreward-trophy-cards.ts --dry-run  # same
 *   bun scripts/backfill-loreward-trophy-cards.ts --apply    # actually write
 *
 * Idempotent: a place with a card is skipped, and a card granted before is never granted again.
 */
import { PrismaClient } from "@prisma/client";
import { backfillTrophyCards, type TrophyBackfillReport } from "~/lib/lorewards/trophy-cards";

export function parseBackfillArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.includes("--apply") && !argv.includes("--dry-run") };
}

/** The lines the run prints: what was missing, then what an apply wrote, or what a dry run found waiting. */
export function backfillSummary(report: TrophyBackfillReport, apply: boolean): string[] {
  const total = Object.values(report.missing).reduce((sum, n) => sum + n, 0);
  const lines = [`Trophy cards missing: ${total} ${JSON.stringify(report.missing)}`];
  if (apply) {
    return [
      ...lines,
      `Minted ${report.minted}, granted ${report.granted}, ${report.waiting} wait for a claim.`,
    ];
  }
  return [
    ...lines,
    `Trophy cards already waiting for a claim: ${report.waiting}.`,
    "Dry run: nothing written. Re-run with --apply to mint them.",
  ];
}

async function main(): Promise<void> {
  const { apply } = parseBackfillArgs(process.argv.slice(2));
  const db = new PrismaClient();
  try {
    for (const line of backfillSummary(await backfillTrophyCards(db, apply), apply)) {
      console.log(line);
    }
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.main) {
  main().catch((error: Error) => {
    console.error(`[backfill-loreward-trophy-cards] failed: ${error.message}`);
    process.exitCode = 1;
  });
}
