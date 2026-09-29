export interface OwnerRow {
  countryId: string;
  ownerUserId: string | null;
  users: Array<{ id: string; clerkUserId: string }>;
}

export interface OwnerPlan {
  assign: Array<{ countryId: string; userId: string }>;
  collisions: Array<{ countryId: string; userIds: string[] }>;
}

/** Decide Country.ownerUserId from the users whose active pointer is the country. Never guesses. */
export function planOwnerBackfill(rows: OwnerRow[], isSystemOwner: (clerkUserId: string) => boolean): OwnerPlan {
  const plan: OwnerPlan = { assign: [], collisions: [] };
  for (const row of rows) {
    if (row.ownerUserId || row.users.length === 0) continue;
    // System owners only ever *point* at nations (admin override) — never make them owners.
    const candidates = row.users.filter((u) => !isSystemOwner(u.clerkUserId));
    if (candidates.length === 0) continue;
    if (candidates.length === 1 && candidates[0]) plan.assign.push({ countryId: row.countryId, userId: candidates[0].id });
    else plan.collisions.push({ countryId: row.countryId, userIds: row.users.map((u) => u.id) });
  }
  return plan;
}

export interface LayerKeyRow {
  id: string;
  layerType: string;
  featureId: string;
}

/**
 * NULL-realm map layers that share a (layerType, featureId): moving them all to IxWorld would break the
 * realm-scoped unique key half-way through the update, so they must be resolved first.
 */
export function findDuplicateLayerKeys(rows: LayerKeyRow[]): Array<Omit<LayerKeyRow, "id"> & { ids: string[] }> {
  const groups = new Map<string, Omit<LayerKeyRow, "id"> & { ids: string[] }>();
  for (const { id, layerType, featureId } of rows) {
    const key = JSON.stringify([layerType, featureId]);
    const group = groups.get(key) ?? { layerType, featureId, ids: [] };
    group.ids.push(id);
    groups.set(key, group);
  }
  return [...groups.values()].filter((g) => g.ids.length > 1);
}
