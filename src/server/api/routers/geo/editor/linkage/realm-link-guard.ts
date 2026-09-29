import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

interface LinkableCountry {
  name: string;
  realmId: string;
}

/**
 * A map feature links only to a country of its own realm: every link is followed by a geometry
 * sync that would otherwise overwrite another realm's country (geometry, centroid, land area).
 * No country id (an unlink, or a link left unchanged) passes without a lookup.
 */
export async function assertCountryInFeatureRealm(
  db: Pick<PrismaClient, "country">,
  countryId: string,
  realmId: string
): Promise<LinkableCountry>;
export async function assertCountryInFeatureRealm(
  db: Pick<PrismaClient, "country">,
  countryId: string | null | undefined,
  realmId: string
): Promise<LinkableCountry | null>;
export async function assertCountryInFeatureRealm(
  db: Pick<PrismaClient, "country">,
  countryId: string | null | undefined,
  realmId: string
): Promise<LinkableCountry | null> {
  if (countryId === null || countryId === undefined) return null;
  const country = await db.country.findUnique({
    where: { id: countryId },
    select: { name: true, realmId: true },
  });
  if (!country) {
    throw new TRPCError({ code: "NOT_FOUND", message: `Country not found: ${countryId}` });
  }
  if (country.realmId !== realmId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A map feature can only be linked to a country of its own realm",
    });
  }
  return country;
}
