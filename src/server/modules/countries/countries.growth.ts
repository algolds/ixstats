/**
 * Site admins: set one country's growth fields (population growth, adjusted GDP growth, max GDP growth, local
 * growth factor) from /admin/countries. Only changed fields are written, with the change in `AdminAuditLog`.
 * The stat progression cron projects from the new rates on its next run.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  COUNTRY_GROWTH_FIELDS,
  type CountryGrowth,
  type CountryGrowthField,
} from "~/lib/countries/country-growth";

type GrowthDb = Pick<PrismaClient, "country" | "adminAuditLog" | "$transaction">;

/** `AdminAuditLog.action` of a country growth edit; `changes` holds the changed fields, from and to. */
export const COUNTRY_GROWTH_UPDATED_ACTION = "COUNTRY_GROWTH_UPDATED";

const GROWTH_SELECT = {
  id: true,
  name: true,
  populationGrowthRate: true,
  adjustedGdpGrowth: true,
  maxGdpGrowthRate: true,
  localGrowthFactor: true,
} satisfies Prisma.CountrySelect;

type GrowthValues = Partial<Record<CountryGrowthField, number>>;

export async function updateCountryGrowth(
  db: GrowthDb,
  admin: { id: string; clerkUserId: string },
  input: { countryId: string; growth: CountryGrowth }
) {
  const country = await db.country.findUnique({
    where: { id: input.countryId },
    select: GROWTH_SELECT,
  });
  if (!country) return null;
  const from: GrowthValues = {};
  const to: GrowthValues = {};
  for (const field of COUNTRY_GROWTH_FIELDS) {
    const next = input.growth[field];
    if (next === undefined || next === country[field]) continue;
    from[field] = country[field];
    to[field] = next;
  }
  if (Object.keys(to).length === 0) return { updated: false, country };
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.country.update({
      where: { id: country.id },
      data: to,
      select: GROWTH_SELECT,
    });
    await tx.adminAuditLog.create({
      data: {
        action: COUNTRY_GROWTH_UPDATED_ACTION,
        targetType: "country",
        targetId: country.id,
        targetName: country.name,
        changes: JSON.stringify({ from, to }),
        adminId: admin.id,
        adminName: admin.clerkUserId,
      },
    });
    return row;
  });
  return { updated: true, country: updated };
}
