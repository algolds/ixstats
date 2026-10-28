/**
 * Site admins: set one country's growth fields (population growth, adjusted GDP growth, max GDP growth, local
 * growth factor) from /admin/countries. Only changed fields are written, with the change in `AdminAuditLog`.
 *
 * A rate is compounded from the baseline, so changing it alone would rewrite the projection all the way back to the
 * baseline (2040 for most nations). The edit rebases first: the figures the old rates reach today (growth only; level
 * effects keep applying on top) become the baseline, dated now on the nation's clock, and the new rates run from the
 * next IxTime day (owner ruling 2026-10-28).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import { LEVEL_EFFECT_TYPES } from "~/lib/economy/storyteller-effects";
import { StorytellerEffectType } from "~/lib/economy/calculations";
import { projectCountryStats } from "~/server/shared/country-helpers";
import { clockForCountry } from "~/server/shared/realm-time";
import {
  COUNTRY_GROWTH_FIELDS,
  type CountryGrowth,
  type CountryGrowthField,
} from "~/lib/countries/country-growth";

type GrowthDb = Pick<
  PrismaClient,
  "country" | "adminAuditLog" | "$transaction" | "realm" | "systemConfig"
>;

/** Effects that sit on top of the growth path (applied after it), so a rebase leaves them out. */
const ON_TOP_EFFECT_TYPES: ReadonlySet<string> = new Set([
  ...LEVEL_EFFECT_TYPES,
  StorytellerEffectType.NATURAL_DISASTER,
  StorytellerEffectType.SPECIAL_EVENT,
]);

/** The baseline columns that carry the nation's growth path to now, so a new rate starts from today. */
async function rebaseAtNow(db: GrowthDb, countryId: string) {
  const country = await db.country.findUniqueOrThrow({
    where: { id: countryId },
    include: { storytellerEffects: { where: { isActive: true } } },
  });
  const now = (await clockForCountry(db, country)).now();
  const growthOnly = country.storytellerEffects.filter(
    (e) => !ON_TOP_EFFECT_TYPES.has(e.inputType.toLowerCase())
  );
  const stats = projectCountryStats(
    { ...country, storytellerEffects: growthOnly },
    undefined,
    await getEconomicConfigFromDB(db),
    now
  );
  return {
    baselinePopulation: stats.currentPopulation,
    baselineGdpPerCapita: stats.currentGdpPerCapita,
    baselineDate: new Date(now),
  };
}

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
  const rebase = await rebaseAtNow(db, country.id);
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.country.update({
      where: { id: country.id },
      data: { ...to, ...rebase },
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
