export interface TransportRealmRow {
  id: string;
  countryId: string | null;
  realmId: string;
}

export interface TransportRealmPlan {
  /** Target realm → ids of rows whose realmId must move there. */
  moves: Map<string, string[]>;
  /** Rows with no owning country (or one that no longer exists): left where they are. */
  orphans: string[];
}

/**
 * AT-1: a transport row belongs to its owning country's realm. Rows already in the right realm are
 * skipped, so re-running the plan after an apply yields no moves.
 */
export function planTransportRealmBackfill(
  rows: TransportRealmRow[],
  countryRealm: Map<string, string>
): TransportRealmPlan {
  const plan: TransportRealmPlan = { moves: new Map(), orphans: [] };
  for (const row of rows) {
    const target = row.countryId ? countryRealm.get(row.countryId) : undefined;
    if (!target) {
      plan.orphans.push(row.id);
      continue;
    }
    if (row.realmId === target) continue;
    plan.moves.set(target, [...(plan.moves.get(target) ?? []), row.id]);
  }
  return plan;
}

export function countMoves(plan: TransportRealmPlan): number {
  let n = 0;
  for (const ids of plan.moves.values()) n += ids.length;
  return n;
}
