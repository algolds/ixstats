/**
 * Geographic Map Router
 *
 * tRPC router for the IxEarth world map system.
 * Handles map layer data, country geometry, spatial queries,
 * and country-feature linking.
 *
 * Data source: PostgreSQL + PostGIS (map_layers table),
 * with file-based fallback for initial load.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  cachedPublicProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

/** Reusable Zod schema for WGS84 coordinate pair [lng, lat] with bounds checking. */
const _coordinatesSchema = z
  .tuple([z.number(), z.number()])
  .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
    message: "Coordinates must be valid WGS84 (lng: -180 to 180, lat: -90 to 90)",
  });

import { syncGeographicDemographics } from "~/lib/country-geo/sync";
export { syncGeographicDemographics };

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoFeaturesStorylinesRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Border Editor
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // User map editor endpoints (country owners)
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Story Pins — Narrative markers on the map
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Storylines — Narrative chains connecting story pins
  // ──────────────────────────────────────────────

  createStoryline: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      return ctx.db.storyline.create({
        data: {
          title: input.title,
          description: input.description,
          countryId: input.countryId,
          color: input.color ?? "#6366f1",
        },
      });
    }),

  updateStoryline: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        storylineId: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const sl = await ctx.db.storyline.findFirst({
        where: { id: input.storylineId, countryId: input.countryId },
      });
      if (!sl) throw new TRPCError({ code: "NOT_FOUND", message: "Storyline not found" });
      return ctx.db.storyline.update({
        where: { id: input.storylineId },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.color && { color: input.color }),
        },
      });
    }),

  deleteStoryline: standardMutationCountryOwnerProcedure
    .input(z.object({ countryId: z.string(), storylineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      const sl = await ctx.db.storyline.findFirst({
        where: { id: input.storylineId, countryId: input.countryId },
      });
      if (!sl) throw new TRPCError({ code: "NOT_FOUND", message: "Storyline not found" });
      // Unlink pins before deleting
      await ctx.db.storyPin.updateMany({
        where: { storylineId: input.storylineId },
        data: { storylineId: null, storylineOrder: null },
      });
      await ctx.db.storyline.delete({ where: { id: input.storylineId } });
      return { id: input.storylineId, deleted: true };
    }),

  getStorylinesByCountry: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.storyline.findMany({
        where: { countryId: input.countryId },
        include: { _count: { select: { pins: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  getStorylineWithPins: cachedPublicProcedure
    .input(z.object({ storylineId: z.string() }))
    .query(async ({ ctx, input }) => {
      const storyline = await ctx.db.storyline.findUnique({
        where: { id: input.storylineId },
        include: {
          pins: {
            where: { status: "approved" },
            orderBy: [{ storylineOrder: "asc" }, { ixTimeYear: "asc" }],
            select: {
              id: true,
              title: true,
              category: true,
              ixTimeYear: true,
              eraLabel: true,
              coordinates: true,
              importance: true,
              thumbnailUrl: true,
            },
          },
          country: { select: { name: true, slug: true } },
        },
      });
      if (!storyline) throw new TRPCError({ code: "NOT_FOUND", message: "Storyline not found" });
      return storyline;
    }),

  // ──────────────────────────────────────────────
  // Map Labels — Custom styled text on the map
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Sovereignty / dependency management
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Linkage validation & repair
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // SVG Upload & Processing Pipeline
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────
  // World Template / Clone System (Phase 3)
  // ──────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────
  // Procedural World Generation (Phase 4)
  // ──────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Map Pipeline Endpoints
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Province Import Endpoints
  // ──────────────────────────────────────────────

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────
});
