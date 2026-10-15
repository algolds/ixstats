/**
 * Country Management — Create Procedure
 *
 * Handles creation of new player countries from the Country Builder,
 * including foundation templates, archetypes, and initial sub-system setup.
 */

import type { Country, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { rateLimitedMutationProcedure, readOnlyProcedure } from "~/server/api/trpc";
import { invalidateCache, globalCache } from "~/lib/cache";
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
import {
  computeFoundingSnapshot,
  FOUNDING_MAX_GDP_GROWTH,
  type FoundingSnapshot,
  type FoundingSummary,
} from "~/server/shared/founding-snapshot";
import { POPULATION_BAND_IDS, WEALTH_BAND_IDS } from "~/lib/builder/founding-bands";
import type { EconInputs } from "./shared";

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

/** Foundations are Ixnay nations; names repeat across realms (ruling E-p). */
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
  snapshot: FoundingSnapshot;
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
  const { econ, foundation, snapshot } = args;
  const { population, gdpPerCapita, nominalGDP } = snapshot.base;
  const totalGdp = population * gdpPerCapita;
  const landArea = foundation?.landArea;
  return {
    ...snapshot.numbers,
    name: args.name,
    slug: args.slug,
    realmId: args.realmId,
    ...buildCountryText(econ, foundation, snapshot.governmentStructure.governmentType),
    landArea,
    areaSqMi: foundation?.areaSqMi,
    baselinePopulation: population,
    baselineGdpPerCapita: gdpPerCapita,
    currentPopulation: population,
    currentGdpPerCapita: gdpPerCapita,
    currentTotalGdp: totalGdp,
    economicTier: snapshot.economicTier,
    populationTier: snapshot.populationTier,
    nominalGDP,
    maxGdpGrowthRate: FOUNDING_MAX_GDP_GROWTH,
    totalWorkforce: snapshot.totalWorkforce,
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

/** The founding fields createCountry and previewFounding share (nothing here needs a write). */
const foundingFields = {
  economicInputs: countryEconomicInputsSchema,
  governmentComponents: z.array(countryGovernmentComponentSchema).optional(),
  taxSystemData: countryTaxSystemInputSchema.nullish(),
  governmentStructure: countryGovernmentStructureInputSchema.nullish(),
  economyBuilderState: countryEconomyBuilderStateSchema.nullish(),
  archetypeId: z.string().optional(),
  /** A government form id (`src/lib/government/form-departments.ts`); sets type and departments. */
  governmentFormId: z.string().max(64).optional(),
  /** Size and wealth bands; an exact figure in `economicInputs.coreIndicators` wins. */
  populationBand: z.enum(POPULATION_BAND_IDS).optional(),
  wealthBand: z.enum(WEALTH_BAND_IDS).optional(),
};

const createCountryInput = z.object({
  name: z.string(),
  foundationCountry: z.string().nullable(),
  ...foundingFields,
  /** Realm to found the nation in; defaults to the realm of the nation the player acts as, else Ixnay. */
  realmId: z.string().min(1).max(100).optional(),
});
type CreateCountryInput = z.infer<typeof createCountryInput>;

export const previewFoundingInput = z.object({
  name: z.string().max(200).optional(),
  foundationCountry: z.string().nullish(),
  ...foundingFields,
});
export type PreviewFoundingInput = z.infer<typeof previewFoundingInput>;

type FoundingInput = Omit<CreateCountryInput, "realmId" | "foundationCountry"> & {
  foundationCountry?: string | null;
};

/** Reads the foundation and archetype, then computes everything the nation is founded with. */
async function prepareFounding(db: PrismaClient, input: FoundingInput) {
  const foundation = input.foundationCountry
    ? await findFoundation(db, input.foundationCountry)
    : null;
  const archetype = input.archetypeId ? await findArchetype(db, input.archetypeId) : null;
  const econ: EconInputs = input.economicInputs ?? {};
  const snapshot = computeFoundingSnapshot({
    name: input.name,
    archetype,
    foundation,
    econ,
    populationBand: input.populationBand,
    wealthBand: input.wealthBand,
    governmentFormId: input.governmentFormId,
    governmentComponents: input.governmentComponents,
    taxSystemData: input.taxSystemData,
    governmentStructure: input.governmentStructure,
    economyBuilderState: input.economyBuilderState,
  });
  return { foundation, econ, snapshot };
}

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

      // The target realm (input, else the realm of the nation the player acts as, else Ixnay), open and
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
      // A nation page of the realm's lore index is taken by claiming it (ruling E-f), which checks wiki
      // authorship and prefills the nation from the page; the builder must not found it around the claim.
      const nationPage = await ctx.db.realmPage.findFirst({
        where: { realmId, kind: "nation", title: { equals: input.name, mode: "insensitive" } },
        select: { title: true },
      });
      if (nationPage) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${nationPage.title}" is a nation of this realm's lore: claim it on the realm page`,
        });
      }

      await ensureDefaultRole(ctx.db, player, userId);

      const { foundation, econ, snapshot } = await prepareFounding(ctx.db, input);
      const { taxSystemData, governmentStructure, governmentComponents, economyBuilderState } =
        snapshot;

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
                snapshot,
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
        await globalCache.delete(`user_profile:${userId}`);

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

  /**
   * The live nation card's figures for a founding draft: the same preparation createCountry
   * runs (archetype and foundation lookup, then computeFoundingSnapshot), with nothing written.
   */
  previewFounding: readOnlyProcedure
    .input(previewFoundingInput)
    .query(async ({ ctx, input }): Promise<FoundingSummary> => {
      const { snapshot } = await prepareFounding(ctx.db, {
        ...input,
        name: input.name?.trim() || "New nation",
      });
      return snapshot.summary;
    }),
};
