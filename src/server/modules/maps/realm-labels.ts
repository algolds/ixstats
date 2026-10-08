/**
 * A realm's own labels (oceans, seas, regions, continents; `MapLabel` with `realmId` and no nation): the stored
 * shape shared by the realm-label API and the seed script. A label's look comes from its kind and rank (kept in
 * `metadata.rank`), drawn in IxWorld's ocean-label style (`src/lib/maps/ocean-labels.ts`).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  REALM_LABEL_DEFAULT_RANK,
  isRealmLabelRank,
  type RealmLabelRank,
  type RealmLabelSeedEntry,
  type RealmLabelType,
} from "~/lib/maps/realm-labels";

export interface RealmLabelInput {
  text: string;
  labelType: RealmLabelType;
  coordinates: [number, number];
  rank?: RealmLabelRank;
}

function metadataString(metadata: Prisma.JsonValue, field: string): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const value = metadata[field];
  return typeof value === "string" ? value : undefined;
}

/** The rank stored on a realm label, if it has a valid one. */
export function storedRealmLabelRank(metadata: Prisma.JsonValue): RealmLabelRank | undefined {
  const rank = metadataString(metadata, "rank");
  return isRealmLabelRank(rank) ? rank : undefined;
}

/** The stored fields of a realm label: its name, kind, anchor and rank (the kind's unless given). */
export function realmLabelData({ text, labelType, coordinates, rank }: RealmLabelInput) {
  return {
    text,
    labelType,
    coordinates,
    metadata: { rank: rank ?? REALM_LABEL_DEFAULT_RANK[labelType] },
  };
}

type SeedDb = { mapLabel: Pick<PrismaClient["mapLabel"], "findMany" | "create" | "update"> };

interface ExistingLabel {
  id: string;
  text: string;
  labelType: string;
  coordinates: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
}

export interface RealmLabelSeedReport {
  created: string[];
  updated: string[];
  unchanged: number;
}

const seedKey = (entry: RealmLabelSeedEntry) => entry.key ?? entry.text;

/** The realm's label for this entry: the one seeded under its key, else a hand-made label of the same name. */
function findExisting(existing: ExistingLabel[], key: string) {
  return (
    existing.find((l) => metadataString(l.metadata, "seedKey") === key) ??
    existing.find((l) => !metadataString(l.metadata, "seedKey") && l.text === key)
  );
}

function seedData(entry: RealmLabelSeedEntry) {
  const data = realmLabelData({
    text: entry.text,
    labelType: entry.kind,
    coordinates: entry.coordinates,
    rank: entry.rank,
  });
  return { ...data, metadata: { ...data.metadata, seedKey: seedKey(entry) } };
}

/** Field-by-field comparison: Postgres JSON does not keep key order, so a JSON string compare would not do. */
function sameLabel(row: ExistingLabel, data: ReturnType<typeof seedData>) {
  const coords = Array.isArray(row.coordinates) ? row.coordinates : [];
  return (
    row.text === data.text &&
    row.labelType === data.labelType &&
    coords[0] === data.coordinates[0] &&
    coords[1] === data.coordinates[1] &&
    metadataString(row.metadata, "rank") === data.metadata.rank &&
    metadataString(row.metadata, "seedKey") === data.metadata.seedKey
  );
}

/**
 * Create or update a realm's labels from a seed list, matched by key; labels the list does not name are left alone.
 * Without `apply` it only reports what it would do.
 */
export async function seedRealmLabels(
  db: SeedDb,
  realmId: string,
  entries: RealmLabelSeedEntry[],
  { apply, submittedBy }: { apply: boolean; submittedBy: string }
): Promise<RealmLabelSeedReport> {
  const existing: ExistingLabel[] = await db.mapLabel.findMany({
    where: { realmId, countryId: null },
    select: { id: true, text: true, labelType: true, coordinates: true, metadata: true },
  });
  const report: RealmLabelSeedReport = { created: [], updated: [], unchanged: 0 };
  for (const entry of entries) {
    const data = seedData(entry);
    const row = findExisting(existing, seedKey(entry));
    if (row && sameLabel(row, data)) {
      report.unchanged += 1;
      continue;
    }
    (row ? report.updated : report.created).push(seedKey(entry));
    if (!apply) continue;
    if (row) await db.mapLabel.update({ where: { id: row.id }, data });
    else {
      await db.mapLabel.create({
        data: { ...data, realmId, countryId: null, status: "approved", submittedBy },
      });
    }
  }
  return report;
}
