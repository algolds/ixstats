/**
 * Read-only dry run of a `stat-progression` run (docs/operations/deploy-mycountry-2026-10.md). Projects every country
 * the way the job does (projectCountryStats at IxTime now) and prints what the first run would change, without
 * writing anything. Point DATABASE_URL at a copy of production:
 *
 *   DATABASE_URL="postgresql://…/ixstats_dryrun" bun scripts/cron/dry-run-stat-progression.ts
 */
import { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import { refreshSharedClock } from "~/lib/ixtime/shared-clock";
import {
  getComponentsStatsDataForCountries,
  projectCountryStats,
  projectedStatsUpdate,
} from "~/server/shared/country-helpers";
import { isProjectionUnchanged } from "~/server/cron/stat-progression";

const db = new PrismaClient();

const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

async function main() {
  await refreshSharedClock(db, { force: true });
  const ixTime = IxTime.getCurrentIxTime();
  const cfg = await getEconomicConfigFromDB(db);
  const countries = await db.country.findMany({
    include: { storytellerEffects: { where: { isActive: true } } },
  });
  const components = await getComponentsStatsDataForCountries(
    db,
    countries.map((c) => c.id)
  );

  let written = 0;
  let tierChanges = 0;
  let popTierChanges = 0;
  const changes: Array<{ name: string; gdp: number; pop: number; tier: string }> = [];
  for (const c of countries) {
    const stats = projectCountryStats(c, components.get(c.id), cfg, ixTime);
    const next = projectedStatsUpdate(stats, ixTime);
    if (!isProjectionUnchanged(c, next)) written++;
    if (next.economicTier !== c.economicTier) tierChanges++;
    if (next.populationTier !== c.populationTier) popTierChanges++;
    changes.push({
      name: `${c.name}${c.ownerUserId ? " (owned)" : ""}`,
      gdp: next.currentTotalGdp / (c.currentTotalGdp || 1) - 1,
      pop: next.currentPopulation / (c.currentPopulation || 1) - 1,
      tier: `${c.economicTier} -> ${next.economicTier}`,
    });
  }

  const sorted = [...changes].sort((a, b) => a.gdp - b.gdp);
  const median = sorted[Math.floor(sorted.length / 2)]?.gdp ?? 0;
  console.log(`IxTime ${IxTime.formatIxTime(ixTime, true)}: ${countries.length} countries`);
  console.log(
    `would write ${written}; economic tier changes ${tierChanges}; population tier changes ${popTierChanges}`
  );
  console.log(`median stored -> projected total GDP change ${pct(median)}`);
  console.log("largest changes (total GDP, population):");
  for (const c of changes.sort((a, b) => Math.abs(b.gdp) - Math.abs(a.gdp)).slice(0, 10)) {
    console.log(`  ${c.name}: GDP ${pct(c.gdp)}, population ${pct(c.pop)}, ${c.tier}`);
  }
}

main()
  .catch((error: Error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
