import { z } from "zod";
import { cachedPublicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import type { FeatureCollection } from "geojson";
import { MAP_LAYER_TYPES } from "~/lib/maps/map-config";
import { getZoomBucket, type ZoomBucket } from "./cache";
import { loadLayerWithFallback } from "./layer-loader";

const DEFAULT_WORLD_MAP_LAYERS = [
  "background",
  "political",
  "lakes",
  "rivers",
  "icecaps",
  "country_labels",
];

const worldMapInput = z
  .object({
    layers: z.array(z.enum(MAP_LAYER_TYPES as unknown as [string, ...string[]])).optional(),
    /** Current map zoom level for LOD-based geometry simplification */
    zoom: z.number().min(0).max(20).optional(),
    ...realmScopeInput.shape,
  })
  .optional();

/** The realm's requested layers (DB first; IxWorld alone falls back to its static files). */
async function loadWorldMapLayers(
  db: Parameters<typeof loadLayerWithFallback>[0],
  layers: string[],
  zoomBucket: ZoomBucket,
  realmId: string
): Promise<Record<string, FeatureCollection>> {
  const results: Record<string, FeatureCollection> = {};
  await Promise.all(
    layers.map(async (layer) => {
      const data = await loadLayerWithFallback(db, layer, zoomBucket, realmId);
      if (data) results[layer] = data;
    })
  );
  return results;
}

export const worldMapProcedures = {
  getWorldMap: cachedPublicProcedure.input(worldMapInput).query(async ({ ctx, input }) => {
    const realmId = await viewerRealmId(ctx, input?.realm);
    return loadWorldMapLayers(
      ctx.db,
      input?.layers ?? DEFAULT_WORLD_MAP_LAYERS,
      getZoomBucket(input?.zoom),
      realmId
    );
  }),

  /**
   * Batched map data endpoint — returns world map layers + overlay features + capitals
   * in a single request to reduce HTTP round-trips on initial map load.
   */
  getMapBundle: cachedPublicProcedure.input(worldMapInput).query(async ({ ctx, input }) => {
    const realmId = await viewerRealmId(ctx, input?.realm);
    const inRealm = { country: { realmId } };

    // Run all three queries in parallel
    const [worldMap, allFeatures, capitalCities] = await Promise.all([
      // 1. World map layers
      loadWorldMapLayers(
        ctx.db,
        input?.layers ?? DEFAULT_WORLD_MAP_LAYERS,
        getZoomBucket(input?.zoom),
        realmId
      ),

      // 2. Overlay features (cities, POIs, subdivisions)
      (async () => {
        const [cities, pois, subdivisions] = await Promise.all([
          ctx.db.city.findMany({
            where: { status: "approved", ...inRealm },
            select: {
              id: true,
              name: true,
              coordinates: true,
              population: true,
              type: true,
              isNationalCapital: true,
              isSubdivisionCapital: true,
              wikiPageTitle: true,
              countryId: true,
              country: { select: { name: true, slug: true } },
            },
          }),
          ctx.db.pointOfInterest.findMany({
            where: { status: "approved", ...inRealm },
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
            where: { status: "approved", ...inRealm },
            select: {
              id: true,
              name: true,
              type: true,
              level: true,
              areaSqKm: true,
              geometry: true,
              color: true,
              countryId: true,
              country: { select: { name: true, slug: true } },
            },
          }),
        ]);
        return { cities, pois, subdivisions };
      })(),

      // 3. Capital cities
      ctx.db.city.findMany({
        where: { isNationalCapital: true, status: "approved", ...inRealm },
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
              isSubdivisionCapital: c.isSubdivisionCapital,
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
              color: s.color,
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

    // realmId: the realm these layers were resolved for, so clients can cache them under it
    return { worldMap, features, capitals, realmId };
  }),

  /**
   * Get a single country's geometry by feature ID, country name, or country DB ID.
   */
  getAllMapFeatures: cachedPublicProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      const inRealm = { country: { realmId: await viewerRealmId(ctx, input?.realm) } };
      const [cities, pois, subdivisions] = await Promise.all([
        ctx.db.city.findMany({
          where: { status: "approved", ...inRealm },
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
          where: { status: "approved", ...inRealm },
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
          where: { status: "approved", ...inRealm },
          select: {
            id: true,
            name: true,
            type: true,
            level: true,
            areaSqKm: true,
            geometry: true,
            color: true,
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
                color: s.color,
                countryId: s.countryId,
                countryName: s.country.name,
                countrySlug: s.country.slug,
              },
            })),
        },
      };
    }),
};
