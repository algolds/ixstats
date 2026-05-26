import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure, systemOwnerProcedure, cachedPublicProcedure, rateLimitedPublicProcedure, countryOwnerProcedure, standardMutationCountryOwnerProcedure } from "~/server/api/trpc";
import { z } from "zod";
import * as Shared from "./shared";

export const geoCoreRouter = createTRPCRouter({
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
        | [number, number]
        | { coordinates?: [number, number] }
        | null;
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
  getCountryAtPoint: rateLimitedPublicProcedure
    .input(
      z.object({
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
      })
    )
    .query(async ({ ctx, input }) => {
      // Use PostGIS spatial query
      try {
        const results = await ctx.db.$queryRawUnsafe<
          Array<{
            id: string;
            featureId: string;
            displayName: string | null;
            countryId: string | null;
            properties: unknown;
          }>
        >(
          `SELECT id, "featureId", "displayName", "countryId", properties
           FROM map_layers
           WHERE "layerType" = 'political'
             AND "isActive" = true
             AND geom_postgis IS NOT NULL
             AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($1, $2), 4326))
           LIMIT 1`,
          input.lng,
          input.lat
        );

        if (results.length > 0) {
          const r = results[0];
          return {
            featureId: r.featureId,
            displayName: r.displayName || featureIdToDisplayName(r.featureId),
            countryId: r.countryId,
            fillColor: getColorForFeature(r.featureId, r.properties as Record<string, unknown>),
          };
        }
      } catch {
        // PostGIS query failed, geometry may not be synced yet
      }

      return null;
    }),
  getPointInfo: rateLimitedPublicProcedure
    .input(
      z.object({
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Query altitude, climate, and political layers at this point
        const layerResults = await ctx.db.$queryRawUnsafe<
          Array<{
            layerType: string;
            featureId: string;
            displayName: string | null;
            properties: Record<string, unknown>;
            countryId: string | null;
          }>
        >(
          `SELECT "layerType", "featureId", "displayName", properties, "countryId"
           FROM map_layers
           WHERE "isActive" = true
             AND geom_postgis IS NOT NULL
             AND "layerType" IN ('altitudes', 'climate', 'political')
             AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($1, $2), 4326))`,
          input.lng,
          input.lat
        );

        const altitude = layerResults.find((r) => r.layerType === "altitudes");
        const climate = layerResults.find((r) => r.layerType === "climate");
        const political = layerResults.find((r) => r.layerType === "political");

        // If we found a country, also check for subdivision
        let subdivision: { id: string; name: string; type: string | null } | null = null;
        let countryInfo: {
          id: string;
          name: string;
          slug: string | null;
          flag: string | null;
        } | null = null;

        if (political?.countryId) {
          // Get country info
          const country = await ctx.db.country.findUnique({
            where: { id: political.countryId },
            select: { id: true, name: true, slug: true, flag: true },
          });
          if (country) countryInfo = country;

          // Check for subdivision at this point
          try {
            const subResults = await ctx.db.$queryRawUnsafe<
              Array<{ id: string; name: string; type: string | null }>
            >(
              `SELECT id, name, type FROM subdivisions
               WHERE "countryId" = $1 AND status = 'approved'
                 AND geom_postgis IS NOT NULL
                 AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($2, $3), 4326))
               LIMIT 1`,
              political.countryId,
              input.lng,
              input.lat
            );
            if (subResults.length > 0) subdivision = subResults[0]!;
          } catch {
            // Subdivision query failed — no PostGIS data yet
          }
        }

        const altProps = altitude?.properties ?? {};
        const climProps = climate?.properties ?? {};

        // Derive elevation zone from fill color if metadata not yet enriched
        const altFill = (altProps.fill as string) ?? null;
        const derivedZone = altFill ? getZoneByColor(altFill) : null;

        // Derive climate name from fill color if metadata not yet enriched
        const climFill = (climProps.fill as string) ?? null;
        const derivedClimate = climFill
          ? (CLIMATE_COLOR_MAP[climFill.toLowerCase()] ?? null)
          : null;

        return {
          coordinates: { lng: input.lng, lat: input.lat },
          elevation: altitude
            ? {
                zoneId: (altProps.zoneId as string) ?? derivedZone?.zoneId ?? null,
                zoneName: (altProps.zoneName as string) ?? derivedZone?.zoneName ?? null,
                elevationMin:
                  (altProps.elevationMin as number) ?? derivedZone?.elevationMin ?? null,
                elevationMax:
                  (altProps.elevationMax as number) ?? derivedZone?.elevationMax ?? null,
                elevationLabel:
                  (altProps.elevationLabel as string) ??
                  (derivedZone ? `${derivedZone.elevationMin}-${derivedZone.elevationMax}m` : null),
                color: altFill ?? derivedZone?.color ?? null,
              }
            : null,
          climate: climate
            ? {
                climateId: (climProps.climateId as string) ?? null,
                climateName: (climProps.climateName as string) ?? derivedClimate ?? null,
                color: climFill,
              }
            : null,
          country: political
            ? {
                featureId: political.featureId,
                displayName: political.displayName || featureIdToDisplayName(political.featureId),
                countryId: political.countryId,
                ...(countryInfo
                  ? {
                      name: countryInfo.name,
                      slug: countryInfo.slug,
                      flag: normalizeFlagUrl(countryInfo.flag),
                    }
                  : {}),
              }
            : null,
          subdivision,
        };
      } catch {
        // PostGIS not available or geometry not synced
        return {
          coordinates: { lng: input.lng, lat: input.lat },
          elevation: null,
          climate: null,
          country: null,
          subdivision: null,
        };
      }
    }),
  listCountries: cachedPublicProcedure.query(async ({ ctx }) => {
    const layers = await ctx.db.mapLayer.findMany({
      where: { layerType: "political", isActive: true },
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
        const raw = l.centroid as [number, number] | { coordinates?: [number, number] } | null;
        let cLng = 0,
          cLat = 0;
        if (Array.isArray(raw) && raw.length >= 2) {
          cLng = raw[0];
          cLat = raw[1];
        } else if (raw && "coordinates" in raw && Array.isArray(raw.coordinates)) {
          cLng = raw.coordinates[0];
          cLat = raw.coordinates[1];
        }
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
  getLayerInfo: cachedPublicProcedure.query(async ({ ctx }) => {
    const counts = await (ctx.db as any).mapLayer.groupBy({
      by: ["layerType"],
      where: { isActive: true },
      _count: { id: true },
    }) as Array<{ layerType: string; _count: { id: number } }>;

    const countMap = new Map(
      counts.map((c: { layerType: string; _count: { id: number } }) => [c.layerType, c._count.id])
    );

    return MAP_LAYER_TYPES.map((type) => ({
      type,
      featureCount: (countMap.get(type) as number) || 0,
      available: ((countMap.get(type) as number) || 0) > 0,
    }));
  }),
  searchFeatures: cachedPublicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        types: z.array(z.enum(["political", "city", "poi", "subdivision"])).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20;
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
          const raw = f.centroid as [number, number] | { coordinates?: [number, number] } | null;
          let cLng = 0,
            cLat = 0;
          if (Array.isArray(raw) && raw.length >= 2) {
            cLng = raw[0];
            cLat = raw[1];
          } else if (raw && "coordinates" in raw && Array.isArray(raw.coordinates)) {
            cLng = raw.coordinates[0];
            cLat = raw.coordinates[1];
          }
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
          },
          select: {
            id: true,
            name: true,
            countryId: true,
          },
          take: limit,
        });

        for (const s of subs) {
          results.push({
            type: "subdivision",
            id: s.id,
            name: s.name,
            countryId: s.countryId,
            centroidLng: 0,
            centroidLat: 0,
          });
        }
      }

      return results.slice(0, limit);
    }),
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
  getCountryFeatures: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [subdivisions, cities, pois, storyPins, mapLabels] = await Promise.all([
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
      ]);

      return { subdivisions, cities, pois, storyPins, mapLabels };
    }),
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
  recalculateArea: adminProcedure
    .input(z.object({ featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { layerType: "political", featureId: input.featureId },
      });

      if (!mapLayer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Map feature not found: ${input.featureId}`,
        });
      }

      try {
        const result = await ctx.db.$queryRawUnsafe<Array<{ area_sqkm: number }>>(
          `SELECT ST_Area(geom_postgis::geography) / 1000000.0 as area_sqkm
           FROM map_layers WHERE id = $1 AND geom_postgis IS NOT NULL`,
          mapLayer.id
        );

        if (result.length > 0 && result[0].area_sqkm) {
          await ctx.db.mapLayer.update({
            where: { id: mapLayer.id },
            data: { areaSqKm: result[0].area_sqkm },
          });
          return {
            featureId: input.featureId,
            areaSqKm: result[0].area_sqkm,
          };
        }
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "PostGIS area calculation failed",
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No geometry available for area calculation",
      });
    }),
  recalculateAllAreas: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await ctx.db.$executeRawUnsafe(`
        UPDATE map_layers
        SET "areaSqKm" = ST_Area(geom_postgis::geography) / 1000000.0
        WHERE "layerType" = 'political'
          AND geom_postgis IS NOT NULL
      `);
      return { updated: result };
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "PostGIS bulk area recalculation failed",
      });
    }
  }),
  validatePointInCountry: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        lng: z.number(),
        lat: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.$queryRawUnsafe<Array<{ is_inside: boolean }>>(
          `SELECT ST_Contains(
             (SELECT geom_postgis FROM map_layers WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL LIMIT 1),
             ST_SetSRID(ST_MakePoint($2, $3), 4326)
           ) as is_inside`,
          input.countryId,
          input.lng,
          input.lat
        );
        return { isInside: result[0]?.is_inside ?? false };
      } catch {
        return { isInside: false };
      }
    }),
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
            | [number, number]
            | null,
          wikiPageTitle: c.wikiPageTitle,
          population: c.population,
        })),
        ...pois.map((p) => ({
          id: p.id,
          name: p.name,
          type: "poi" as const,
          coordinates: (Array.isArray(p.coordinates) ? p.coordinates : null) as
            | [number, number]
            | null,
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
  getCountryGeoProfile: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 1. Get country geometry and basic info
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          id: true,
          name: true,
          geometry: true,
          centroid: true,
          boundingBox: true,
          coastlineKm: true,
          landArea: true,
          areaSqMi: true,
        },
      });

      if (!country) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      const countryGeo = country.geometry as import("geojson").Geometry | null;
      const centroid = country.centroid as [number, number] | null;
      const bbox = country.boundingBox as [number, number, number, number] | null;

      if (!countryGeo || !centroid) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Country has no map geometry. Link it to a map feature first.",
        });
      }

      // 2. Get intersecting map layers for climate and altitude analysis
      const [climateLayers, altitudeLayers, riverLayers, lakeLayers] = await Promise.all([
        ctx.db.mapLayer.findMany({
          where: { layerType: "climate", isActive: true },
          select: {
            featureId: true,
            geometry: true,
            properties: true,
            areaSqKm: true,
            displayName: true,
          },
        }),
        ctx.db.mapLayer.findMany({
          where: { layerType: "altitudes", isActive: true },
          select: {
            featureId: true,
            geometry: true,
            properties: true,
            areaSqKm: true,
            displayName: true,
          },
        }),
        ctx.db.mapLayer.findMany({
          where: { layerType: "rivers", isActive: true },
          select: {
            featureId: true,
            properties: true,
            areaSqKm: true,
          },
        }),
        ctx.db.mapLayer.findMany({
          where: { layerType: "lakes", isActive: true },
          select: {
            featureId: true,
            areaSqKm: true,
          },
        }),
      ]);

      // 3. Compute area (use stored value or estimate from geometry)
      const areaKm2 = country.landArea ?? (country.areaSqMi ? country.areaSqMi / 0.386102 : 0);

      // 4. Build climate distribution
      // Strategy: match climate features by checking if they overlap the country's bbox
      // (client-side approximation; PostGIS ST_Intersection would be more precise)
      const climateDistribution: ClimateZoneEntry[] = [];
      const countryMinLng = bbox?.[0] ?? -180;
      const countryMinLat = bbox?.[1] ?? -90;
      const countryMaxLng = bbox?.[2] ?? 180;
      const countryMaxLat = bbox?.[3] ?? 90;

      for (const cl of climateLayers) {
        const props = cl.properties as Record<string, unknown> | null;
        if (!props) continue;

        // Check rough bbox overlap
        const clGeo = cl.geometry as import("geojson").Geometry | null;
        if (!clGeo) continue;

        // Resolve climate type from fill color (SVG paths have no text names)
        const fill = (props["fill"] as string) ?? "";
        const climateName = resolveClimateFromColor(fill);
        if (!climateName) continue;

        // Simple bbox overlap test using the climate feature's centroid or first coord
        const clArea = cl.areaSqKm ?? 0;
        if (clArea <= 0) continue;

        // For now, use a proportional estimation based on the feature's total area
        // and the country's relative size. This will be replaced with PostGIS
        // ST_Intersection once the endpoint is validated.
        // We estimate overlap fraction from bbox coverage
        const overlapFraction = estimateBboxOverlap(
          clGeo,
          countryMinLng,
          countryMinLat,
          countryMaxLng,
          countryMaxLat
        );
        if (overlapFraction <= 0) continue;

        const overlapArea = clArea * overlapFraction;
        const agFactor = getAgricultureFactor(climateName);

        // Aggregate same climate types (multiple SVG polygons per zone)
        const existing = climateDistribution.find((e) => e.type === climateName);
        if (existing) {
          existing.areaSqKm += overlapArea;
        } else {
          climateDistribution.push({
            type: climateName,
            percentArea: 0, // computed below
            areaSqKm: overlapArea,
            agricultureFactor: agFactor,
          });
        }
      }

      // Normalize climate percentages
      const totalClimateArea = climateDistribution.reduce((s, z) => s + z.areaSqKm, 0);
      for (const z of climateDistribution) {
        z.percentArea =
          totalClimateArea > 0 ? Math.round((z.areaSqKm / totalClimateArea) * 100 * 10) / 10 : 0;
      }
      // Sort by area descending
      climateDistribution.sort((a, b) => b.areaSqKm - a.areaSqKm);

      // 5. Build elevation profile
      const elevationProfile: ElevationZoneEntry[] = [];
      for (const al of altitudeLayers) {
        const props = al.properties as Record<string, unknown> | null;
        if (!props) continue;

        const alGeo = al.geometry as import("geojson").Geometry | null;
        if (!alGeo) continue;

        const alArea = al.areaSqKm ?? 0;
        if (alArea <= 0) continue;

        const overlapFraction = estimateBboxOverlap(
          alGeo,
          countryMinLng,
          countryMinLat,
          countryMaxLng,
          countryMaxLat
        );
        if (overlapFraction <= 0) continue;

        const overlapArea = alArea * overlapFraction;

        // Match to elevation zone by color or name
        const fill = (props["fill"] as string) ?? "";
        const zoneMatch = ELEVATION_ZONES.find(
          (ez) => ez.color.toLowerCase() === fill.toLowerCase()
        );

        if (zoneMatch) {
          // Aggregate into existing zone or create new entry
          const existing = elevationProfile.find((e) => e.zone === zoneMatch.zoneId);
          if (existing) {
            existing.areaSqKm += overlapArea;
          } else {
            elevationProfile.push({
              zone: zoneMatch.zoneId,
              name: zoneMatch.zoneName,
              percentArea: 0, // computed below
              areaSqKm: overlapArea,
              minElev: zoneMatch.elevationMin,
              maxElev: zoneMatch.elevationMax,
            });
          }
        }
      }

      // Normalize elevation percentages
      const totalElevArea = elevationProfile.reduce((s, z) => s + z.areaSqKm, 0);
      for (const z of elevationProfile) {
        z.percentArea =
          totalElevArea > 0 ? Math.round((z.areaSqKm / totalElevArea) * 100 * 10) / 10 : 0;
      }
      elevationProfile.sort((a, b) => a.minElev - b.minElev);

      // 6. Estimate hydrography (rough: count features in bbox)
      const riverCount = riverLayers.length;
      const totalRiverLengthKm = riverLayers.reduce((s, r) => {
        const p = r.properties as Record<string, unknown> | null;
        return s + ((p?.["lengthKm"] as number) ?? r.areaSqKm ?? 0);
      }, 0);
      const lakeCount = lakeLayers.length;
      const totalLakeAreaSqKm = lakeLayers.reduce((s, l) => s + (l.areaSqKm ?? 0), 0);

      // 7. Find neighbors + coastline via PostGIS spatial queries
      // Uses ST_Intersects on JSONB geometry cast to PostGIS geometry for pixel-perfect
      // neighbor detection and accurate coastline/shared-border computation.
      interface PostGISNeighborRow {
        id: string;
        name: string;
        slug: string | null;
        shared_border_km: number;
      }

      let neighborCountries: Array<{
        id: string;
        name: string;
        slug: string | null;
        sharedBorderKm: number;
      }> = [];
      let perimeterKm = 0;
      let coastlineKm = 0;

      try {
        // Query 1: Find all neighboring countries and their shared border lengths
        const neighborRows = await ctx.db.$queryRawUnsafe<PostGISNeighborRow[]>(
          `
          WITH country AS (
            SELECT id, name,
              ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326)) as geom
            FROM "Country"
            WHERE id = $1
            LIMIT 1
          )
          SELECT DISTINCT ON (c2.id)
            c2.id, c2.name, c2.slug,
            ST_Length(
              ST_Intersection(
                ST_Boundary(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326))),
                ST_Boundary(c.geom)
              )::geography
            ) / 1000 as shared_border_km
          FROM country c
          JOIN map_layers ml ON ml."layerType" = 'political'
            AND ml."isActive" = true
            AND ml."countryId" IS NOT NULL
            AND ml."countryId" != c.id
          JOIN "Country" c2 ON c2.id = ml."countryId"
          WHERE ST_Intersects(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(ml.geometry::text), 4326)),
            c.geom
          )
          ORDER BY c2.id, shared_border_km DESC
        `,
          input.countryId
        );

        neighborCountries = neighborRows
          .filter((r) => Number(r.shared_border_km) > 0)
          .map((r) => ({
            id: r.id,
            name: r.name,
            slug: r.slug,
            sharedBorderKm: Math.round(Number(r.shared_border_km)),
          }))
          .sort((a, b) => b.sharedBorderKm - a.sharedBorderKm);

        // Query 2: Get country perimeter for coastline calculation
        const perimResult = await ctx.db.$queryRawUnsafe<Array<{ perimeter_km: number }>>(
          `
          SELECT ST_Perimeter(
            ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326))::geography
          ) / 1000 as perimeter_km
          FROM "Country"
          WHERE id = $1
        `,
          input.countryId
        );

        perimeterKm = Math.round(Number(perimResult[0]?.perimeter_km ?? 0));
        const totalSharedBorderKm = neighborCountries.reduce((s, n) => s + n.sharedBorderKm, 0);
        coastlineKm = Math.max(0, perimeterKm - totalSharedBorderKm);
      } catch {
        // PostGIS unavailable or geometry invalid — fall back to bbox estimation
        const latMid = (countryMinLat + countryMaxLat) / 2;
        const degToKm = 111.32;
        const cosLat = Math.cos((latMid * Math.PI) / 180);
        perimeterKm = Math.round(
          2 *
            ((countryMaxLat - countryMinLat) * degToKm +
              (countryMaxLng - countryMinLng) * degToKm * cosLat) *
            1.3
        );
        coastlineKm = country.coastlineKm ?? perimeterKm;
      }

      const neighborCount = neighborCountries.length;
      const profile = buildGeoProfile({
        climateDistribution,
        elevationProfile,
        coastlineKm,
        neighborCount,
        totalRiverLengthKm,
        totalLakeAreaSqKm: totalLakeAreaSqKm,
        areaKm2,
      });

      // 9. Compute gameplay modifiers
      const economicModifiers = computeEconomicGeoModifiers(profile);
      const npcModifiers = computeNPCGeoModifiers(profile);
      const crisisRisk = computeCrisisRiskFactors(profile);

      // 10. Temperature and precipitation estimates
      const centroidLat = centroid[1] ?? 0;
      const temp = estimateTemperature(centroidLat, profile.meanElevation, climateDistribution);
      const precipMm = estimatePrecipitation(climateDistribution, profile.meanElevation);

      // 11. Area metrics (perimeterKm already computed by PostGIS above)
      const nsSpanKm = bbox ? Math.abs(bbox[3] - bbox[1]) * 111.32 : 0;
      const ewSpanKm = bbox
        ? Math.abs(bbox[2] - bbox[0]) * 111.32 * Math.cos((centroidLat * Math.PI) / 180)
        : 0;

      return {
        countryId: country.id,
        countryName: country.name,
        area: {
          areaKm2: Math.round(areaKm2),
          perimeterKm: Math.round(perimeterKm),
          nsSpanKm: Math.round(nsSpanKm),
          ewSpanKm: Math.round(ewSpanKm),
          centroid,
        },
        climate: {
          zones: climateDistribution,
          dominant: profile.dominantClimate,
          diversityIndex: profile.climateDiversity,
          estMeanTempC: temp.meanTempC,
          estAnnualPrecipMm: precipMm,
          estSummerHighC: temp.summerHighC,
          estWinterLowC: temp.winterLowC,
        },
        elevation: {
          zones: elevationProfile,
          dominant: profile.dominantElevation,
          meanElev: profile.meanElevation,
          terrainRoughness: profile.terrainRoughness,
        },
        hydro: {
          riverCount,
          totalRiverLengthKm: Math.round(totalRiverLengthKm),
          lakeCount,
          totalLakeAreaSqKm: Math.round(totalLakeAreaSqKm),
          drainageDensity: profile.drainageDensity,
        },
        derived: {
          arableLandPercent: profile.arableLandPercent,
          isLandlocked: profile.isLandlocked,
          isIsland: profile.isIsland,
          coastlineKm: profile.coastlineKm,
          neighborCount: profile.neighborCount,
        },
        neighbors: neighborCountries.map((n) => ({
          id: n.id,
          name: n.name,
          slug: n.slug,
          sharedBorderKm: n.sharedBorderKm,
        })),
        economic: economicModifiers,
        npcModifiers,
        crisisRisk,
      };
    }),
  recalculateGeoProfiles: adminProcedure
    .input(z.object({ countryId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      // Get countries to process
      const countries = await ctx.db.country.findMany({
        where: input?.countryId ? { id: input.countryId } : { geometry: { not: null } },
        select: { id: true, name: true },
      });

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const country of countries) {
        try {
          // Call the profile computation endpoint internally (reuse logic)
          // We directly compute here to avoid circular calls
          const profileResult = await ctx.db.country.findUnique({
            where: { id: country.id },
            select: {
              coastlineKm: true,
              landArea: true,
              areaSqMi: true,
              geometry: true,
              centroid: true,
              boundingBox: true,
            },
          });

          if (!profileResult?.geometry) {
            errors.push(`${country.name}: no geometry`);
            failed++;
            continue;
          }

          const coastlineKm = profileResult.coastlineKm ?? 0;
          const areaKm2 =
            profileResult.landArea ??
            (profileResult.areaSqMi ? profileResult.areaSqMi / 0.386102 : 0);
          const bbox = profileResult.boundingBox as [number, number, number, number] | null;

          // Get climate/altitude layers for this country's bbox
          const [climateLayers, altitudeLayers] = await Promise.all([
            ctx.db.mapLayer.findMany({
              where: { layerType: "climate", isActive: true },
              select: {
                featureId: true,
                geometry: true,
                properties: true,
                areaSqKm: true,
                displayName: true,
              },
            }),
            ctx.db.mapLayer.findMany({
              where: { layerType: "altitudes", isActive: true },
              select: { featureId: true, geometry: true, properties: true, areaSqKm: true },
            }),
          ]);

          const countryMinLng = bbox?.[0] ?? -180;
          const countryMinLat = bbox?.[1] ?? -90;
          const countryMaxLng = bbox?.[2] ?? 180;
          const countryMaxLat = bbox?.[3] ?? 90;

          // Build climate distribution
          const climateDistribution: ClimateZoneEntry[] = [];
          for (const cl of climateLayers) {
            const props = cl.properties as Record<string, unknown> | null;
            if (!props) continue;
            const clGeo = cl.geometry as import("geojson").Geometry | null;
            if (!clGeo || !cl.areaSqKm || cl.areaSqKm <= 0) continue;

            const clFill = (props["fill"] as string) ?? "";
            const climateName = resolveClimateFromColor(clFill);
            if (!climateName) continue;

            const overlapFraction = estimateBboxOverlap(
              clGeo,
              countryMinLng,
              countryMinLat,
              countryMaxLng,
              countryMaxLat
            );
            if (overlapFraction <= 0) continue;

            climateDistribution.push({
              type: climateName,
              percentArea: 0,
              areaSqKm: cl.areaSqKm * overlapFraction,
              agricultureFactor: getAgricultureFactor(climateName),
            });
          }
          const totalClimateArea = climateDistribution.reduce((s, z) => s + z.areaSqKm, 0);
          for (const z of climateDistribution) {
            z.percentArea =
              totalClimateArea > 0
                ? Math.round((z.areaSqKm / totalClimateArea) * 100 * 10) / 10
                : 0;
          }

          // Build elevation profile
          const elevationProfile: ElevationZoneEntry[] = [];
          for (const al of altitudeLayers) {
            const props = al.properties as Record<string, unknown> | null;
            if (!props) continue;
            const alGeo = al.geometry as import("geojson").Geometry | null;
            if (!alGeo || !al.areaSqKm || al.areaSqKm <= 0) continue;

            const overlapFraction = estimateBboxOverlap(
              alGeo,
              countryMinLng,
              countryMinLat,
              countryMaxLng,
              countryMaxLat
            );
            if (overlapFraction <= 0) continue;

            const fill = (props["fill"] as string) ?? "";
            const zoneMatch = ELEVATION_ZONES.find(
              (ez) => ez.color.toLowerCase() === fill.toLowerCase()
            );
            if (!zoneMatch) continue;

            const existing = elevationProfile.find((e) => e.zone === zoneMatch.zoneId);
            if (existing) {
              existing.areaSqKm += al.areaSqKm * overlapFraction;
            } else {
              elevationProfile.push({
                zone: zoneMatch.zoneId,
                name: zoneMatch.zoneName,
                percentArea: 0,
                areaSqKm: al.areaSqKm * overlapFraction,
                minElev: zoneMatch.elevationMin,
                maxElev: zoneMatch.elevationMax,
              });
            }
          }
          const totalElevArea = elevationProfile.reduce((s, z) => s + z.areaSqKm, 0);
          for (const z of elevationProfile) {
            z.percentArea =
              totalElevArea > 0 ? Math.round((z.areaSqKm / totalElevArea) * 100 * 10) / 10 : 0;
          }

          const profile = buildGeoProfile({
            climateDistribution,
            elevationProfile,
            coastlineKm,
            neighborCount: 0,
            totalRiverLengthKm: 0,
            totalLakeAreaSqKm: 0,
            areaKm2,
          });
          const econ = computeEconomicGeoModifiers(profile);

          // Upsert the profile
          await ctx.db.countryGeoProfile.upsert({
            where: { countryId: country.id },
            create: {
              countryId: country.id,
              climateDistribution:
                climateDistribution as unknown as import("@prisma/client").Prisma.JsonValue,
              elevationProfile:
                elevationProfile as unknown as import("@prisma/client").Prisma.JsonValue,
              arableLandPercent: profile.arableLandPercent,
              coastlineKm,
              isLandlocked: profile.isLandlocked,
              isIsland: profile.isIsland,
              riverKm: 0,
              lakeAreaSqKm: 0,
              neighborCount: profile.neighborCount,
              dominantClimate: profile.dominantClimate,
              dominantElevation: profile.dominantElevation,
              meanElevation: profile.meanElevation,
              terrainRoughness: profile.terrainRoughness,
              gdpModifier: econ.gdpModifier,
              tradeModifier: econ.tradeModifier,
              infraCostModifier: econ.infraCostModifier,
              lastCalculatedAt: new Date(),
            },
            update: {
              climateDistribution:
                climateDistribution as unknown as import("@prisma/client").Prisma.JsonValue,
              elevationProfile:
                elevationProfile as unknown as import("@prisma/client").Prisma.JsonValue,
              arableLandPercent: profile.arableLandPercent,
              coastlineKm,
              isLandlocked: profile.isLandlocked,
              isIsland: profile.isIsland,
              dominantClimate: profile.dominantClimate,
              dominantElevation: profile.dominantElevation,
              meanElevation: profile.meanElevation,
              terrainRoughness: profile.terrainRoughness,
              gdpModifier: econ.gdpModifier,
              tradeModifier: econ.tradeModifier,
              infraCostModifier: econ.infraCostModifier,
              lastCalculatedAt: new Date(),
            },
          });

          processed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${country.name}: ${msg}`);
          failed++;
        }
      }

      return { processed, failed, total: countries.length, errors: errors.slice(0, 20) };
    }),
  getRegionalChoropleth: cachedPublicProcedure
    .input(
      z.object({
        metric: z.enum(["gdpPerCapita", "population", "vitality", "health", "tradeBalance"]),
        groupBy: z.enum(["country", "region", "continent"]).default("country"),
      })
    )
    .query(async ({ ctx, input }) => {
      const countries = await ctx.db.country.findMany({
        where: { geometry: { not: null } },
        select: {
          id: true,
          name: true,
          slug: true,
          geometry: true,
          centroid: true,
          continent: true,
          region: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          economicVitality: true,
          overallNationalHealth: true,
          tradeBalance: true,
          landArea: true,
        },
      });

      const getMetricValue = (c: (typeof countries)[number]): number => {
        switch (input.metric) {
          case "gdpPerCapita":
            return c.currentGdpPerCapita ?? 0;
          case "population": {
            // Population density (per km²) is more useful than raw population
            const area = c.landArea ?? 1;
            return area > 0 ? (c.currentPopulation ?? 0) / area : 0;
          }
          case "vitality":
            return c.economicVitality ?? 0;
          case "health":
            return c.overallNationalHealth ?? 0;
          case "tradeBalance":
            return c.tradeBalance ?? 0;
          default:
            return 0;
        }
      };

      if (input.groupBy === "country") {
        // Compute percentile rank (0–1) for each country so colors distribute evenly.
        // Raw values go in rawValue for tooltips. `value` is the normalized rank.
        const rawValues = countries.map((c) => ({ c, raw: getMetricValue(c) }));
        const sorted = [...rawValues].sort((a, b) => a.raw - b.raw);
        const rankMap = new Map<string, number>();
        for (let i = 0; i < sorted.length; i++) {
          rankMap.set(sorted[i]!.c.id, sorted.length > 1 ? i / (sorted.length - 1) : 0.5);
        }

        return {
          type: "FeatureCollection" as const,
          features: countries.map((c) => ({
            type: "Feature" as const,
            geometry: c.geometry as unknown as import("geojson").Geometry,
            properties: {
              id: c.id,
              name: c.name,
              slug: c.slug,
              value: rankMap.get(c.id) ?? 0, // 0–1 percentile rank
              rawValue: getMetricValue(c),
              metric: input.metric,
              continent: c.continent,
              region: c.region,
            },
          })),
          metadata: {
            metric: input.metric,
            groupBy: input.groupBy,
            minVal: 0,
            maxVal: 1,
            count: countries.length,
          },
        };
      }

      // Region/continent aggregation
      const groups = new Map<string, { values: number[]; countryIds: string[]; names: string[] }>();
      for (const c of countries) {
        const key =
          input.groupBy === "region" ? (c.region ?? "Unknown") : (c.continent ?? "Unknown");
        if (!groups.has(key)) groups.set(key, { values: [], countryIds: [], names: [] });
        const g = groups.get(key)!;
        g.values.push(getMetricValue(c));
        g.countryIds.push(c.id);
        g.names.push(c.name);
      }

      // Aggregate per group, then rank groups by percentile
      const groupAgg = new Map<string, number>();
      for (const [key, g] of groups) {
        const avg = g.values.reduce((s, v) => s + v, 0) / g.values.length;
        groupAgg.set(
          key,
          input.metric === "population" ? g.values.reduce((s, v) => s + v, 0) : avg
        );
      }

      // Rank groups by percentile (0–1)
      const sortedGroups = Array.from(groupAgg.entries()).sort((a, b) => a[1] - b[1]);
      const groupRank = new Map<string, number>();
      for (let i = 0; i < sortedGroups.length; i++) {
        groupRank.set(
          sortedGroups[i]![0],
          sortedGroups.length > 1 ? i / (sortedGroups.length - 1) : 0.5
        );
      }

      return {
        type: "FeatureCollection" as const,
        features: countries.map((c) => {
          const key =
            input.groupBy === "region" ? (c.region ?? "Unknown") : (c.continent ?? "Unknown");
          return {
            type: "Feature" as const,
            geometry: c.geometry as unknown as import("geojson").Geometry,
            properties: {
              id: c.id,
              name: c.name,
              slug: c.slug,
              value: groupRank.get(key) ?? 0,
              rawValue: groupAgg.get(key) ?? 0,
              metric: input.metric,
              groupName: key,
              groupBy: input.groupBy,
            },
          };
        }),
        metadata: {
          metric: input.metric,
          groupBy: input.groupBy,
          minVal: 0,
          maxVal: 1,
          count: groups.size,
        },
      };
    }),
  getCrisisRiskMap: cachedPublicProcedure
    .input(
      z
        .object({
          riskType: z
            .enum(["hurricane", "earthquake", "drought", "flood", "wildfire", "pandemic", "famine"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Get pre-computed geo profiles with crisis risk data
      const profiles = await ctx.db.countryGeoProfile.findMany({
        select: {
          countryId: true,
          country: {
            select: { name: true, slug: true, geometry: true },
          },
        },
      });

      // Also get active crisis events for point markers
      const activeCrises = await ctx.db.crisisEvent.findMany({
        where: { status: { not: "resolved" } },
        select: {
          id: true,
          title: true,
          type: true,
          severity: true,
          location: true,
          affectedCountries: true,
        },
        take: 50,
      });

      // For each country, compute risk from their geo profile
      const riskFeatures = [];
      for (const p of profiles) {
        if (!p.country.geometry) continue;

        // Re-compute risk factors from the stored profile data
        const geoProfile = await ctx.db.countryGeoProfile.findUnique({
          where: { countryId: p.countryId },
          select: {
            climateDistribution: true,
            elevationProfile: true,
            arableLandPercent: true,
            coastlineKm: true,
            isLandlocked: true,
            neighborCount: true,
            terrainRoughness: true,
            meanElevation: true,
          },
        });

        if (!geoProfile) continue;

        const risk = computeCrisisRiskFactors({
          coastlineKm: geoProfile.coastlineKm ?? 0,
          isLandlocked: geoProfile.isLandlocked ?? false,
          isIsland: false,
          arableLandPercent: geoProfile.arableLandPercent ?? 50,
          climateDiversity: 0.5,
          terrainRoughness: geoProfile.terrainRoughness ?? 0,
          meanElevation: geoProfile.meanElevation ?? 200,
          neighborCount: geoProfile.neighborCount ?? 0,
          dominantClimate: "",
          dominantElevation: "",
          drainageDensity: 0,
        });

        const riskType = input?.riskType;
        const riskScore = riskType ? (risk[riskType] ?? 0) : Math.max(...Object.values(risk));

        riskFeatures.push({
          type: "Feature" as const,
          geometry: p.country.geometry as unknown as import("geojson").Geometry,
          properties: {
            id: p.countryId,
            name: p.country.name,
            slug: p.country.slug,
            riskScore,
            riskType: riskType ?? "max",
            ...risk,
          },
        });
      }

      // Crisis event points (using affected country centroids as fallback locations)
      const crisisPoints = [];
      for (const ce of activeCrises) {
        const affected = ce.affectedCountries as string[] | null;
        if (affected && affected.length > 0) {
          const country = await ctx.db.country.findFirst({
            where: { name: { in: affected } },
            select: { centroid: true, name: true },
          });
          if (country?.centroid) {
            const coords = (country.centroid as { coordinates: [number, number] }).coordinates;
            crisisPoints.push({
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: coords },
              properties: {
                id: ce.id,
                title: ce.title,
                type: ce.type,
                severity: ce.severity,
                countryName: country.name,
              },
            });
          }
        }
      }

      return {
        riskMap: { type: "FeatureCollection" as const, features: riskFeatures },
        crisisEvents: { type: "FeatureCollection" as const, features: crisisPoints },
      };
    }),
  getTradeRouteGeoJSON: cachedPublicProcedure
    .input(
      z
        .object({
          minVolume: z.number().optional(),
          limit: z.number().min(1).max(200).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const trades = await ctx.db.bilateralTrade.findMany({
        where: input?.minVolume ? { tradeVolume: { gte: input.minVolume } } : undefined,
        orderBy: { tradeVolume: "desc" },
        take: input?.limit ?? 50,
        select: {
          id: true,
          tradeVolume: true,
          exportsFrom1: true,
          exportsFrom2: true,
          tradeBalance1: true,
          commodities: true,
          country1: { select: { id: true, name: true, slug: true, centroid: true } },
          country2: { select: { id: true, name: true, slug: true, centroid: true } },
        },
      });

      const features = [];
      for (const t of trades) {
        const c1 = t.country1.centroid as { coordinates: [number, number] } | null;
        const c2 = t.country2.centroid as { coordinates: [number, number] } | null;
        if (!c1 || !c2) continue;

        const balance = t.tradeBalance1 ?? 0;
        features.push({
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: [c1.coordinates, c2.coordinates],
          },
          properties: {
            id: t.id,
            volume: t.tradeVolume ?? 0,
            balance,
            // Color hint: positive = country1 surplus (green), negative = deficit (red), near zero = balanced (blue)
            balanceColor: Math.abs(balance) < 1e6 ? "#3b82f6" : balance > 0 ? "#22c55e" : "#ef4444",
            commodities: t.commodities,
            country1Name: t.country1.name,
            country2Name: t.country2.name,
            country1Slug: t.country1.slug,
            country2Slug: t.country2.slug,
          },
        });
      }

      const volumes = features.map((f) => f.properties.volume);
      return {
        type: "FeatureCollection" as const,
        features,
        metadata: {
          count: features.length,
          maxVolume: Math.max(0, ...volumes),
          minVolume: Math.min(Infinity, ...volumes),
        },
      };
    }),
  getGeopoliticalOverlay: cachedPublicProcedure.query(async ({ ctx }) => {
    // 1. Alliance groups
    const alliances = await ctx.db.alliance.findMany({
      where: { visibility: "public" },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        members: {
          select: {
            countryId: true,
            role: true,
          },
        },
      },
    });

    const allianceGroups = alliances.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      color: a.color ?? "#888888",
      memberCountryIds: a.members.map((m) => m.countryId),
    }));

    // 2. Diplomatic relations as lines between country centroids
    const relations = await ctx.db.diplomaticRelation.findMany({
      where: {
        strength: { gt: 0 },
      },
      select: {
        country1Id: true,
        country2Id: true,
        relationship: true,
        strength: true,
        country1: { select: { name: true, centroid: true } },
        country2: { select: { name: true, centroid: true } },
      },
      take: 100,
      orderBy: { strength: "desc" },
    });

    const relationFeatures = [];
    for (const r of relations) {
      const c1 = r.country1.centroid as { coordinates: [number, number] } | null;
      const c2 = r.country2.centroid as { coordinates: [number, number] } | null;
      if (!c1 || !c2) continue;

      const relType = (r.relationship ?? "neutral").toLowerCase();
      const color =
        relType.includes("friend") || relType.includes("ally")
          ? "#22c55e"
          : relType.includes("hostil") || relType.includes("rival")
            ? "#ef4444"
            : "#f59e0b";

      relationFeatures.push({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: [c1.coordinates, c2.coordinates] },
        properties: {
          country1Name: r.country1.name,
          country2Name: r.country2.name,
          relationship: r.relationship,
          strength: r.strength,
          color,
        },
      });
    }

    // 3. Active military conflicts as point markers
    const conflicts = await ctx.db.militaryConflict.findMany({
      where: { status: { in: ["active", "proposed", "accepted"] } },
      select: {
        id: true,
        type: true,
        status: true,
        initiator: { select: { name: true, centroid: true } },
        defender: { select: { name: true, centroid: true } },
      },
      take: 20,
    });

    const conflictFeatures = [];
    for (const c of conflicts) {
      const c1 = c.initiator.centroid as { coordinates: [number, number] } | null;
      const c2 = c.defender.centroid as { coordinates: [number, number] } | null;
      if (!c1 || !c2) continue;

      // Place marker at midpoint
      const midLng = (c1.coordinates[0] + c2.coordinates[0]) / 2;
      const midLat = (c1.coordinates[1] + c2.coordinates[1]) / 2;

      conflictFeatures.push({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [midLng, midLat] as [number, number] },
        properties: {
          id: c.id,
          type: c.type,
          status: c.status,
          initiatorName: c.initiator.name,
          defenderName: c.defender.name,
        },
      });
    }

    return {
      allianceGroups,
      relations: { type: "FeatureCollection" as const, features: relationFeatures },
      conflicts: { type: "FeatureCollection" as const, features: conflictFeatures },
    };
  }),
});
