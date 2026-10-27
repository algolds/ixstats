/**
 * Backfill Country.ownedSince for nations that were owned before the column existed (Vault hub,
 * Stewardship achievements). Dry run by default; pass --apply to write.
 *   bun scripts/backfill-country-owned-since.ts [--apply]
 * Date per owned nation without one: the latest approved RealmClaim by the current owner
 * (`reviewedAt`), else the nation's first CountryChangeLog row. Nations with neither are listed
 * and left null (0 months owned) for an admin to set by hand. Idempotent: only rows still null
 * are written, and each write re-checks that.
 */
import { PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "country" | "realmClaim" | "countryChangeLog">;

interface OwnedCountry {
  id: string;
  ownerUserId: string | null;
}
interface ApprovedClaim {
  countryId: string | null;
  userId: string;
  reviewedAt: Date | null;
}
export interface OwnedSinceResolution {
  date: Date | null;
  source: "claim" | "changelog" | "none";
}
export interface BackfillReport {
  fromClaim: number;
  fromChangelog: number;
  unresolved: string[];
  written: number;
}

/** The current owner's latest approved claim, else the first change log row, else nothing. */
export function resolveOwnedSince(
  country: OwnedCountry,
  claims: ApprovedClaim[],
  firstChangeLog: Date | null
): OwnedSinceResolution {
  const reviewed = claims
    .filter((c) => c.countryId === country.id && c.userId === country.ownerUserId)
    .flatMap((c) => (c.reviewedAt ? [c.reviewedAt] : []))
    .sort((a, b) => b.getTime() - a.getTime());
  if (reviewed[0]) return { date: reviewed[0], source: "claim" };
  if (firstChangeLog) return { date: firstChangeLog, source: "changelog" };
  return { date: null, source: "none" };
}

export async function backfillOwnedSince(db: Db, apply: boolean): Promise<BackfillReport> {
  const countries = await db.country.findMany({
    where: { ownerUserId: { not: null }, ownedSince: null },
    select: { id: true, ownerUserId: true },
  });
  const ids = countries.map((c) => c.id);
  const [claims, logs] = await Promise.all([
    db.realmClaim.findMany({
      where: { countryId: { in: ids }, status: "approved", reviewedAt: { not: null } },
      select: { countryId: true, userId: true, reviewedAt: true },
    }),
    db.countryChangeLog.groupBy({
      by: ["countryId"],
      where: { countryId: { in: ids } },
      _min: { createdAt: true },
    }),
  ]);
  const firstLog = new Map(logs.map((l) => [l.countryId, l._min.createdAt]));

  const report: BackfillReport = { fromClaim: 0, fromChangelog: 0, unresolved: [], written: 0 };
  for (const country of countries) {
    const { date, source } = resolveOwnedSince(country, claims, firstLog.get(country.id) ?? null);
    if (!date) {
      report.unresolved.push(country.id);
      continue;
    }
    if (source === "claim") report.fromClaim += 1;
    else report.fromChangelog += 1;
    if (!apply) continue;
    const { count } = await db.country.updateMany({
      where: { id: country.id, ownedSince: null },
      data: { ownedSince: date },
    });
    report.written += count;
  }
  return report;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient();
  try {
    const report = await backfillOwnedSince(db, apply);
    console.log(
      `ownedSince: ${report.fromClaim} from an approved claim, ${report.fromChangelog} from the first change log row, ` +
        `${report.unresolved.length} unresolved`
    );
    for (const id of report.unresolved)
      console.log(`  unresolved ${id}: set Country.ownedSince by hand`);
    console.log(
      apply
        ? `Wrote ${report.written} nations.`
        : "DRY RUN: nothing written. Re-run with --apply to write."
    );
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
