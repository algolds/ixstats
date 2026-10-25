/**
 * Read-only dry run of a `stat-progression` run (docs/operations/deploy-mycountry-2026-10.md). Projects every country
 * the way the job does (projectCountryStats at its realm's time now; paused realms skipped) and prints what the first run would change, without
 * writing anything, naming every nation whose economic or population tier would change. Point DATABASE_URL at a
 * copy of production:
 *
 *   DATABASE_URL="postgresql://…/ixstats_dryrun" bun scripts/cron/dry-run-stat-progression.ts
 *
 * It exits once it has printed: imports open a Redis connection (the rate limiter) that would keep it alive.
 */
import { PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import { pickClock, realmClocks } from "~/server/shared/realm-time";
import {
  getComponentsStatsDataForCountries,
  projectCountryStats,
  projectedStatsUpdate,
} from "~/server/shared/country-helpers";
import { isProjectionUnchanged } from "~/server/cron/stat-progression";

const pct = (x: number) => `${(100 * x).toFixed(2)}%`;

interface Tiers {
  economicTier: string | null;
  populationTier: string | null;
}

/** The tiers a projection changes, each as a line naming the nation ("Castadilla (owned): economic A -> B"). */
export function tierChanges(
  name: string,
  stored: Tiers,
  next: Tiers
): { economic: string | null; population: string | null } {
  const line = (kind: string, from: string | null, to: string | null) =>
    from === to ? null : `${name}: ${kind} ${from} -> ${to}`;
  return {
    economic: line("economic", stored.economicTier, next.economicTier),
    population: line("population", stored.populationTier, next.populationTier),
  };
}

async function main(db: PrismaClient) {
  const clocks = await realmClocks(db);
  const ixTime = IxTime.getCurrentIxTime();
  const cfg = await getEconomicConfigFromDB(db);
  const countries = (
    await db.country.findMany({
      include: { storytellerEffects: { where: { isActive: true } } },
    })
  ).filter((c) => !pickClock(clocks, c.realmId).paused);
  const nowOf = new Map(countries.map((c) => [c.id, pickClock(clocks, c.realmId).now()]));
  const components = await getComponentsStatsDataForCountries(
    db,
    countries.map((c) => c.id),
    (id) => nowOf.get(id)!
  );

  let written = 0;
  const economicLines: string[] = [];
  const populationLines: string[] = [];
  const changes: Array<{ name: string; gdp: number; pop: number; tier: string }> = [];
  for (const c of countries) {
    const now = nowOf.get(c.id)!;
    const stats = projectCountryStats(c, components.get(c.id), cfg, now);
    const next = projectedStatsUpdate(stats, now);
    const name = `${c.name}${c.ownerUserId ? " (owned)" : ""}`;
    if (!isProjectionUnchanged(c, next)) written++;
    const tiers = tierChanges(name, c, next);
    if (tiers.economic) economicLines.push(tiers.economic);
    if (tiers.population) populationLines.push(tiers.population);
    changes.push({
      name,
      gdp: next.currentTotalGdp / (c.currentTotalGdp || 1) - 1,
      pop: next.currentPopulation / (c.currentPopulation || 1) - 1,
      tier: `${c.economicTier} -> ${next.economicTier}`,
    });
  }

  const sorted = [...changes].sort((a, b) => a.gdp - b.gdp);
  const median = sorted[Math.floor(sorted.length / 2)]?.gdp ?? 0;
  console.log(`IxTime ${IxTime.formatIxTime(ixTime, true)}: ${countries.length} countries`);
  console.log(
    `would write ${written}; economic tier changes ${economicLines.length}; population tier changes ${populationLines.length}`
  );
  for (const line of [...economicLines, ...populationLines]) console.log(`  tier change: ${line}`);
  console.log(`median stored -> projected total GDP change ${pct(median)}`);
  console.log("largest changes (total GDP, population):");
  for (const c of changes.sort((a, b) => Math.abs(b.gdp) - Math.abs(a.gdp)).slice(0, 10)) {
    console.log(`  ${c.name}: GDP ${pct(c.gdp)}, population ${pct(c.pop)}, ${c.tier}`);
  }
}

if (import.meta.main) {
  const db = new PrismaClient();
  main(db)
    .catch((error: Error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
      // The rate limiter's Redis connection (opened on import) keeps the event loop alive: exit explicitly.
      process.exit(process.exitCode ?? 0);
    });
}
