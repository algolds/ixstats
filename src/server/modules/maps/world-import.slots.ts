/**
 * The nation slots of a world import: the one transaction that retires the old generated slots and creates the new
 * ones, and the steps around it.
 *
 * The transaction (`replaceSlots`) is where a claim racing the apply is decided. It locks the realm's row and its
 * generated (`worldgen`) countries with SELECT ... FOR UPDATE: a claim being filed takes a share lock on both (the
 * foreign keys of `RealmClaim`), so one that is already filed has committed and is counted below, and one that comes
 * later waits until this transaction ends. Then it counts the pending and approved claims again and aborts if there
 * are any. Only then does it retire slots, and only those no player has: `worldgen`, no owner and no claim row at
 * all (a claim row is removed with its country, `RealmClaim.country` cascades), never a country the realm's players
 * made. New slots are created unclaimable and opened by `openSlots` once the map is written, so nobody can claim a
 * slot that has no territory yet.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { buildBaselineCountryData } from "~/lib/countries/baseline-country";
import type { SnapshotSlotCountry } from "~/lib/maps/realm-map-snapshot";
import { baselineBounds } from "~/lib/worldgen/baseline";
import type { DevelopmentLevel } from "~/lib/worldgen/v2/types";
import { freeNationSlug } from "~/server/modules/realms/realms.claims";
import { realmNationDefaults } from "~/server/modules/realms/realms.settings";
import { MapImportError, type ImportRealm } from "./map-import.realm";
import { assertNoLockingClaims } from "./world-import.guards";
import type { PreparedSlot } from "./world-import.prepare";

const SQKM_TO_SQMI = 0.386102;
/** An empty slot (no habitable land) starts as a token nation: the builder cannot start from zero people. */
const EMPTY_SLOT_POPULATION = 1_000;
const TRANSACTION_MS = 120_000;
/** MapLayer.displayName and Country.name stay short; a suffix " (n)" must fit. */
const MAX_NAME = 190;

/** A nation the import creates, linked to its political feature. */
export interface NewNation {
  name: string;
  /** Slots only: the browser's figures, already checked. Absent: the builder's defaults. */
  population?: number;
  gdpPerCapita?: number;
  areaKm2: number;
  claimable: boolean;
  featureKey: string;
  /** A realm's own feature that gets a country (the "realm map" source): linked, and its outline copied over. */
  feature?: {
    id: string;
    geometry: Prisma.JsonValue;
    centroid: Prisma.JsonValue | null;
    boundingBox: Prisma.JsonValue | null;
  };
}

export interface CreatedNation {
  countryId: string;
  name: string;
  featureKey: string;
  claimable: boolean;
}

export interface SlotStep {
  created: CreatedNation[];
  /** Every column of the slots retired, for the rollback snapshot. */
  retired: SnapshotSlotCountry[];
}

type SlotTx = Prisma.TransactionClient;

/** `names` made unique among themselves and `taken` (case and surrounding spaces ignored): "Name", "Name (2)", ... */
export function dedupeNames(names: readonly string[], taken: Iterable<string>): string[] {
  const used = new Set([...taken].map((name) => name.trim().toLowerCase()));
  return names.map((wanted) => {
    const base = wanted.trim().slice(0, MAX_NAME);
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n})`;
    used.add(name.toLowerCase());
    return name;
  });
}

/** The slots a dry run says a regeneration would retire (the same rule as the transaction, without its locks). */
export async function retirableSlots(
  db: Pick<PrismaClient, "country" | "realmClaim">,
  realmId: string
) {
  const slots = await db.country.findMany({ where: { realmId, worldgen: true } });
  const claimed = await db.realmClaim.findMany({
    where: { countryId: { in: slots.map((slot) => slot.id) } },
    select: { countryId: true },
  });
  const held = new Set(claimed.map((claim) => claim.countryId));
  return slots.filter((slot) => !slot.ownerUserId && !held.has(slot.id));
}

/** A stored JSON value as input for another column; null (nothing stored) leaves the column as it is. */
const asInput = (value: Prisma.JsonValue | null) =>
  value === null ? undefined : (value as Prisma.InputJsonValue);

const toSnapshot = (row: Prisma.CountryGetPayload<object>) =>
  JSON.parse(JSON.stringify(row)) as SnapshotSlotCountry;

async function lockRealmAndSlots(tx: SlotTx, realmId: string) {
  await tx.$queryRaw`SELECT "id" FROM "realms" WHERE "id" = ${realmId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Country" WHERE "realmId" = ${realmId} AND "worldgen" = true FOR UPDATE`;
}

/** The figures a slot starts with: the browser's (checked), a token for an empty one, the builder's for no slot. */
function initialFigures(nation: NewNation, level: DevelopmentLevel) {
  const gdpFloor = baselineBounds(level).gdpPerCapita.min;
  return {
    landArea: nation.areaKm2 > 0 ? nation.areaKm2 : undefined,
    baselinePopulation:
      nation.population === undefined
        ? undefined
        : Math.max(nation.population, EMPTY_SLOT_POPULATION),
    baselineGdpPerCapita:
      nation.gdpPerCapita === undefined ? undefined : nation.gdpPerCapita || gdpFloor,
  };
}

async function createNation(
  tx: SlotTx,
  realm: ImportRealm,
  nation: NewNation,
  name: string,
  level: DevelopmentLevel
): Promise<CreatedNation> {
  const slug = await freeNationSlug(tx, { title: name, realmSlug: realm.slug });
  const area = nation.areaKm2;
  const country = await tx.country.create({
    data: {
      ...buildBaselineCountryData(
        name,
        initialFigures(nation, level),
        realmNationDefaults(realm.settings as Prisma.JsonValue)
      ),
      slug,
      realmId: realm.id,
      worldgen: true,
      claimable: false,
      ...(area > 0 && { areaSqMi: area * SQKM_TO_SQMI }),
      wikiSource: null,
      wikiPageTitle: null,
    },
    select: { id: true },
  });
  const { feature } = nation;
  if (feature) {
    await tx.mapLayer.update({ where: { id: feature.id }, data: { countryId: country.id } });
    await tx.country.update({
      where: { id: country.id },
      data: {
        geometry: asInput(feature.geometry),
        centroid: asInput(feature.centroid),
        boundingBox: asInput(feature.boundingBox),
      },
    });
  }
  return {
    countryId: country.id,
    name,
    featureKey: nation.featureKey,
    claimable: nation.claimable,
  };
}

/** The realm's political features with no country: what the "realm map" source turns into claimable nations. */
export async function unlinkedFeatures(
  db: Pick<PrismaClient, "mapLayer">,
  realmId: string
): Promise<Array<NewNation & { feature: NonNullable<NewNation["feature"]> }>> {
  const rows = await db.mapLayer.findMany({
    where: { realmId, layerType: "political", isActive: true, countryId: null },
    select: {
      id: true,
      featureId: true,
      displayName: true,
      geometry: true,
      centroid: true,
      boundingBox: true,
      areaSqKm: true,
    },
    orderBy: { featureId: "asc" },
  });
  return rows.map((row) => ({
    name: row.displayName?.trim() || row.featureId,
    areaKm2: row.areaSqKm ?? 0,
    claimable: true,
    featureKey: row.featureId,
    feature: {
      id: row.id,
      geometry: row.geometry,
      centroid: row.centroid,
      boundingBox: row.boundingBox,
    },
  }));
}

export interface ReplaceSlotsInput {
  /** Retire the old generated slots (a regeneration); false for the "realm map" source, which keeps its borders. */
  retire: boolean;
  /** The slots to create, or null to create one for each of the realm's unlinked political features. */
  slots: readonly PreparedSlot[] | null;
  level: DevelopmentLevel;
}

/**
 * The slot transaction (see the module comment). Throws a MapImportError, with nothing changed, when the realm was
 * archived, or a claim exists or is filed while the apply runs. A deadlock with a claim being filed reads the same.
 */
export async function replaceSlots(
  db: PrismaClient,
  realm: ImportRealm,
  input: ReplaceSlotsInput
): Promise<SlotStep> {
  try {
    return await db.$transaction(
      async (tx) => {
        await lockRealmAndSlots(tx, realm.id);
        await assertNoLockingClaims(tx, realm.id);
        const row = await tx.realm.findUnique({
          where: { id: realm.id },
          select: { status: true },
        });
        if (row?.status === "archived") {
          throw new MapImportError(
            "BAD_REQUEST",
            "This realm was archived: its map can't be changed"
          );
        }

        const retired = input.retire ? await retireSlots(tx, realm.id) : [];
        const nations: NewNation[] = input.slots
          ? input.slots.map((planned) => ({
              name: planned.slot.name,
              population: planned.slot.population,
              gdpPerCapita: planned.slot.gdpPerCapita,
              areaKm2: planned.areaKm2,
              claimable: planned.slot.claimable,
              featureKey: planned.featureKey,
            }))
          : await unlinkedFeatures(tx, realm.id);
        const taken = await tx.country.findMany({
          where: { realmId: realm.id },
          select: { name: true },
        });
        const names = dedupeNames(
          nations.map((nation) => nation.name),
          taken.map((country) => country.name)
        );
        const created: CreatedNation[] = [];
        for (const [index, nation] of nations.entries()) {
          created.push(await createNation(tx, realm, nation, names[index]!, input.level));
        }
        return { created, retired: retired.map(toSnapshot) };
      },
      { timeout: TRANSACTION_MS, maxWait: TRANSACTION_MS }
    );
  } catch (error) {
    if (error instanceof Error && isDeadlock(error)) {
      throw new MapImportError(
        "CONFLICT",
        "A claim was filed while the world was being applied. Nothing was changed"
      );
    }
    throw error;
  }
}

/** A claim being filed can deadlock with the locks above: Prisma reports it as P2034, or PostgreSQL's own message. */
const isDeadlock = (error: Error): boolean =>
  ("code" in error && error.code === "P2034") || /deadlock/i.test(error.message);

async function retireSlots(tx: SlotTx, realmId: string) {
  const retired = await retirableSlots(tx, realmId);
  await tx.country.deleteMany({ where: { id: { in: retired.map((slot) => slot.id) } } });
  return retired;
}

/** Open the new slots the founder left claimable. Called once the map is written: before it they have no territory. */
export async function openSlots(
  db: Pick<PrismaClient, "country">,
  created: readonly CreatedNation[]
): Promise<number> {
  const open = created.filter((nation) => nation.claimable).map((nation) => nation.countryId);
  if (open.length === 0) return 0;
  const { count } = await db.country.updateMany({
    where: { id: { in: open } },
    data: { claimable: true },
  });
  return count;
}
