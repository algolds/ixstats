// src/server/api/routers/geo.ts
// Geographic router for country border management with PostGIS integration

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import {
  area as turfArea,
  length as turfLength,
  polygonToLine as turfPolygonToLine,
  lineOverlap as turfLineOverlap,
} from "@turf/turf";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "~/server/api/trpc";

// Zod schemas for validation
const GeoJSONGeometrySchema = z.object({
  type: z.enum([
    "Point",
    "LineString",
    "Polygon",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
    "GeometryCollection",
  ]),
  coordinates: z.any(), // Flexible for different geometry types
  bbox: z.array(z.number()).optional(),
});

const BoundingBoxSchema = z.object({
  minLng: z.number().min(-180).max(180),
  minLat: z.number().min(-90).max(90),
  maxLng: z.number().min(-180).max(180),
  maxLat: z.number().min(-90).max(90),
});

export const geoRouter = createTRPCRouter({
  /**
   * Get country borders with optional filtering and simplification
   * Public endpoint for map display
   */
  getCountryBorders: publicProcedure
    .input(
      z.object({
        countryIds: z.array(z.string()).optional(),
        bbox: BoundingBoxSchema.optional(),
        simplify: z.boolean().default(false),
        simplifyTolerance: z.number().min(0.0001).max(1).default(0.01),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { countryIds, bbox, simplify, simplifyTolerance } = input;

        // Build WHERE clause
        const whereClause: any = {};
        if (countryIds && countryIds.length > 0) {
          whereClause.id = { in: countryIds };
        }

        // Fetch countries with geometry
        const countries = await ctx.db.country.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            slug: true,
            geometry: true,
            centroid: true,
            boundingBox: true,
            landArea: true,
            areaSqMi: true,
            coastlineKm: true,
            populationDensity: true,
            gdpDensity: true,
          },
        });

        let coastlineStats: Record<
          string,
          {
            land_area_km2: number | null;
            area_sqmi: number | null;
            coastline_km: number | null;
          }
        > = {};

        if (countries.length > 0) {
          try {
            const geoFeatures = countries
              .map((country) => {
                const geometry = country.geometry as
                  | Feature<Polygon | MultiPolygon>["geometry"]
                  | null;
                if (!geometry) {
                  return null;
                }
                const feature: Feature<Polygon | MultiPolygon> = {
                  type: "Feature",
                  properties: { id: country.id },
                  geometry,
                };
                return {
                  id: country.id,
                  feature,
                };
              })
              .filter(
                (item): item is { id: string; feature: Feature<Polygon | MultiPolygon> } =>
                  item !== null
              );

            const boundaryData = geoFeatures.map(({ id, feature }) => {
              const areaSqMeters = turfArea(feature);
              const polygonLines = turfPolygonToLine(feature);
              const lineFeatures =
                polygonLines.type === "FeatureCollection" ? polygonLines.features : [polygonLines];

              const totalBoundaryKm = lineFeatures.reduce(
                (sum, line) => sum + turfLength(line, { units: "kilometers" }),
                0
              );

              return {
                id,
                feature,
                lines: lineFeatures,
                areaKm2: areaSqMeters / 1_000_000,
                areaSqMi: areaSqMeters / 1_000_000 / 2.58999,
                totalBoundaryKm,
              };
            });

            const coastlineMap = new Map<
              string,
              {
                land_area_km2: number;
                area_sqmi: number;
                coastline_km: number;
              }
            >();

            boundaryData.forEach(({ id, areaKm2, areaSqMi, totalBoundaryKm }) => {
              coastlineMap.set(id, {
                land_area_km2: Number.isFinite(areaKm2) ? Number(areaKm2.toFixed(2)) : 0,
                area_sqmi: Number.isFinite(areaSqMi) ? Number(areaSqMi.toFixed(2)) : 0,
                coastline_km: Number.isFinite(totalBoundaryKm) ? totalBoundaryKm : 0,
              });
            });

            for (let i = 0; i < boundaryData.length; i++) {
              for (let j = i + 1; j < boundaryData.length; j++) {
                let sharedKm = 0;
                for (const lineA of boundaryData[i].lines) {
                  for (const lineB of boundaryData[j].lines) {
                    const overlapCollection = turfLineOverlap(lineA, lineB, {
                      tolerance: 1e-6,
                    });
                    if (!overlapCollection || overlapCollection.features.length === 0) {
                      continue;
                    }
                    for (const segment of overlapCollection.features) {
                      sharedKm += turfLength(segment, { units: "kilometers" });
                    }
                  }
                }

                if (sharedKm > 0) {
                  const entryA = coastlineMap.get(boundaryData[i].id);
                  const entryB = coastlineMap.get(boundaryData[j].id);
                  if (entryA) {
                    entryA.coastline_km = Math.max(entryA.coastline_km - sharedKm, 0);
                  }
                  if (entryB) {
                    entryB.coastline_km = Math.max(entryB.coastline_km - sharedKm, 0);
                  }
                }
              }
            }

            coastlineStats = Object.fromEntries(
              Array.from(coastlineMap.entries()).map(([id, stats]) => [
                id,
                {
                  land_area_km2: Number(stats.land_area_km2.toFixed(2)),
                  area_sqmi: Number(stats.area_sqmi.toFixed(2)),
                  coastline_km: Number(stats.coastline_km.toFixed(2)),
                },
              ])
            );
          } catch (geoError) {
            console.warn(
              "[geo.getCountryBorders] Failed to compute coastline via Turf, falling back to stored values",
              geoError
            );
          }
        }

        // Filter by bounding box if provided (client-side for SQLite compatibility)
        let filteredCountries = countries;
        if (bbox) {
          filteredCountries = countries.filter((country) => {
            if (!country.boundingBox) return false;
            const countryBox = country.boundingBox as any;

            // Check if bounding boxes intersect
            return !(
              countryBox.maxLng < bbox.minLng ||
              countryBox.minLng > bbox.maxLng ||
              countryBox.maxLat < bbox.minLat ||
              countryBox.minLat > bbox.maxLat
            );
          });
        }

        // For SQLite: simplify is handled client-side
        // For PostgreSQL with PostGIS: we could use ST_Simplify here
        const results = filteredCountries.map((country) => {
          const stat = coastlineStats[country.id] ?? null;
          return {
            id: country.id,
            name: country.name,
            slug: country.slug,
            geometry: country.geometry as any,
            centroid: country.centroid as any,
            boundingBox: country.boundingBox as any,
            landArea: stat?.land_area_km2 ?? country.landArea,
            areaSqMi: stat?.area_sqmi ?? country.areaSqMi,
            coastlineKm: stat?.coastline_km ?? country.coastlineKm,
            populationDensity: country.populationDensity,
            gdpDensity: country.gdpDensity,
          };
        });

        return {
          countries: results,
          count: results.length,
          simplified: simplify,
        };
      } catch (error) {
        console.error("[geo.getCountryBorders] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch country borders",
        });
      }
    }),

  /**
   * Update country border geometry
   * Admin-only with validation and overlap checking
   */
  updateCountryBorder: adminProcedure
    .input(
      z.object({
        countryId: z.string(),
        geometry: GeoJSONGeometrySchema,
        reason: z.string().min(10).max(500),
        checkOverlaps: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { countryId, geometry, reason, checkOverlaps } = input;

        // Validate country exists
        const country = await ctx.db.country.findUnique({
          where: { id: countryId },
          select: {
            id: true,
            name: true,
            geometry: true,
            areaSqMi: true,
            landArea: true,
            currentPopulation: true,
            currentTotalGdp: true,
          },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Basic geometry validation (type check)
        if (!geometry.type || !geometry.coordinates) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid geometry: missing type or coordinates",
          });
        }

        // For PostgreSQL with PostGIS, we would use ST_IsValid here
        // For SQLite, we do basic structural validation
        const isValidGeometry = validateGeoJSONStructure(geometry);
        if (!isValidGeometry) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid GeoJSON geometry structure",
          });
        }

        // Calculate new area (simplified for SQLite - would use ST_Area for PostGIS)
        const newAreaSqMi = calculateGeometryArea(geometry);
        const oldAreaSqMi = country.areaSqMi || 0;
        const areaDeltaSqMi = newAreaSqMi - oldAreaSqMi;

        // Check for overlaps with other countries if requested
        if (checkOverlaps) {
          const overlappingCountries = await checkGeometryOverlaps(ctx.db, countryId, geometry);

          if (overlappingCountries.length > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Geometry overlaps with: ${overlappingCountries
                .map((c) => c.name)
                .join(", ")}`,
            });
          }
        }

        // Calculate centroid and bounding box
        const centroid = calculateCentroid(geometry);
        const boundingBox = calculateBoundingBox(geometry);

        // Update country geometry
        const updatedCountry = await ctx.db.country.update({
          where: { id: countryId },
          data: {
            geometry: geometry as any,
            centroid: centroid as any,
            boundingBox: boundingBox as any,
            areaSqMi: newAreaSqMi,
            landArea: newAreaSqMi * 2.58999, // Convert sq mi to sq km
            populationDensity: country.currentPopulation
              ? country.currentPopulation / (newAreaSqMi * 2.58999)
              : null,
            gdpDensity: country.currentTotalGdp
              ? country.currentTotalGdp / (newAreaSqMi * 2.58999)
              : null,
          },
        });

        // Record border history
        await ctx.db.borderHistory.create({
          data: {
            countryId,
            geometry: country.geometry as any,
            changedBy: ctx.user?.clerkUserId || "system",
            reason,
            oldAreaSqMi,
            newAreaSqMi,
            areaDeltaSqMi,
          },
        });

        // Trigger metric recalculation if area changed significantly
        if (Math.abs(areaDeltaSqMi / oldAreaSqMi) > 0.05) {
          // 5% threshold
          console.log(
            `[geo.updateCountryBorder] Significant area change for ${country.name}: ${areaDeltaSqMi.toFixed(2)} sq mi (${((areaDeltaSqMi / oldAreaSqMi) * 100).toFixed(1)}%)`
          );
          // Note: This would trigger recalculation in a real system
        }

        return {
          success: true,
          country: {
            id: updatedCountry.id,
            name: updatedCountry.name,
            newAreaSqMi,
            oldAreaSqMi,
            areaDeltaSqMi,
            centroid,
            boundingBox,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[geo.updateCountryBorder] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update country border",
        });
      }
    }),

  /**
   * Get all political boundaries from the raw import data
   * This returns ALL 185 political features, not just matched countries
   * Public endpoint for complete political layer rendering
   *
   * Architecture:
   * - Storage: SRID 3857 (Web Mercator) for efficient PostGIS operations
   * - Output: SRID 4326 (WGS84 lat/lon) for GeoJSON - MapLibre GL expects degrees
   * - Rendering: MapLibre GL handles Web Mercator projection internally
   */
  getAllPoliticalBoundaries: publicProcedure
    .input(
      z.object({
        simplify: z.boolean().default(false),
        // Tolerance is in meters for SRID 3857:
        // 0.01 = 10 meters (good quality, minimal distortion)
        // 0.05 = 50 meters (more aggressive, noticeable distortion)
        // 0.1 = 100 meters (very aggressive, significant distortion)
        simplifyTolerance: z.number().min(0.0001).max(1).default(0.01),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { simplify, simplifyTolerance } = input;

        // Query the temp_political_import table with LEFT JOIN to Country table for additional data
        // Geometry stored in SRID 3857 (Web Mercator) for efficient storage
        // Transform to SRID 4326 (WGS84 lat/lon) for GeoJSON output - MapLibre GL expects degrees
        // Note: MapLibre handles Web Mercator projection internally
        const rawBoundaries = await ctx.db.$queryRaw<
          Array<{
            ogc_fid: number;
            name: string;
            fill: string;
            area_km2: number;
            area_sqmi: number;
            perimeter_km: number;
            geometry: any;
            // Country table fields
            country_id: string | null;
            slug: string | null;
            flag: string | null;
            coat_of_arms: string | null;
            government_type: string | null;
            capital_city: string | null;
            currency: string | null;
            currency_symbol: string | null;
            motto: string | null;
            official_name: string | null;
            continent: string | null;
            region: string | null;
          }>
        >`
          SELECT
            t.ogc_fid,
            COALESCE(t.id, 'Unknown') as name,
            t.fill,
            ROUND(CAST(ST_Area(ST_Transform(t.wkb_geometry, 4326)::geography) / 1000000 AS numeric), 2) as area_km2,
            ROUND(CAST(ST_Area(ST_Transform(t.wkb_geometry, 4326)::geography) / 2589988.11 AS numeric), 2) as area_sqmi,
            ROUND(CAST(ST_Perimeter(ST_Transform(t.wkb_geometry, 4326)::geography) / 1000 AS numeric), 2) as perimeter_km,
            CASE
              WHEN ${simplify} THEN ST_AsGeoJSON(ST_Transform(ST_Simplify(t.wkb_geometry, ${simplifyTolerance}), 4326))::json
              ELSE ST_AsGeoJSON(ST_Transform(t.wkb_geometry, 4326))::json
            END as geometry,
            c.id as country_id,
            c.slug,
            c.flag,
            c."coatOfArms" as coat_of_arms,
            c."governmentType" as government_type,
            ni."capitalCity" as capital_city,
            ni.currency,
            ni."currencySymbol" as currency_symbol,
            ni.motto,
            ni."officialName" as official_name,
            c.continent,
            c.region
          FROM temp_political_import t
          LEFT JOIN "Country" c ON LOWER(REPLACE(c.name, ' ', '')) = LOWER(REPLACE(t.id, ' ', ''))
          LEFT JOIN "NationalIdentity" ni ON ni."countryId" = c.id
          WHERE t.wkb_geometry IS NOT NULL
        `;

        return {
          features: rawBoundaries.map((boundary) => ({
            type: "Feature" as const,
            id: boundary.ogc_fid, // Use ogc_fid as the feature ID for MapLibre
            properties: {
              name: boundary.name,
              fill: boundary.fill,
              landArea: boundary.area_km2,
              areaSqMi: boundary.area_sqmi,
              coastlineKm: boundary.perimeter_km,
              // Country details
              countryId: boundary.country_id,
              slug: boundary.slug,
              flag: boundary.flag,
              coatOfArms: boundary.coat_of_arms,
              governmentType: boundary.government_type,
              capitalCity: boundary.capital_city,
              currency: boundary.currency,
              currencySymbol: boundary.currency_symbol,
              motto: boundary.motto,
              officialName: boundary.official_name,
              continent: boundary.continent,
              region: boundary.region,
            },
            geometry: boundary.geometry,
          })),
          type: "FeatureCollection" as const,
          count: rawBoundaries.length,
          simplified: simplify,
        };
      } catch (error) {
        console.error("[geo.getAllPoliticalBoundaries] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch political boundaries",
        });
      }
    }),

  /**
   * Get map layer data by layer name
   * Fetches features from PostGIS with their original colors/properties
   * Public endpoint for map visualization
   *
   * Architecture:
   * - Storage: SRID 3857 (Web Mercator) for efficient PostGIS operations
   * - Output: SRID 4326 (WGS84 lat/lon) for GeoJSON - MapLibre GL expects degrees
   * - Rendering: MapLibre GL handles Web Mercator projection internally
   */
  getMapLayer: publicProcedure
    .input(
      z.object({
        layer: z.enum(["rivers", "lakes", "icecaps", "climate", "altitudes", "background"]),
        simplify: z.boolean().default(false),
        // Tolerance is in meters for SRID 3857:
        // 0.01 = 10 meters (good quality, minimal distortion)
        // 0.05 = 50 meters (more aggressive, noticeable distortion)
        // 0.1 = 100 meters (very aggressive, significant distortion)
        simplifyTolerance: z.number().min(0.0001).max(1).default(0.01),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { layer, simplify, simplifyTolerance } = input;
        const tableName = `map_layer_${layer}`;

        // Query the layer table with optional simplification
        // Using queryRawUnsafe since table name is dynamic but validated by Zod enum
        // Geometry stored in SRID 3857, transform to SRID 4326 for GeoJSON output
        // MapLibre GL expects lat/lon degrees, handles Web Mercator projection internally
        const query = `
          SELECT
            ogc_fid,
            COALESCE(id, 'unknown') as id,
            fill,
            CASE
              WHEN $1 THEN ST_AsGeoJSON(ST_Transform(ST_Simplify(wkb_geometry, $2), 4326))::json
              ELSE ST_AsGeoJSON(ST_Transform(wkb_geometry, 4326))::json
            END as geometry
          FROM "${tableName}"
          WHERE wkb_geometry IS NOT NULL
        `;

        const features = await ctx.db.$queryRawUnsafe<
          Array<{ ogc_fid: number; id: string; fill: string; geometry: any }>
        >(query, simplify, simplifyTolerance);

        return {
          type: "FeatureCollection" as const,
          features: features.map((feature) => ({
            type: "Feature" as const,
            id: feature.ogc_fid,
            properties: {
              id: feature.id,
              fill: feature.fill,
            },
            geometry: feature.geometry,
          })),
          count: features.length,
          layer,
          simplified: simplify,
        };
      } catch (error) {
        console.error(`[geo.getMapLayer] Error fetching ${input.layer}:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch ${input.layer} layer data`,
        });
      }
    }),

  /**
   * Get vector tile (MVT) for a given layer and tile coordinates
   * Public endpoint for efficient tile-based map rendering
   *
   * This endpoint uses PostGIS ST_AsMVT to generate Mapbox Vector Tiles on-the-fly:
   * - Tiles are generated per zoom level with automatic simplification
   * - Only visible features in the tile extent are included
   * - Geometry is transformed from SRID 3857 (storage) to tile coordinates
   * - Browser automatically caches tiles for fast re-renders
   *
   * Performance: ~50-200ms per tile vs. 10+ seconds for full GeoJSON
   */
  getVectorTile: publicProcedure
    .input(
      z.object({
        layer: z.enum([
          "political",
          "rivers",
          "lakes",
          "icecaps",
          "climate",
          "altitudes",
          "background",
        ]),
        z: z.number().min(0).max(14), // Zoom level
        x: z.number().min(0), // Tile X coordinate
        y: z.number().min(0), // Tile Y coordinate
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { layer, z, x, y } = input;

        // Calculate tile bounds in Web Mercator (EPSG:3857)
        const tileSize = 256;
        const earthCircumference = 40075016.686; // meters at equator
        const worldSize = earthCircumference / 2 ** z;
        const tileWorldSize = worldSize;

        // Calculate tile extent in EPSG:3857 coordinates
        const minX = -earthCircumference / 2 + x * tileWorldSize;
        const maxX = minX + tileWorldSize;
        const maxY = earthCircumference / 2 - y * tileWorldSize;
        const minY = maxY - tileWorldSize;

        // Determine source table based on layer
        let tableName: string;
        let sourceField = "wkb_geometry";

        if (layer === "political") {
          tableName = "temp_political_import";
        } else {
          tableName = `map_layer_${layer}`;
        }

        // Generate MVT with zoom-based simplification
        // ST_AsMVT automatically handles:
        // - Coordinate transformation to tile space
        // - Feature clipping to tile bounds
        // - Geometry simplification
        // - Efficient binary encoding
        const query = `
          WITH tile_bounds AS (
            SELECT ST_MakeEnvelope($1, $2, $3, $4, 3857) AS geom
          ),
          tile_features AS (
            SELECT
              ogc_fid,
              COALESCE(id, 'unknown') as name,
              fill,
              ${
                layer === "political"
                  ? `
              -- Additional political boundary fields
              ST_Area(ST_Transform(${sourceField}, 4326)::geography) / 1000000 as area_km2,
              ST_Area(ST_Transform(${sourceField}, 4326)::geography) / 2589988.11 as area_sqmi
              `
                  : ""
              }
              -- Geometry in tile coordinates (ST_AsMVTGeom handles transformation)
              ST_AsMVTGeom(
                ${sourceField},
                (SELECT geom FROM tile_bounds),
                ${tileSize},
                0, -- buffer (0 for performance, increase if seeing edge artifacts)
                true -- clip geometry to tile bounds
              ) as geom
            FROM "${tableName}"
            WHERE ${sourceField} IS NOT NULL
              AND ST_Intersects(${sourceField}, (SELECT geom FROM tile_bounds))
          )
          SELECT ST_AsMVT(tile_features.*, '${layer}', ${tileSize}, 'geom') as mvt
          FROM tile_features
          WHERE geom IS NOT NULL;
        `;

        const result = await ctx.db.$queryRawUnsafe<Array<{ mvt: Buffer }>>(
          query,
          minX,
          minY,
          maxX,
          maxY
        );

        // Return MVT binary data
        // Browser will receive this as application/x-protobuf
        if (result.length > 0 && result[0]?.mvt) {
          return result[0].mvt;
        }

        // Return empty MVT if no features
        return Buffer.from([]);
      } catch (error) {
        console.error(
          `[geo.getVectorTile] Error generating tile ${input.z}/${input.x}/${input.y} for layer ${input.layer}:`,
          error
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate vector tile for ${input.layer}`,
        });
      }
    }),

  /**
   * Get border change history for a country
   * Protected endpoint for country owners and admins
   */
  getBorderHistory: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { countryId, limit, offset } = input;

        // Verify country exists
        const country = await ctx.db.country.findUnique({
          where: { id: countryId },
          select: { id: true, name: true },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Check permissions: must be country owner or admin
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.user?.clerkUserId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isCountryOwner = userCountry?.countryId === countryId;
        const isAdmin = (userCountry?.role?.level ?? 0) >= 90;

        if (!isCountryOwner && !isAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to view this border history",
          });
        }

        // Fetch border history
        const [history, total] = await Promise.all([
          ctx.db.borderHistory.findMany({
            where: { countryId },
            orderBy: { changedAt: "desc" },
            take: limit,
            skip: offset,
            select: {
              id: true,
              geometry: true,
              changedBy: true,
              changedAt: true,
              reason: true,
              oldAreaSqMi: true,
              newAreaSqMi: true,
              areaDeltaSqMi: true,
            },
          }),
          ctx.db.borderHistory.count({ where: { countryId } }),
        ]);

        // Fetch user names for changedBy
        const uniqueUserIds = new Set(history.map((h) => h.changedBy));
        const userIds = Array.from(uniqueUserIds);
        const users = await ctx.db.user.findMany({
          where: { clerkUserId: { in: userIds } },
          select: { clerkUserId: true, displayName: true, username: true },
        });

        const userMap = new Map(
          users.map((u) => [u.clerkUserId, u.displayName || u.username || "Unknown"])
        );

        const enrichedHistory = history.map((h) => ({
          id: h.id,
          geometry: h.geometry,
          changedBy: userMap.get(h.changedBy) || h.changedBy,
          changedAt: h.changedAt.toISOString(),
          reason: h.reason,
          oldAreaSqMi: h.oldAreaSqMi,
          newAreaSqMi: h.newAreaSqMi,
          areaDeltaSqMi: h.areaDeltaSqMi,
          percentChange:
            h.oldAreaSqMi && h.areaDeltaSqMi ? (h.areaDeltaSqMi / h.oldAreaSqMi) * 100 : null,
        }));

        return {
          history: enrichedHistory,
          total,
          hasMore: offset + limit < total,
          country: {
            id: country.id,
            name: country.name,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[geo.getBorderHistory] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch border history",
        });
      }
    }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate GeoJSON geometry structure
 * Basic validation for SQLite (would use ST_IsValid for PostGIS)
 */
function validateGeoJSONStructure(geometry: any): boolean {
  if (!geometry.type || !geometry.coordinates) {
    return false;
  }

  // Type-specific validation
  switch (geometry.type) {
    case "Point":
      return (
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length === 2 &&
        typeof geometry.coordinates[0] === "number" &&
        typeof geometry.coordinates[1] === "number"
      );

    case "LineString":
      return (
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length >= 2 &&
        geometry.coordinates.every(
          (coord: any) =>
            Array.isArray(coord) &&
            coord.length === 2 &&
            typeof coord[0] === "number" &&
            typeof coord[1] === "number"
        )
      );

    case "Polygon":
      return (
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length >= 1 &&
        geometry.coordinates.every(
          (ring: any) =>
            Array.isArray(ring) &&
            ring.length >= 4 &&
            ring.every(
              (coord: any) =>
                Array.isArray(coord) &&
                coord.length === 2 &&
                typeof coord[0] === "number" &&
                typeof coord[1] === "number"
            )
        )
      );

    case "MultiPolygon":
      return (
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.every(
          (polygon: any) =>
            Array.isArray(polygon) &&
            polygon.every(
              (ring: any) =>
                Array.isArray(ring) &&
                ring.length >= 4 &&
                ring.every(
                  (coord: any) =>
                    Array.isArray(coord) &&
                    coord.length === 2 &&
                    typeof coord[0] === "number" &&
                    typeof coord[1] === "number"
                )
            )
        )
      );

    default:
      // Other types not fully validated
      return true;
  }
}

/**
 * Calculate geometry area in square miles
 * Simplified calculation (would use ST_Area for PostGIS)
 */
function calculateGeometryArea(geometry: any): number {
  // This is a simplified calculation
  // For production, use a proper library like Turf.js or PostGIS ST_Area

  if (geometry.type === "Polygon") {
    return calculatePolygonArea(geometry.coordinates[0]);
  } else if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.reduce(
      (total: number, polygon: any) => total + calculatePolygonArea(polygon[0]),
      0
    );
  }

  return 0;
}

/**
 * Calculate polygon area using shoelace formula
 * Returns area in square miles (approximate)
 */
function calculatePolygonArea(coordinates: number[][]): number {
  let area = 0;
  const n = coordinates.length;

  for (let i = 0; i < n - 1; i++) {
    area += coordinates[i][0] * coordinates[i + 1][1];
    area -= coordinates[i + 1][0] * coordinates[i][1];
  }

  area = Math.abs(area / 2);

  // Convert from decimal degrees squared to square miles (very rough approximation)
  // 1 degree latitude ≈ 69 miles, 1 degree longitude varies by latitude
  // This is simplified - use proper geodesic calculations for production
  const avgLatitude = coordinates.reduce((sum, coord) => sum + coord[1], 0) / n;
  const latitudeFactor = 69; // miles per degree latitude
  const longitudeFactor = 69 * Math.cos((avgLatitude * Math.PI) / 180); // miles per degree longitude

  return area * latitudeFactor * longitudeFactor;
}

/**
 * Calculate centroid of geometry
 */
function calculateCentroid(geometry: any): { lng: number; lat: number } {
  let coordinates: number[][];

  if (geometry.type === "Point") {
    return { lng: geometry.coordinates[0], lat: geometry.coordinates[1] };
  } else if (geometry.type === "Polygon") {
    coordinates = geometry.coordinates[0];
  } else if (geometry.type === "MultiPolygon") {
    // Use first polygon for simplicity
    coordinates = geometry.coordinates[0][0];
  } else {
    return { lng: 0, lat: 0 };
  }

  const sum = coordinates.reduce(
    (acc, coord) => ({
      lng: acc.lng + coord[0],
      lat: acc.lat + coord[1],
    }),
    { lng: 0, lat: 0 }
  );

  return {
    lng: sum.lng / coordinates.length,
    lat: sum.lat / coordinates.length,
  };
}

/**
 * Calculate bounding box of geometry
 */
function calculateBoundingBox(geometry: any): {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} {
  let allCoordinates: number[][] = [];

  if (geometry.type === "Point") {
    allCoordinates = [geometry.coordinates];
  } else if (geometry.type === "Polygon") {
    allCoordinates = geometry.coordinates.flat();
  } else if (geometry.type === "MultiPolygon") {
    allCoordinates = geometry.coordinates.flat(2);
  }

  if (allCoordinates.length === 0) {
    return { minLng: 0, minLat: 0, maxLng: 0, maxLat: 0 };
  }

  const lngs = allCoordinates.map((c) => c[0]);
  const lats = allCoordinates.map((c) => c[1]);

  return {
    minLng: Math.min(...lngs),
    minLat: Math.min(...lats),
    maxLng: Math.max(...lngs),
    maxLat: Math.max(...lats),
  };
}

/**
 * Check if geometry overlaps with other countries
 * Simplified for SQLite (would use ST_Intersects for PostGIS)
 */
async function checkGeometryOverlaps(
  db: any,
  excludeCountryId: string,
  geometry: any
): Promise<{ id: string; name: string }[]> {
  // For SQLite: fetch all other countries and check bounding box intersection
  const otherCountries = await db.country.findMany({
    where: {
      id: { not: excludeCountryId },
      boundingBox: { not: null },
    },
    select: {
      id: true,
      name: true,
      boundingBox: true,
      geometry: true,
    },
  });

  const newBbox = calculateBoundingBox(geometry);
  const overlapping: { id: string; name: string }[] = [];

  for (const country of otherCountries) {
    const bbox = country.boundingBox as any;

    // Quick bounding box check
    const bboxIntersects = !(
      bbox.maxLng < newBbox.minLng ||
      bbox.minLng > newBbox.maxLng ||
      bbox.maxLat < newBbox.minLat ||
      bbox.minLat > newBbox.maxLat
    );

    if (bboxIntersects) {
      // For more accurate checking, would use detailed polygon intersection
      // For now, flag potential overlaps based on bounding box
      overlapping.push({ id: country.id, name: country.name });
    }
  }

  return overlapping;
}
