import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { invalidateCache } from "~/lib/cache";
import {
  COUNTRY_MAP_SELECT,
  countryMapChanged,
  invalidateRealmMap,
  touchesCountryMapFields,
} from "~/server/shared/map-invalidation";

import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { evaluateThresholds } from "~/server/shared/intelligence-alert-thresholds";
import {
  MAX_COUNTRY_NAME_LENGTH,
  checkCountryName,
  normalizeCountryName,
  renameCountryInTx,
} from "~/server/shared/country-rename";

/**
 * The rename an update asks for, or null when it names no new name. Refuses (CONFLICT) a name the
 * country cannot take.
 */
async function pendingRename(db: PrismaClient, id: string, rawName: unknown) {
  if (typeof rawName !== "string") return null;
  const current = await db.country.findUnique({
    where: { id },
    select: { name: true, slug: true, realmId: true },
  });
  if (!current || normalizeCountryName(rawName) === current.name) return null;
  const check = await checkCountryName(db, { ...current, id }, rawName);
  if (!check.available) {
    throw new TRPCError({ code: "CONFLICT", message: check.reason ?? "Name not available" });
  }
  return { country: { id, slug: current.slug ?? null }, name: rawName };
}

/**
 * What an owner may change through `countries.update`: the name (Settings rename) and the flag (Settings flag). Strict, so
 * any other key (a figure the simulation owns, `ownerUserId`, `realmId`, a nested relation write) is refused, not dropped.
 */
const ownerUpdateInput = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1).max(MAX_COUNTRY_NAME_LENGTH).optional(),
    flag: z.string().max(2048).optional(),
  })
  .strict();

/** What the admin country panel edits: identity columns, the stored figures and the two profile visibility toggles. */
const adminUpdateInput = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1).max(MAX_COUNTRY_NAME_LENGTH).optional(),
    continent: z.string().max(100).nullable().optional(),
    region: z.string().max(100).nullable().optional(),
    currentPopulation: z.number().finite().nonnegative().optional(),
    currentGdpPerCapita: z.number().finite().nonnegative().optional(),
    currentTotalGdp: z.number().finite().nonnegative().optional(),
    hideDiplomaticOps: z.boolean().optional(),
    hideStratcommIntel: z.boolean().optional(),
  })
  .strict();

type CountryColumnUpdates = Omit<Prisma.CountryUpdateInput, "slug"> & { name?: string };

interface UpdateContext {
  db: PrismaClient;
  auth: { userId: string | null } | null;
}

/** Writes allow-listed scalar columns: a new name through the shared rename, then the map and the alert thresholds. */
async function applyCountryUpdate(ctx: UpdateContext, id: string, updates: CountryColumnUpdates) {
  const userProfile = ctx.auth?.userId
    ? await ctx.db.user.findUnique({ where: { clerkUserId: ctx.auth.userId } })
    : null;

  // A new name renames through the shared path, so the slug, its redirect and the identity's
  // country name move with it. Checked before the try, so a taken name stays a CONFLICT.
  const rename = await pendingRename(ctx.db, id, updates.name);

  try {
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    ) as CountryColumnUpdates;

    // Only a column the political layer reads moves the map, so the before-image is read for those alone
    const touchesMap = touchesCountryMapFields(filteredUpdates);
    const before = touchesMap
      ? await ctx.db.country.findUnique({ where: { id }, select: COUNTRY_MAP_SELECT })
      : null;

    const { name: _name, ...otherUpdates } = filteredUpdates;
    const updatedCountry = rename
      ? await ctx.db.$transaction(
          async (tx) =>
            (
              await renameCountryInTx(tx, rename.country, rename.name, {
                ...otherUpdates,
                updatedAt: new Date(),
              })
            ).country
        )
      : await ctx.db.country.update({
          where: { id },
          data: { ...filteredUpdates, updatedAt: new Date() },
        });

    await invalidateCache(["countries."]);
    if (touchesMap && countryMapChanged(before, updatedCountry)) {
      await invalidateRealmMap(ctx.db, updatedCountry.realmId);
    }

    let targetUserId = userProfile?.id;
    if (!targetUserId) {
      const countryOwner = await ctx.db.user.findFirst({
        where: { ownedCountries: { some: { id } } },
      });
      targetUserId = countryOwner?.id;
    }

    if (targetUserId) {
      try {
        await evaluateThresholds(ctx.db, id, targetUserId);
      } catch (e) {
        console.error("[Countries API] Error evaluating thresholds on country update:", e);
      }
    }

    return updatedCountry;
  } catch (error) {
    console.error("[Countries API] Failed to update country:", error);
    throw new Error(
      `Failed to update country: ${error instanceof Error ? error.message : "Unknown error"}`,
      { cause: error }
    );
  }
}

export const managementLifecycleProcedures = {
  /** Owner edits from Settings: the name and the flag only. */
  update: rateLimitedMutationProcedure.input(ownerUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...updates } = input;
    await assertCountryWriteAccess(ctx, id);
    return applyCountryUpdate(ctx, id, updates);
  }),

  /** The admin country panel: identity, stored figures and profile visibility. */
  adminUpdate: adminProcedure.input(adminUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...updates } = input;
    return applyCountryUpdate(ctx, id, updates);
  }),
};
