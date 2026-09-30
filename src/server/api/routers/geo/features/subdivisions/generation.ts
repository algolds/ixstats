import { z } from "zod";
import { createTRPCRouter, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { GEO_FEATURE_INVALIDATE_KEYS, invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { clipAndValidatePolygon } from "~/lib/maps/geo-validation";
import { generateProvinces } from "~/lib/maps/province-generator";
import { syncGeographicDemographics } from "~/lib/country-geo/sync";

export const geoFeaturesSubdivisionsGenerationRouter = createTRPCRouter({
  /**
   * Batch simplify all subdivisions for a country.
   * Reduces vertex count using Douglas-Peucker, sanitizes shapes,
   * and snaps shared borders between neighbors.
   */
  simplifySubdivisions: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        targetVerticesPerProvince: z.number().min(30).max(300).default(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const subdivisions = await ctx.db.subdivision.findMany({
        where: { countryId: input.countryId },
        take: 200,
        select: { id: true, name: true, geometry: true },
      });

      if (subdivisions.length === 0) {
        return { updated: 0, total: 0, verticesBefore: 0, verticesAfter: 0, reduction: 0 };
      }

      const { simplifyProvinceBatch, countVertices } =
        await import("~/lib/maps/province-importer/topo-simplify");

      // Build Feature array from all subdivisions with valid geometry
      const validSubs = subdivisions.filter((s) => s.geometry);
      const features = validSubs.map((sub) => ({
        type: "Feature" as const,
        properties: { name: sub.name, _dbId: sub.id },
        geometry: sub.geometry as any,
      }));

      const verticesBefore = features.reduce((s, f) => s + countVertices(f.geometry), 0);

      const result = simplifyProvinceBatch(features, {
        targetVerticesPerProvince: input.targetVerticesPerProvince,
      });

      // Write simplified geometries back to the database
      let updated = 0;
      for (let i = 0; i < validSubs.length; i++) {
        const sub = validSubs[i]!;
        const simplified = result.features[i];
        if (!simplified?.geometry) continue;

        const beforeCount = countVertices(features[i]!.geometry);
        const afterCount = countVertices(simplified.geometry);

        // Only update if actually reduced
        if (afterCount < beforeCount) {
          await ctx.db.subdivision.update({
            where: { id: sub.id },
            data: { geometry: simplified.geometry as any },
          });
          updated++;
        }
      }

      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);

      return {
        updated,
        total: subdivisions.length,
        verticesBefore,
        verticesAfter: result.totalVerticesAfter,
        reduction:
          verticesBefore > 0
            ? Math.round((1 - result.totalVerticesAfter / verticesBefore) * 100)
            : 0,
      };
    }),

  /**
   * Commit generated subdivisions: auto-subdivide a country polygon into N
   * provinces using Voronoi tessellation. Each cell is clipped to the country
   * border via clipAndValidatePolygon and bulk-created as an approved Subdivision.
   */
  commitGeneratedSubdivisions: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        count: z.number().int().min(2).max(200),
        seed: z.number().optional(),
        names: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      // Load country geometry from the map_layers table (needed for the pure-math generator)
      const rows = await ctx.db.$queryRawUnsafe<Array<{ geom_geojson: string }>>(
        `SELECT ST_AsGeoJSON(geom_postgis) as geom_geojson
         FROM map_layers
         WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL
         LIMIT 1`,
        input.countryId
      );
      if (rows.length === 0 || !rows[0]?.geom_geojson) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country geometry not found" });
      }
      const countryGeom = JSON.parse(rows[0].geom_geojson) as any;

      // Generate raw Voronoi cells (pure math, no DB yet)
      const rawCells = generateProvinces(countryGeom, input.count, {
        seed: input.seed,
      });
      if (rawCells.length === 0) {
        return { created: 0, skipped: 0 };
      }

      const names = input.names ?? [];
      let created = 0;
      let skipped = 0;

      // Clip each cell to the country border and create a Subdivision
      for (let i = 0; i < rawCells.length; i++) {
        const cell = rawCells[i]!;
        const clipped = await clipAndValidatePolygon(
          ctx.db as any,
          input.countryId,
          cell as unknown as Record<string, unknown>,
          `Generated Province ${i + 1}`
        );
        const name = names[i] || `Province ${i + 1}`;

        try {
          await ctx.db.subdivision.create({
            data: {
              name,
              countryId: input.countryId,
              type: "province",
              level: 1,
              geometry: clipped,
              status: "approved",
              submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
            },
          });
          created++;
        } catch {
          skipped++;
        }
      }

      await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS);
      broadcastMapUpdate("subdivision", input.countryId);
      await syncGeographicDemographics(ctx.db, input.countryId);

      return { created, skipped, totalCells: rawCells.length };
    }),
});
