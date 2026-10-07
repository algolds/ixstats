/**
 * Claiming a nation that already exists unclaimed (a realm's source sync creates every nation up front, with
 * `ownerUserId` null). Approval hands the existing Country over instead of creating one, and the nation's wiki
 * infobox (AT-3) then fills only what is still empty: flag, coat of arms, leader and national identity fields.
 * The figures the sync set (population, GDP per capita, land area) are never replaced by the infobox.
 */
import type { Prisma } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import type { NationPagePrefill } from "./realms.prefill";

type HandOverTx = Pick<Prisma.TransactionClient, "country" | "nationalIdentity" | "mapLayer">;

/**
 * The realm's unclaimed Country carrying a nation page's title (country names are unique per realm, and the sync
 * names a roster nation after its page), or null when there is none or it already has an owner.
 */
export async function findUnclaimedNation(
  tx: Pick<Prisma.TransactionClient, "country">,
  realmId: string,
  title: string
): Promise<{ id: string; name: string } | null> {
  const country = await tx.country.findFirst({
    where: { realmId, name: title },
    select: { id: true, name: true, ownerUserId: true },
  });
  return country && country.ownerUserId === null ? { id: country.id, name: country.name } : null;
}

/**
 * The wiki page an existing nation's claim reads its infobox from: only outside IxWorld (an IxWorld country's
 * claim never read one), and only for a nation with a page.
 */
export function existingNationPage(country: {
  realmId?: string | null;
  wikiSource?: string | null;
  wikiPageTitle?: string | null;
}): { wikiSource: string; title: string } | null {
  if (!country.realmId || country.realmId === DEFAULT_REALM_ID) return null;
  if (!country.wikiSource || !country.wikiPageTitle) return null;
  return { wikiSource: country.wikiSource, title: country.wikiPageTitle };
}

const blank = (value: string | null | undefined) => !value || !value.trim();

/** Fill the handed-over nation's empty fields from its infobox; anything already set stays. */
export async function fillEmptyFromPrefill(
  tx: HandOverTx,
  countryId: string,
  prefill: NationPagePrefill | null
): Promise<void> {
  if (!prefill) return;
  const country = await tx.country.findUnique({
    where: { id: countryId },
    select: {
      name: true,
      flag: true,
      coatOfArms: true,
      leader: true,
      governmentType: true,
      nationalIdentity: true,
    },
  });
  if (!country) return;
  const { flag, coatOfArms, leader, government } = prefill.country;
  const data: Prisma.CountryUpdateInput = {
    ...(blank(country.flag) && flag && { flag }),
    ...(blank(country.coatOfArms) && coatOfArms && { coatOfArms }),
    ...(blank(country.leader) && leader && { leader }),
    ...(blank(country.governmentType) && government && { governmentType: government }),
  };
  if (Object.keys(data).length > 0) await tx.country.update({ where: { id: countryId }, data });

  const current = (country.nationalIdentity ?? {}) as Record<string, unknown>;
  const identity = Object.fromEntries(
    Object.entries(prefill.identity).filter(
      ([field, value]) => value && blank(current[field] as string | null | undefined)
    )
  ) as Record<string, string>;
  if (Object.keys(identity).length === 0) return;
  if (country.nationalIdentity) {
    await tx.nationalIdentity.update({ where: { countryId }, data: identity });
  } else {
    await tx.nationalIdentity.create({ data: { countryId, countryName: country.name, ...identity } });
  }
}

/** Whether the nation already holds a political region of its realm's map (the sync links its border). */
export async function hasMapRegion(
  tx: Pick<Prisma.TransactionClient, "mapLayer">,
  countryId: string
): Promise<boolean> {
  return !!(await tx.mapLayer.findFirst({
    where: { countryId, layerType: "political", isActive: true },
    select: { id: true },
  }));
}
