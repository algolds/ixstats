/**
 * Realms Phase 1 backfill. Dry run by default; pass --apply to write.
 *   bun scripts/realms/backfill-foundation.ts [--apply]
 * 1. Country.ownerUserId from users whose countryId points at it (collisions reported, never guessed)
 * 2. IxWorld realm slug default → ixworld
 * 3. WikiAccountLink (ixwiki, unverified) for every legacy User.wikiUsername
 * 4. realms.visibility private → unlisted
 * 5. map_layers with no realm (legacy NULL worldId) → IxWorld — map reads filter by realm since E4
 * Preflight (before any write): the IxWorld realm row must exist; its ownerId is printed. --apply refuses (exit 1,
 * nothing written) unless that ownerId is "system" and no owner collision is left (ruling F-5).
 */
import { PrismaClient } from "@prisma/client";
import { isSystemOwner } from "~/lib/auth";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { applyBlockers, findDuplicateLayerKeys, planOwnerBackfill, type OwnerPlan } from "./backfill-plan";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

async function planOwners(): Promise<OwnerPlan> {
  const countries = await db.country.findMany({
    select: { id: true, name: true, ownerUserId: true, users: { select: { id: true, clerkUserId: true } } },
  });
  const plan = planOwnerBackfill(
    countries.map((c) => ({ countryId: c.id, ownerUserId: c.ownerUserId, users: c.users })),
    isSystemOwner
  );
  console.log(`owners: ${plan.assign.length} to assign, ${plan.collisions.length} collisions`);
  for (const c of plan.collisions) console.log(`  COLLISION ${c.countryId}: users ${c.userIds.join(", ")} — resolve by hand`);
  return plan;
}

async function backfillOwners(plan: OwnerPlan) {
  if (!apply) return;
  for (const a of plan.assign) {
    await db.country.update({ where: { id: a.countryId }, data: { ownerUserId: a.userId } });
  }
}

/** Runs before any write: the IxWorld realm row every Country.realmId FK depends on. */
async function requireIxWorldRealm() {
  const realm = await db.realm.findUnique({ where: { id: DEFAULT_REALM_ID }, select: { slug: true, ownerId: true } });
  if (!realm) throw new Error(`realms row id="${DEFAULT_REALM_ID}" (IxWorld) is missing — Country.realmId FK depends on it; create it before running this backfill`);
  console.log(`IxWorld realm ownerId: ${realm.ownerId}`);
  return realm;
}

async function backfillRealms(realm: { slug: string }) {
  console.log(`IxWorld slug: ${realm.slug} → ixworld`);
  const privateCount = await db.realm.count({ where: { visibility: "private" } });
  console.log(`private realms → unlisted: ${privateCount}`);
  if (!apply) return;
  if (realm.slug !== "ixworld") await db.realm.update({ where: { id: DEFAULT_REALM_ID }, data: { slug: "ixworld" } });
  await db.realm.updateMany({ where: { visibility: "private" }, data: { visibility: "unlisted" } });
}

async function backfillWikiLinks() {
  const users = await db.user.findMany({
    where: { wikiUsername: { not: null } },
    select: { id: true, wikiUsername: true, wikiUserId: true },
  });
  const existing = new Set((await db.wikiAccountLink.findMany({ where: { source: "ixwiki" }, select: { userId: true } })).map((l) => l.userId));
  const todo = users.filter((u) => u.wikiUsername && !existing.has(u.id));
  console.log(`ixwiki links to record (unverified): ${todo.length}`);
  if (!apply) return;
  for (const u of todo) {
    await db.wikiAccountLink
      .create({ data: { userId: u.id, source: "ixwiki", username: normalizeWikiUsername(u.wikiUsername ?? ""), wikiUserId: u.wikiUserId } })
      .catch((e: Error) => console.log(`  skip ${u.id}: ${e.message}`)); // duplicate legacy usernames: first wins, rest re-verify
  }
}

async function backfillMapLayerRealms() {
  const orphans = await db.mapLayer.findMany({
    where: { realmId: null },
    select: { id: true, layerType: true, featureId: true },
  });
  // A NULL row whose (layerType, featureId) IxWorld already has would collide on the realm-scoped unique key
  const [{ clashes }] = await db.$queryRaw<Array<{ clashes: bigint }>>`
    SELECT count(*) AS clashes FROM map_layers a
    JOIN map_layers b ON b."worldId" = ${DEFAULT_REALM_ID}
      AND b."layerType" = a."layerType" AND b."featureId" = a."featureId"
    WHERE a."worldId" IS NULL`;
  // …and so would two NULL rows sharing one (NULLs never collided with each other before the move)
  const duplicates = findDuplicateLayerKeys(orphans);
  console.log(
    `map layers with no realm → IxWorld: ${orphans.length} (${clashes} clash with an IxWorld feature, ${duplicates.length} keys held by more than one of them)`
  );
  for (const d of duplicates) console.log(`  DUPLICATE ${d.layerType}/${d.featureId}: ${d.ids.join(", ")}`);
  if (!apply || orphans.length === 0) return;
  if (Number(clashes) > 0 || duplicates.length > 0) {
    console.log("  SKIPPED — resolve the clashing/duplicate rows by hand (deactivate or delete the NULL duplicates), then re-run");
    return;
  }
  await db.mapLayer.updateMany({ where: { realmId: null }, data: { realmId: DEFAULT_REALM_ID } });
}

async function main() {
  console.log(apply ? "APPLY mode — writing" : "DRY RUN — pass --apply to write");
  const ixworld = await requireIxWorldRealm();
  const owners = await planOwners();
  const blockers = applyBlockers({ ixworldOwnerId: ixworld.ownerId, ownerCollisions: owners.collisions.length });
  for (const blocker of blockers) console.log(`  BLOCKS --apply: ${blocker}`);
  if (apply && blockers.length > 0) {
    console.error("Refusing --apply: nothing was written. Resolve the blockers above, then re-run.");
    process.exitCode = 1;
    return;
  }
  await backfillOwners(owners);
  await backfillRealms(ixworld);
  await backfillWikiLinks();
  await backfillMapLayerRealms();
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
