/**
 * Pure decision helper for province-import commit.
 * Splits incoming provinces into "update existing" vs "create new" by
 * case-insensitive, trimmed name match against existing subdivisions.
 *
 * No DB/React deps so it is unit-testable. The router passes the existing
 * subdivisions it already loaded.
 */

export interface ExistingSubdivisionRef {
  id: string;
  name: string;
}

export interface MergePlanEntry<T> {
  province: T;
  /** id of the existing subdivision to update, or null to create */
  existingId: string | null;
}

/** Normalize a subdivision name to its match key (matches checkNameUniqueness). */
export function subdivisionNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Build a per-province plan. When `replaceExisting` is true, everything is a
 * create (the caller deletes existing rows first), so existingId is always null.
 */
export function buildProvinceMergePlan<T extends { name: string }>(
  incoming: T[],
  existing: ExistingSubdivisionRef[],
  replaceExisting: boolean
): MergePlanEntry<T>[] {
  const byKey = new Map<string, string>();
  if (!replaceExisting) {
    for (const e of existing) byKey.set(subdivisionNameKey(e.name), e.id);
  }
  return incoming.map((province) => ({
    province,
    existingId: replaceExisting ? null : (byKey.get(subdivisionNameKey(province.name)) ?? null),
  }));
}
