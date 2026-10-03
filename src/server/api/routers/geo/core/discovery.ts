import { z } from "zod";
import { cachedPublicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import type { LayerInfoItemDto } from "~/types/geo.dto";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { MAP_LAYER_TYPES } from "~/lib/maps/map-config";
import { centroidLngLat, computeVisualCenter } from "./geometry";
import { getColorForFeature } from "./layer-loader";

export const discoveryProcedures = {
  listCountries: cachedPublicProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }): Promise<LayerInfoItemDto[]> => {
      const layers = await ctx.db.mapLayer.findMany({
        where: {
          layerType: "political",
          isActive: true,
          realmId: await viewerRealmId(ctx, input?.realm),
        },
        select: {
          featureId: true,
          displayName: true,
          properties: true,
          countryId: true,
          areaSqKm: true,
          centroid: true,
        },
        orderBy: { displayName: "asc" },
      });

      return layers.map(
        (l: {
          featureId: string;
          displayName: string | null;
          properties: unknown;
          countryId: string | null;
          areaSqKm: number | null;
          centroid: unknown;
        }) => {
          const [cLng, cLat] = centroidLngLat(l.centroid);
          return {
            featureId: l.featureId,
            displayName: l.displayName || featureIdToDisplayName(l.featureId),
            fillColor: getColorForFeature(l.featureId, l.properties as Record<string, unknown>),
            countryId: l.countryId,
            areaSqKm: l.areaSqKm,
            centroidLng: cLng,
            centroidLat: cLat,
            isClaimed: !!l.countryId,
          };
        }
      );
    }),

  /**
   * Get available layer types and their metadata.
   */
  getLayerInfo: cachedPublicProcedure
    .input(realmScopeInput.optional())
    .query(async ({ ctx, input }) => {
      const counts = (await (ctx.db as any).mapLayer.groupBy({
        by: ["layerType"],
        where: { isActive: true, realmId: await viewerRealmId(ctx, input?.realm) },
        _count: { id: true },
      })) as Array<{ layerType: string; _count: { id: number } }>;

      const countMap = new Map(
        counts.map((c: { layerType: string; _count: { id: number } }) => [c.layerType, c._count.id])
      );

      return MAP_LAYER_TYPES.map((type) => ({
        type,
        featureCount: (countMap.get(type) as number) || 0,
        available: ((countMap.get(type) as number) || 0) > 0,
      }));
    }),

  /**
   * Search map features by name (full-text search).
   */
  searchFeatures: cachedPublicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        types: z.array(z.enum(["political", "city", "poi", "subdivision"])).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        ...realmScopeInput.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;
      const realmId = await viewerRealmId(ctx, input.realm);
      const results: Array<{
        type: string;
        id: string;
        name: string;
        countryId: string | null;
        centroidLng: number;
        centroidLat: number;
      }> = [];

      const searchTypes = input.types ?? ["political", "city", "poi", "subdivision"];

      // Search map layers (political features) — search displayName OR featureId
      if (searchTypes.includes("political")) {
        const features = await ctx.db.mapLayer.findMany({
          where: {
            layerType: "political",
            isActive: true,
            realmId,
            OR: [
              { displayName: { contains: input.query, mode: "insensitive" as const } },
              { featureId: { contains: input.query, mode: "insensitive" as const } },
            ],
          },
          select: {
            featureId: true,
            displayName: true,
            countryId: true,
            centroid: true,
          },
          take: limit,
          orderBy: { displayName: "asc" },
        });

        for (const f of features) {
          const [cLng, cLat] = centroidLngLat(f.centroid);
          results.push({
            type: "country",
            id: f.featureId,
            name: f.displayName || featureIdToDisplayName(f.featureId),
            countryId: f.countryId,
            centroidLng: cLng,
            centroidLat: cLat,
          });
        }
      }

      // Search cities
      if (searchTypes.includes("city")) {
        const cities = await ctx.db.city.findMany({
          where: {
            name: { contains: input.query, mode: "insensitive" as const },
            status: "approved",
            country: { realmId },
          },
          select: {
            id: true,
            name: true,
            countryId: true,
            coordinates: true,
          },
          take: limit,
        });

        for (const c of cities) {
          const coords = c.coordinates as [number, number] | null;
          results.push({
            type: "city",
            id: c.id,
            name: c.name,
            countryId: c.countryId,
            centroidLng: coords?.[0] ?? 0,
            centroidLat: coords?.[1] ?? 0,
          });
        }
      }

      // Search subdivisions
      if (searchTypes.includes("subdivision")) {
        const subs = await ctx.db.subdivision.findMany({
          where: {
            name: { contains: input.query, mode: "insensitive" as const },
            status: "approved",
            country: { realmId },
          },
          select: {
            id: true,
            name: true,
            countryId: true,
            geometry: true,
          },
          take: limit,
        });

        for (const s of subs) {
          const [cLng, cLat] = s.geometry ? computeVisualCenter(s.geometry) : [0, 0];
          results.push({
            type: "subdivision",
            id: s.id,
            name: s.name,
            countryId: s.countryId,
            centroidLng: cLng,
            centroidLat: cLat,
          });
        }
      }

      return results.slice(0, limit);
    }),
};
