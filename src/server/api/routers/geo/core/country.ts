import { z } from "zod";
import { cachedPublicProcedure, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
// eslint-disable-next-line unused-imports/no-unused-imports
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { truncateGeometry } from "~/lib/maps/geojson-compress";

export const countryProcedures = {
  getCountryGeometry: cachedPublicProcedure
    .input(
      z.object({
        featureId: z.string().optional(),
        countryName: z.string().optional(),
        countryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!input.featureId && !input.countryName && !input.countryId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One of featureId, countryName, or countryId is required",
        });
      }

      // Query MapLayer directly from DB
      let mapLayer;

      if (input.countryId) {
        mapLayer = await ctx.db.mapLayer.findFirst({
          where: {
            layerType: "political",
            countryId: input.countryId,
            isActive: true,
          },
          include: {
            country: {
              select: { id: true, name: true, flag: true },
            },
          },
        });
      } else if (input.featureId) {
        mapLayer = await ctx.db.mapLayer.findFirst({
          where: {
            layerType: "political",
            featureId: input.featureId,
            isActive: true,
          },
          include: {
            country: {
              select: { id: true, name: true, flag: true },
            },
          },
        });
      } else if (input.countryName) {
        // Search by display name (case-insensitive)
        mapLayer = await ctx.db.mapLayer.findFirst({
          where: {
            layerType: "political",
            displayName: { contains: input.countryName, mode: "insensitive" as const },
            isActive: true,
          },
          include: {
            country: {
              select: { id: true, name: true, flag: true },
            },
          },
        });
      }

      if (!mapLayer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Country not found`,
        });
      }

      const rawC = mapLayer.centroid as
        [number, number] | { coordinates?: [number, number] } | null;
      let parsedCentroid: { lng: number; lat: number } | null = null;
      if (Array.isArray(rawC) && rawC.length >= 2) {
        parsedCentroid = { lng: rawC[0], lat: rawC[1] };
      } else if (rawC && "coordinates" in rawC && Array.isArray(rawC.coordinates)) {
        parsedCentroid = { lng: rawC.coordinates[0], lat: rawC.coordinates[1] };
      }
      const bbox = mapLayer.boundingBox as number[] | null;

      return {
        featureId: mapLayer.featureId,
        displayName: mapLayer.displayName || featureIdToDisplayName(mapLayer.featureId),
        geometry: mapLayer.geometry,
        centroid: parsedCentroid,
        bbox: bbox ? { minLng: bbox[0], minLat: bbox[1], maxLng: bbox[2], maxLat: bbox[3] } : null,
        areaSqKm: mapLayer.areaSqKm,
        country: mapLayer.country,
      };
    }),

  /**
   * Get country at a given point using PostGIS ST_Contains.
   */
  getCountryFeatures: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [subdivisions, cities, pois, storyPins, mapLabels, peaks, namedRivers, namedLakes] =
        await Promise.all([
          ctx.db.subdivision.findMany({
            where: { countryId: input.countryId, status: "approved" },
            orderBy: { name: "asc" },
          }),
          ctx.db.city.findMany({
            where: { countryId: input.countryId, status: "approved" },
            orderBy: [{ isNationalCapital: "desc" }, { population: "desc" }],
          }),
          ctx.db.pointOfInterest.findMany({
            where: { countryId: input.countryId, status: "approved" },
            orderBy: { name: "asc" },
          }),
          ctx.db.storyPin.findMany({
            where: { countryId: input.countryId, status: "approved" },
            orderBy: { ixTimeYear: "asc" },
          }),
          ctx.db.mapLabel.findMany({
            where: { countryId: input.countryId, status: "approved" },
            orderBy: { text: "asc" },
          }),
          ctx.db.peak
            .findMany({
              where: { countryId: input.countryId, status: "approved" },
              orderBy: { name: "asc" },
            })
            .catch(() => []),
          ctx.db.namedRiver
            .findMany({
              where: { countryId: input.countryId, status: "approved" },
              orderBy: { name: "asc" },
            })
            .catch(() => []),
          ctx.db.namedLake
            .findMany({
              where: { countryId: input.countryId, status: "approved" },
              orderBy: { name: "asc" },
            })
            .catch(() => []),
        ]);

      // Plan 119 §2.1 — truncate subdivision geometry to 6dp (~0.11m) at the
      // response boundary only. DB stores full precision; the editor's setData
      // patch (useMapEditor) keeps writing/reading the authoritative geometry.
      const truncatedSubdivisions = subdivisions.map((s) => {
        if (!s.geometry || !(s.geometry as any).coordinates) return s;
        return { ...s, geometry: truncateGeometry(s.geometry as unknown as Geometry, 6) };
      });
      return {
        subdivisions: truncatedSubdivisions,
        cities,
        pois,
        storyPins,
        mapLabels,
        peaks,
        namedRivers,
        namedLakes,
      };
    }),

  /**
   * Get map statistics (admin dashboard).
   */
  getCapitalCities: cachedPublicProcedure.query(async ({ ctx }) => {
    const capitals = await ctx.db.city.findMany({
      where: { isNationalCapital: true, status: "approved" },
      select: {
        id: true,
        name: true,
        coordinates: true,
        population: true,
        wikiPageTitle: true,
        countryId: true,
        country: { select: { name: true, slug: true } },
      },
    });

    return {
      type: "FeatureCollection" as const,
      features: capitals
        .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
        .map((c) => {
          const coords = c.coordinates as [number, number];
          return {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: coords },
            properties: {
              id: c.id,
              name: c.name,
              countryId: c.countryId,
              countryName: c.country.name,
              countrySlug: c.country.slug,
              population: c.population,
              wikiPageTitle: c.wikiPageTitle,
            },
          };
        }),
    };
  }),

  /**
   * Run conflict detection for a country's map features.
   * Returns issues like duplicate names, coordinate mismatches, missing wiki links.
   */
  getCountryLinkage: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", countryId: input.countryId, isActive: true },
        select: {
          featureId: true,
          displayName: true,
          areaSqKm: true,
          centroid: true,
          boundingBox: true,
        },
      });

      return {
        isLinked: !!mapLayer,
        featureId: mapLayer?.featureId ?? null,
        featureName: mapLayer?.displayName ?? null,
        areaSqKm: mapLayer?.areaSqKm ?? null,
      };
    }),

  // ──────────────────────────────────────────────
  // SVG Upload & Processing Pipeline
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────
  // World Template / Clone System (Phase 3)
  // ──────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────
  // Procedural World Generation (Phase 4)
  // ──────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Map Pipeline Endpoints
  // ──────────────────────────────────────────────

  /**
   * Get shared vertices for a specific feature (used by border editor).
   */
  getNeighbors: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get the country's map feature
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: {
          layerType: "political",
          countryId: input.countryId,
          isActive: true,
        },
      });

      if (!mapLayer) {
        return [];
      }

      // Use PostGIS to find touching/intersecting features
      // Uses pre-computed centroid JSON field instead of ST_Centroid()
      try {
        const neighbors = await ctx.db.$queryRawUnsafe<
          Array<{
            featureId: string;
            displayName: string | null;
            countryId: string | null;
            centroidLng: number | null;
            centroidLat: number | null;
          }>
        >(
          `SELECT ml2."featureId", ml2."displayName", ml2."countryId",
                  (ml2.centroid -> 'coordinates' ->> 0)::float AS "centroidLng",
                  (ml2.centroid -> 'coordinates' ->> 1)::float AS "centroidLat"
           FROM map_layers ml1
           JOIN map_layers ml2 ON ml2."layerType" = 'political'
             AND ml2."isActive" = true
             AND ml2.id != ml1.id
             AND ml1.geom_postgis IS NOT NULL
             AND ml2.geom_postgis IS NOT NULL
             AND ST_Touches(ml1.geom_postgis, ml2.geom_postgis)
           WHERE ml1.id = $1`,
          mapLayer.id
        );

        return neighbors.map((n) => ({
          featureId: n.featureId,
          displayName: n.displayName || featureIdToDisplayName(n.featureId),
          countryId: n.countryId,
          centroidLng: Number(n.centroidLng) || 0,
          centroidLat: Number(n.centroidLat) || 0,
        }));
      } catch {
        // PostGIS query failed
        return [];
      }
    }),

  /**
   * Get all geographic features for a specific country.
   * Includes subdivisions, cities, and points of interest.
   */
  getNeighborGeometries: adminProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const feature = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId, isActive: true },
        select: { boundingBox: true },
      });
      if (!feature) return [];

      const bbox = feature.boundingBox as number[] | null;
      if (!bbox || bbox.length !== 4) return [];

      const pad = 1;
      const neighbors = await ctx.db.mapLayer.findMany({
        where: {
          layerType: "political",
          featureId: { not: input.featureId },
          isActive: true,
        },
        select: { featureId: true, displayName: true, geometry: true, boundingBox: true },
      });

      return neighbors
        .filter((l) => {
          const nb = l.boundingBox as number[] | null;
          if (!nb || nb.length !== 4) return false;
          return (
            nb[0]! < bbox[2]! + pad &&
            nb[2]! > bbox[0]! - pad &&
            nb[1]! < bbox[3]! + pad &&
            nb[3]! > bbox[1]! - pad
          );
        })
        .map((l) => ({
          featureId: l.featureId,
          displayName: l.displayName,
          geometry: l.geometry,
        }));
    }),

  /**
   * Admin: Recalculate area for a map feature using PostGIS.
   */
};
