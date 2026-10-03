import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * A public country reference — id, slug or display name. Ids and slugs are globally unique; a name is
 * unique only within a realm (`@@unique([realmId, name])`), so it matches in `realmId` only (ruling E-p).
 * Query with `take: 3` and pick the row with `pickCountryRef`.
 */
export function countryRefWhere(ref: string, realmId: string): Prisma.CountryWhereInput {
  return { OR: [{ id: ref }, { slug: ref.toLowerCase() }, { name: ref, realmId }] };
}

/** The row a reference means when it matched several: an id beats a slug beats a name. */
export function pickCountryRef<T extends { id: string; slug: string | null }>(
  rows: readonly T[],
  ref: string
): T | null {
  const slug = ref.toLowerCase();
  return rows.find((r) => r.id === ref) ?? rows.find((r) => r.slug === slug) ?? rows[0] ?? null;
}

/** The id a public country reference means within `realmId`, or null (see `countryRefWhere`). */
export async function resolveCountryRefId(
  db: Pick<PrismaClient, "country">,
  ref: string,
  realmId: string
): Promise<string | null> {
  const rows = await db.country.findMany({
    where: countryRefWhere(ref, realmId),
    take: 3,
    select: { id: true, slug: true },
  });
  return pickCountryRef(rows, ref)?.id ?? null;
}

export {
  prepareBaseCountryData,
  getCountryComponentsStatsData,
} from "~/server/shared/country-helpers";

export function getGrowthRates(arr: any[], key: string): number[] {
  const rates: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    const prev = arr[i - 1]![key];
    const curr = arr[i]![key];
    if (prev && curr && prev > 0) {
      rates.push((curr - prev) / prev);
    }
  }
  return rates;
}

export function stddev(arr: number[]): number {
  if (!arr.length) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
}
