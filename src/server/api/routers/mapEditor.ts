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
} from "~/server/api/trpc";

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
// Map Editor Router
// ============================================================================

export const mapEditorRouter = createTRPCRouter({
  // ============================================================================
  // UNIFIED SEARCH ENDPOINT (Optimization)
  // ============================================================================

  /**
   * Unified search across all map entities (countries, subdivisions, cities, POIs)
   * Replaces 4 separate queries with 1 batched query for better performance
   * Public endpoint with rate limiting
   */
  unifiedSearch: publicProcedure
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
        // Run all queries in parallel for maximum performance
        const [countries, subdivisions, cities, pois] = await Promise.all([
          // Countries
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
              minLng: true,
              minLat: true,
              maxLng: true,
              maxLat: true,
            },
            take: perEntityLimit,
            orderBy: { name: "asc" },
          }),

          // Subdivisions (approved only)
          ctx.db.subdivision.findMany({
            where: {
              name: { contains: search, mode: "insensitive" },
              status: "approved",
            },
            select: {
              id: true,
              name: true,
              type: true,
              country: { select: { id: true, name: true } },
            },
            take: perEntityLimit,
            orderBy: { name: "asc" },
          }),

          // Cities (approved only)
          ctx.db.city.findMany({
            where: {
              name: { contains: search, mode: "insensitive" },
              status: "approved",
            },
            select: {
              id: true,
              name: true,
              coordinates: true,
              country: { select: { id: true, name: true } },
              subdivision: { select: { id: true, name: true } },
            },
            take: perEntityLimit,
            orderBy: { name: "asc" },
          }),

          // POIs (approved only)
          ctx.db.poi.findMany({
            where: {
              name: { contains: search, mode: "insensitive" },
              status: "approved",
            },
            select: {
              id: true,
              name: true,
              category: true,
              coordinates: true,
              country: { select: { id: true, name: true } },
              subdivision: { select: { id: true, name: true } },
            },
            take: perEntityLimit,
            orderBy: { name: "asc" },
          }),
        ]);

        return {
          countries,
          subdivisions,
          cities,
          pois,
          totalResults: countries.length + subdivisions.length + cities.length + pois.length,
        };
      } catch (error) {
        console.error("[mapEditor.unifiedSearch] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Search failed",
        });
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
          where: { clerkUserId: ctx.auth.userId },
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

        // Create subdivision with pending status
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
            status: "pending",
            submittedBy: ctx.auth.userId,
          },
        });

        // Create audit log entry
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "subdivision",
            entityId: subdivision.id,
            action: "create",
            userId: ctx.auth.userId,
            changes: {
              name: input.name,
              type: input.type,
              level: input.level,
            },
            metadata: {
              countryId: input.countryId,
              countryName: country.name,
            },
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
          where: { clerkUserId: ctx.auth.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth.userId;
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
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "subdivision",
            entityId: input.id,
            action: "update",
            userId: ctx.auth.userId,
            changes: {
              old: { name: existing.name },
              new: input,
            },
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
          where: { clerkUserId: ctx.auth.userId },
          select: { role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth.userId;
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
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "subdivision",
            entityId: input.id,
            action: "delete",
            userId: ctx.auth.userId,
            changes: {
              name: existing.name,
            },
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
   */
  getCountrySubdivisions: publicProcedure
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

        return {
          subdivisions,
          count: subdivisions.length,
        };
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
          submittedBy: ctx.auth.userId,
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
            orderBy: { createdAt: "desc" },
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
        if (existing.submittedBy !== ctx.auth.userId) {
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
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "subdivision",
            entityId: input.id,
            action: "modify",
            userId: ctx.auth.userId,
            changes: {
              old: { status: existing.status },
              new: { status: "pending" },
            },
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
          where: { clerkUserId: ctx.auth.userId },
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

        // Create city with pending status
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
            status: "pending",
            submittedBy: ctx.auth.userId,
          },
        });

        // Create audit log entry
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "city",
            entityId: city.id,
            action: "create",
            userId: ctx.auth.userId,
            changes: {
              name: input.name,
              type: input.type,
            },
            metadata: {
              countryId: input.countryId,
              countryName: country.name,
            },
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
          where: { clerkUserId: ctx.auth.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth.userId;
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
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "city",
            entityId: input.id,
            action: "update",
            userId: ctx.auth.userId,
            changes: {
              old: { name: existing.name },
              new: input,
            },
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
          where: { clerkUserId: ctx.auth.userId },
          select: { role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth.userId;
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
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "city",
            entityId: input.id,
            action: "delete",
            userId: ctx.auth.userId,
            changes: {
              name: existing.name,
            },
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
   */
  getCountryCities: publicProcedure
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
          submittedBy: ctx.auth.userId,
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
            orderBy: { createdAt: "desc" },
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
        if (existing.submittedBy !== ctx.auth.userId) {
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
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "city",
            entityId: input.id,
            action: "modify",
            userId: ctx.auth.userId,
            changes: {
              old: { status: existing.status },
              new: { status: "pending" },
            },
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
          where: { clerkUserId: ctx.auth.userId },
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

        // Create POI with pending status
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
            status: "pending",
            submittedBy: ctx.auth.userId,
          },
        });

        // Create audit log entry
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "poi",
            entityId: poi.id,
            action: "create",
            userId: ctx.auth.userId,
            changes: {
              name: input.name,
              category: input.category,
            },
            metadata: {
              countryId: input.countryId,
              countryName: country.name,
            },
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
          where: { clerkUserId: ctx.auth.userId },
          select: { countryId: true, role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth.userId;
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
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "poi",
            entityId: input.id,
            action: "update",
            userId: ctx.auth.userId,
            changes: {
              old: { name: existing.name },
              new: input,
            },
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
          where: { clerkUserId: ctx.auth.userId },
          select: { role: { select: { level: true } } },
        });

        const isOwner = existing.submittedBy === ctx.auth.userId;
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
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "poi",
            entityId: input.id,
            action: "delete",
            userId: ctx.auth.userId,
            changes: {
              name: existing.name,
            },
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
   */
  getCountryPOIs: publicProcedure
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
          submittedBy: ctx.auth.userId,
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
            orderBy: { createdAt: "desc" },
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
        if (existing.submittedBy !== ctx.auth.userId) {
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
        await ctx.db.mapEditLog.create({
          data: {
            entityType: "poi",
            entityId: input.id,
            action: "modify",
            userId: ctx.auth.userId,
            changes: {
              old: { status: existing.status },
              new: { status: "pending" },
            },
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
            reviewedBy: ctx.auth.userId,
            reviewedAt: new Date(),
          },
        });

        // Create audit log entry
        await ctx.db.mapEditLog.create({
          data: {
            entityType,
            entityId,
            action: "approve",
            userId: ctx.auth.userId,
            reason,
            changes: {
              old: { status: "pending" },
              new: { status: "approved" },
            },
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
            reviewedBy: ctx.auth.userId,
            reviewedAt: new Date(),
            rejectionReason: reason,
          },
        });

        // Create audit log entry
        await ctx.db.mapEditLog.create({
          data: {
            entityType,
            entityId,
            action: "reject",
            userId: ctx.auth.userId,
            reason,
            changes: {
              old: { status: "pending" },
              new: { status: "rejected", reason },
            },
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
          reviewedBy: ctx.auth.userId,
          reviewedAt: new Date(),
        },
      });

      // Create audit log entries
      await Promise.all(
        entityIds.map((entityId) =>
          ctx.db.mapEditLog.create({
            data: {
              entityType,
              entityId,
              action: "approve",
              userId: ctx.auth.userId,
              changes: {
                old: { status: "pending" },
                new: { status: "approved" },
              },
              metadata: {
                bulkOperation: true,
                totalItems: entityIds.length,
              },
            },
          })
        )
      );

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
          where.entityId = input.entityId;
        }

        if (input.userId) {
          where.userId = input.userId;
        }

        if (input.action) {
          where.action = input.action;
        }

        const [logs, total] = await Promise.all([
          ctx.db.mapEditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: input.limit,
            skip: input.offset,
          }),
          ctx.db.mapEditLog.count({ where }),
        ]);

        // Fetch user information for logs
        const uniqueUserIds = new Set(logs.map((log) => log.userId));
        const users = await ctx.db.user.findMany({
          where: {
            clerkUserId: { in: Array.from(uniqueUserIds) },
          },
          select: {
            clerkUserId: true,
            displayName: true,
            username: true,
          },
        });

        const userMap = new Map(
          users.map((u) => [u.clerkUserId, u.displayName || u.username || "Unknown"])
        );

        const enrichedLogs = logs.map((log) => ({
          ...log,
          userName: userMap.get(log.userId) || log.userId,
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
});

// ============================================================================
// Helper Functions
// ============================================================================

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
