/**
 * Renaming a country: its name, its slug (the `/countries/<slug>` address) and the national
 * identity's `countryName` change together, and the old slug keeps working as a permanent redirect.
 * The editor's Name section, Settings and the whole-country update all rename through here, so the
 * three never diverge.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { generateSlug } from "~/lib/utils/slug-utils";

type Db = Pick<PrismaClient, "country" | "realmPage" | "countrySlugRedirect">;
type Tx = Prisma.TransactionClient;

export const MAX_COUNTRY_NAME_LENGTH = 100;

/** Trimmed, with inner runs of whitespace as one space. */
export function normalizeCountryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export interface NameAvailability {
  available: boolean;
  /** Why the name cannot be used, as a sentence the player can act on. */
  reason: string | null;
}

/**
 * Whether `countryId` may take `name` in its realm: names are unique per realm, and a name the
 * realm's lore lists as a nation is taken by claiming that page, not by renaming into it.
 */
export async function checkCountryName(
  db: Pick<Db, "country" | "realmPage">,
  country: { id: string; realmId: string; name: string },
  rawName: string
): Promise<NameAvailability> {
  const name = normalizeCountryName(rawName);
  if (!name) return { available: false, reason: "Enter a name." };
  if (name.length > MAX_COUNTRY_NAME_LENGTH)
    return {
      available: false,
      reason: `Use ${MAX_COUNTRY_NAME_LENGTH} characters or fewer.`,
    };
  if (!generateSlug(name)) {
    return { available: false, reason: "Use at least one letter or number." };
  }
  if (name === country.name) return { available: true, reason: null };

  const taken = await db.country.findFirst({
    where: {
      realmId: country.realmId,
      id: { not: country.id },
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (taken) {
    return { available: false, reason: "Another nation in this realm has this name." };
  }
  const lorePage = await db.realmPage.findFirst({
    where: {
      realmId: country.realmId,
      kind: "nation",
      title: { equals: name, mode: "insensitive" },
    },
    select: { title: true },
  });
  if (lorePage) {
    return {
      available: false,
      reason: `"${lorePage.title}" is a nation of this realm's lore. Claim it on the realm page instead.`,
    };
  }
  return { available: true, reason: null };
}

/** A slug for `name` no other country holds: `name`, then `name-2`, `name-3`… */
async function freeSlugFor(tx: Pick<Tx, "country">, countryId: string, name: string) {
  const base = generateSlug(name) || "country";
  let slug = base;
  for (let n = 2; n < 1000; n++) {
    const holder = await tx.country.findFirst({
      where: { slug, id: { not: countryId } },
      select: { id: true },
    });
    if (!holder) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${countryId.slice(-6).toLowerCase()}`;
}

export interface RenameResult<Row = unknown> {
  name: string;
  slug: string;
  previousSlug: string | null;
  /** The country row as the rename left it. */
  country: Row;
}

/**
 * Inside a transaction: renames the country, gives it a free slug for the new name, writes
 * `nationalIdentity.countryName` and records the old slug as a redirect. `data` is written to the
 * country row in the same update (the editor's `updatedAt`, Settings' other columns).
 */
export async function renameCountryInTx(
  tx: Pick<Tx, "country" | "nationalIdentity" | "countrySlugRedirect">,
  country: { id: string; slug: string | null },
  rawName: string,
  data: Omit<Prisma.CountryUpdateInput, "name" | "slug"> = {}
): Promise<RenameResult<Awaited<ReturnType<Tx["country"]["update"]>>>> {
  const name = normalizeCountryName(rawName);
  const slug = await freeSlugFor(tx, country.id, name);

  const row = await tx.country.update({
    where: { id: country.id },
    data: { ...data, name, slug },
  });
  await tx.nationalIdentity.upsert({
    where: { countryId: country.id },
    update: { countryName: name },
    create: { countryId: country.id, countryName: name },
  });

  // The new slug is a live address now: no redirect may point away from it.
  await tx.countrySlugRedirect.deleteMany({ where: { oldSlug: slug } });
  const previousSlug = country.slug && country.slug !== slug ? country.slug : null;
  if (previousSlug) {
    await tx.countrySlugRedirect.upsert({
      where: { oldSlug: previousSlug },
      update: { countryId: country.id },
      create: { oldSlug: previousSlug, countryId: country.id },
    });
  }
  return { name, slug, previousSlug, country: row };
}

/**
 * The current slug a renamed country's old slug should redirect to, or null when the slug is
 * live (a country holds it) or unknown.
 */
export async function findCountrySlugRedirect(
  db: Pick<Db, "country" | "countrySlugRedirect">,
  rawSlug: string
): Promise<string | null> {
  let oldSlug: string;
  try {
    oldSlug = decodeURIComponent(rawSlug).toLowerCase();
  } catch {
    return null;
  }
  const redirect = await db.countrySlugRedirect.findUnique({
    where: { oldSlug },
    select: { countryId: true },
  });
  if (!redirect) return null;
  const live = await db.country.findUnique({ where: { slug: oldSlug }, select: { id: true } });
  if (live) return null;
  const target = await db.country.findUnique({
    where: { id: redirect.countryId },
    select: { slug: true },
  });
  return target?.slug && target.slug !== oldSlug ? target.slug : null;
}
