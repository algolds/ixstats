/**
 * A realm's nation growth defaults (site admins, /admin/realms "Nations"): the per-tier table its new nations
 * get (`Realm.settings.nationDefaults`, else IxStats's defaults), and applying it to the realm's unclaimed
 * nations with a dry-run preview first. A claimed nation's growth is its player's, so it is never touched;
 * IxWorld is refused, its nations keeping their curated roster values.
 * Saving and applying are recorded in `AdminAuditLog`, like the other realm admin actions.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  IXSTATS_NATION_GROWTH_DEFAULTS,
  planNationDefaultsApply,
  type GrowthChange,
  type NationGrowthTable,
} from "~/lib/realms/nation-growth-defaults";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import type { EconomicTier } from "~/types/ixstats";
import { isSiteAdmin, type RealmActor } from "./realms.access";
import { RealmRegionError } from "./realms.region";
import { hasNationDefaults, realmNationDefaults, withNationDefaults } from "./realms.settings";

type NationDefaultsDb = Pick<PrismaClient, "realm" | "country" | "adminAuditLog" | "$transaction">;
type NationDefaultsTx = Pick<Prisma.TransactionClient, "realm" | "country" | "adminAuditLog">;

/** `AdminAuditLog.action` of a saved (or reset) table; `changes` holds the previous and next table. */
export const NATION_DEFAULTS_SAVED_ACTION = "REALM_NATION_DEFAULTS_SAVED";
/** `AdminAuditLog.action` of an apply; `changes` lists every nation written, from and to. */
export const NATION_DEFAULTS_APPLIED_ACTION = "REALM_NATION_DEFAULTS_APPLIED";
/** How many changed nations a preview lists. */
export const PREVIEW_SAMPLE_SIZE = 12;

/** A nation no player holds and none was ever approved for. */
export const UNCLAIMED_NATION_WHERE = {
  ownerUserId: null,
  realmClaims: { none: { status: "approved" } },
} satisfies Prisma.CountryWhereInput;

const GROWTH_SELECT = {
  id: true,
  name: true,
  baselineGdpPerCapita: true,
  populationGrowthRate: true,
  adjustedGdpGrowth: true,
  maxGdpGrowthRate: true,
} satisfies Prisma.CountrySelect;

async function loadRealm(db: Pick<PrismaClient, "realm">, actor: RealmActor, realmId: string) {
  if (!isSiteAdmin(actor))
    throw new RealmRegionError("FORBIDDEN", "Only site admins manage a realm's nation defaults");
  if (realmId === DEFAULT_REALM_ID)
    throw new RealmRegionError(
      "BAD_REQUEST",
      "IxWorld's nations keep their roster values: edit them one by one in Countries"
    );
  const realm = await db.realm.findUnique({
    where: { id: realmId },
    select: { id: true, slug: true, name: true, settings: true },
  });
  if (!realm) throw new RealmRegionError("NOT_FOUND", "Realm not found");
  return realm;
}

function audit(
  tx: NationDefaultsTx,
  actor: RealmActor,
  realm: { id: string; name: string },
  action: string,
  changes: object
) {
  return tx.adminAuditLog.create({
    data: {
      action,
      targetType: "realm",
      targetId: realm.id,
      targetName: realm.name,
      changes: JSON.stringify(changes),
      adminId: actor.id,
      adminName: actor.clerkUserId,
    },
  });
}

/** The realm's table, whether it is the realm's own, IxStats's defaults, and its nation counts. */
export async function getNationDefaults(db: NationDefaultsDb, actor: RealmActor, realmId: string) {
  const realm = await loadRealm(db, actor, realmId);
  const nations = await db.country.count({ where: { realmId: realm.id } });
  const unclaimed = await db.country.count({
    where: { realmId: realm.id, ...UNCLAIMED_NATION_WHERE },
  });
  return {
    realm: { id: realm.id, slug: realm.slug, name: realm.name },
    table: realmNationDefaults(realm.settings),
    custom: hasNationDefaults(realm.settings),
    systemDefaults: IXSTATS_NATION_GROWTH_DEFAULTS,
    nations,
    unclaimed,
  };
}

/** Store the realm's table (`null`: back to IxStats's defaults); its other settings are kept. Audited. */
export async function saveNationDefaults(
  db: NationDefaultsDb,
  actor: RealmActor,
  input: { realmId: string; table: NationGrowthTable | null }
) {
  await db.$transaction(async (tx) => {
    const realm = await loadRealm(tx, actor, input.realmId);
    await tx.realm.update({
      where: { id: realm.id },
      data: { settings: withNationDefaults(realm.settings, input.table) },
    });
    const previous = hasNationDefaults(realm.settings) ? realmNationDefaults(realm.settings) : null;
    await audit(tx, actor, realm, NATION_DEFAULTS_SAVED_ACTION, { previous, next: input.table });
  });
  return { success: true, custom: input.table !== null };
}

function unclaimedNations(db: Pick<PrismaClient, "country">, realmId: string) {
  return db.country.findMany({
    where: { realmId, ...UNCLAIMED_NATION_WHERE },
    select: GROWTH_SELECT,
    orderBy: { name: "asc" },
  });
}

function countByTier(changes: readonly GrowthChange[]) {
  const byTier: Partial<Record<EconomicTier, number>> = {};
  for (const change of changes) byTier[change.tier] = (byTier[change.tier] ?? 0) + 1;
  return byTier;
}

/** Dry run: what applying the realm's table would change on its unclaimed nations. Writes nothing. */
export async function previewNationDefaults(
  db: NationDefaultsDb,
  actor: RealmActor,
  realmId: string
) {
  const realm = await loadRealm(db, actor, realmId);
  const nations = await unclaimedNations(db, realm.id);
  const changes = planNationDefaultsApply(nations, realmNationDefaults(realm.settings));
  return {
    unclaimed: nations.length,
    changed: changes.length,
    unchanged: nations.length - changes.length,
    byTier: countByTier(changes),
    sample: changes.slice(0, PREVIEW_SAMPLE_SIZE),
  };
}

/**
 * Write the realm's table to its unclaimed nations (each write guarded, so a nation claimed meanwhile is left
 * alone) and record every nation written in the audit log.
 */
export async function applyNationDefaults(
  db: NationDefaultsDb,
  actor: RealmActor,
  realmId: string
) {
  return db.$transaction(
    async (tx) => {
      const realm = await loadRealm(tx, actor, realmId);
      const table = realmNationDefaults(realm.settings);
      const nations = await unclaimedNations(tx, realm.id);
      const written: GrowthChange[] = [];
      for (const change of planNationDefaultsApply(nations, table)) {
        const { count } = await tx.country.updateMany({
          where: { id: change.id, realmId: realm.id, ...UNCLAIMED_NATION_WHERE },
          data: change.to,
        });
        if (count > 0) written.push(change);
      }
      const result = { unclaimed: nations.length, updated: written.length };
      await audit(tx, actor, realm, NATION_DEFAULTS_APPLIED_ACTION, {
        ...result,
        table,
        nations: written,
      });
      return result;
    },
    { timeout: 60_000 }
  );
}
