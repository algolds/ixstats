/**
 * Loads the rank tables `rank` trigger conditions read (./evaluators/realm-rank.ts): every nation of a realm, NPC
 * nations included, through the same snapshot builder the engine uses, so a rank compares like with like. A realm
 * smaller than MIN_REALM_SAMPLE ranks against every nation on the platform.
 *
 * A cache lives for one generation run (createRankCache): each realm's table is built once, whatever the number of
 * nations or templates evaluated against it.
 */
import type { PrismaClient } from "@prisma/client";
import { buildCountrySnapshot } from "./country-snapshot";
import { buildRankTable, MIN_REALM_SAMPLE, rankRowOf, type RankRow, type RankTable } from "./evaluators/realm-rank";

async function loadRankRows(db: PrismaClient, realmId: string | null, now?: number): Promise<RankRow[]> {
  const nations = await db.country.findMany({
    where: realmId === null ? {} : { realmId },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const rows: RankRow[] = [];
  for (const { id } of nations) {
    const snapshot = await buildCountrySnapshot(id, db, now);
    if (snapshot) rows.push(rankRowOf(snapshot));
  }
  return rows;
}

export interface RankSource {
  /** The rank table of the nation's realm, at `now` (the realm clock's now). Null for an unknown nation. */
  forCountry(countryId: string, now?: number): Promise<RankTable | null>;
}

/** A per-run cache of realm rank tables (and the platform rows small realms fall back to). */
export function createRankCache(db: PrismaClient): RankSource {
  const realms = new Map<string, Promise<RankTable>>();
  let platform: Promise<RankRow[]> | null = null;

  const buildRealm = async (realmId: string, now?: number): Promise<RankTable> => {
    const rows = await loadRankRows(db, realmId, now);
    if (rows.length >= MIN_REALM_SAMPLE) return buildRankTable(rows);
    platform ??= loadRankRows(db, null);
    return buildRankTable(rows, await platform);
  };

  return {
    async forCountry(countryId, now) {
      const country = await db.country.findUnique({ where: { id: countryId }, select: { realmId: true } });
      if (!country) return null;
      let table = realms.get(country.realmId);
      if (!table) {
        table = buildRealm(country.realmId, now);
        realms.set(country.realmId, table);
      }
      return table;
    },
  };
}
