/**
 * Generic clone utilities for the Demo Seed system.
 *
 * Provides helpers to deep-clone Prisma records from a source country
 * to a demo country, stripping auto-generated fields and remapping FKs.
 */

import { type PrismaClient } from "@prisma/client";

type Prisma = PrismaClient;

/** Fields that should always be stripped from cloned records. */
const ALWAYS_STRIP = new Set(["id", "createdAt", "updatedAt"]);

/**
 * Strip auto-generated fields from a record and remap the country FK.
 */
export function stripRecord(
  record: Record<string, any>,
  demoCountryId: string,
  options?: {
    countryField?: string;
    extraStrip?: string[];
    transforms?: Record<string, (val: any) => any>;
  }
): Record<string, any> {
  const countryField = options?.countryField ?? "countryId";
  const extraStrip = new Set(options?.extraStrip ?? []);
  const transforms = options?.transforms ?? {};

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(record)) {
    if (ALWAYS_STRIP.has(key) || extraStrip.has(key)) continue;

    if (key === countryField) {
      result[key] = demoCountryId;
    } else if (key in transforms) {
      result[key] = transforms[key]!(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Clone flat records from source country to demo country.
 *
 * Queries all records matching `sourceCountryId` via the given model delegate,
 * strips IDs/timestamps, remaps the country FK, and creates them on the demo country.
 *
 * Returns the count of cloned records and the new records (with their new IDs).
 */
export async function cloneRecords(
  prisma: Prisma,
  modelName: string,
  sourceCountryId: string,
  demoCountryId: string,
  options?: {
    countryField?: string;
    extraStrip?: string[];
    transforms?: Record<string, (val: any) => any>;
    orderBy?: Record<string, string>;
    take?: number;
    where?: Record<string, any>;
  }
): Promise<{ count: number; records: any[] }> {
  const countryField = options?.countryField ?? "countryId";
  const model = (prisma as any)[modelName];
  if (!model) return { count: 0, records: [] };

  const where = {
    [countryField]: sourceCountryId,
    ...options?.where,
  };

  const findArgs: any = { where };
  if (options?.orderBy) findArgs.orderBy = options.orderBy;
  if (options?.take) findArgs.take = options.take;

  const sourceRecords: any[] = await model.findMany(findArgs);
  if (sourceRecords.length === 0) return { count: 0, records: [] };

  const created: any[] = [];
  for (const rec of sourceRecords) {
    const data = stripRecord(rec, demoCountryId, {
      countryField,
      extraStrip: options?.extraStrip,
      transforms: options?.transforms,
    });
    const newRec = await model.create({ data });
    created.push(newRec);
  }

  return { count: created.length, records: created };
}

/**
 * Clone a single unique-per-country record (1:1 relation).
 * Uses findFirst instead of findMany since there's at most one record.
 */
export async function cloneUniqueRecord(
  prisma: Prisma,
  modelName: string,
  sourceCountryId: string,
  demoCountryId: string,
  options?: {
    countryField?: string;
    extraStrip?: string[];
    transforms?: Record<string, (val: any) => any>;
  }
): Promise<{ count: number; record: any | null }> {
  const countryField = options?.countryField ?? "countryId";
  const model = (prisma as any)[modelName];
  if (!model) return { count: 0, record: null };

  const source = await model.findFirst({
    where: { [countryField]: sourceCountryId },
  });
  if (!source) return { count: 0, record: null };

  const data = stripRecord(source, demoCountryId, {
    countryField,
    extraStrip: options?.extraStrip,
    transforms: options?.transforms,
  });

  const newRec = await model.create({ data });
  return { count: 1, record: newRec };
}

/**
 * Clone a parent-child tree. Clones parent records, builds an oldId→newId map,
 * then clones children with the parent FK remapped.
 *
 * Returns the total count across parent + all children.
 */
export async function cloneParentChildren(
  prisma: Prisma,
  parentModelName: string,
  sourceCountryId: string,
  demoCountryId: string,
  children: Array<{
    modelName: string;
    parentField: string; // FK field pointing to parent's id
    extraStrip?: string[];
    transforms?: Record<string, (val: any) => any>;
  }>,
  options?: {
    countryField?: string;
    extraStrip?: string[];
    transforms?: Record<string, (val: any) => any>;
  }
): Promise<{ count: number; idMap: Map<string, string> }> {
  const countryField = options?.countryField ?? "countryId";

  // Clone parents
  const { count: parentCount, records: parents } = await cloneRecords(
    prisma,
    parentModelName,
    sourceCountryId,
    demoCountryId,
    { countryField, extraStrip: options?.extraStrip, transforms: options?.transforms }
  );
  if (parentCount === 0) return { count: 0, idMap: new Map() };

  // Build parent ID map from source records
  const parentModel = (prisma as any)[parentModelName];
  const sourceParents: any[] = await parentModel.findMany({
    where: { [countryField]: sourceCountryId },
  });

  const idMap = new Map<string, string>();
  for (let i = 0; i < sourceParents.length; i++) {
    if (i < parents.length) {
      idMap.set(sourceParents[i].id, parents[i].id);
    }
  }

  // Clone each child type
  let childCount = 0;
  for (const child of children) {
    const childModel = (prisma as any)[child.modelName];
    if (!childModel) continue;

    // Get all source parent IDs
    const sourceParentIds = Array.from(idMap.keys());
    if (sourceParentIds.length === 0) continue;

    const sourceChildren: any[] = await childModel.findMany({
      where: { [child.parentField]: { in: sourceParentIds } },
    });

    for (const rec of sourceChildren) {
      const oldParentId = rec[child.parentField];
      const newParentId = idMap.get(oldParentId);
      if (!newParentId) continue;

      const data = stripRecord(rec, demoCountryId, {
        countryField: "___skip___", // Don't remap countryId on children (they don't have one)
        extraStrip: child.extraStrip,
        transforms: {
          [child.parentField]: () => newParentId,
          ...child.transforms,
        },
      });
      // Remove the skipped field if it was set
      delete data["___skip___"];

      // If child also has countryId, set it
      if ("countryId" in rec) {
        data.countryId = demoCountryId;
      }

      await childModel.create({ data });
      childCount++;
    }
  }

  return { count: parentCount + childCount, idMap };
}
