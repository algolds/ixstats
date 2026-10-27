/**
 * Prisma selects shared by the identity module (plan 188), plus the row types they produce.
 */
import type { Prisma, User } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";

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

/**
 * The nations a passport lists: those in realms the directory lists. Ixnay nations count even when Ixnay has no realm
 * row (the relation filter needs one).
 */
export const LISTED_NATION_WHERE = {
  OR: [{ realmId: DEFAULT_REALM_ID }, { realm: DIRECTORY_REALM_WHERE }],
} satisfies Prisma.CountryWhereInput;

/** A passport's nations, largest economy first. */
export const NATIONS_LARGEST_FIRST = {
  currentTotalGdp: "desc",
} satisfies Prisma.CountryOrderByWithRelationInput;

export type IdentityUser = User;
