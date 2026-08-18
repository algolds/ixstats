/**
 * City Import Router
 *
 * tRPC router for bulk city import via the map editor.
 * Provides validateCityImport (query) and commitCityImport (mutation).
 */

import { z } from "zod";
import {
  createTRPCRouter,
  countryOwnerProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { upsertCity } from "~/lib/country-geo";
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { clearLayerCache } from "~/server/shared/layer-cache";

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

type CityImportRow = z.infer<typeof cityImportRowSchema>;

// ── Validation helper ─────────────────────────────────────────────────────────

async function validateCityRow(
  db: any,
  countryId: string,
  row: CityImportRow,
  existingNames: Set<string>
): Promise<string[]> {
  const issues: string[] = [];

  // Inside-country check via PostGIS
  try {
    const containResult = (await db.$queryRawUnsafe(
      `SELECT ST_Covers(
         ST_MakeValid((SELECT geom_postgis FROM map_layers WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL LIMIT 1)),
         ST_SetSRID(ST_MakePoint($2, $3), 4326)
       ) as is_inside`,
      countryId,
      row.lng,
      row.lat
    )) as Array<{ is_inside: boolean | null }>;

    // If geom_postgis is null, containResult[0]?.is_inside is null — skip check gracefully
    if (containResult[0] && containResult[0].is_inside === false) {
      issues.push("City coordinates are outside country borders");
    }
  } catch {
    // PostGIS unavailable (e.g. dev without spatial data) — skip silently
  }

  // Name conflict with existing cities
  if (existingNames.has(row.name.toLowerCase())) {
    issues.push(`City name "${row.name}" already exists in this country`);
  }

  return issues;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const geoAdminCitiesRouter = createTRPCRouter({
  /**
   * Validate a batch of city rows for a country:
   * - Checks each point is inside the country border (PostGIS)
   * - Checks for name conflicts with existing cities
   *
   * Returns per-row issues (not a fatal error — caller shows warnings).
   */
  validateCityImport: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        cities: z.array(cityImportRowSchema),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = ctx.country as any;
      // countryOwnerMiddleware sets ctx.country = null for admins; non-admins must own the country
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only validate cities for your own country",
        });
      }

      // Pre-fetch existing city names for this country
      const existingCities = await ctx.db.city.findMany({
        where: { countryId: input.countryId },
        select: { name: true },
      });
      const existingNames = new Set(
        (existingCities as Array<{ name: string }>).map((c) => c.name.toLowerCase())
      );

      const results = await Promise.all(
        input.cities.map(async (row) => {
          const issues = await validateCityRow(ctx.db, input.countryId, row, existingNames);
          return { name: row.name, lat: row.lat, lng: row.lng, issues };
        })
      );

      return { results };
    }),

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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only import cities for your own country",
        });
      }

      // Verify country exists
      const countryRecord = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true },
      });
      if (!countryRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Re-validate containment for each city; skip those outside the border
      let created = 0;
      for (const row of input.cities) {
        // Check containment
        let isInside: boolean | null = null;
        try {
          const containResult = (await ctx.db.$queryRawUnsafe(
            `SELECT ST_Covers(
               ST_MakeValid((SELECT geom_postgis FROM map_layers WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL LIMIT 1)),
               ST_SetSRID(ST_MakePoint($2, $3), 4326)
             ) as is_inside`,
            input.countryId,
            row.lng,
            row.lat
          )) as Array<{ is_inside: boolean | null }>;
          isInside = containResult[0]?.is_inside ?? null;
        } catch {
          // PostGIS unavailable — allow through
          isInside = null;
        }

        // Skip if definitely outside (null means border data unavailable — allow)
        if (isInside === false) {
          continue;
        }

        try {
          await upsertCity(ctx.db, input.countryId, {
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
          });
          created++;
        } catch (err) {
          // Log and skip individual failures (don't abort the whole batch)
          console.error(
            `[commitCityImport] Failed to create city "${row.name}":`,
            err instanceof Error ? err.message : err
          );
        }
      }

      clearLayerCache("political");
      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
      ]);
      broadcastMapUpdate("bulk", input.countryId);

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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only parse city SVGs for your own country",
        });
      }

      const { parseCitySvg } = await import("~/lib/city-importer/svg-points");
      return parseCitySvg(input.svgContent, {
        citiesLayerId: input.citiesLayerId,
        capitalLayerId: input.capitalLayerId,
        cityNameLayerId: input.cityNameLayerId,
      });
    }),
});
