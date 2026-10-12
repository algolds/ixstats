/**
 * City Import Router
 *
 * tRPC router for bulk city import via the map editor.
 * Provides validateCityImport (query) and commitCityImport (mutation).
 */

import { z } from "zod";
import { createTRPCRouter, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { lookupCityPoints, upsertCity } from "~/lib/country-geo";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { assertOwnCountry } from "../core/shared";

// ── Shared schema ─────────────────────────────────────────────────────────────

const cityImportRowSchema = z.object({
  name: z.string().min(1).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  cityType: z.string().default("city"),
  population: z.number().int().min(0).optional(),
  foundedYear: z.number().int().optional(),
  elevation: z.number().optional(),
  isNationalCapital: z.boolean().default(false),
  isSubdivisionCapital: z.boolean().default(false),
  subdivisionId: z.string().optional(),
  wikiPageTitle: z.string().max(200).optional(),
});

// ── Validation helper ─────────────────────────────────────────────────────────

// ── Router ────────────────────────────────────────────────────────────────────

export const geoAdminCitiesRouter = createTRPCRouter({
  /**
   * Commit a validated batch of city rows.
   * Re-validates each row server-side (never trusts client validation).
   * Skips cities that fail containment check.
   * Returns the number of cities successfully created.
   */
  commitCityImport: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        cities: z.array(cityImportRowSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId, "import cities for");

      // Verify country exists
      const countryRecord = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, realmId: true },
      });
      if (!countryRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Re-validate containment for each city; skip those outside the border. One lookup covers the whole batch
      // (border, covering subdivision, nearest water), and each city's answer goes to upsertCity.
      const lookups = await lookupCityPoints(
        ctx.db,
        input.countryId,
        input.cities.map((row) => [row.lng, row.lat])
      );

      let created = 0;
      for (const [i, row] of input.cities.entries()) {
        const lookup = lookups[i];
        // Skip if definitely outside (null means border data unavailable — allow)
        if (lookup?.inside === false) {
          continue;
        }

        try {
          await upsertCity(
            ctx.db,
            input.countryId,
            {
              name: row.name,
              type: row.cityType,
              coordinates: [row.lng, row.lat],
              population: row.population,
              isNationalCapital: row.isNationalCapital,
              isSubdivisionCapital: row.isSubdivisionCapital,
              subdivisionId: row.subdivisionId,
              wikiPageTitle: row.wikiPageTitle,
              // elevation and foundedYear passed through for Plan 053 compatibility;
              // silently dropped if not yet in the upsertCity data spread
              elevation: row.elevation,
              foundedYear: row.foundedYear,
            },
            lookup
          );
          created++;
        } catch (err) {
          // Log and skip individual failures (don't abort the whole batch)
          console.error(
            `[commitCityImport] Failed to create city "${row.name}":`,
            err instanceof Error ? err.message : err
          );
        }
      }

      // An import bumps the map version too: the detail queries (cities, subdivisions) key on it
      await invalidateRealmMap(ctx.db, countryRecord.realmId);
      broadcastMapUpdate("bulk", input.countryId, countryRecord.realmId);

      return { created };
    }),

  /**
   * Parse an SVG city import file:
   * - Extracts layers (Inkscape groups)
   * - Extracts city points (circles, ellipses, uses, point-like paths)
   * - Extracts province centroids for auto-alignment
   */
  parseCitySvg: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        svgContent: z.string().min(1),
        citiesLayerId: z.string().optional(),
        capitalLayerId: z.string().optional(),
        cityNameLayerId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId, "parse city SVGs for");

      const { parseCitySvg } = await import("~/lib/city-importer/svg-points");
      return parseCitySvg(input.svgContent, {
        citiesLayerId: input.citiesLayerId,
        capitalLayerId: input.capitalLayerId,
        cityNameLayerId: input.cityNameLayerId,
      });
    }),
});
