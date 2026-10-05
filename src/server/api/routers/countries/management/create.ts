/**
 * Country Management — Create Procedure
 *
 * Handles creation of new player countries from the Country Builder,
 * including foundation templates, archetypes, and initial sub-system setup.
 */

import type { Country, EconomicArchetype, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { rateLimitedMutationProcedure } from "~/server/api/trpc";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";
import { invalidateCache, globalCache } from "~/lib/cache";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { getBonusConfig, grantBonus, NEW_PLAYER_BONUS_SOURCE } from "~/lib/vault/vault-bonus";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { ActivityHooks } from "~/lib/activity/hooks";
import { IxTime } from "~/lib/ixtime";
import { generateSlug } from "~/lib/utils/slug-utils";
import {
  countryEconomicInputsSchema,
  countryGovernmentComponentSchema,
  countryTaxSystemInputSchema,
  countryGovernmentStructureInputSchema,
  countryEconomyBuilderStateSchema,
} from "~/server/shared/country-payload-builder";
import {
  syncNationalIdentity,
  syncDemographics,
  syncIncomeAndSpending,
  syncTaxSystem,
  syncGovernmentStructure,
  syncGovernmentComponents,
  syncEconomyBuilderState,
} from "~/server/shared/country-mutation-helpers";
import {
  assignNation,
  BuilderRealmError,
  DEFAULT_REALM_ID,
  NationOwnershipError,
  pointActiveNation,
  resolveBuilderRealm,
} from "~/server/modules/realms";
import { pct, type EconInputs, type NumberKey } from "./shared";

const BUILDER_REALM_ERROR_CODES = {
  REALM_NOT_FOUND: "NOT_FOUND",
  REALM_CLOSED: "FORBIDDEN",
  CAP_REACHED: "CONFLICT",
} as const;

function builderRealmError(error: Error): never {
  if (error instanceof BuilderRealmError) {
    throw new TRPCError({ code: BUILDER_REALM_ERROR_CODES[error.code], message: error.message });
  }
  throw error;
}

type TaxInput = z.infer<typeof countryTaxSystemInputSchema>;
type GovernmentStructureInput = z.infer<typeof countryGovernmentStructureInputSchema>;
type GovernmentComponentInput = z.infer<typeof countryGovernmentComponentSchema>;
type EconomyBuilderInput = z.infer<typeof countryEconomyBuilderStateSchema>;

/** The sub-system payloads a nation is founded with; an archetype fills whichever the builder left empty. */
interface FoundingPayload {
  taxSystemData: TaxInput | null | undefined;
  governmentStructure: GovernmentStructureInput | null | undefined;
  governmentComponents: GovernmentComponentInput[];
  economyBuilderState: EconomyBuilderInput | null | undefined;
}

interface Baseline {
  population: number;
  gdpPerCapita: number;
  nominalGDP: number;
}

type Fallback = number | ((base: Baseline) => number);
type Getter = (e: EconInputs, taxRate: number | undefined) => number | undefined;

/** Numeric columns where a missing or zero input falls back to a default. */
const ZERO_FALLBACK_FIELDS: ReadonlyArray<readonly [NumberKey, Getter, Fallback]> = [
  ["currencyExchangeRate", (e) => e.coreIndicators?.currencyExchangeRate, 1],
  ["laborForceParticipationRate", (e) => e.laborEmployment?.laborForceParticipationRate, 65],
  ["employmentRate", (e) => e.laborEmployment?.employmentRate, 95],
  ["unemploymentRate", (e) => e.laborEmployment?.unemploymentRate, 5],
  ["averageWorkweekHours", (e) => e.laborEmployment?.averageWorkweekHours, 40],
  ["minimumWage", (e) => e.laborEmployment?.minimumWage, 15],
  [
    "averageAnnualIncome",
    (e) => e.laborEmployment?.averageAnnualIncome,
    (b) => b.gdpPerCapita * 0.8,
  ],
  ["taxRevenueGDPPercent", (e, taxRate) => e.fiscalSystem?.taxRevenueGDPPercent || taxRate, 25],
  [
    "governmentRevenueTotal",
    (e) => e.fiscalSystem?.governmentRevenueTotal,
    (b) => b.nominalGDP * 0.25,
  ],
  [
    "taxRevenuePerCapita",
    (e) => e.fiscalSystem?.taxRevenuePerCapita,
    (b) => (b.nominalGDP * 0.25) / b.population,
  ],
  ["governmentBudgetGDPPercent", (e) => e.fiscalSystem?.governmentBudgetGDPPercent, 25],
  ["budgetDeficitSurplus", (e) => e.fiscalSystem?.budgetDeficitSurplus, 0],
  ["internalDebtGDPPercent", (e) => e.fiscalSystem?.internalDebtGDPPercent, 30],
  ["externalDebtGDPPercent", (e) => e.fiscalSystem?.externalDebtGDPPercent, 20],
  ["totalDebtGDPRatio", (e) => e.fiscalSystem?.totalDebtGDPRatio, 50],
  [
    "debtPerCapita",
    (e) => e.fiscalSystem?.debtPerCapita,
    (b) => (b.nominalGDP * 0.5) / b.population,
  ],
  ["interestRates", (e) => e.fiscalSystem?.interestRates, 3.5],
  ["debtServiceCosts", (e) => e.fiscalSystem?.debtServiceCosts, (b) => b.nominalGDP * 0.02],
  ["povertyRate", (e) => e.incomeWealth?.povertyRate, 12],
  [
    "incomeInequalityGini",
    (e) =>
      e.incomeWealth?.incomeInequalityGini ||
      (e.incomeWealth?.giniIndex ? e.incomeWealth.giniIndex / 100 : undefined),
    0.35,
  ],
  ["socialMobilityIndex", (e) => e.incomeWealth?.socialMobilityIndex, 65],
  [
    "totalGovernmentSpending",
    (e) => e.governmentSpending?.totalSpending,
    (b) => b.nominalGDP * 0.22,
  ],
  ["spendingGDPPercent", (e) => e.governmentSpending?.spendingGDPPercent, 22],
  [
    "spendingPerCapita",
    (e) => e.governmentSpending?.spendingPerCapita,
    (b) => (b.nominalGDP * 0.22) / b.population,
  ],
  ["lifeExpectancy", (e) => e.demographics?.lifeExpectancy, 78.5],
  ["urbanPopulationPercent", (e) => e.demographics?.urbanRuralSplit?.urban, 65],
  ["ruralPopulationPercent", (e) => e.demographics?.urbanRuralSplit?.rural, 35],
  ["literacyRate", (e) => e.demographics?.literacyRate, 95],
];

/** Growth and inflation inputs arrive as percents; only an absent value (not 0) takes the default. */
const RATE_FIELDS: ReadonlyArray<readonly [NumberKey, Getter, number]> = [
  ["adjustedGdpGrowth", (e) => pct(e.coreIndicators?.realGDPGrowthRate), 0.025],
  ["actualGdpGrowth", (e) => pct(e.coreIndicators?.realGDPGrowthRate), 0.025],
  ["realGDPGrowthRate", (e) => pct(e.coreIndicators?.realGDPGrowthRate), 0.025],
  ["populationGrowthRate", (e) => pct(e.demographics?.populationGrowthRate), 0.008],
  ["inflationRate", (e) => pct(e.coreIndicators?.inflationRate), 0.02],
];

function buildCountryNumbers(econ: EconInputs, taxRate: number | undefined, base: Baseline) {
  const resolve = (fallback: Fallback) =>
    typeof fallback === "function" ? fallback(base) : fallback;
  return Object.fromEntries([
    ...ZERO_FALLBACK_FIELDS.map(([key, get, fallback]) => [
      key,
      get(econ, taxRate) || resolve(fallback),
    ]),
    ...RATE_FIELDS.map(([key, get, fallback]) => [key, get(econ, taxRate) ?? fallback]),
  ]) as Record<NumberKey, number>;
}

/** Foundations are IxWorld nations; names repeat across realms (ruling E-p). */
function findFoundation(db: PrismaClient, ref: string) {
  return db.country.findFirst({
    where: { realmId: DEFAULT_REALM_ID, OR: [{ slug: ref }, { name: ref }] },
  });
}

async function findArchetype(db: PrismaClient, idOrKey: string) {
  return (
    (await db.economicArchetype.findUnique({ where: { id: idOrKey } })) ??
    (await db.economicArchetype.findFirst({ where: { key: idOrKey } }))
  );
}

function parseArchetypeJson<T>(raw: string, field: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Failed to parse archetype ${field}:`, e);
    return null;
  }
}

/** Archetype row; `economicStructure` / `economicModel` are optional extras the schema does not store. */
type ArchetypeWithEconomy = EconomicArchetype & {
  economicStructure?: string | null;
  economicModel?: string | null;
};

function archetypeTaxSystem(archetype: EconomicArchetype): TaxInput | undefined {
  const profile = parseArchetypeJson<{
    incomeRate?: number;
    corporateRate?: number;
    consumptionRate?: number;
  }>(archetype.taxProfile, "taxProfile");
  if (!profile) return undefined;
  const incomeRate = profile.incomeRate || 15;
  const rated = (categoryName: string, categoryType: string, baseRate: number) => ({
    categoryName,
    categoryType,
    baseRate,
    isActive: true,
  });
  return {
    taxSystemName: `${archetype.name} Tax System`,
    taxAuthority: "Ministry of Finance",
    progressiveTax: true,
    baseRate: incomeRate,
    categories: [
      {
        ...rated("Income Tax", "income", incomeRate),
        brackets: [
          {
            bracketName: "Base Bracket",
            minIncome: 0,
            maxIncome: null,
            rate: incomeRate,
            isActive: true,
          },
        ],
      },
      rated("Corporate Tax", "corporate", profile.corporateRate || 20),
      rated("Consumption Tax", "consumption", profile.consumptionRate || 10),
    ],
  };
}

const DEFAULT_DEPARTMENTS = [
  ["Ministry of Finance", "finance"],
  ["Ministry of Interior", "interior"],
  ["Ministry of Foreign Affairs", "foreign"],
  ["Ministry of Defense", "defense"],
  ["Ministry of Justice", "justice"],
] as const;

function archetypeEconomyState(
  archetype: ArchetypeWithEconomy,
  base: Baseline
): EconomyBuilderInput | undefined {
  if (!archetype.economicStructure) return undefined;
  const parsed = parseArchetypeJson<{
    tradeOpenness?: number;
    economicFreedom?: number;
    sectors?: EconomyBuilderInput["sectors"];
    selectedAtomicComponents?: string[];
  }>(archetype.economicStructure, "economicStructure");
  if (!parsed) return undefined;
  return {
    structure: {
      economicModel: archetype.economicModel || "Social Market",
      economicTier: "Developed",
      totalGDP: base.nominalGDP,
      gdpPerCapita: base.gdpPerCapita,
      population: base.population,
      tradeOpenness: parsed.tradeOpenness || 60,
      economicFreedom: parsed.economicFreedom || 70,
      creditRating: "AA",
      fdi: base.nominalGDP * 0.03,
      foreignReserves: base.nominalGDP * 0.15,
    },
    sectors: parsed.sectors || [],
    selectedAtomicComponents: parsed.selectedAtomicComponents || [],
  };
}

function archetypeComponents(archetype: EconomicArchetype): GovernmentComponentInput[] {
  const types = parseArchetypeJson<string[]>(
    archetype.governmentComponents,
    "governmentComponents"
  );
  return Array.isArray(types)
    ? types.map((componentType) => ({ componentType, effectivenessScore: 60, isActive: true }))
    : [];
}

/** Fills the sub-system payloads the builder left empty from the chosen archetype. */
function withArchetypeDefaults(
  archetype: ArchetypeWithEconomy,
  payload: FoundingPayload,
  name: string,
  base: Baseline
): FoundingPayload {
  const taxSystemData =
    !payload.taxSystemData && archetype.taxProfile
      ? (archetypeTaxSystem(archetype) ?? payload.taxSystemData)
      : payload.taxSystemData;
  const economyBuilderState =
    !payload.economyBuilderState && archetype.economicStructure
      ? (archetypeEconomyState(archetype, base) ?? payload.economyBuilderState)
      : payload.economyBuilderState;
  const governmentStructure = payload.governmentStructure ?? {
    governmentName: `Government of ${name}`,
    governmentType: archetype.name || "Constitutional Republic",
    totalBudget: base.nominalGDP * 0.3,
    fiscalYear: "Calendar Year",
    budgetCurrency: "USD",
    departments: DEFAULT_DEPARTMENTS.map(([deptName, category]) => ({
      name: deptName,
      category,
      isActive: true,
    })),
  };
  const governmentComponents =
    payload.governmentComponents.length === 0 && archetype.governmentComponents
      ? archetypeComponents(archetype)
      : payload.governmentComponents;
  return { taxSystemData, governmentStructure, governmentComponents, economyBuilderState };
}

async function uniqueCountrySlug(db: PrismaClient, name: string): Promise<string> {
  const baseSlug = generateSlug(name) || "country";
  let slug = baseSlug;
  for (let n = 2; await db.country.findUnique({ where: { slug }, select: { id: true } }); n++) {
    slug = `${baseSlug}-${n}`;
  }
  return slug;
}

interface CountryDataArgs {
  name: string;
  slug: string;
  realmId: string;
  econ: EconInputs;
  foundation: Country | null;
  base: Baseline;
  taxRate: number | undefined;
  structureType: string | undefined;
}

function buildCountryText(
  econ: EconInputs,
  foundation: Country | null,
  structureType: string | undefined
) {
  const identity = econ.nationalIdentity;
  return {
    continent: econ.geography?.continent || foundation?.continent || "Custom",
    region: econ.geography?.region || foundation?.region || "Custom",
    governmentType: identity?.governmentType || structureType || "Federal Republic",
    religion: identity?.nationalReligion || "Secular",
    leader: identity?.leader || "President",
    flag: econ.flagUrl || foundation?.flag || undefined,
    coatOfArms: econ.coatOfArmsUrl || foundation?.coatOfArms || undefined,
  };
}

function buildCountryData(args: CountryDataArgs) {
  const { econ, foundation, base } = args;
  const { population, gdpPerCapita } = base;
  const totalGdp = population * gdpPerCapita;
  const landArea = foundation?.landArea;
  return {
    ...buildCountryNumbers(econ, args.taxRate, base),
    name: args.name,
    slug: args.slug,
    realmId: args.realmId,
    ...buildCountryText(econ, foundation, args.structureType),
    landArea,
    areaSqMi: foundation?.areaSqMi,
    baselinePopulation: population,
    baselineGdpPerCapita: gdpPerCapita,
    currentPopulation: population,
    currentGdpPerCapita: gdpPerCapita,
    currentTotalGdp: totalGdp,
    economicTier: getEconomicTierFromGdpPerCapita(gdpPerCapita),
    populationTier: getPopulationTierFromPopulation(population),
    nominalGDP: base.nominalGDP,
    maxGdpGrowthRate: 0.15,
    totalWorkforce: econ.laborEmployment?.totalWorkforce || Math.round(population * 0.65),
    populationDensity: landArea ? population / landArea : undefined,
    gdpDensity: landArea ? totalGdp / landArea : undefined,
  };
}

async function ensureDefaultRole(
  db: PrismaClient,
  player: { roleId: string | null },
  userId: string
) {
  if (player.roleId) return;
  const defaultRole = await db.role.findFirst({ where: { name: "user" } });
  if (defaultRole) {
    await db.user.update({ where: { clerkUserId: userId }, data: { roleId: defaultRole.id } });
  }
}

/** One-time onboarding bonuses (a no-op if the account was already paid at sign-up); never fails the build. */
async function grantOnboardingBonuses(
  db: PrismaClient,
  userId: string,
  country: { id: string; name: string },
  foundationRef: string | null
) {
  try {
    const bcfg = await getBonusConfig(db);
    const countryMeta = { countryId: country.id, countryName: country.name };
    await grantBonus(db, userId, NEW_PLAYER_BONUS_SOURCE, bcfg.newPlayer, {
      oneTime: true,
      metadata: countryMeta,
    });
    if (foundationRef) {
      await grantBonus(db, userId, "bonus:wiki_import", bcfg.wikiImport, {
        oneTime: true,
        metadata: { ...countryMeta, foundation: foundationRef },
      });
    }
  } catch (bonusError) {
    console.error("[createCountry] Failed to grant onboarding bonus:", bonusError);
  }
}

async function prepareFounding(db: PrismaClient, input: CreateCountryInput) {
  const foundation = input.foundationCountry
    ? await findFoundation(db, input.foundationCountry)
    : null;
  const archetype = input.archetypeId ? await findArchetype(db, input.archetypeId) : null;

  const econ: EconInputs = input.economicInputs ?? {};
  const population =
    econ.coreIndicators?.totalPopulation || foundation?.baselinePopulation || 10000000;
  const gdpPerCapita =
    econ.coreIndicators?.gdpPerCapita || foundation?.baselineGdpPerCapita || 25000;
  const base: Baseline = {
    population,
    gdpPerCapita,
    nominalGDP: econ.coreIndicators?.nominalGDP || population * gdpPerCapita,
  };

  const submitted: FoundingPayload = {
    taxSystemData: input.taxSystemData,
    governmentStructure: input.governmentStructure,
    governmentComponents: input.governmentComponents ?? [],
    economyBuilderState: input.economyBuilderState,
  };
  const payload = archetype
    ? withArchetypeDefaults(archetype, submitted, input.name, base)
    : submitted;
  return { foundation, econ, base, payload };
}

const createCountryInput = z.object({
  name: z.string(),
  foundationCountry: z.string().nullable(),
  economicInputs: countryEconomicInputsSchema,
  governmentComponents: z.array(countryGovernmentComponentSchema).optional(),
  taxSystemData: countryTaxSystemInputSchema.nullish(),
  governmentStructure: countryGovernmentStructureInputSchema.nullish(),
  economyBuilderState: countryEconomyBuilderStateSchema.nullish(),
  archetypeId: z.string().optional(),
  /** Realm to found the nation in; defaults to the realm of the nation the player acts as, else IxWorld. */
  realmId: z.string().min(1).max(100).optional(),
});
type CreateCountryInput = z.infer<typeof createCountryInput>;

export const managementCreateProcedures = {
  // Create a new country from builder
  createCountry: rateLimitedMutationProcedure
    .input(createCountryInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const player = await ctx.db.user.findUnique({
        where: { clerkUserId: userId },
        include: { role: true },
      });
      if (!player) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User account not found" });
      }

      // The target realm (input, else the realm of the nation the player acts as, else IxWorld), open and
      // under the player's nation cap there — a player at the cap gets a clear refusal, never their old nation.
      const { realmId } = await resolveBuilderRealm(
        ctx.db,
        { id: player.id, clerkUserId: userId },
        input.realmId
      ).catch(builderRealmError);
      const nameTaken = await ctx.db.country.findFirst({
        where: { realmId, name: input.name },
        select: { id: true },
      });
      if (nameTaken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A country named "${input.name}" already exists in this realm`,
        });
      }

      await ensureDefaultRole(ctx.db, player, userId);

      const { foundation, econ, base, payload } = await prepareFounding(ctx.db, input);
      const { taxSystemData, governmentStructure, governmentComponents, economyBuilderState } =
        payload;

      const slug = await uniqueCountrySlug(ctx.db, input.name);
      const { nationalIdentity, demographics, incomeWealth, governmentSpending, fiscalSystem } = {
        nationalIdentity: econ.nationalIdentity ?? {},
        demographics: econ.demographics ?? {},
        incomeWealth: econ.incomeWealth ?? {},
        governmentSpending: econ.governmentSpending ?? {},
        fiscalSystem: econ.fiscalSystem ?? {},
      };

      try {
        const result = await ctx.db.$transaction(async (tx) => {
          const ixNow = new Date(IxTime.getCurrentIxTime());
          const country = await tx.country.create({
            data: {
              ...buildCountryData({
                name: input.name,
                slug,
                realmId,
                econ,
                foundation,
                base,
                taxRate: taxSystemData?.totalTaxRate,
                structureType: governmentStructure?.governmentType,
              }),
              baselineDate: ixNow,
              lastCalculated: ixNow,
            },
          });

          await syncNationalIdentity(tx, country.id, input.name, nationalIdentity);
          await syncDemographics(tx, country.id, demographics);
          await syncIncomeAndSpending(
            tx,
            country.id,
            incomeWealth,
            governmentSpending,
            fiscalSystem
          );
          await syncTaxSystem(tx, country.id, taxSystemData);
          await syncGovernmentStructure(tx, country.id, input.name, governmentStructure);
          await syncGovernmentComponents(tx, country.id, governmentComponents);
          await syncEconomyBuilderState(tx, country.id, economyBuilderState);

          // assignNation re-checks the cap inside the transaction (a concurrent build or claim may have
          // filled it). The nation just built becomes the one the player acts as, so /mycountry shows it.
          await assignNation(tx, { userId: player.id, countryId: country.id });
          await pointActiveNation(tx, player.id, country.id);

          return country;
        });

        await invalidateCache(["countries.getAll"]);
        clearLayerCache("political");
        await globalCache.delete(`user_profile:${userId}`);

        await grantOnboardingBonuses(ctx.db, userId, result, input.foundationCountry);
        queueAchievementCheck(userId, result.id);
        void ActivityHooks.User.onCountryLink(userId, result.id, true);

        return result;
      } catch (error) {
        console.error("[createCountry] Transaction failed:", error);
        if (error instanceof NationOwnershipError && error.code === "CAP_REACHED") {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        throw new Error(
          `Failed to create country: ${error instanceof Error ? error.message : "Unknown error"}`,
          { cause: error }
        );
      }
    }),
};
