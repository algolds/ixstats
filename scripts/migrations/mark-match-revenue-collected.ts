/**
 * One-off SL-14 migration: mark every match that completed before per-match revenue tracking as
 * already collected, so the first `collectMatchRevenue` after the deploy doesn't pay out a club's
 * whole history at once (the old procedure paid per click, with no record of what was paid).
 *
 *   bun run db:mark-match-revenue-collected [--apply]
 *
 * Run once, right after the schema push that adds `homeRevenueCollectedAt` /
 * `awayRevenueCollectedAt`. Dry run by default; re-running after --apply changes nothing.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const where = {
    status: "completed",
    OR: [{ homeRevenueCollectedAt: null }, { awayRevenueCollectedAt: null }],
  };
  const pending = await db.sportMatch.count({ where });
  console.log(`${pending} completed matches have uncollected revenue on at least one side.`);
  if (!apply) {
    console.log("DRY RUN — pass --apply to mark them as collected.");
    return;
  }

  const now = new Date();
  const [home, away] = await db.$transaction([
    db.sportMatch.updateMany({
      where: { status: "completed", homeRevenueCollectedAt: null },
      data: { homeRevenueCollectedAt: now },
    }),
    db.sportMatch.updateMany({
      where: { status: "completed", awayRevenueCollectedAt: null },
      data: { awayRevenueCollectedAt: now },
    }),
  ]);
  console.log(`Marked ${home.count} home sides and ${away.count} away sides as collected.`);
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
