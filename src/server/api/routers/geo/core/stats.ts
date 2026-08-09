import { z } from "zod";
import { cachedPublicProcedure, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { detectConflicts, type FeatureData } from "~/lib/map-conflict-detector";

export const statsProcedures = {
  getMapStats: cachedPublicProcedure.query(async ({ ctx }) => {
    const [totalFeatures, politicalFeatures, linkedFeatures, unlinkedFeatures] = await Promise.all([
      ctx.db.mapLayer.count({ where: { isActive: true } }),
      ctx.db.mapLayer.count({
        where: { layerType: "political", isActive: true },
      }),
      ctx.db.mapLayer.count({
        where: {
          layerType: "political",
          isActive: true,
          countryId: { not: null },
        },
      }),
      ctx.db.mapLayer.count({
        where: {
          layerType: "political",
          isActive: true,
          countryId: null,
        },
      }),
    ]);

    const [totalCountries, countriesWithGeometry] = await Promise.all([
      ctx.db.country.count(),
      ctx.db.country.count({ where: { geometry: { not: null } as any } }),
    ]);

    return {
      totalFeatures,
      politicalFeatures,
      linkedFeatures,
      unlinkedFeatures,
      totalCountries,
      countriesWithGeometry,
      linkageRate:
        politicalFeatures > 0 ? Math.round((linkedFeatures / politicalFeatures) * 100) : 0,
    };
  }),

  /**
   * Admin: Get system health — linkage completeness and data integrity.
   */
  getSystemHealth: cachedPublicProcedure.query(async ({ ctx }) => {
    const [totalFeatures, linkedFeatures, totalCountries, countriesWithGeo, countriesWithWiki] =
      await Promise.all([
        ctx.db.mapLayer.count({ where: { layerType: "political", isActive: true } }),
        ctx.db.mapLayer.count({
          where: { layerType: "political", isActive: true, countryId: { not: null } },
        }),
        ctx.db.country.count({ where: { isDemo: false } }),
        ctx.db.country.count({ where: { isDemo: false, geometry: { not: null } as any } }),
        ctx.db.country.count({ where: { isDemo: false, wikiPageTitle: { not: null } } }),
      ]);

    return {
      mapFeatures: {
        total: totalFeatures,
        linked: linkedFeatures,
        unlinked: totalFeatures - linkedFeatures,
      },
      countries: {
        total: totalCountries,
        withGeometry: countriesWithGeo,
        withWiki: countriesWithWiki,
      },
      linkageHealth: totalFeatures > 0 ? Math.round((linkedFeatures / totalFeatures) * 100) : 0,
    };
  }),

  // ──────────────────────────────────────────────
  // Border Editor
  // ──────────────────────────────────────────────

  /** Get neighbor geometries for a feature (for shared border visualization). */
  getCountryConflicts: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, name: true, landArea: true },
      });
      if (!country) return { conflicts: [], countryName: "Unknown" };

      const [cities, pois, subdivisions] = await Promise.all([
        ctx.db.city.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: {
            id: true,
            name: true,
            coordinates: true,
            population: true,
            wikiPageTitle: true,
          },
        }),
        ctx.db.pointOfInterest.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: { id: true, name: true, coordinates: true, wikiPageTitle: true },
        }),
        ctx.db.subdivision.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: { id: true, name: true, areaSqKm: true },
        }),
      ]);

      const features: FeatureData[] = [
        ...cities.map((c) => ({
          id: c.id,
          name: c.name,
          type: "city" as const,
          coordinates: (Array.isArray(c.coordinates) ? c.coordinates : null) as
            [number, number] | null,
          wikiPageTitle: c.wikiPageTitle,
          population: c.population,
        })),
        ...pois.map((p) => ({
          id: p.id,
          name: p.name,
          type: "poi" as const,
          coordinates: (Array.isArray(p.coordinates) ? p.coordinates : null) as
            [number, number] | null,
          wikiPageTitle: p.wikiPageTitle,
        })),
        ...subdivisions.map((s) => ({
          id: s.id,
          name: s.name,
          type: "subdivision" as const,
          areaSqKm: s.areaSqKm,
        })),
      ];

      const conflicts = detectConflicts({
        countryId: input.countryId,
        countryName: country.name,
        totalAreaKm2: country.landArea ?? undefined,
        features,
      });

      return { conflicts, countryName: country.name };
    }),

  /** Get linkage status for a single country (used by map editor, detail sheets) */
  getSharedVertices: rateLimitedPublicProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const vertices = await ctx.db.sharedVertex.findMany({
        where: { worldId: "default" },
      });

      // Filter to those referencing this feature
      return vertices
        .filter((v) => {
          const refs = v.featureRefs as Array<{ featureId: string }>;
          return Array.isArray(refs) && refs.some((r) => r.featureId === input.featureId);
        })
        .map((v) => ({
          id: v.id,
          lng: v.lng,
          lat: v.lat,
          featureRefs: v.featureRefs as Array<{
            featureId: string;
            ringIndex: number;
            vertexIndex: number;
          }>,
          snapTarget: v.snapTarget,
        }));
    }),

  // ──────────────────────────────────────────────
  // Province Import Endpoints
  // ──────────────────────────────────────────────

  /**
   * Get a comprehensive geographic profile for a country.
   *
   * Analyzes the country's geometry against climate and altitude map layers
   * to produce climate distribution, elevation profile, derived stats
   * (arable land, landlocked/island), economic modifiers, and NPC trait modifiers.
   *
   * Uses PostGIS ST_Intersection for spatial analysis when available,
   * falls back to property-based estimation from MapLayer data.
   */
};
