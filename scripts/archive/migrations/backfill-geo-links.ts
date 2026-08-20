/**
 * Backfill Geo Links (Maps ↔ MyCountry Integration — Phase A)
 *
 * Links the legacy string-based geography fields to canonical City records:
 *   - NationalIdentity.capitalCity  -> NationalIdentity.capitalCityId (City.id)
 *   - NationalIdentity.largestCity  -> NationalIdentity.largestCityId (City.id)
 *   - Subdivision.capital           -> Subdivision.capitalCityId       (City.id)
 *
 * Matching is by City.name, case-insensitive + trimmed, scoped to the
 * relevant country (and subdivision/country for subdivision capitals).
 *   - Exactly 1 match  -> link it (and ensure isNationalCapital where applicable).
 *   - 0 matches        -> logged as "unmatched".
 *   - >1 matches       -> logged as "ambiguous" (no write).
 *
 * SAFE BY DEFAULT: runs as a dry-run unless `--apply` is passed.
 *
 * Usage:
 *   bunx tsx scripts/backfill-geo-links.ts            # dry-run (default)
 *   bunx tsx scripts/backfill-geo-links.ts --dry-run  # explicit dry-run
 *   bunx tsx scripts/backfill-geo-links.ts --apply    # actually write changes
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY; // default is dry-run; only --apply writes

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

interface Stats {
  linked: number;
  alreadyLinked: number;
  unmatched: number;
  ambiguous: number;
  skippedNoString: number;
}

function newStats(): Stats {
  return { linked: 0, alreadyLinked: 0, unmatched: 0, ambiguous: 0, skippedNoString: 0 };
}

/**
 * Find a single City within a set of candidates whose name matches `target`
 * (case-insensitive, trimmed). Returns { match, count }.
 */
function findCity(
  candidates: { id: string; name: string }[],
  target: string
): { match: { id: string; name: string } | null; count: number } {
  const t = norm(target);
  const matches = candidates.filter((c) => norm(c.name) === t);
  return { match: matches.length === 1 ? matches[0]! : null, count: matches.length };
}

async function backfillNationalIdentities() {
  console.log("\n=== NationalIdentity: capitalCity / largestCity ===");
  const capStats = newStats();
  const largestStats = newStats();

  const identities = await prisma.nationalIdentity.findMany({
    select: {
      id: true,
      countryId: true,
      countryName: true,
      capitalCity: true,
      largestCity: true,
      capitalCityId: true,
      largestCityId: true,
    },
  });

  for (const ni of identities) {
    const label = ni.countryName ?? ni.countryId;

    // Fetch this country's cities once.
    const cities = await prisma.city.findMany({
      where: { countryId: ni.countryId },
      select: { id: true, name: true },
    });

    // --- capitalCity -> capitalCityId ---
    if (!ni.capitalCity || norm(ni.capitalCity) === "") {
      capStats.skippedNoString++;
    } else if (ni.capitalCityId) {
      capStats.alreadyLinked++;
    } else {
      const { match, count } = findCity(cities, ni.capitalCity);
      if (count === 0) {
        capStats.unmatched++;
        console.log(`  [capital UNMATCHED] ${label}: "${ni.capitalCity}" (no City found)`);
      } else if (count > 1) {
        capStats.ambiguous++;
        console.log(`  [capital AMBIGUOUS] ${label}: "${ni.capitalCity}" (${count} Cities match)`);
      } else if (match) {
        capStats.linked++;
        console.log(`  [capital LINK] ${label}: "${ni.capitalCity}" -> City ${match.id}`);
        if (!DRY_RUN) {
          await prisma.nationalIdentity.update({
            where: { id: ni.id },
            data: { capitalCityId: match.id },
          });
          await prisma.city.update({
            where: { id: match.id },
            data: { isNationalCapital: true },
          });
        }
      }
    }

    // --- largestCity -> largestCityId ---
    if (!ni.largestCity || norm(ni.largestCity) === "") {
      largestStats.skippedNoString++;
    } else if (ni.largestCityId) {
      largestStats.alreadyLinked++;
    } else {
      const { match, count } = findCity(cities, ni.largestCity);
      if (count === 0) {
        largestStats.unmatched++;
        console.log(`  [largest UNMATCHED] ${label}: "${ni.largestCity}" (no City found)`);
      } else if (count > 1) {
        largestStats.ambiguous++;
        console.log(`  [largest AMBIGUOUS] ${label}: "${ni.largestCity}" (${count} Cities match)`);
      } else if (match) {
        largestStats.linked++;
        console.log(`  [largest LINK] ${label}: "${ni.largestCity}" -> City ${match.id}`);
        if (!DRY_RUN) {
          await prisma.nationalIdentity.update({
            where: { id: ni.id },
            data: { largestCityId: match.id },
          });
        }
      }
    }
  }

  return { capStats, largestStats, total: identities.length };
}

async function backfillSubdivisions() {
  console.log("\n=== Subdivision: capital ===");
  const stats = newStats();

  const subdivisions = await prisma.subdivision.findMany({
    select: {
      id: true,
      name: true,
      countryId: true,
      capital: true,
      capitalCityId: true,
    },
  });

  for (const sub of subdivisions) {
    const label = `${sub.name} (${sub.countryId})`;

    if (!sub.capital || norm(sub.capital) === "") {
      stats.skippedNoString++;
      continue;
    }
    if (sub.capitalCityId) {
      stats.alreadyLinked++;
      continue;
    }

    // Prefer cities belonging to this subdivision; fall back to country-wide.
    const subCities = await prisma.city.findMany({
      where: { subdivisionId: sub.id },
      select: { id: true, name: true },
    });

    let { match, count } = findCity(subCities, sub.capital);

    // Fall back to country-wide search only if no subdivision-scoped city exists.
    if (count === 0) {
      const countryCities = await prisma.city.findMany({
        where: { countryId: sub.countryId },
        select: { id: true, name: true },
      });
      ({ match, count } = findCity(countryCities, sub.capital));
    }

    if (count === 0) {
      stats.unmatched++;
      console.log(`  [sub-capital UNMATCHED] ${label}: "${sub.capital}" (no City found)`);
    } else if (count > 1) {
      stats.ambiguous++;
      console.log(`  [sub-capital AMBIGUOUS] ${label}: "${sub.capital}" (${count} Cities match)`);
    } else if (match) {
      stats.linked++;
      console.log(`  [sub-capital LINK] ${label}: "${sub.capital}" -> City ${match.id}`);
      if (!DRY_RUN) {
        await prisma.subdivision.update({
          where: { id: sub.id },
          data: { capitalCityId: match.id },
        });
      }
    }
  }

  return { stats, total: subdivisions.length };
}

function printStats(title: string, s: Stats) {
  console.log(`\n  ${title}`);
  console.log(`    linked:          ${s.linked}`);
  console.log(`    already linked:  ${s.alreadyLinked}`);
  console.log(`    unmatched:       ${s.unmatched}`);
  console.log(`    ambiguous:       ${s.ambiguous}`);
  console.log(`    no string (skip): ${s.skippedNoString}`);
}

async function main() {
  console.log("====================================================");
  console.log(" Backfill Geo Links (Phase A)");
  console.log(`  mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY (writing changes)"}`);
  console.log("====================================================");

  const ni = await backfillNationalIdentities();
  const sub = await backfillSubdivisions();

  console.log("\n====================================================");
  console.log(" SUMMARY");
  console.log("====================================================");
  console.log(`\n NationalIdentity records scanned: ${ni.total}`);
  printStats("capitalCity -> capitalCityId", ni.capStats);
  printStats("largestCity -> largestCityId", ni.largestStats);
  console.log(`\n Subdivision records scanned: ${sub.total}`);
  printStats("capital -> capitalCityId", sub.stats);

  const totalLinked = ni.capStats.linked + ni.largestStats.linked + sub.stats.linked;
  const totalUnmatched = ni.capStats.unmatched + ni.largestStats.unmatched + sub.stats.unmatched;
  const totalAmbiguous = ni.capStats.ambiguous + ni.largestStats.ambiguous + sub.stats.ambiguous;

  console.log("\n TOTALS");
  console.log(`   linked:    ${totalLinked}`);
  console.log(`   unmatched: ${totalUnmatched}`);
  console.log(`   ambiguous: ${totalAmbiguous}`);

  if (DRY_RUN) {
    console.log("\n DRY-RUN complete. No data was written. Re-run with --apply to persist.");
  } else {
    console.log("\n APPLY complete. Changes have been written to the database.");
  }
}

main()
  .catch((e) => {
    console.error("Fatal error during backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
