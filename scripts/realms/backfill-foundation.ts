/**
 * Realms Phase 1 backfill. Dry run by default; pass --apply to write.
 *   bun scripts/realms/backfill-foundation.ts [--apply]
 * 1. Country.ownerUserId from users whose countryId points at it (collisions reported, never guessed)
 * 2. Ixnay realm slug default → ixnay
 * 3. realms.visibility private → unlisted
 * 4. map_layers with no realm (legacy NULL worldId) → Ixnay — map reads filter by realm since E4
 * Preflight (before any write): the Ixnay realm row must exist; its ownerId is printed. --apply refuses (exit 1,
 * nothing written) unless that ownerId is "system" and no owner collision is left (ruling F-5).
 */
import { PrismaClient } from "@prisma/client";
import { isSystemOwner } from "~/lib/auth";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import {
  applyBlockers,
  findDuplicateLayerKeys,
  planOwnerBackfill,
  type OwnerPlan,
} from "./backfill-plan";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

async function planOwners(): Promise<OwnerPlan> {
  const countries = await db.country.findMany({
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      users: { select: { id: true, clerkUserId: true } },
    },
  });
  const plan = planOwnerBackfill(
    countries.map((c) => ({ countryId: c.id, ownerUserId: c.ownerUserId, users: c.users })),
    isSystemOwner
  );
  console.log(`owners: ${plan.assign.length} to assign, ${plan.collisions.length} collisions`);
  for (const c of plan.collisions)
    console.log(`  COLLISION ${c.countryId}: users ${c.userIds.join(", ")} — resolve by hand`);
  return plan;
}

async function backfillOwners(plan: OwnerPlan) {
  if (!apply) return;
  for (const a of plan.assign) {
    // select id: before the deploy, columns only the deploy SQL adds (Country.ownedSince) don't exist yet,
    // and a plain update reads every column back
    await db.country.update({
      where: { id: a.countryId },
      data: { ownerUserId: a.userId },
      select: { id: true },
    });
  }
}

/** Runs before any write: the Ixnay realm row every Country.realmId FK depends on. */
async function requireIxnayRealm() {
  const realm = await db.realm.findUnique({
    where: { id: DEFAULT_REALM_ID },
    select: { slug: true, ownerId: true },
  });
  if (!realm)
    throw new Error(
      `realms row id="${DEFAULT_REALM_ID}" (Ixnay) is missing — Country.realmId FK depends on it; create it before running this backfill`
    );
  console.log(`Ixnay realm ownerId: ${realm.ownerId}`);
  return realm;
}

async function backfillRealms(realm: { slug: string }) {
  console.log(`Ixnay slug: ${realm.slug} → ixnay`);
  const privateCount = await db.realm.count({ where: { visibility: "private" } });
  console.log(`private realms → unlisted: ${privateCount}`);
  if (!apply) return;
  if (realm.slug !== "ixnay")
    await db.realm.update({
      where: { id: DEFAULT_REALM_ID },
      data: { slug: "ixnay" },
      select: { id: true },
    });
  await db.realm.updateMany({ where: { visibility: "private" }, data: { visibility: "unlisted" } });
}

async function backfillMapLayerRealms() {
  const orphans = await db.mapLayer.findMany({
    where: { realmId: null },
    select: { id: true, layerType: true, featureId: true },
  });
  // A NULL row whose (layerType, featureId) Ixnay already has would collide on the realm-scoped unique key
  const [{ clashes }] = await db.$queryRaw<Array<{ clashes: bigint }>>`
    SELECT count(*) AS clashes FROM map_layers a
    JOIN map_layers b ON b."worldId" = ${DEFAULT_REALM_ID}
      AND b."layerType" = a."layerType" AND b."featureId" = a."featureId"
    WHERE a."worldId" IS NULL`;
  // …and so would two NULL rows sharing one (NULLs never collided with each other before the move)
  const duplicates = findDuplicateLayerKeys(orphans);
  console.log(
    `map layers with no realm → Ixnay: ${orphans.length} (${clashes} clash with an Ixnay feature, ${duplicates.length} keys held by more than one of them)`
  );
  for (const d of duplicates)
    console.log(`  DUPLICATE ${d.layerType}/${d.featureId}: ${d.ids.join(", ")}`);
  if (!apply || orphans.length === 0) return;
  if (Number(clashes) > 0 || duplicates.length > 0) {
    console.log(
      "  SKIPPED — resolve the clashing/duplicate rows by hand (deactivate or delete the NULL duplicates), then re-run"
    );
    return;
  }
  await db.mapLayer.updateMany({ where: { realmId: null }, data: { realmId: DEFAULT_REALM_ID } });
}

async function main() {
  console.log(apply ? "APPLY mode — writing" : "DRY RUN — pass --apply to write");
  const ixnay = await requireIxnayRealm();
  const owners = await planOwners();
  const blockers = applyBlockers({
    ixnayOwnerId: ixnay.ownerId,
    ownerCollisions: owners.collisions.length,
  });
  for (const blocker of blockers) console.log(`  BLOCKS --apply: ${blocker}`);
  if (apply && blockers.length > 0) {
    console.error(
      "Refusing --apply: nothing was written. Resolve the blockers above, then re-run."
    );
    process.exitCode = 1;
    return;
  }
  await backfillOwners(owners);
  await backfillRealms(ixnay);
  await backfillMapLayerRealms();
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
