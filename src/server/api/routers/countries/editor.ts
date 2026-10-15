/**
 * The country editor's reads and saves (`/mycountry/editor`). One mutation per section, each
 * patching only the rows and columns that section names, and each refusing when the nation
 * changed since the page loaded it (`expectedUpdatedAt` against `Country.updatedAt`), so a stale
 * tab can never overwrite newer work. Every save returns the new `updatedAt` for the next one.
 */

import { ComponentType, type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { IxTime } from "~/lib/ixtime";
import { globalCache, invalidateCache } from "~/lib/cache";
import { getComponentGroup } from "~/lib/government/component-guide";
import { isRealmImageUrl } from "~/lib/realms/realm-region";
import {
  EDITOR_IDENTITY_KEYS,
  GDP_PER_CAPITA_LIMITS,
  identityFieldError,
  MAX_DEFINED_COMPONENTS,
  POPULATION_LIMITS,
  STALE_EDITOR_MESSAGE,
  type EditorIdentityKey,
} from "~/lib/mycountry/editor-fields";
import { rateLimitedMutationProcedure, readOnlyProcedure } from "~/server/api/trpc";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { syncGovernmentComponents } from "~/server/shared/country-mutation-helpers";
import {
  checkCountryName,
  MAX_COUNTRY_NAME_LENGTH,
  renameCountryInTx,
} from "~/server/shared/country-rename";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/types/ixstats";

type Tx = Prisma.TransactionClient;

const versioned = z.object({ countryId: z.string().min(1), expectedUpdatedAt: z.date() });

/**
 * Claims the country's version: moves `updatedAt` to now only when it still equals what the page
 * loaded, in one conditional write. Anything else (another tab saved, the server recalculated)
 * refuses the save with CONFLICT.
 */
async function claimVersion(
  tx: Pick<Tx, "country">,
  countryId: string,
  expectedUpdatedAt: Date,
  data: Prisma.CountryUpdateManyMutationInput = {}
): Promise<Date> {
  const updatedAt = new Date();
  const { count } = await tx.country.updateMany({
    where: { id: countryId, updatedAt: expectedUpdatedAt },
    data: { ...data, updatedAt },
  });
  if (count === 0) throw new TRPCError({ code: "CONFLICT", message: STALE_EDITOR_MESSAGE });
  return updatedAt;
}

async function afterSave(userId: string | null | undefined) {
  await invalidateCache(["countries."]);
  if (userId) await globalCache.delete(`user_profile:${userId}`);
}

const optionalText = z.string().max(400).nullable().optional();
const imageUrl = z
  .string()
  .max(2000)
  .nullable()
  .optional()
  .refine((v) => v == null || isRealmImageUrl(v), {
    message: "Use an https:// image address, an uploaded image or one from the repository.",
  });

const identityPatch = z
  .object(
    Object.fromEntries(EDITOR_IDENTITY_KEYS.map((key) => [key, optionalText])) as Record<
      EditorIdentityKey,
      typeof optionalText
    >
  )
  .strict()
  .superRefine((patch, ctx) => {
    for (const [key, value] of Object.entries(patch)) {
      const error = value ? identityFieldError(key as EditorIdentityKey, value) : null;
      if (error) ctx.addIssue({ code: "custom", path: [key], message: error });
    }
  });

const institutionName = z.string().trim().max(120).nullable();

/** Empty text clears a field. */
const blankToNull = (value: string | null | undefined) =>
  value == null ? value : value.trim() === "" ? null : value.trim();

export const editorProcedures = {
  /** Everything the editor page shows, with the version its saves are checked against. */
  getEditorState: readOnlyProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          coatOfArms: true,
          realmId: true,
          governmentType: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          updatedAt: true,
          nationalIdentity: {
            select: Object.fromEntries(EDITOR_IDENTITY_KEYS.map((key) => [key, true])) as Record<
              EditorIdentityKey,
              true
            >,
          },
          governmentStructure: {
            select: {
              governmentType: true,
              headOfState: true,
              headOfGovernment: true,
              legislatureName: true,
              executiveName: true,
              judicialName: true,
              governmentEffectiveness: true,
            },
          },
          governmentComponents: {
            select: { componentType: true, effectivenessScore: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Nation not found" });
      return country;
    }),

  /** Whether the nation can take a name: unique in its realm, not a lore nation, has a slug. */
  checkNameAvailable: readOnlyProcedure
    .input(z.object({ countryId: z.string().min(1), name: z.string().max(400) }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, name: true, realmId: true },
      });
      if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Nation not found" });
      return checkCountryName(ctx.db, country, input.name);
    }),

  /** Name: the name, the slug (the old one redirects) and the identity's country name. */
  rename: rateLimitedMutationProcedure
    .input(
      versioned.extend({
        name: z
          .string()
          .min(1)
          .max(MAX_COUNTRY_NAME_LENGTH * 2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, name: true, slug: true, realmId: true },
      });
      if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Nation not found" });
      const check = await checkCountryName(ctx.db, country, input.name);
      if (!check.available) {
        throw new TRPCError({ code: "CONFLICT", message: check.reason ?? "Name not available" });
      }

      const result = await ctx.db.$transaction(async (tx) => {
        const updatedAt = await claimVersion(tx, country.id, input.expectedUpdatedAt);
        const renamed = await renameCountryInTx(tx, country, input.name, { updatedAt });
        return { name: renamed.name, slug: renamed.slug, updatedAt };
      });

      await afterSave(ctx.auth?.userId);
      if (result.name !== country.name) await invalidateRealmMap(ctx.db, country.realmId);
      return result;
    }),

  /** Flag and symbols, capital and language, culture and civic standards. */
  saveIdentity: rateLimitedMutationProcedure
    .input(
      versioned.extend({
        identity: identityPatch,
        flag: imageUrl,
        coatOfArms: imageUrl,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const identity = Object.fromEntries(
        Object.entries(input.identity)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, blankToNull(value)])
      ) as Partial<Record<EditorIdentityKey, string | null>>;

      const countryColumns: Prisma.CountryUpdateManyMutationInput = {};
      if (input.flag !== undefined) countryColumns.flag = blankToNull(input.flag);
      if (input.coatOfArms !== undefined) countryColumns.coatOfArms = blankToNull(input.coatOfArms);
      // The country row keeps a copy of the religion that profiles and filters read.
      if (identity.nationalReligion !== undefined)
        countryColumns.religion = identity.nationalReligion;

      const updatedAt = await ctx.db.$transaction(async (tx) => {
        const claimed = await claimVersion(
          tx,
          input.countryId,
          input.expectedUpdatedAt,
          countryColumns
        );
        if (Object.keys(identity).length > 0) {
          await tx.nationalIdentity.upsert({
            where: { countryId: input.countryId },
            update: identity,
            create: { countryId: input.countryId, ...identity },
          });
        }
        return claimed;
      });

      await afterSave(ctx.auth?.userId);
      return { updatedAt };
    }),

  /** Form and institutions: the government type and the institution names. */
  saveGovernmentForm: rateLimitedMutationProcedure
    .input(
      versioned.extend({
        governmentType: z.string().trim().min(1).max(120),
        headOfState: institutionName,
        headOfGovernment: institutionName,
        legislatureName: institutionName,
        executiveName: institutionName,
        judicialName: institutionName,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const { countryId, expectedUpdatedAt, governmentType, ...names } = input;
      const institutions = Object.fromEntries(
        Object.entries(names).map(([key, value]) => [key, blankToNull(value)])
      ) as Record<keyof typeof names, string | null>;

      const updatedAt = await ctx.db.$transaction(async (tx) => {
        const claimed = await claimVersion(tx, countryId, expectedUpdatedAt, { governmentType });
        const existing = await tx.governmentStructure.findUnique({
          where: { countryId },
          select: { id: true },
        });
        if (existing) {
          await tx.governmentStructure.update({
            where: { countryId },
            data: { governmentType, ...institutions },
          });
        } else {
          const country = await tx.country.findUnique({
            where: { id: countryId },
            select: { name: true },
          });
          await tx.governmentStructure.create({
            data: {
              countryId,
              governmentName: `Government of ${country?.name ?? "the nation"}`,
              governmentType,
              ...institutions,
            },
          });
        }
        // The identity keeps its own copy of the government type; keep it in step when it exists.
        await tx.nationalIdentity.updateMany({ where: { countryId }, data: { governmentType } });
        return claimed;
      });

      await afterSave(ctx.auth?.userId);
      return { updatedAt };
    }),

  /**
   * Institutions (components). A component the nation keeps keeps its row, score and history;
   * synergies and government effectiveness are recalculated from the shared table.
   */
  saveGovernmentComponents: rateLimitedMutationProcedure
    .input(
      versioned.extend({
        componentTypes: z.array(z.nativeEnum(ComponentType)).max(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const types = [...new Set(input.componentTypes)];
      const defined = types.filter((type) => getComponentGroup(type));
      if (defined.length > MAX_DEFINED_COMPONENTS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A government can have up to ${MAX_DEFINED_COMPONENTS} institutions.`,
        });
      }

      const result = await ctx.db.$transaction(async (tx) => {
        const updatedAt = await claimVersion(tx, input.countryId, input.expectedUpdatedAt);
        // Effectiveness is stored on the structure, so the nation needs one.
        const structure = await tx.governmentStructure.findUnique({
          where: { countryId: input.countryId },
          select: { id: true },
        });
        if (!structure) {
          const country = await tx.country.findUnique({
            where: { id: input.countryId },
            select: { name: true, governmentType: true },
          });
          await tx.governmentStructure.create({
            data: {
              countryId: input.countryId,
              governmentName: `Government of ${country?.name ?? "the nation"}`,
              governmentType: country?.governmentType || "Parliamentary Republic",
            },
          });
        }
        await syncGovernmentComponents(
          tx,
          input.countryId,
          types.map((componentType) => ({ componentType }))
        );
        const after = await tx.governmentStructure.findUnique({
          where: { countryId: input.countryId },
          select: { governmentEffectiveness: true },
        });
        return { updatedAt, governmentEffectiveness: after?.governmentEffectiveness ?? null };
      });

      await afterSave(ctx.auth?.userId);
      return result;
    }),

  /**
   * Population and wealth. The figures become the nation's new baseline (dated now), so the
   * stat progression projects forward from them instead of reverting them; the totals that
   * follow from them (total GDP, tiers, densities, workforce) are recalculated.
   */
  saveSize: rateLimitedMutationProcedure
    .input(
      versioned.extend({
        population: z.number().int().min(POPULATION_LIMITS.min).max(POPULATION_LIMITS.max),
        gdpPerCapita: z.number().min(GDP_PER_CAPITA_LIMITS.min).max(GDP_PER_CAPITA_LIMITS.max),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const before = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { currentPopulation: true, totalWorkforce: true, landArea: true },
      });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Nation not found" });

      const updatedAt = await ctx.db.$transaction(async (tx) =>
        claimVersion(
          tx,
          input.countryId,
          input.expectedUpdatedAt,
          sizeColumns(input.population, input.gdpPerCapita, before)
        )
      );

      await afterSave(ctx.auth?.userId);
      return { updatedAt };
    }),
};

/** The Country columns a new population and GDP per capita set. Exported for tests. */
export function sizeColumns(
  population: number,
  gdpPerCapita: number,
  before: { currentPopulation: number; totalWorkforce: number | null; landArea: number | null }
): Prisma.CountryUpdateManyMutationInput {
  const totalGdp = population * gdpPerCapita;
  const ixNow = new Date(IxTime.getCurrentIxTime());
  // The workforce keeps its share of the population; a nation without one gets the usual 65%.
  const workforceShare =
    before.totalWorkforce && before.currentPopulation > 0
      ? before.totalWorkforce / before.currentPopulation
      : 0.65;
  const land = before.landArea && before.landArea > 0 ? before.landArea : null;
  return {
    baselinePopulation: population,
    baselineGdpPerCapita: gdpPerCapita,
    baselineDate: ixNow,
    currentPopulation: population,
    currentGdpPerCapita: gdpPerCapita,
    currentTotalGdp: totalGdp,
    nominalGDP: totalGdp,
    economicTier: getEconomicTierFromGdpPerCapita(gdpPerCapita),
    populationTier: getPopulationTierFromPopulation(population),
    totalWorkforce: Math.round(population * workforceShare),
    ...(land && { populationDensity: population / land, gdpDensity: totalGdp / land }),
    lastCalculated: ixNow,
  };
}
