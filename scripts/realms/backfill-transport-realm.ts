/**
 * AT-1 backfill: transport routes and hubs were always saved with the default realm (IxWorld), so a
 * non-IxWorld nation's network showed on IxWorld's map. Moves each row to its owning country's realm.
 * Dry run by default; pass --apply to write. Idempotent: rows already in the right realm are skipped.
 *   bun scripts/realms/backfill-transport-realm.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";
import {
  countMoves,
  planTransportRealmBackfill,
  type TransportRealmPlan,
} from "./transport-realm-plan";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

function report(label: string, plan: TransportRealmPlan) {
  console.log(
    `${label}: ${countMoves(plan)} to move, ${plan.orphans.length} with no owning country (left as is)`
  );
  for (const [realmId, ids] of plan.moves) console.log(`  → ${realmId}: ${ids.length}`);
}

async function main() {
  console.log(apply ? "APPLY mode — writing" : "DRY RUN — pass --apply to write");
  const countries = await db.country.findMany({ select: { id: true, realmId: true } });
  const countryRealm = new Map(countries.map((c) => [c.id, c.realmId]));

  const routes = planTransportRealmBackfill(
    await db.transportRoute.findMany({ select: { id: true, countryId: true, realmId: true } }),
    countryRealm
  );
  const hubs = planTransportRealmBackfill(
    await db.transportHub.findMany({ select: { id: true, countryId: true, realmId: true } }),
    countryRealm
  );
  report("transport routes", routes);
  report("transport hubs", hubs);
  if (!apply) return;

  for (const [realmId, ids] of routes.moves) {
    await db.transportRoute.updateMany({ where: { id: { in: ids } }, data: { realmId } });
  }
  for (const [realmId, ids] of hubs.moves) {
    await db.transportHub.updateMany({ where: { id: { in: ids } }, data: { realmId } });
  }
  console.log("done");
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
