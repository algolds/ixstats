import { z } from "zod";
import { cachedPublicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import type { FeatureCollection } from "geojson";
import type { PrismaClient } from "@prisma/client";
import { MAP_LAYER_TYPES } from "~/lib/maps/map-config";
import { compressFeatureCollection } from "~/lib/maps/geojson-compress";
import { packFeatureCollection, type PackedFeatureCollection } from "~/lib/maps/geojson-pack";
import { getCompressionForLayer, getZoomBucket, type ZoomBucket } from "./cache";
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

/** Layers in the packed wire format, each at the precision its LOD already truncates it to. */
function packLayers(
  layers: Record<string, FeatureCollection>,
  zoomBucket: ZoomBucket
): Record<string, PackedFeatureCollection> {
  const out: Record<string, PackedFeatureCollection> = {};
  for (const [layer, fc] of Object.entries(layers)) {
    out[layer] = packFeatureCollection(
      fc,
      getCompressionForLayer(layer, zoomBucket).coordinatePrecision
    );
  }
  return out;
}

const hasPoint = (c: { coordinates: unknown }) =>
  Array.isArray(c.coordinates) && (c.coordinates as number[]).length >= 2;

/** A stored [lng, lat] as a GeoJSON point at 5 dp (~1 m); the DB keeps up to 15. */
const toPoint = (coordinates: unknown) => {
  const [lng, lat] = coordinates as [number, number];
  const at5 = (n: number) => Math.round(n * 1e5) / 1e5;
  return { type: "Point" as const, coordinates: [at5(lng), at5(lat)] as [number, number] };
};

/** An overlay query's rows, or none when it fails, so overlays never take the base map down. */
async function orNone<T>(query: Promise<T[]>, what: string): Promise<T[]> {
  try {
    return await query;
  } catch (err) {
    console.error(`[geoCore] ${what} query failed; the map goes without them`, err);
    return [];
  }
}

const countryRef = { country: { select: { name: true, slug: true } } } as const;

type InRealm = { country: { realmId: string } };

/** Approved cities in the realm (drawn from zoom 4). */
async function loadCities(db: PrismaClient, inRealm: InRealm) {
  const cities = await orNone(
    db.city.findMany({
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
        ...countryRef,
      },
    }),
    "cities"
  );
  return {
    type: "FeatureCollection" as const,
    features: cities.filter(hasPoint).map((c) => ({
      type: "Feature" as const,
      geometry: toPoint(c.coordinates),
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
  };
}

/** Approved points of interest in the realm (clustered from the globe view). */
async function loadPois(db: PrismaClient, inRealm: InRealm) {
  const pois = await orNone(
    db.pointOfInterest.findMany({
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
        ...countryRef,
      },
    }),
    "points of interest"
  );
  return {
    type: "FeatureCollection" as const,
    features: pois.filter(hasPoint).map((p) => ({
      type: "Feature" as const,
      geometry: toPoint(p.coordinates),
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
  };
}

/** Approved subdivisions in the realm (drawn from zoom 4), at the political layer's LOD since
 * they are borders drawn inside it. */
async function loadSubdivisions(db: PrismaClient, inRealm: InRealm, zoomBucket: ZoomBucket) {
  const subdivisions = await orNone(
    db.subdivision.findMany({
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
        ...countryRef,
      },
    }),
    "subdivisions"
  );
  return compressFeatureCollection(
    {
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
    getCompressionForLayer("political", zoomBucket)
  );
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

  /** getWorldMap in the packed wire format (decode with `unpackLayers`): /maps and the map editor. */
  getWorldMapPacked: cachedPublicProcedure.input(worldMapInput).query(async ({ ctx, input }) => {
    const realmId = await viewerRealmId(ctx, input?.realm);
    const zoomBucket = getZoomBucket(input?.zoom);
    return packLayers(
      await loadWorldMapLayers(
        ctx.db,
        input?.layers ?? DEFAULT_WORLD_MAP_LAYERS,
        zoomBucket,
        realmId
      ),
      zoomBucket
    );
  }),

  /**
   * Batched first-load map data: the requested layers (packed; decode with `unpackLayers`), POIs
   * and capitals. Cities and subdivisions only draw from zoom 4, so they come from
   * getMapBundleDetail once the viewer zooms in.
   */
  getMapBundle: cachedPublicProcedure.input(worldMapInput).query(async ({ ctx, input }) => {
    const realmId = await viewerRealmId(ctx, input?.realm);
    const inRealm = { country: { realmId } };
    const zoomBucket = getZoomBucket(input?.zoom);

    const [worldMap, pois, capitalCities] = await Promise.all([
      loadWorldMapLayers(ctx.db, input?.layers ?? DEFAULT_WORLD_MAP_LAYERS, zoomBucket, realmId),
      loadPois(ctx.db, inRealm),

      orNone(
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
        "capitals"
      ),
    ]);

    // Format capitals as GeoJSON
    const capitals = {
      type: "FeatureCollection" as const,
      features: capitalCities.filter(hasPoint).map((c) => ({
        type: "Feature" as const,
        geometry: toPoint(c.coordinates),
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
    return { worldMap: packLayers(worldMap, zoomBucket), features: { pois }, capitals, realmId };
  }),

  /** The zoom-4 overlays the first-load bundle leaves out: cities, and subdivisions (packed). */
  getMapBundleDetail: cachedPublicProcedure.input(worldMapInput).query(async ({ ctx, input }) => {
    const inRealm = { country: { realmId: await viewerRealmId(ctx, input?.realm) } };
    const zoomBucket = getZoomBucket(input?.zoom);
    const [cities, subdivisions] = await Promise.all([
      loadCities(ctx.db, inRealm),
      loadSubdivisions(ctx.db, inRealm, zoomBucket),
    ]);
    return {
      cities,
      subdivisions: packFeatureCollection(
        subdivisions,
        getCompressionForLayer("political", zoomBucket).coordinatePrecision
      ),
    };
  }),

  /**
   * Get a single country's geometry by feature ID, country name, or country DB ID.
   */
  getAllMapFeatures: cachedPublicProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      const inRealm = { country: { realmId: await viewerRealmId(ctx, input?.realm) } };
      const [cities, pois, subdivisions] = await Promise.all([
        loadCities(ctx.db, inRealm),
        loadPois(ctx.db, inRealm),
        loadSubdivisions(ctx.db, inRealm, 1),
      ]);
      return { cities, pois, subdivisions };
    }),
};
