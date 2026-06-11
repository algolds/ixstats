import { z } from "zod";
import { cachedPublicProcedure } from "~/server/api/trpc";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { MAP_LAYER_TYPES } from "~/lib/map-config";
import { getZoomBucket } from "./cache";
import { loadLayerFromDB, loadGeoJSONFromFile } from "./layer-loader";

export const worldMapProcedures = {
  getWorldMap: cachedPublicProcedure
    .input(
      z
        .object({
          layers: z.array(z.enum(MAP_LAYER_TYPES as unknown as [string, ...string[]])).optional(),
          /** Current map zoom level for LOD-based geometry simplification */
          zoom: z.number().min(0).max(20).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const requestedLayers = input?.layers ?? [
        "background",
        "political",
        "lakes",
        "rivers",
        "icecaps",
        "country_labels",
      ];
      const zoomBucket = getZoomBucket(input?.zoom);

      const results: Record<string, FeatureCollection> = {};

      await Promise.all(
        requestedLayers.map(async (layer) => {
          // Try database first
          const dbData = await loadLayerFromDB(ctx.db, layer, zoomBucket);
          if (dbData) {
            results[layer] = dbData;
          } else {
            // Fallback to file
            try {
              results[layer] = await loadGeoJSONFromFile(layer);
            } catch {
              // Layer not available
            }
          }
        })
      );

      return results;
    }),

  /**
   * Batched map data endpoint — returns world map layers + overlay features + capitals
   * in a single request to reduce HTTP round-trips on initial map load.
   */
  getMapBundle: cachedPublicProcedure
    .input(
      z
        .object({
          layers: z.array(z.enum(MAP_LAYER_TYPES as unknown as [string, ...string[]])).optional(),
          zoom: z.number().min(0).max(20).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const requestedLayers = input?.layers ?? [
        "background",
        "political",
        "lakes",
        "rivers",
        "icecaps",
        "country_labels",
      ];
      const zoomBucket = getZoomBucket(input?.zoom);

      // Run all three queries in parallel
      const [worldMap, allFeatures, capitalCities] = await Promise.all([
        // 1. World map layers
        (async () => {
          const results: Record<string, FeatureCollection> = {};
          await Promise.all(
            requestedLayers.map(async (layer) => {
              const dbData = await loadLayerFromDB(ctx.db, layer, zoomBucket);
              if (dbData) {
                results[layer] = dbData;
              } else {
                try {
                  results[layer] = await loadGeoJSONFromFile(layer);
                } catch {
                  // Layer not available
                }
              }
            })
          );
          return results;
        })(),

        // 2. Overlay features (cities, POIs, subdivisions)
        (async () => {
          const [cities, pois, subdivisions] = await Promise.all([
            ctx.db.city.findMany({
              where: { status: "approved" },
              select: {
                id: true,
                name: true,
                coordinates: true,
                population: true,
                type: true,
                isNationalCapital: true,
                wikiPageTitle: true,
                countryId: true,
                country: { select: { name: true, slug: true } },
              },
            }),
            ctx.db.pointOfInterest.findMany({
              where: { status: "approved" },
              select: {
                id: true,
                name: true,
                coordinates: true,
                category: true,
                icon: true,
                description: true,
                wikiPageTitle: true,
                countryId: true,
                country: { select: { name: true, slug: true } },
              },
            }),
            ctx.db.subdivision.findMany({
              where: { status: "approved" },
              select: {
                id: true,
                name: true,
                type: true,
                level: true,
                areaSqKm: true,
                geometry: true,
                countryId: true,
                country: { select: { name: true, slug: true } },
              },
            }),
          ]);
          return { cities, pois, subdivisions };
        })(),

        // 3. Capital cities
        ctx.db.city.findMany({
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
        }),
      ]);

      // Format overlay features as GeoJSON
      const features = {
        cities: {
          type: "FeatureCollection" as const,
          features: allFeatures.cities
            .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
            .map((c) => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: c.coordinates as [number, number] },
              properties: {
                id: c.id,
                name: c.name,
                cityType: c.type,
                isCapital: c.isNationalCapital,
                population: c.population,
                countryId: c.countryId,
                countryName: c.country.name,
                countrySlug: c.country.slug,
                wikiPageTitle: c.wikiPageTitle,
              },
            })),
        },
        pois: {
          type: "FeatureCollection" as const,
          features: allFeatures.pois
            .filter((p) => Array.isArray(p.coordinates) && (p.coordinates as number[]).length >= 2)
            .map((p) => ({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: p.coordinates as [number, number] },
              properties: {
                id: p.id,
                name: p.name,
                category: p.category,
                icon: p.icon,
                description: p.description,
                wikiPageTitle: p.wikiPageTitle,
                countryId: p.countryId,
                countryName: p.country.name,
                countrySlug: p.country.slug,
              },
            })),
        },
        subdivisions: {
          type: "FeatureCollection" as const,
          features: allFeatures.subdivisions
            .filter((s) => s.geometry)
            .map((s) => ({
              type: "Feature" as const,
              geometry: s.geometry as unknown as import("geojson").Geometry,
              properties: {
                id: s.id,
                name: s.name,
                subdivisionType: s.type,
                level: s.level,
                areaSqKm: s.areaSqKm,
                countryId: s.countryId,
                countryName: s.country.name,
                countrySlug: s.country.slug,
              },
            })),
        },
      };

      // Format capitals as GeoJSON
      const capitals = {
        type: "FeatureCollection" as const,
        features: capitalCities
          .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
          .map((c) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: c.coordinates as [number, number] },
            properties: {
              id: c.id,
              name: c.name,
              countryId: c.countryId,
              countryName: c.country.name,
              countrySlug: c.country.slug,
              population: c.population,
              wikiPageTitle: c.wikiPageTitle,
            },
          })),
      };

      return { worldMap, features, capitals };
    }),

  /**
   * Get a single country's geometry by feature ID, country name, or country DB ID.
   */
  getAllMapFeatures: cachedPublicProcedure.query(async ({ ctx }) => {
    const [cities, pois, subdivisions] = await Promise.all([
      ctx.db.city.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          name: true,
          coordinates: true,
          population: true,
          type: true,
          isNationalCapital: true,
          wikiPageTitle: true,
          countryId: true,
          country: { select: { name: true, slug: true } },
        },
      }),
      ctx.db.pointOfInterest.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          name: true,
          coordinates: true,
          category: true,
          icon: true,
          description: true,
          wikiPageTitle: true,
          countryId: true,
          country: { select: { name: true, slug: true } },
        },
      }),
      ctx.db.subdivision.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          name: true,
          type: true,
          level: true,
          areaSqKm: true,
          geometry: true,
          countryId: true,
          country: { select: { name: true, slug: true } },
        },
      }),
    ]);

    return {
      cities: {
        type: "FeatureCollection" as const,
        features: cities
          .filter((c) => Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2)
          .map((c) => {
            const coords = c.coordinates as [number, number];
            return {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: coords },
              properties: {
                id: c.id,
                name: c.name,
                cityType: c.type,
                isCapital: c.isNationalCapital,
                population: c.population,
                countryId: c.countryId,
                countryName: c.country.name,
                countrySlug: c.country.slug,
                wikiPageTitle: c.wikiPageTitle,
              },
            };
          }),
      },
      pois: {
        type: "FeatureCollection" as const,
        features: pois
          .filter((p) => Array.isArray(p.coordinates) && (p.coordinates as number[]).length >= 2)
          .map((p) => {
            const coords = p.coordinates as [number, number];
            return {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: coords },
              properties: {
                id: p.id,
                name: p.name,
                category: p.category,
                icon: p.icon,
                description: p.description,
                wikiPageTitle: p.wikiPageTitle,
                countryId: p.countryId,
                countryName: p.country.name,
                countrySlug: p.country.slug,
              },
            };
          }),
      },
      subdivisions: {
        type: "FeatureCollection" as const,
        features: subdivisions
          .filter((s) => s.geometry)
          .map((s) => ({
            type: "Feature" as const,
            geometry: s.geometry as unknown as import("geojson").Geometry,
            properties: {
              id: s.id,
              name: s.name,
              subdivisionType: s.type,
              level: s.level,
              areaSqKm: s.areaSqKm,
              countryId: s.countryId,
              countryName: s.country.name,
              countrySlug: s.country.slug,
            },
          })),
      },
    };
  }),

  /** Get all national capital cities as GeoJSON FeatureCollection for map display. */
};
