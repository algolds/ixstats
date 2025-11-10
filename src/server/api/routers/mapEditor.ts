// src/server/api/routers/mapEditor.ts
// Map Editor router for CRUD operations on subdivisions, cities, and POIs

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  standardMutationProcedure,
  rateLimitedPublicProcedure,
  readOnlyPublicProcedure,
} from "~/server/api/trpc";
import { mapCacheService, MapCacheKeys } from "~/lib/map-cache-service";
import { tileCacheInvalidation } from "~/lib/tile-cache-invalidation";
import {
  validatePolygonGeometry,
  validatePointGeometry,
  checkBoundaryIntersection,
  checkPointInCountry,
  generateDataQualityReport,
} from "~/lib/postgis-validation";

// ============================================================================
// Zod Schemas for Input Validation
// ============================================================================

const GeoJSONPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
});

const GeoJSONPolygonSchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.any(), // Complex nested array structure
});

// Subdivision Input Schemas
const CreateSubdivisionInput = z.object({
  countryId: z.string(),
  name: z.string().min(1).max(200),
  type: z.enum(["state", "province", "region", "territory", "district", "county"]),
  geometry: GeoJSONPolygonSchema,
  level: z.number().int().min(1).max(5),
  population: z.number().optional(),
  capital: z.string().max(200).optional(),
  areaSqKm: z.number().optional(),
});

const UpdateSubdivisionInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  type: z.enum(["state", "province", "region", "territory", "district", "county"]).optional(),
  geometry: GeoJSONPolygonSchema.optional(),
  level: z.number().int().min(1).max(5).optional(),
  population: z.number().optional(),
  capital: z.string().max(200).optional(),
  areaSqKm: z.number().optional(),
});

// City Input Schemas
const CreateCityInput = z.object({
  countryId: z.string(),
  subdivisionId: z.string().optional(),
  name: z.string().min(1).max(200),
  type: z.enum(["capital", "city", "town", "village"]),
  coordinates: GeoJSONPointSchema,
  population: z.number().optional(),
  isNationalCapital: z.boolean().default(false),
  isSubdivisionCapital: z.boolean().default(false),
  elevation: z.number().optional(),
  foundedYear: z.number().int().min(0).max(new Date().getFullYear()).optional(),
});

const UpdateCityInput = z.object({
  id: z.string(),
  subdivisionId: z.string().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  type: z.enum(["capital", "city", "town", "village"]).optional(),
  coordinates: GeoJSONPointSchema.optional(),
  population: z.number().optional(),
  isNationalCapital: z.boolean().optional(),
  isSubdivisionCapital: z.boolean().optional(),
  elevation: z.number().optional(),
  foundedYear: z.number().int().min(0).max(new Date().getFullYear()).optional(),
});

// POI Input Schemas
const CreatePOIInput = z.object({
  countryId: z.string(),
  subdivisionId: z.string().optional(),
  name: z.string().min(1).max(200),
  category: z.enum([
    "monument",
    "landmark",
    "military",
    "cultural",
    "natural",
    "religious",
    "government",
  ]),
  icon: z.string().max(50).optional(),
  coordinates: GeoJSONPointSchema,
  description: z.string().max(2000).optional(),
  images: z.array(z.string()).optional(),
  metadata: z.any().optional(),
});

const UpdatePOIInput = z.object({
  id: z.string(),
  subdivisionId: z.string().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  category: z
    .enum(["monument", "landmark", "military", "cultural", "natural", "religious", "government"])
    .optional(),
  icon: z.string().max(50).optional(),
  coordinates: GeoJSONPointSchema.optional(),
  description: z.string().max(2000).optional(),
  images: z.array(z.string()).optional(),
  metadata: z.any().optional(),
});

// Admin Review Schemas
const ApproveSubmissionInput = z.object({
  entityType: z.enum(["subdivision", "city", "poi"]),
  entityId: z.string(),
  reason: z.string().max(500).optional(),
});

const RejectSubmissionInput = z.object({
  entityType: z.enum(["subdivision", "city", "poi"]),
  entityId: z.string(),
  reason: z.string().min(10).max(500),
});

const BulkApproveInput = z.object({
  entityType: z.enum(["subdivision", "city", "poi"]),
  entityIds: z.array(z.string()).min(1).max(50),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create audit log entry (non-blocking)
 * If the map_edit_logs table doesn't exist, this will fail silently
 */
async function createAuditLog(
  db: any,
  data: {
    entityType: "subdivision" | "city" | "poi";
    entityId: string;
    action: "create" | "update" | "delete" | "submit" | "approve" | "reject";
    userId: string;
    changes?: any;
    reason?: string | null;
    metadata?: any;
  }
) {
  try {
    await db.auditLog.create({ 
      data: {
        entityType: data.entityType,
        target: data.entityId,
        action: data.action,
        userId: data.userId,
        details: data.changes ? JSON.stringify(data.changes) : null,
      }
    });
  } catch (error) {
    // Audit logging failure should not fail the mutation
    console.warn("[mapEditor] Audit log creation failed (non-critical):", error);
  }
}

// ============================================================================
// Map Editor Router
// ============================================================================

export const mapEditorRouter = createTRPCRouter({
  // ============================================================================
  // UNIFIED SEARCH ENDPOINT (Optimization)
  // ============================================================================

  /**
   * Unified search across all map entities (countries, subdivisions, cities, POIs)
   * Replaces 4 separate queries with 1 batched query for better performance
   * Public endpoint with rate limiting (30 req/min)
   */
  unifiedSearch: rateLimitedPublicProcedure
    .input(
      z.object({
        search: z.string().min(1),
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, limit } = input;
      const perEntityLimit = Math.ceil(limit / 4);

      try {
        // Sanitize search query for PostgreSQL full-text search
        // Replace special characters and create tsquery-compatible format
        const sanitizedSearch = search
          .replace(/[^\w\s]/g, " ")
          .trim()
          .split(/\s+/)
          .filter((word) => word.length > 0)
          .join(" & ");

        // Fallback to basic search if sanitization fails
        const useFullTextSearch = sanitizedSearch.length > 0;

        // Run all queries in parallel for maximum performance
        const [countries, subdivisions, cities, pois] = await Promise.all([
          // Countries - use basic search (no full-text index needed for small table)
          ctx.db.country.findMany({
            where: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              name: true,
              slug: true,
              flag: true,
              continent: true,
            },
            take: perEntityLimit,
            orderBy: { name: "asc" },
          }),

          // Subdivisions - use full-text search for better performance
          useFullTextSearch
            ? ctx.db.$queryRawUnsafe<
                Array<{
                  id: string;
                  name: string;
                  type: string;
                  country_id: string;
                  country_name: string;
                  rank: number;
                }>
              >(
                `
                SELECT
                  s.id,
                  s.name,
                  s.type,
                  s.country_id,
                  c.name as country_name,
                  ts_rank(to_tsvector('english', s.name), to_tsquery('english', $1)) as rank
                FROM subdivisions s
                JOIN countries c ON s.country_id = c.id
                WHERE
                  s.status = 'approved' AND
                  to_tsvector('english', s.name) @@ to_tsquery('english', $1)
                ORDER BY rank DESC, s.name ASC
                LIMIT $2
              `,
                sanitizedSearch,
                perEntityLimit
              )
            : ctx.db.subdivision
                .findMany({
                  where: {
                    name: { contains: search, mode: "insensitive" },
                    status: "approved",
                  },
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    countryId: true,
                    country: { select: { id: true, name: true } },
                  },
                  take: perEntityLimit,
                  orderBy: { name: "asc" },
                })
                .then((results) =>
                  results.map((r) => ({
                    id: r.id,
                    name: r.name,
                    type: r.type,
                    country_id: r.countryId,
                    country_name: r.country.name,
                    rank: 0,
                  }))
                ),

          // Cities - use full-text search for better performance
          useFullTextSearch
            ? ctx.db.$queryRawUnsafe<
                Array<{
                  id: string;
                  name: string;
                  coordinates: any;
                  country_id: string;
                  country_name: string;
                  subdivision_id: string | null;
                  subdivision_name: string | null;
                  rank: number;
                }>
              >(
                `
                SELECT
                  ci.id,
                  ci.name,
                  ci.coordinates,
                  ci.country_id,
                  c.name as country_name,
                  ci.subdivision_id,
                  s.name as subdivision_name,
                  ts_rank(to_tsvector('english', ci.name), to_tsquery('english', $1)) as rank
                FROM cities ci
                JOIN countries c ON ci.country_id = c.id
                LEFT JOIN subdivisions s ON ci.subdivision_id = s.id
                WHERE
                  ci.status = 'approved' AND
                  to_tsvector('english', ci.name) @@ to_tsquery('english', $1)
                ORDER BY rank DESC, ci.name ASC
                LIMIT $2
              `,
                sanitizedSearch,
                perEntityLimit
              )
            : ctx.db.city
                .findMany({
                  where: {
                    name: { contains: search, mode: "insensitive" },
                    status: "approved",
                  },
                  select: {
                    id: true,
                    name: true,
                    coordinates: true,
                    countryId: true,
                    subdivisionId: true,
                    country: { select: { id: true, name: true } },
                    subdivision: { select: { id: true, name: true } },
                  },
                  take: perEntityLimit,
                  orderBy: { name: "asc" },
                })
                .then((results) =>
                  results.map((r) => ({
                    id: r.id,
                    name: r.name,
                    coordinates: r.coordinates,
                    country_id: r.countryId,
                    country_name: r.country.name,
                    subdivision_id: r.subdivisionId,
                    subdivision_name: r.subdivision?.name ?? null,
                    rank: 0,
                  }))
                ),

          // POIs - use full-text search for name + description
          useFullTextSearch
            ? ctx.db.$queryRawUnsafe<
                Array<{
                  id: string;
                  name: string;
                  category: string;
                  coordinates: any;
                  country_id: string;
                  country_name: string;
                  subdivision_id: string | null;
                  subdivision_name: string | null;
                  rank: number;
                }>
              >(
                `
                SELECT
                  p.id,
                  p.name,
                  p.category,
                  p.coordinates,
                  p.country_id,
                  c.name as country_name,
                  p.subdivision_id,
                  s.name as subdivision_name,
                  ts_rank(to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')), to_tsquery('english', $1)) as rank
                FROM points_of_interest p
                JOIN countries c ON p.country_id = c.id
                LEFT JOIN subdivisions s ON p.subdivision_id = s.id
                WHERE
                  p.status = 'approved' AND
                  to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) @@ to_tsquery('english', $1)
                ORDER BY rank DESC, p.name ASC
                LIMIT $2
              `,
                sanitizedSearch,
                perEntityLimit
              )
            : ctx.db.pointOfInterest
                .findMany({
                  where: {
                    name: { contains: search, mode: "insensitive" },
                    status: "approved",
                  },
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    coordinates: true,
                    countryId: true,
                    subdivisionId: true,
                    country: { select: { id: true, name: true } },
                    subdivision: { select: { id: true, name: true } },
                  },
                  take: perEntityLimit,
                  orderBy: { name: "asc" },
                })
                .then((results) =>
                  results.map((r) => ({
                    id: r.id,
                    name: r.name,
                    category: r.category,
                    coordinates: r.coordinates,
                    country_id: r.countryId,
                    country_name: r.country.name,
                    subdivision_id: r.subdivisionId,
                    subdivision_name: r.subdivision?.name ?? null,
                    rank: 0,
                  }))
                ),
        ]);

        // Transform raw SQL results to match expected format
        const transformedSubdivisions = subdivisions.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          country: { id: s.country_id, name: s.country_name },
        }));

        const transformedCities = cities.map((c) => ({
          id: c.id,
          name: c.name,
          coordinates: c.coordinates,
          country: { id: c.country_id, name: c.country_name },
          subdivision: c.subdivision_id
            ? { id: c.subdivision_id, name: c.subdivision_name! }
            : null,
        }));

        const transformedPOIs = pois.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          coordinates: p.coordinates,
          country: { id: p.country_id, name: p.country_name },
          subdivision: p.subdivision_id
            ? { id: p.subdivision_id, name: p.subdivision_name! }
            : null,
        }));

        return {
          countries,
          subdivisions: transformedSubdivisions,
          cities: transformedCities,
          pois: transformedPOIs,
          totalResults:
            countries.length +
            transformedSubdivisions.length +
            transformedCities.length +
            transformedPOIs.length,
        };
      } catch (error) {
        console.error("[mapEditor.unifiedSearch] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Search failed",
        });
      }
    }),

  /**
   * Get country centroid in WGS84 coordinates from vector tiles
   * This returns the correct WGS84 coordinates for map navigation
   * Rate limited: 120 req/min (read-only operation)
   */
  getCountryCentroidWGS84: readOnlyPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Query vector tiles table to get WGS84 centroid
        // Join with Country table to match CUID with slug
        const result = await ctx.db.$queryRaw<Array<{ lng: number; lat: number }>>`
          SELECT
            ST_X(ST_Centroid(p.geometry)) as lng,
            ST_Y(ST_Centroid(p.geometry)) as lat
          FROM map_layer_political p
          JOIN "Country" c ON p.country_id = c.slug
          WHERE c.id = ${input.countryId}
          LIMIT 1
        `;

        if (!result || result.length === 0) {
          console.warn(`[mapEditor.getCountryCentroidWGS84] No centroid found for country: ${input.countryId}`);
          return null;
        }

        return {
          lng: result[0].lng,
          lat: result[0].lat,
        };
      } catch (error) {
        console.error("[mapEditor.getCountryCentroidWGS84] Error:", error);
        return null;
      }
    }),

  // ============================================================================
  // SUBDIVISION ENDPOINTS
  // ============================================================================

  /**
   * Create a new subdivision (state, province, region, etc.)
   * Protected: Users can create subdivisions in their own country
   */
  createSubdivision: standardMutationProcedure
    .input(CreateSubdivisionInput)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify country exists
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { id: true, name: true },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Check if user owns this country
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isCountryOwner = userCountry?.countryId === input.countryId;
        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;

        if (!isCountryOwner && !isAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only create subdivisions in your own country",
          });
        }

        // Validate geometry structure
        if (!validateGeoJSONPolygon(input.geometry)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid GeoJSON geometry structure",
          });
        }

        // PostGIS topology validation
        const topologyValidation = await validatePolygonGeometry(input.geometry);
        if (!topologyValidation.isValid) {
          // Try auto-fix if possible
          if (topologyValidation.canAutoFix && topologyValidation.fixedGeometry) {
            console.log(
              `[createSubdivision] Auto-fixing invalid geometry for ${input.name}:`,
              topologyValidation.errors
            );
            input.geometry = topologyValidation.fixedGeometry;
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid topology: ${topologyValidation.errors.join(", ")}`,
            });
          }
        }

        // Check boundary intersection (ensure subdivision is within country)
        const boundaryCheck = await checkBoundaryIntersection(
          input.geometry,
          input.countryId
        );

        if (!boundaryCheck.intersects) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subdivision does not intersect with country boundaries",
          });
        }

        if (!boundaryCheck.isFullyContained) {
          console.warn(
            `[createSubdivision] Subdivision ${input.name} not fully contained in country (${boundaryCheck.percentageInCountry?.toFixed(1)}% overlap)`
          );
          // Allow it but log warning (some countries may have complex boundaries)
        }

        // Create subdivision with draft status (user can submit for review later)
        const subdivision = await ctx.db.subdivision.create({
          data: {
            countryId: input.countryId,
            name: input.name,
            type: input.type,
            geometry: input.geometry as any,
            level: input.level,
            population: input.population,
            capital: input.capital,
            areaSqKm: input.areaSqKm,
            status: "draft",
            submittedBy: ctx.auth!.userId,
          },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "subdivision",
            target: subdivision.id,
            action: "create",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              name: input.name,
              type: input.type,
              level: input.level,
            }),
          },
        });

        return {
          success: true,
          subdivision,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.createSubdivision] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create subdivision",
        });
      }
    }),

  /**
   * Update an existing subdivision
   * Protected: Users can only update their own draft subdivisions
   */
  updateSubdivision: standardMutationProcedure
    .input(UpdateSubdivisionInput)
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch existing subdivision
        const existing = await ctx.db.subdivision.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            name: true,
            countryId: true,
            status: true,
            submittedBy: true,
            geometry: true,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Subdivision not found",
          });
        }

        // Check permissions
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth!.userId;
        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;
        const isDraft = existing.status === "pending" || existing.status === "draft";

        if (!isAdmin && (!isOwner || !isDraft)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only edit your own pending/draft subdivisions",
          });
        }

        // Validate geometry if provided
        if (input.geometry && !validateGeoJSONPolygon(input.geometry)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid GeoJSON geometry structure",
          });
        }

        // Update subdivision
        const updated = await ctx.db.subdivision.update({
          where: { id: input.id },
          data: {
            ...(input.name && { name: input.name }),
            ...(input.type && { type: input.type }),
            ...(input.geometry && { geometry: input.geometry as any }),
            ...(input.level !== undefined && { level: input.level }),
            ...(input.population !== undefined && { population: input.population }),
            ...(input.capital !== undefined && { capital: input.capital }),
            ...(input.areaSqKm !== undefined && { areaSqKm: input.areaSqKm }),
            updatedAt: new Date(),
          },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "subdivision",
            target: input.id,
            action: "update",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              old: { name: existing.name },
              new: input,
            }),
          },
        });

        return {
          success: true,
          subdivision: updated,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.updateSubdivision] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update subdivision",
        });
      }
    }),

  /**
   * Delete a subdivision
   * Protected: Users can only delete their own draft subdivisions
   */
  deleteSubdivision: standardMutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch existing subdivision
        const existing = await ctx.db.subdivision.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            name: true,
            status: true,
            submittedBy: true,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Subdivision not found",
          });
        }

        // Check permissions
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth!.userId;
        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;
        const isDraft = existing.status === "pending" || existing.status === "draft";

        if (!isAdmin && (!isOwner || !isDraft)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only delete your own pending/draft subdivisions",
          });
        }

        // Delete subdivision (cascade will handle cities/POIs)
        await ctx.db.subdivision.delete({
          where: { id: input.id },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "subdivision",
            target: input.id,
            action: "delete",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              name: existing.name,
            }),
          },
        });

        return {
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.deleteSubdivision] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete subdivision",
        });
      }
    }),

  /**
   * Get all approved subdivisions for a country
   * Public: Anyone can view approved subdivisions
   * Rate limited: 120 req/min (read-only operation)
   */
  getCountrySubdivisions: readOnlyPublicProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        includeGeometry: z.boolean().default(true),
        search: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected", "draft"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Only cache approved subdivisions without search filters
        const shouldCache =
          (input.status ?? "approved") === "approved" &&
          !input.search &&
          input.countryId;

        // Check cache first
        if (shouldCache) {
          const cacheKey = MapCacheKeys.subdivision(
            input.countryId!,
            input.includeGeometry
          );
          const cached = mapCacheService.get<{
            subdivisions: any[];
            count: number;
          }>(cacheKey);

          if (cached) {
            return cached;
          }
        }

        const where: any = {
          status: input.status ?? "approved",
        };

        if (input.countryId) {
          where.countryId = input.countryId;
        }

        if (input.search && input.search.length > 0) {
          where.name = {
            contains: input.search,
            mode: "insensitive",
          };
        }

        const subdivisions = await ctx.db.subdivision.findMany({
          where,
          select: {
            id: true,
            name: true,
            type: true,
            geometry: input.includeGeometry,
            level: true,
            population: true,
            capital: true,
            areaSqKm: true,
            createdAt: true,
            updatedAt: true,
            country: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [{ level: "asc" }, { name: "asc" }],
          take: input.limit,
        });

        const result = {
          subdivisions,
          count: subdivisions.length,
        };

        // Cache the result
        if (shouldCache) {
          const cacheKey = MapCacheKeys.subdivision(
            input.countryId!,
            input.includeGeometry
          );
          mapCacheService.set(cacheKey, result, 5 * 60 * 1000); // 5 minutes
        }

        return result;
      } catch (error) {
        console.error("[mapEditor.getCountrySubdivisions] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch subdivisions",
        });
      }
    }),

  /**
   * Get user's own subdivisions (all statuses)
   * Protected: Users can see their own submissions
   */
  getMySubdivisions: protectedProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected", "draft"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          submittedBy: ctx.auth!.userId,
        };

        if (input.countryId) {
          where.countryId = input.countryId;
        }

        if (input.status) {
          where.status = input.status;
        }

        const [subdivisions, total] = await Promise.all([
          ctx.db.subdivision.findMany({
            where,
            select: {
              id: true,
              name: true,
              type: true,
              geometry: true,
              level: true,
              population: true,
              capital: true,
              areaSqKm: true,
              status: true,
              reviewedBy: true,
              reviewedAt: true,
              rejectionReason: true,
              createdAt: true,
              updatedAt: true,
              country: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.subdivision.count({ where }),
        ]);

        return {
          subdivisions,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[mapEditor.getMySubdivisions] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch subdivisions",
        });
      }
    }),

  /**
   * Submit subdivision for review
   * Protected: Change status from draft to pending
   */
  submitSubdivisionForReview: standardMutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch existing subdivision
        const existing = await ctx.db.subdivision.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            status: true,
            submittedBy: true,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Subdivision not found",
          });
        }

        // Check ownership
        if (existing.submittedBy !== ctx.auth!.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only submit your own subdivisions for review",
          });
        }

        // Only allow draft/rejected to be submitted
        if (existing.status !== "draft" && existing.status !== "rejected") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only draft or rejected subdivisions can be submitted for review",
          });
        }

        // Update status to pending
        const updated = await ctx.db.subdivision.update({
          where: { id: input.id },
          data: {
            status: "pending",
            updatedAt: new Date(),
          },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "subdivision",
            target: input.id,
            action: "modify",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              old: { status: existing.status },
              new: { status: "pending" },
            }),
          },
        });

        return {
          success: true,
          subdivision: updated,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.submitSubdivisionForReview] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit subdivision for review",
        });
      }
    }),

  // ============================================================================
  // CITY ENDPOINTS
  // ============================================================================

  /**
   * Create a new city
   * Protected: Users can create cities in their own country
   */
  createCity: standardMutationProcedure
    .input(CreateCityInput)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify country exists
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { id: true, name: true },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Check if user owns this country
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isCountryOwner = userCountry?.countryId === input.countryId;
        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;

        if (!isCountryOwner && !isAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only create cities in your own country",
          });
        }

        // Verify subdivision exists if provided
        if (input.subdivisionId) {
          const subdivision = await ctx.db.subdivision.findUnique({
            where: { id: input.subdivisionId },
            select: { countryId: true },
          });

          if (!subdivision || subdivision.countryId !== input.countryId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Subdivision not found or does not belong to this country",
            });
          }
        }

        // PostGIS point validation
        const pointValidation = await validatePointGeometry(input.coordinates);
        if (!pointValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid coordinates: ${pointValidation.errors.join(", ")}`,
          });
        }

        // Check if point is within country boundaries
        const boundaryCheck = await checkPointInCountry(
          input.coordinates,
          input.countryId
        );

        if (!boundaryCheck.isInCountry) {
          const distanceInfo = boundaryCheck.distanceKm
            ? ` (${boundaryCheck.distanceKm.toFixed(1)} km from border)`
            : "";
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `City coordinates are outside country boundaries${distanceInfo}`,
          });
        }

        // Create city with draft status (user can submit for review later)
        const city = await ctx.db.city.create({
          data: {
            countryId: input.countryId,
            subdivisionId: input.subdivisionId,
            name: input.name,
            type: input.type,
            coordinates: input.coordinates as any,
            population: input.population,
            isNationalCapital: input.isNationalCapital,
            isSubdivisionCapital: input.isSubdivisionCapital,
            elevation: input.elevation,
            foundedYear: input.foundedYear,
            status: "draft",
            submittedBy: ctx.auth!.userId,
          },
        });

        // Create audit log entry (non-blocking)
        await createAuditLog(ctx.db, {
          entityType: "city",
          entityId: city.id,
          action: "create",
          userId: ctx.auth!.userId!,
          changes: {
            name: input.name,
            type: input.type,
          },
          metadata: {
            countryId: input.countryId,
            countryName: country.name,
          },
        });

        return {
          success: true,
          city,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.createCity] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create city",
        });
      }
    }),

  /**
   * Update an existing city
   * Protected: Users can only update their own draft cities
   */
  updateCity: standardMutationProcedure
    .input(UpdateCityInput)
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch existing city
        const existing = await ctx.db.city.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            name: true,
            countryId: true,
            status: true,
            submittedBy: true,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "City not found",
          });
        }

        // Check permissions
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth!.userId;
        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;
        const isDraft = existing.status === "pending" || existing.status === "draft";

        if (!isAdmin && (!isOwner || !isDraft)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only edit your own pending/draft cities",
          });
        }

        // Verify subdivision if provided
        if (input.subdivisionId) {
          const subdivision = await ctx.db.subdivision.findUnique({
            where: { id: input.subdivisionId },
            select: { countryId: true },
          });

          if (!subdivision || subdivision.countryId !== existing.countryId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Subdivision not found or does not belong to this country",
            });
          }
        }

        // Update city
        const updated = await ctx.db.city.update({
          where: { id: input.id },
          data: {
            ...(input.subdivisionId !== undefined && { subdivisionId: input.subdivisionId }),
            ...(input.name && { name: input.name }),
            ...(input.type && { type: input.type }),
            ...(input.coordinates && { coordinates: input.coordinates as any }),
            ...(input.population !== undefined && { population: input.population }),
            ...(input.isNationalCapital !== undefined && {
              isNationalCapital: input.isNationalCapital,
            }),
            ...(input.isSubdivisionCapital !== undefined && {
              isSubdivisionCapital: input.isSubdivisionCapital,
            }),
            ...(input.elevation !== undefined && { elevation: input.elevation }),
            ...(input.foundedYear !== undefined && { foundedYear: input.foundedYear }),
            updatedAt: new Date(),
          },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "city",
            target: input.id,
            action: "update",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              old: { name: existing.name },
              new: input,
            }),
          },
        });

        return {
          success: true,
          city: updated,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.updateCity] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update city",
        });
      }
    }),

  /**
   * Delete a city
   * Protected: Users can only delete their own draft cities
   */
  deleteCity: standardMutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch existing city
        const existing = await ctx.db.city.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            name: true,
            status: true,
            submittedBy: true,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "City not found",
          });
        }

        // Check permissions
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth!.userId;
        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;
        const isDraft = existing.status === "pending" || existing.status === "draft";

        if (!isAdmin && (!isOwner || !isDraft)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only delete your own pending/draft cities",
          });
        }

        // Delete city
        await ctx.db.city.delete({
          where: { id: input.id },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "city",
            target: input.id,
            action: "delete",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              name: existing.name,
            }),
          },
        });

        return {
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.deleteCity] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete city",
        });
      }
    }),

  /**
   * Get all approved cities for a country
   * Public: Anyone can view approved cities
   * Rate limited: 120 req/min (read-only operation)
   */
  getCountryCities: readOnlyPublicProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        subdivisionId: z.string().optional(),
        type: z.enum(["capital", "city", "town", "village"]).optional(),
        search: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected", "draft"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          status: input.status ?? "approved",
        };

        if (input.countryId) {
          where.countryId = input.countryId;
        }

        if (input.subdivisionId) {
          where.subdivisionId = input.subdivisionId;
        }

        if (input.type) {
          where.type = input.type;
        }

        if (input.search && input.search.length > 0) {
          where.name = {
            contains: input.search,
            mode: "insensitive",
          };
        }

        const cities = await ctx.db.city.findMany({
          where,
          select: {
            id: true,
            name: true,
            type: true,
            coordinates: true,
            population: true,
            isNationalCapital: true,
            isSubdivisionCapital: true,
            elevation: true,
            foundedYear: true,
            subdivisionId: true,
            createdAt: true,
            country: {
              select: {
                id: true,
                name: true,
              },
            },
            subdivision: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [
            { isNationalCapital: "desc" },
            { isSubdivisionCapital: "desc" },
            { population: "desc" },
          ],
          take: input.limit,
        });

        return {
          cities,
          count: cities.length,
        };
      } catch (error) {
        console.error("[mapEditor.getCountryCities] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch cities",
        });
      }
    }),

  /**
   * Get ALL approved cities globally (for main map display)
   * Public: Anyone can view approved cities
   * Rate limited: 120 req/min (read-only operation)
   */
  getAllCities: readOnlyPublicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).default(500),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const cities = await ctx.db.city.findMany({
          where: {
            status: "approved",
          },
          select: {
            id: true,
            name: true,
            type: true,
            coordinates: true,
            population: true,
            isNationalCapital: true,
            isSubdivisionCapital: true,
            country: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            population: "desc",
          },
          take: input.limit,
        });

        return {
          cities,
          count: cities.length,
        };
      } catch (error) {
        console.error("[mapEditor.getAllCities] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch cities",
        });
      }
    }),

  /**
   * Get ALL national capitals globally (for main map display)
   * Public: Anyone can view approved national capitals
   * Rate limited: 120 req/min (read-only operation)
   */
  getAllNationalCapitals: readOnlyPublicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(500).default(200), // Higher limit for global display
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const capitals = await ctx.db.city.findMany({
          where: {
            isNationalCapital: true,
            status: "approved", // Only show approved capitals
          },
          select: {
            id: true,
            name: true,
            type: true,
            coordinates: true,
            population: true,
            status: true,
            country: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          orderBy: {
            population: "desc",
          },
          take: input.limit,
        });

        return {
          capitals,
          count: capitals.length,
        };
      } catch (error) {
        console.error("[mapEditor.getAllNationalCapitals] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch national capitals",
        });
      }
    }),

  /**
   * Get user's own cities (all statuses)
   * Protected: Users can see their own submissions
   */
  getMyCities: protectedProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected", "draft"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          submittedBy: ctx.auth!.userId,
        };

        if (input.countryId) {
          where.countryId = input.countryId;
        }

        if (input.status) {
          where.status = input.status;
        }

        const [cities, total] = await Promise.all([
          ctx.db.city.findMany({
            where,
            select: {
              id: true,
              name: true,
              type: true,
              coordinates: true,
              population: true,
              isNationalCapital: true,
              isSubdivisionCapital: true,
              elevation: true,
              foundedYear: true,
              status: true,
              reviewedBy: true,
              reviewedAt: true,
              rejectionReason: true,
              createdAt: true,
              updatedAt: true,
              country: {
                select: {
                  id: true,
                  name: true,
                },
              },
              subdivision: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.city.count({ where }),
        ]);

        return {
          cities,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[mapEditor.getMyCities] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch cities",
        });
      }
    }),

  /**
   * Submit city for review
   * Protected: Change status from draft to pending
   */
  submitCityForReview: standardMutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch existing city
        const existing = await ctx.db.city.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            status: true,
            submittedBy: true,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "City not found",
          });
        }

        // Check ownership
        if (existing.submittedBy !== ctx.auth!.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only submit your own cities for review",
          });
        }

        // Only allow draft/rejected to be submitted
        if (existing.status !== "draft" && existing.status !== "rejected") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only draft or rejected cities can be submitted for review",
          });
        }

        // Update status to pending
        const updated = await ctx.db.city.update({
          where: { id: input.id },
          data: {
            status: "pending",
            updatedAt: new Date(),
          },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "city",
            target: input.id,
            action: "modify",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              old: { status: existing.status },
              new: { status: "pending" },
            }),
          },
        });

        return {
          success: true,
          city: updated,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.submitCityForReview] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit city for review",
        });
      }
    }),

  // ============================================================================
  // POI (Point of Interest) ENDPOINTS
  // ============================================================================

  /**
   * Create a new POI
   * Protected: Users can create POIs in their own country
   */
  createPOI: standardMutationProcedure
    .input(CreatePOIInput)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify country exists
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: { id: true, name: true },
        });

        if (!country) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Country not found",
          });
        }

        // Check if user owns this country
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isCountryOwner = userCountry?.countryId === input.countryId;
        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;

        if (!isCountryOwner && !isAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only create POIs in your own country",
          });
        }

        // Verify subdivision exists if provided
        if (input.subdivisionId) {
          const subdivision = await ctx.db.subdivision.findUnique({
            where: { id: input.subdivisionId },
            select: { countryId: true },
          });

          if (!subdivision || subdivision.countryId !== input.countryId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Subdivision not found or does not belong to this country",
            });
          }
        }

        // Create POI with draft status (user can submit for review later)
        const poi = await ctx.db.pointOfInterest.create({
          data: {
            countryId: input.countryId,
            subdivisionId: input.subdivisionId,
            name: input.name,
            category: input.category,
            icon: input.icon,
            coordinates: input.coordinates as any,
            description: input.description,
            images: input.images ? (input.images as any) : null,
            metadata: input.metadata ? (input.metadata as any) : null,
            status: "draft",
            submittedBy: ctx.auth!.userId,
          },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "poi",
            target: poi.id,
            action: "create",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              name: input.name,
              category: input.category,
            }),
          },
        });

        return {
          success: true,
          poi,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.createPOI] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create POI",
        });
      }
    }),

  /**
   * Update an existing POI
   * Protected: Users can only update their own draft POIs
   */
  updatePOI: standardMutationProcedure
    .input(UpdatePOIInput)
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch existing POI
        const existing = await ctx.db.pointOfInterest.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            name: true,
            countryId: true,
            status: true,
            submittedBy: true,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "POI not found",
          });
        }

        // Check permissions
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth!.userId;
        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;
        const isDraft = existing.status === "pending" || existing.status === "draft";

        if (!isAdmin && (!isOwner || !isDraft)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only edit your own pending/draft POIs",
          });
        }

        // Verify subdivision if provided
        if (input.subdivisionId) {
          const subdivision = await ctx.db.subdivision.findUnique({
            where: { id: input.subdivisionId },
            select: { countryId: true },
          });

          if (!subdivision || subdivision.countryId !== existing.countryId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Subdivision not found or does not belong to this country",
            });
          }
        }

        // Update POI
        const updated = await ctx.db.pointOfInterest.update({
          where: { id: input.id },
          data: {
            ...(input.subdivisionId !== undefined && { subdivisionId: input.subdivisionId }),
            ...(input.name && { name: input.name }),
            ...(input.category && { category: input.category }),
            ...(input.icon !== undefined && { icon: input.icon }),
            ...(input.coordinates && { coordinates: input.coordinates as any }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.images !== undefined && { images: input.images as any }),
            ...(input.metadata !== undefined && { metadata: input.metadata as any }),
            updatedAt: new Date(),
          },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "poi",
            target: input.id,
            action: "update",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              old: { name: existing.name },
              new: input,
            }),
          },
        });

        return {
          success: true,
          poi: updated,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.updatePOI] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update POI",
        });
      }
    }),

  /**
   * Delete a POI
   * Protected: Users can only delete their own draft POIs
   */
  deletePOI: standardMutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch existing POI
        const existing = await ctx.db.pointOfInterest.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            name: true,
            status: true,
            submittedBy: true,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "POI not found",
          });
        }

        // Check permissions
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth!.userId;
        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;
        const isDraft = existing.status === "pending" || existing.status === "draft";

        if (!isAdmin && (!isOwner || !isDraft)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only delete your own pending/draft POIs",
          });
        }

        // Delete POI
        await ctx.db.pointOfInterest.delete({
          where: { id: input.id },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "poi",
            target: input.id,
            action: "delete",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              name: existing.name,
            }),
          },
        });

        return {
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.deletePOI] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete POI",
        });
      }
    }),

  /**
   * Get all approved POIs for a country
   * Public: Anyone can view approved POIs
   * Rate limited: 120 req/min (read-only operation)
   */
  getCountryPOIs: readOnlyPublicProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        subdivisionId: z.string().optional(),
        category: z
          .enum([
            "monument",
            "landmark",
            "military",
            "cultural",
            "natural",
            "religious",
            "government",
          ])
          .optional(),
        search: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected", "draft"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          status: input.status ?? "approved",
        };

        if (input.countryId) {
          where.countryId = input.countryId;
        }

        if (input.subdivisionId) {
          where.subdivisionId = input.subdivisionId;
        }

        if (input.category) {
          where.category = input.category;
        }

        if (input.search && input.search.length > 0) {
          where.name = {
            contains: input.search,
            mode: "insensitive",
          };
        }

        const pois = await ctx.db.pointOfInterest.findMany({
          where,
          select: {
            id: true,
            name: true,
            category: true,
            icon: true,
            coordinates: true,
            description: true,
            images: true,
            metadata: true,
            subdivisionId: true,
            createdAt: true,
            country: {
              select: {
                id: true,
                name: true,
              },
            },
            subdivision: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { name: "asc" },
          take: input.limit,
        });

        return {
          pois,
          count: pois.length,
        };
      } catch (error) {
        console.error("[mapEditor.getCountryPOIs] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch POIs",
        });
      }
    }),

  /**
   * Get user's own POIs (all statuses)
   * Protected: Users can see their own submissions
   */
  getMyPOIs: protectedProcedure
    .input(
      z.object({
        countryId: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected", "draft"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {
          submittedBy: ctx.auth!.userId,
        };

        if (input.countryId) {
          where.countryId = input.countryId;
        }

        if (input.status) {
          where.status = input.status;
        }

        const [pois, total] = await Promise.all([
          ctx.db.pointOfInterest.findMany({
            where,
            select: {
              id: true,
              name: true,
              category: true,
              icon: true,
              coordinates: true,
              description: true,
              images: true,
              metadata: true,
              status: true,
              reviewedBy: true,
              reviewedAt: true,
              rejectionReason: true,
              createdAt: true,
              updatedAt: true,
              country: {
                select: {
                  id: true,
                  name: true,
                },
              },
              subdivision: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.pointOfInterest.count({ where }),
        ]);

        return {
          pois,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[mapEditor.getMyPOIs] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch POIs",
        });
      }
    }),

  /**
   * Submit POI for review
   * Protected: Change status from draft to pending
   */
  submitPOIForReview: standardMutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch existing POI
        const existing = await ctx.db.pointOfInterest.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            status: true,
            submittedBy: true,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "POI not found",
          });
        }

        // Check ownership
        if (existing.submittedBy !== ctx.auth!.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only submit your own POIs for review",
          });
        }

        // Only allow draft/rejected to be submitted
        if (existing.status !== "draft" && existing.status !== "rejected") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only draft or rejected POIs can be submitted for review",
          });
        }

        // Update status to pending
        const updated = await ctx.db.pointOfInterest.update({
          where: { id: input.id },
          data: {
            status: "pending",
            updatedAt: new Date(),
          },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType: "poi",
            target: input.id,
            action: "modify",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              old: { status: existing.status },
              new: { status: "pending" },
            }),
          },
        });

        return {
          success: true,
          poi: updated,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.submitPOIForReview] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit POI for review",
        });
      }
    }),

  // ============================================================================
  // ADMIN ENDPOINTS
  // ============================================================================

  /**
   * Get all pending submissions for review
   * Admin-only: Returns all pending submissions with filters
   */
  getPendingReviews: adminProcedure
    .input(
      z.object({
        entityType: z.enum(["subdivision", "city", "poi", "all"]).default("all"),
        countryId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      console.log("[getPendingReviews] CALLED with input:", input);
      console.log("[getPendingReviews] User:", ctx.auth!.userId);

      try {
        const results: any = {
          subdivisions: [],
          cities: [],
          pois: [],
          total: 0,
        };

        // Fetch subdivisions
        if (input.entityType === "all" || input.entityType === "subdivision") {
          const where: any = { status: "pending" };
          if (input.countryId) where.countryId = input.countryId;

          const [subdivisions, subdivisionCount] = await Promise.all([
            ctx.db.subdivision.findMany({
              where,
              select: {
                id: true,
                name: true,
                type: true,
                level: true,
                status: true,
                submittedBy: true,
                createdAt: true,
                country: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
              take: input.entityType === "subdivision" ? input.limit : undefined,
              skip: input.entityType === "subdivision" ? input.offset : undefined,
            }),
            ctx.db.subdivision.count({ where }),
          ]);

          results.subdivisions = subdivisions;
          if (input.entityType === "subdivision") {
            results.total = subdivisionCount;
          }
        }

        // Fetch cities
        if (input.entityType === "all" || input.entityType === "city") {
          const where: any = { status: "pending" };
          if (input.countryId) where.countryId = input.countryId;

          console.log("[getPendingReviews] Fetching cities with where:", where);
          console.log("[getPendingReviews] Entity type:", input.entityType);

          const [cities, cityCount] = await Promise.all([
            ctx.db.city.findMany({
              where,
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
                submittedBy: true,
                createdAt: true,
                country: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
              take: input.entityType === "city" ? input.limit : undefined,
              skip: input.entityType === "city" ? input.offset : undefined,
            }),
            ctx.db.city.count({ where }),
          ]);

          console.log("[getPendingReviews] Found cities:", cities.length, cities);
          console.log("[getPendingReviews] City count:", cityCount);

          results.cities = cities;
          if (input.entityType === "city") {
            results.total = cityCount;
          }
        }

        // Fetch POIs
        if (input.entityType === "all" || input.entityType === "poi") {
          const where: any = { status: "pending" };
          if (input.countryId) where.countryId = input.countryId;

          const [pois, poiCount] = await Promise.all([
            ctx.db.pointOfInterest.findMany({
              where,
              select: {
                id: true,
                name: true,
                category: true,
                status: true,
                submittedBy: true,
                createdAt: true,
                country: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
              take: input.entityType === "poi" ? input.limit : undefined,
              skip: input.entityType === "poi" ? input.offset : undefined,
            }),
            ctx.db.pointOfInterest.count({ where }),
          ]);

          results.pois = pois;
          if (input.entityType === "poi") {
            results.total = poiCount;
          }
        }

        // For "all" type, calculate combined total
        if (input.entityType === "all") {
          results.total =
            results.subdivisions.length + results.cities.length + results.pois.length;
        }

        console.log("[getPendingReviews] RETURNING results:", {
          subdivisions: results.subdivisions.length,
          cities: results.cities.length,
          pois: results.pois.length,
          total: results.total,
          citiesData: results.cities,
        });

        return results;
      } catch (error) {
        console.error("[mapEditor.getPendingReviews] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch pending reviews",
        });
      }
    }),

  /**
   * Approve a submission
   * Admin-only: Approves a pending submission
   */
  approveSubmission: adminProcedure
    .input(ApproveSubmissionInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const { entityType, entityId, reason } = input;

        // Get the appropriate model
        let model: any;
        if (entityType === "subdivision") {
          model = ctx.db.subdivision;
        } else if (entityType === "city") {
          model = ctx.db.city;
        } else {
          model = ctx.db.pointOfInterest;
        }

        // Fetch entity to verify it exists and is pending
        const entity = await model.findUnique({
          where: { id: entityId },
          select: { id: true, status: true, name: true },
        });

        if (!entity) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${entityType} not found`,
          });
        }

        if (entity.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Can only approve pending submissions`,
          });
        }

        // Approve the submission
        const updated = await model.update({
          where: { id: entityId },
          data: {
            status: "approved",
            reviewedBy: ctx.auth!.userId,
            reviewedAt: new Date(),
          },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType,
            target: entityId,
            action: "approve",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              reason,
              old: { status: "pending" },
              new: { status: "approved" },
            }),
          },
        });

        return {
          success: true,
          entity: updated,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.approveSubmission] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to approve submission",
        });
      }
    }),

  /**
   * Reject a submission
   * Admin-only: Rejects a pending submission with reason
   */
  rejectSubmission: adminProcedure
    .input(RejectSubmissionInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const { entityType, entityId, reason } = input;

        // Get the appropriate model
        let model: any;
        if (entityType === "subdivision") {
          model = ctx.db.subdivision;
        } else if (entityType === "city") {
          model = ctx.db.city;
        } else {
          model = ctx.db.pointOfInterest;
        }

        // Fetch entity to verify it exists and is pending
        const entity = await model.findUnique({
          where: { id: entityId },
          select: { id: true, status: true, name: true },
        });

        if (!entity) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${entityType} not found`,
          });
        }

        if (entity.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Can only reject pending submissions`,
          });
        }

        // Reject the submission
        const updated = await model.update({
          where: { id: entityId },
          data: {
            status: "rejected",
            reviewedBy: ctx.auth!.userId,
            reviewedAt: new Date(),
            rejectionReason: reason,
          },
        });

        // Create audit log entry
        await ctx.db.auditLog.create({
          data: {
            entityType,
            target: entityId,
            action: "reject",
            userId: ctx.auth!.userId!,
            details: JSON.stringify({
              reason,
              old: { status: "pending" },
              new: { status: "rejected", reason },
            }),
          },
        });

        return {
          success: true,
          entity: updated,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.rejectSubmission] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reject submission",
        });
      }
    }),

  /**
   * Bulk approve multiple submissions
   * Admin-only: Approves multiple submissions at once
   */
  bulkApprove: adminProcedure.input(BulkApproveInput).mutation(async ({ ctx, input }) => {
    try {
      const { entityType, entityIds } = input;

      // Get the appropriate model
      let model: any;
      if (entityType === "subdivision") {
        model = ctx.db.subdivision;
      } else if (entityType === "city") {
        model = ctx.db.city;
      } else {
        model = ctx.db.pointOfInterest;
      }

      // Bulk update
      const result = await model.updateMany({
        where: {
          id: { in: entityIds },
          status: "pending",
        },
        data: {
          status: "approved",
          reviewedBy: ctx.auth!.userId,
          reviewedAt: new Date(),
        },
      });

      // Create audit log entries
      await Promise.all(
        entityIds.map((entityId) =>
          ctx.db.auditLog.create({
            data: {
              entityType,
              target: entityId,
              action: "approve",
              userId: ctx.auth!.userId!,
              details: JSON.stringify({
                bulkOperation: true,
                totalItems: entityIds.length,
                old: { status: "pending" },
                new: { status: "approved" },
              }),
            },
          })
        )
      );

      // Invalidate vector tile caches (async, don't wait)
      if (result.count > 0) {
        if (entityType === "subdivision") {
          tileCacheInvalidation.invalidateSubdivisions().catch((err) => {
            console.error("[bulkApprove] Failed to invalidate subdivision tiles:", err);
          });
        } else if (entityType === "city") {
          tileCacheInvalidation.invalidateCities().catch((err) => {
            console.error("[bulkApprove] Failed to invalidate city tiles:", err);
          });
        } else if (entityType === "poi") {
          tileCacheInvalidation.invalidatePOIs().catch((err) => {
            console.error("[bulkApprove] Failed to invalidate POI tiles:", err);
          });
        }
      }

      return {
        success: true,
        approvedCount: result.count,
      };
    } catch (error) {
      console.error("[mapEditor.bulkApprove] Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to bulk approve submissions",
      });
    }
  }),

  /**
   * Get edit history for map entities
   * Admin-only: Returns audit log entries for map editing operations
   */
  getEditHistory: adminProcedure
    .input(
      z.object({
        entityType: z.enum(["subdivision", "city", "poi", "border"]).optional(),
        entityId: z.string().optional(),
        userId: z.string().optional(),
        action: z.enum(["create", "update", "delete", "approve", "reject", "modify"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};

        if (input.entityType) {
          where.entityType = input.entityType;
        }

        if (input.entityId) {
          where.target = input.entityId;
        }

        if (input.userId) {
          where.userId = input.userId;
        }

        if (input.action) {
          where.action = input.action;
        }

        const [logs, total] = await Promise.all([
          ctx.db.auditLog.findMany({
            where,
            orderBy: { timestamp: "desc" },
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.auditLog.count({ where }),
        ]);

        // Fetch user information for logs
        const uniqueUserIds = new Set(
          logs.map((log) => log.userId).filter((id): id is string => id !== null)
        );
        const users = await ctx.db.user.findMany({
          where: {
            clerkUserId: { in: Array.from(uniqueUserIds) },
          },
          select: {
            clerkUserId: true,
          },
        });

        const userMap = new Map(
          users.map((u) => [u.clerkUserId, "Unknown User"])
        );

        const enrichedLogs = logs.map((log) => ({
          ...log,
          userName: log.userId ? (userMap.get(log.userId) || log.userId) : "Unknown User",
        }));

        return {
          logs: enrichedLogs,
          total,
          hasMore: input.offset + input.limit < total,
        };
      } catch (error) {
        console.error("[mapEditor.getEditHistory] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch edit history",
        });
      }
    }),

  // ============================================================================
  // BATCH OPERATIONS (Performance Optimization)
  // ============================================================================

  /**
   * Batch create subdivisions
   * Creates multiple subdivisions in a single transaction
   * More efficient than creating individually
   */
  batchCreateSubdivisions: standardMutationProcedure
    .input(
      z.object({
        subdivisions: z.array(CreateSubdivisionInput).min(1).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Validate all geometries first
        for (const sub of input.subdivisions) {
          if (!validateGeoJSONPolygon(sub.geometry)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid GeoJSON geometry for subdivision: ${sub.name}`,
            });
          }
        }

        // Verify all countries exist and user has permissions
        const countryIds = Array.from(new Set(input.subdivisions.map((s) => s.countryId)));
        const countries = await ctx.db.country.findMany({
          where: { id: { in: countryIds } },
          select: { id: true },
        });

        if (countries.length !== countryIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "One or more countries not found",
          });
        }

        // Check user permissions
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;

        // Verify user owns all countries or is admin
        if (!isAdmin) {
          const unauthorized = input.subdivisions.some(
            (s) => s.countryId !== userCountry?.countryId
          );
          if (unauthorized) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You can only create subdivisions in your own country",
            });
          }
        }

        // Batch create in a transaction
        const results = await ctx.db.$transaction(
          input.subdivisions.map((sub) =>
            ctx.db.subdivision.create({
              data: {
                countryId: sub.countryId,
                name: sub.name,
                type: sub.type,
                geometry: sub.geometry as any,
                level: sub.level,
                population: sub.population,
                capital: sub.capital,
                areaSqKm: sub.areaSqKm,
                status: "draft",
                submittedBy: ctx.auth!.userId,
              },
            })
          )
        );

        // Batch create audit logs
        await ctx.db.auditLog.createMany({
          data: results.map((sub) => ({
            entityType: "subdivision",
            target: sub.id,
            action: "create",
            userId: ctx.auth!.userId!,
          })),
        });

        return {
          success: true,
          count: results.length,
          ids: results.map((r) => r.id),
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.batchCreateSubdivisions] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to batch create subdivisions",
        });
      }
    }),

  /**
   * Batch create cities
   * Creates multiple cities in a single transaction
   */
  batchCreateCities: standardMutationProcedure
    .input(
      z.object({
        cities: z.array(CreateCityInput).min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Validate all coordinates
        for (const city of input.cities) {
          if (!validateGeoJSONPoint(city.coordinates)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid GeoJSON coordinates for city: ${city.name}`,
            });
          }
        }

        // Verify countries exist
        const countryIds = Array.from(new Set(input.cities.map((c) => c.countryId)));
        const countries = await ctx.db.country.findMany({
          where: { id: { in: countryIds } },
          select: { id: true },
        });

        if (countries.length !== countryIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "One or more countries not found",
          });
        }

        // Check permissions
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;

        if (!isAdmin) {
          const unauthorized = input.cities.some(
            (c) => c.countryId !== userCountry?.countryId
          );
          if (unauthorized) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You can only create cities in your own country",
            });
          }
        }

        // Batch create in transaction
        const results = await ctx.db.$transaction(
          input.cities.map((city) =>
            ctx.db.city.create({
              data: {
                countryId: city.countryId,
                subdivisionId: city.subdivisionId,
                name: city.name,
                type: city.type,
                coordinates: city.coordinates as any,
                population: city.population,
                isNationalCapital: city.isNationalCapital ?? false,
                isSubdivisionCapital: city.isSubdivisionCapital ?? false,
                elevation: city.elevation,
                foundedYear: city.foundedYear,
                status: "draft",
                submittedBy: ctx.auth!.userId,
              },
            })
          )
        );

        // Batch audit logs
        await ctx.db.auditLog.createMany({
          data: results.map((city) => ({
            entityType: "city",
            target: city.id,
            action: "create",
            userId: ctx.auth!.userId!,
          })),
        });

        return {
          success: true,
          count: results.length,
          ids: results.map((r) => r.id),
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.batchCreateCities] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to batch create cities",
        });
      }
    }),

  /**
   * Batch create POIs
   * Creates multiple POIs in a single transaction
   */
  batchCreatePOIs: standardMutationProcedure
    .input(
      z.object({
        pois: z.array(CreatePOIInput).min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Validate coordinates
        for (const poi of input.pois) {
          if (!validateGeoJSONPoint(poi.coordinates)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid GeoJSON coordinates for POI: ${poi.name}`,
            });
          }
        }

        // Verify countries
        const countryIds = Array.from(new Set(input.pois.map((p) => p.countryId)));
        const countries = await ctx.db.country.findMany({
          where: { id: { in: countryIds } },
          select: { id: true },
        });

        if (countries.length !== countryIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "One or more countries not found",
          });
        }

        // Check permissions
        const userCountry = await ctx.db.user.findUnique({
          where: { clerkUserId: ctx.auth!.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isAdmin = (userCountry?.role?.level ?? 999) <= 20;

        if (!isAdmin) {
          const unauthorized = input.pois.some(
            (p) => p.countryId !== userCountry?.countryId
          );
          if (unauthorized) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You can only create POIs in your own country",
            });
          }
        }

        // Batch create in transaction
        const results = await ctx.db.$transaction(
          input.pois.map((poi) =>
            ctx.db.pointOfInterest.create({
              data: {
                countryId: poi.countryId,
                subdivisionId: poi.subdivisionId,
                name: poi.name,
                category: poi.category,
                icon: poi.icon,
                coordinates: poi.coordinates as any,
                description: poi.description,
                images: poi.images,
                metadata: poi.metadata,
                status: "draft",
                submittedBy: ctx.auth!.userId,
              },
            })
          )
        );

        // Batch audit logs
        await ctx.db.auditLog.createMany({
          data: results.map((poi) => ({
            entityType: "poi",
            target: poi.id,
            action: "create",
            userId: ctx.auth!.userId!,
          })),
        });

        return {
          success: true,
          count: results.length,
          ids: results.map((r) => r.id),
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.batchCreatePOIs] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to batch create POIs",
        });
      }
    }),

  // ============================================================================
  // DATA QUALITY & VALIDATION (Admin)
  // ============================================================================

  /**
   * Get data quality report for a country
   * Admin-only: Comprehensive validation and quality metrics
   */
  getDataQualityReport: adminProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const report = await generateDataQualityReport(input.countryId);
        return report;
      } catch (error) {
        console.error("[mapEditor.getDataQualityReport] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate data quality report",
        });
      }
    }),

  /**
   * Auto-fix invalid geometries
   * Admin-only: Attempts to fix topology issues using ST_MakeValid
   */
  autoFixGeometries: adminProcedure
    .input(
      z.object({
        entityType: z.enum(["subdivision", "city", "poi"]),
        entityIds: z.array(z.string()).min(1).max(100),
        dryRun: z.boolean().default(true), // Safety: default to dry run
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { entityType, entityIds, dryRun } = input;

        if (entityType !== "subdivision") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only subdivisions can be auto-fixed (polygons)",
          });
        }

        const fixResults: Array<{
          id: string;
          name: string;
          wasValid: boolean;
          isFixed: boolean;
          errors: string[];
        }> = [];

        // Process each subdivision
        for (const id of entityIds) {
          const subdivision = await ctx.db.subdivision.findUnique({
            where: { id },
            select: { id: true, name: true, geometry: true },
          });

          if (!subdivision) {
            fixResults.push({
              id,
              name: "NOT_FOUND",
              wasValid: false,
              isFixed: false,
              errors: ["Subdivision not found"],
            });
            continue;
          }

          // Validate geometry
          const validation = await validatePolygonGeometry(subdivision.geometry);

          if (validation.isValid) {
            fixResults.push({
              id: subdivision.id,
              name: subdivision.name,
              wasValid: true,
              isFixed: false,
              errors: [],
            });
            continue;
          }

          // Try to fix
          if (!validation.canAutoFix || !validation.fixedGeometry) {
            fixResults.push({
              id: subdivision.id,
              name: subdivision.name,
              wasValid: false,
              isFixed: false,
              errors: validation.errors,
            });
            continue;
          }

          // Apply fix if not dry run
          if (!dryRun) {
            await ctx.db.subdivision.update({
              where: { id: subdivision.id },
              data: {
                geometry: validation.fixedGeometry as any,
                updatedAt: new Date(),
              },
            });

            // Create audit log
            await ctx.db.auditLog.create({
              data: {
                entityType: "subdivision",
                target: subdivision.id,
                action: "modify",
                userId: ctx.auth!.userId!,
                details: JSON.stringify({
                  old: { geometry: "INVALID" },
                  new: { geometry: "AUTO_FIXED" },
                  reason: `Auto-fixed geometry: ${validation.errors.join(", ")}`,
                }),
              },
            });

            // Invalidate tile cache
            tileCacheInvalidation.invalidateSubdivisions().catch(console.error);
          }

          fixResults.push({
            id: subdivision.id,
            name: subdivision.name,
            wasValid: false,
            isFixed: true,
            errors: validation.errors,
          });
        }

        const summary = {
          total: fixResults.length,
          alreadyValid: fixResults.filter((r) => r.wasValid).length,
          fixed: fixResults.filter((r) => r.isFixed).length,
          unfixable: fixResults.filter((r) => !r.wasValid && !r.isFixed).length,
          dryRun,
        };

        return {
          summary,
          results: fixResults,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[mapEditor.autoFixGeometries] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to auto-fix geometries",
        });
      }
    }),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate GeoJSON Point structure
 */
function validateGeoJSONPoint(geometry: any): boolean {
  if (!geometry.type || !geometry.coordinates) {
    return false;
  }

  if (geometry.type === "Point") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length === 2 &&
      typeof geometry.coordinates[0] === "number" &&
      typeof geometry.coordinates[1] === "number" &&
      geometry.coordinates[0] >= -180 &&
      geometry.coordinates[0] <= 180 &&
      geometry.coordinates[1] >= -90 &&
      geometry.coordinates[1] <= 90
    );
  }

  return false;
}

/**
 * Validate GeoJSON Polygon structure
 */
function validateGeoJSONPolygon(geometry: any): boolean {
  if (!geometry.type || !geometry.coordinates) {
    return false;
  }

  if (geometry.type === "Polygon") {
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
  } else if (geometry.type === "MultiPolygon") {
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
  }

  return false;
}
