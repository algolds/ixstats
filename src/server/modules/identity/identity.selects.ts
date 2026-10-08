/**
 * Prisma selects shared by the identity module (plan 188), plus the row types they produce.
 */
import type { Prisma, User } from "@prisma/client";

/** The country columns a passport reads — never the full 150-column row. */
export const IDENTITY_COUNTRY_SELECT = {
  id: true,
  name: true,
  slug: true,
  flag: true,
  coatOfArms: true,
  continent: true,
  region: true,
  governmentType: true,
  currentPopulation: true,
  currentTotalGdp: true,
  currentGdpPerCapita: true,
  publicApproval: true,
  realmId: true,
  realm: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.CountrySelect;

export type IdentityCountry = Prisma.CountryGetPayload<{ select: typeof IDENTITY_COUNTRY_SELECT }>;

export type IdentityUser = User;
