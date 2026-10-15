/**
 * The country editor's reads and saves (`/mycountry/editor`). One mutation per section, each
 * patching only the rows and columns that section names.
 *
 * Concurrency is per field: a save sends the values the page loaded for exactly the fields it
 * changes (`expected`), and inside the same transaction as the write the server checks those
 * fields still hold them. If one moved (another tab saved it), the save is refused with CONFLICT
 * ("Culture changed since you opened it"). Writes to anything else, such as the stat progression
 * or a MyCountry console touching the country row, never refuse a save. Each save returns the
 * section's new values, so the page re-keys that section from them.
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
  IDENTITY_FIELDS,
  IDENTITY_SECTION_IDS,
  identityFieldError,
  MAX_DEFINED_COMPONENTS,
  POPULATION_LIMITS,
  staleMessage,
  type EditorIdentityKey,
  type EditorSectionId,
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

const countryInput = z.object({ countryId: z.string().min(1) });

/** Text as stored and as the page shows it: missing and empty are the same, spaces trimmed. */
const sameText = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim() === (b ?? "").trim();

const sameNumber = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Refuses the save when a field it changes no longer holds what the page loaded. */
function refuseIfChanged(changed: boolean, section: EditorSectionId) {
  if (changed) throw new TRPCError({ code: "CONFLICT", message: staleMessage(section) });
}

async function afterSave(userId: string | null | undefined) {
  await invalidateCache(["countries."]);
  if (userId) await globalCache.delete(`user_profile:${userId}`);
}

const optionalText = z.string().max(400).nullable().optional();
const loadedText = z.string().max(2000).nullable();
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
const INSTITUTION_KEYS = [
  "headOfState",
  "headOfGovernment",
  "legislatureName",
  "executiveName",
  "judicialName",
] as const;
type InstitutionKey = (typeof INSTITUTION_KEYS)[number];

/** Empty text clears a field. */
const blankToNull = (value: string | null | undefined) =>
  value == null ? null : value.trim() === "" ? null : value.trim();

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Nation not found" });

export const editorProcedures = {
  /** Everything the editor page shows. */
  getEditorState: readOnlyProcedure.input(countryInput).query(async ({ ctx, input }) => {
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
        baselinePopulation: true,
        baselineGdpPerCapita: true,
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
    if (!country) throw notFound();
    return country;
  }),

  /** Whether the nation can take a name: unique in its realm, not a lore nation, has a slug. */
  checkNameAvailable: readOnlyProcedure
    .input(countryInput.extend({ name: z.string().max(400) }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, name: true, realmId: true },
      });
      if (!country) throw notFound();
      return checkCountryName(ctx.db, country, input.name);
    }),

  /** Name: the name, the slug (the old one redirects) and the identity's country name. */
  rename: rateLimitedMutationProcedure
    .input(
      countryInput.extend({
        name: z
          .string()
          .min(1)
          .max(MAX_COUNTRY_NAME_LENGTH * 2),
        expected: z.object({ name: z.string().max(400) }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const before = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, name: true, realmId: true },
      });
      if (!before) throw notFound();
      const check = await checkCountryName(ctx.db, before, input.name);
      if (!check.available) {
        throw new TRPCError({ code: "CONFLICT", message: check.reason ?? "Name not available" });
      }

      const result = await ctx.db.$transaction(async (tx) => {
        const current = await tx.country.findUnique({
          where: { id: input.countryId },
          select: { id: true, name: true, slug: true },
        });
        if (!current) throw notFound();
        refuseIfChanged(current.name !== input.expected.name, "name");
        const renamed = await renameCountryInTx(tx, current, input.name);
        return { name: renamed.name, slug: renamed.slug };
      });

      await afterSave(ctx.auth?.userId);
      if (result.name !== before.name) await invalidateRealmMap(ctx.db, before.realmId);
      return result;
    }),

  /** Flag and symbols, capital and language, culture and civic standards. */
  saveIdentity: rateLimitedMutationProcedure
    .input(
      countryInput
        .extend({
          section: z.enum(IDENTITY_SECTION_IDS),
          identity: identityPatch,
          flag: imageUrl,
          coatOfArms: imageUrl,
          expected: z.object({
            identity: z.record(z.string(), loadedText).default({}),
            flag: loadedText.optional(),
            coatOfArms: loadedText.optional(),
          }),
        })
        .superRefine((input, ctx) => {
          const own = new Set<string>(IDENTITY_FIELDS[input.section].map((f) => f.key));
          for (const key of Object.keys(input.identity)) {
            if (!own.has(key)) {
              ctx.addIssue({ code: "custom", path: ["identity", key], message: "Not here" });
            } else if (!(key in input.expected.identity)) {
              ctx.addIssue({ code: "custom", path: ["expected", key], message: "Missing" });
            }
          }
          for (const key of ["flag", "coatOfArms"] as const) {
            if (input[key] === undefined) continue;
            if (input.section !== "symbols") {
              ctx.addIssue({ code: "custom", path: [key], message: "Not here" });
            } else if (input.expected[key] === undefined) {
              ctx.addIssue({ code: "custom", path: ["expected", key], message: "Missing" });
            }
          }
        })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const { countryId, section, expected } = input;
      const identity = Object.fromEntries(
        Object.entries(input.identity)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, blankToNull(value)])
      ) as Partial<Record<EditorIdentityKey, string | null>>;
      const keys = Object.keys(identity) as EditorIdentityKey[];

      const images: { flag?: string | null; coatOfArms?: string | null } = {};
      if (input.flag !== undefined) images.flag = blankToNull(input.flag);
      if (input.coatOfArms !== undefined) images.coatOfArms = blankToNull(input.coatOfArms);
      const imageKeys = Object.keys(images) as Array<"flag" | "coatOfArms">;

      await ctx.db.$transaction(async (tx) => {
        const stored =
          keys.length > 0
            ? ((await tx.nationalIdentity.findUnique({
                where: { countryId },
                select: Object.fromEntries(keys.map((key) => [key, true])),
              })) as Partial<Record<EditorIdentityKey, string | null>> | null)
            : null;
        const storedImages =
          imageKeys.length > 0
            ? await tx.country.findUnique({
                where: { id: countryId },
                select: { flag: true, coatOfArms: true },
              })
            : null;
        refuseIfChanged(
          keys.some((key) => !sameText(stored?.[key], expected.identity[key])) ||
            imageKeys.some((key) => !sameText(storedImages?.[key], expected[key])),
          section
        );

        // The country row keeps a copy of the religion that profiles and filters read.
        const countryColumns: Prisma.CountryUpdateInput = { ...images };
        if (identity.nationalReligion !== undefined) {
          countryColumns.religion = identity.nationalReligion;
        }
        if (Object.keys(countryColumns).length > 0) {
          await tx.country.update({ where: { id: countryId }, data: countryColumns });
        }
        if (keys.length > 0) {
          await tx.nationalIdentity.upsert({
            where: { countryId },
            update: identity,
            create: { countryId, ...identity },
          });
        }
      });

      await afterSave(ctx.auth?.userId);
      return { identity, ...images };
    }),

  /** Form and institutions: the government type and the institution names. */
  saveGovernmentForm: rateLimitedMutationProcedure
    .input(
      countryInput.extend({
        governmentType: z.string().trim().min(1).max(120),
        headOfState: institutionName,
        headOfGovernment: institutionName,
        legislatureName: institutionName,
        executiveName: institutionName,
        judicialName: institutionName,
        expected: z.object({
          governmentType: loadedText,
          headOfState: loadedText,
          headOfGovernment: loadedText,
          legislatureName: loadedText,
          executiveName: loadedText,
          judicialName: loadedText,
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const { countryId, governmentType, expected } = input;
      const institutions = Object.fromEntries(
        INSTITUTION_KEYS.map((key) => [key, blankToNull(input[key])])
      ) as Record<InstitutionKey, string | null>;

      await ctx.db.$transaction(async (tx) => {
        const structure = await tx.governmentStructure.findUnique({
          where: { countryId },
          select: {
            id: true,
            governmentType: true,
            headOfState: true,
            headOfGovernment: true,
            legislatureName: true,
            executiveName: true,
            judicialName: true,
          },
        });
        const country = await tx.country.findUnique({
          where: { id: countryId },
          select: { name: true, governmentType: true },
        });
        if (!country) throw notFound();
        // The page shows the structure's type, else the country's.
        const storedType = structure?.governmentType ?? country.governmentType ?? null;
        refuseIfChanged(
          !sameText(storedType, expected.governmentType) ||
            INSTITUTION_KEYS.some((key) => !sameText(structure?.[key], expected[key])),
          "form"
        );

        if (structure) {
          await tx.governmentStructure.update({
            where: { countryId },
            data: { governmentType, ...institutions },
          });
        } else {
          await tx.governmentStructure.create({
            data: {
              countryId,
              governmentName: `Government of ${country.name}`,
              governmentType,
              ...institutions,
            },
          });
        }
        await tx.country.update({ where: { id: countryId }, data: { governmentType } });
        // The identity keeps its own copy of the government type; keep it in step when it exists.
        await tx.nationalIdentity.updateMany({ where: { countryId }, data: { governmentType } });
      });

      await afterSave(ctx.auth?.userId);
      return { governmentType, ...institutions };
    }),

  /**
   * Institutions (components). A component the nation keeps keeps its row, score and history;
   * synergies and government effectiveness are recalculated from the shared table.
   */
  saveGovernmentComponents: rateLimitedMutationProcedure
    .input(
      countryInput.extend({
        componentTypes: z.array(z.nativeEnum(ComponentType)).max(80),
        expected: z.object({ componentTypes: z.array(z.string()).max(200) }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const { countryId } = input;
      const types = [...new Set(input.componentTypes)];
      const defined = types.filter((type) => getComponentGroup(type));
      if (defined.length > MAX_DEFINED_COMPONENTS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A government can have up to ${MAX_DEFINED_COMPONENTS} institutions.`,
        });
      }

      const result = await ctx.db.$transaction(async (tx) => {
        const existing = await tx.governmentComponent.findMany({
          where: { countryId },
          select: { componentType: true },
        });
        const stored = new Set<string>(existing.map((c) => c.componentType));
        const loaded = new Set(input.expected.componentTypes);
        refuseIfChanged(
          stored.size !== loaded.size || [...stored].some((type) => !loaded.has(type)),
          "institutions"
        );

        // Effectiveness is stored on the structure, so the nation needs one.
        const structure = await tx.governmentStructure.findUnique({
          where: { countryId },
          select: { id: true },
        });
        if (!structure) {
          const country = await tx.country.findUnique({
            where: { id: countryId },
            select: { name: true, governmentType: true },
          });
          await tx.governmentStructure.create({
            data: {
              countryId,
              governmentName: `Government of ${country?.name ?? "the nation"}`,
              governmentType: country?.governmentType || "Parliamentary Republic",
            },
          });
        }
        await syncGovernmentComponents(
          tx,
          countryId,
          types.map((componentType) => ({ componentType }))
        );
        const components = await tx.governmentComponent.findMany({
          where: { countryId },
          select: { componentType: true, effectivenessScore: true },
          orderBy: { createdAt: "asc" },
        });
        const after = await tx.governmentStructure.findUnique({
          where: { countryId },
          select: { governmentEffectiveness: true },
        });
        return { components, governmentEffectiveness: after?.governmentEffectiveness ?? null };
      });

      await afterSave(ctx.auth?.userId);
      return result;
    }),

  /**
   * Population and wealth. The figures become the nation's new baseline (dated now), so the
   * stat progression projects forward from them instead of reverting them; the totals that
   * follow from them (total GDP, tiers, densities, workforce) are recalculated. The check is
   * against the baseline the page loaded: the stat progression moves the current figures, never
   * the baseline, so it never refuses this save.
   */
  saveSize: rateLimitedMutationProcedure
    .input(
      countryInput.extend({
        population: z.number().int().min(POPULATION_LIMITS.min).max(POPULATION_LIMITS.max),
        gdpPerCapita: z.number().min(GDP_PER_CAPITA_LIMITS.min).max(GDP_PER_CAPITA_LIMITS.max),
        expected: z.object({ baselinePopulation: z.number(), baselineGdpPerCapita: z.number() }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const { countryId, population, gdpPerCapita, expected } = input;

      await ctx.db.$transaction(async (tx) => {
        const before = await tx.country.findUnique({
          where: { id: countryId },
          select: {
            baselinePopulation: true,
            baselineGdpPerCapita: true,
            currentPopulation: true,
            totalWorkforce: true,
            landArea: true,
          },
        });
        if (!before) throw notFound();
        refuseIfChanged(
          !sameNumber(before.baselinePopulation, expected.baselinePopulation) ||
            !sameNumber(before.baselineGdpPerCapita, expected.baselineGdpPerCapita),
          "population"
        );
        await tx.country.update({
          where: { id: countryId },
          data: sizeColumns(population, gdpPerCapita, before),
        });
      });

      await afterSave(ctx.auth?.userId);
      return {
        baselinePopulation: population,
        baselineGdpPerCapita: gdpPerCapita,
        currentPopulation: population,
        currentGdpPerCapita: gdpPerCapita,
      };
    }),
};

/** The Country columns a new population and GDP per capita set. Exported for tests. */
export function sizeColumns(
  population: number,
  gdpPerCapita: number,
  before: { currentPopulation: number; totalWorkforce: number | null; landArea: number | null }
): Prisma.CountryUpdateInput {
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
