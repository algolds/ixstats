// scripts/cards/convert-lore-requests.ts
/**
 * One-off: old paid lore requests become free suggestions. No refund is paid.
 *
 *   bun scripts/cards/convert-lore-requests.ts            # dry run: counts and what would change
 *   bun scripts/cards/convert-lore-requests.ts --apply    # write
 *
 * Idempotent: a second run finds nothing to reopen or home.
 */
import { PrismaClient } from "@prisma/client";
import { canonicalCardTitle, parseCardWikiSource } from "~/lib/cards/card-sources";
import { planRequestConversion } from "~/lib/cards/lore-request-conversion";
import { resolveImportRealm } from "~/server/modules/cards/cards.importer";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const rows = await db.loreCardRequest.findMany({
    select: {
      id: true,
      status: true,
      userId: true,
      articleTitle: true,
      wikiSource: true,
      realmId: true,
    },
  });
  const plan = planRequestConversion(rows);
  console.log("Requests by status:", plan.byStatus);
  console.log(
    `${plan.reopen.length} approved requests go back to waiting; ${plan.home.length} open requests get a realm.`
  );
  if (!APPLY) {
    console.log("Dry run: nothing written. Re-run with --apply.");
    return;
  }
  if (plan.reopen.length > 0) {
    await db.loreCardRequest.updateMany({
      where: { id: { in: plan.reopen }, status: "APPROVED" },
      data: { status: "PENDING" },
    });
  }
  for (const row of plan.home) {
    const source = parseCardWikiSource(row.wikiSource) ?? "ixwiki";
    const title = canonicalCardTitle(source, row.articleTitle) ?? row.articleTitle;
    const { realmId } = await resolveImportRealm(db, source, title);
    await db.loreCardRequest.update({ where: { id: row.id }, data: { realmId } });
  }
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
