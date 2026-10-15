import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { rateLimitedMutationProcedure } from "~/server/api/trpc";
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

export const managementLifecycleProcedures = {
  // General update mutation for country fields (used by editor)
  update: rateLimitedMutationProcedure
    .input(
      z
        .object({
          id: z.string(),
        })
        .passthrough()
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      await assertCountryWriteAccess(ctx, id);

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      // A new name renames through the shared path, so the slug, its redirect and the identity's
      // country name move with it. Checked before the try, so a taken name stays a CONFLICT.
      const rename = await pendingRename(ctx.db, id, updates.name);

      try {
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        // Only a column the political layer reads moves the map, so the before-image is read for those alone
        const touchesMap = touchesCountryMapFields(filteredUpdates);
        const before = touchesMap
          ? await ctx.db.country.findUnique({ where: { id }, select: COUNTRY_MAP_SELECT })
          : null;

        const { name: _name, slug: _slug, ...otherUpdates } = filteredUpdates;
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
              data: {
                ...filteredUpdates,
                updatedAt: new Date(),
              },
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
    }),
};
