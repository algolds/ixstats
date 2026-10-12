import { z } from "zod";
import { cachedPublicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import type { PrismaClient } from "@prisma/client";
import { compressFeatureCollection } from "~/lib/maps/geojson-compress";
import { packFeatureCollection } from "~/lib/maps/geojson-pack";
import {
  getCompressionForLayer,
  getZoomBucket,
  type ZoomBucket,
} from "~/server/modules/maps/layer-lod";

// The map's geometry layers (political, background, ...) are not tRPC procedures: they are served as packed JSON by
// the versioned GET /api/map-layers route (src/server/modules/maps/layer-delivery.ts). What stays here is what
// the layers do not carry: points, capitals, cities and subdivisions.
/** The realm's map version the client asks at: part of the query key, so a moved version refetches. Unused here. */
const versionInput = { version: z.number().int().min(0).optional() };

const zoomInput = z
  .object({
    /** Current map zoom level for LOD-based geometry simplification */
    zoom: z.number().min(0).max(20).optional(),
    ...realmScopeInput.shape,
    ...versionInput,
  })
  .optional();

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
  /**
   * What /maps draws on top of the layers on first load: POIs and capitals, and the realm they were resolved for.
   * Cities and subdivisions only draw from zoom 4, so they come from getMapBundleDetail once the viewer zooms in.
   */
  getMapBundleMarkers: cachedPublicProcedure
    .input(z.object({ ...realmScopeInput.shape, ...versionInput }).optional())
    .query(async ({ ctx, input }) => {
      const realmId = await viewerRealmId(ctx, input?.realm);
      const inRealm = { country: { realmId } };

      const [pois, capitalCities] = await Promise.all([
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

      // realmId: the realm these were resolved for, so clients can name it
      return { features: { pois }, capitals, realmId };
    }),

  /** The zoom-4 overlays the first-load markers leave out: cities, and subdivisions (packed). */
  getMapBundleDetail: cachedPublicProcedure.input(zoomInput).query(async ({ ctx, input }) => {
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
