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
  publicProcedure,
  rateLimitedPublicProcedure,
  cachedPublicProcedure,
  adminProcedure,
  countryOwnerProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { SOVEREIGNTY_TYPES } from "~/lib/maps/map-config";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { clearLayerCache } from "./core";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoSovereigntyRouter = createTRPCRouter({
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

  // ──────────────────────────────────────────────
  // Map Labels — Custom styled text on the map
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Sovereignty / dependency management
  // ──────────────────────────────────────────────

  /** Get all active sovereignty relationships (public, cached) */
  getSovereigntyRelations: cachedPublicProcedure.query(async ({ ctx }) => {
    const relations = await ctx.db.countrySovereignty.findMany({
      where: { isActive: true },
      include: {
        sovereign: { select: { id: true, name: true, flag: true, slug: true } },
        subject: { select: { id: true, name: true, flag: true, slug: true } },
      },
      orderBy: [{ sovereign: { name: "asc" } }, { subject: { name: "asc" } }],
    });
    return relations.map((r) => ({
      id: r.id,
      sovereignId: r.sovereignId,
      sovereignName: r.sovereign.name,
      sovereignFlag: normalizeFlagUrl(r.sovereign.flag),
      sovereignSlug: r.sovereign.slug,
      subjectId: r.subjectId,
      subjectName: r.subject.name,
      subjectFlag: normalizeFlagUrl(r.subject.flag),
      subjectSlug: r.subject.slug,
      relationshipType: r.relationshipType,
      autonomyLevel: r.autonomyLevel,
      description: r.description,
      establishedDate: r.establishedDate,
      isActive: r.isActive,
      createdAt: r.createdAt,
    }));
  }),

  /** Get sovereignty info for a specific country (subjects + sovereign) */
  getCountrySovereignty: cachedPublicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [sovereign, subjects] = await Promise.all([
        ctx.db.countrySovereignty.findFirst({
          where: { subjectId: input.countryId, isActive: true },
          include: {
            sovereign: { select: { id: true, name: true, flag: true, slug: true } },
          },
        }),
        ctx.db.countrySovereignty.findMany({
          where: { sovereignId: input.countryId, isActive: true },
          include: {
            subject: { select: { id: true, name: true, flag: true, slug: true } },
          },
          orderBy: { subject: { name: "asc" } },
        }),
      ]);

      return {
        sovereign: sovereign
          ? {
              id: sovereign.id,
              countryId: sovereign.sovereignId,
              name: sovereign.sovereign.name,
              flag: normalizeFlagUrl(sovereign.sovereign.flag),
              slug: sovereign.sovereign.slug,
              relationshipType: sovereign.relationshipType,
              autonomyLevel: sovereign.autonomyLevel,
              description: sovereign.description,
              establishedDate: sovereign.establishedDate,
            }
          : null,
        subjects: subjects.map((s) => ({
          id: s.id,
          countryId: s.subjectId,
          name: s.subject.name,
          flag: normalizeFlagUrl(s.subject.flag),
          slug: s.subject.slug,
          relationshipType: s.relationshipType,
          autonomyLevel: s.autonomyLevel,
        })),
      };
    }),

  /** Create a sovereignty relationship (admin only) */
  createSovereignty: adminProcedure
    .input(
      z.object({
        sovereignId: z.string(),
        subjectId: z.string(),
        relationshipType: z.string(),
        autonomyLevel: z.number().min(0).max(1).optional().default(0.5),
        description: z.string().optional(),
        establishedDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.sovereignId === input.subjectId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A country cannot be its own sovereign.",
        });
      }

      // Validate relationship type
      const validTypes = SOVEREIGNTY_TYPES.map((t) => t.value);
      if (!validTypes.includes(input.relationshipType as any)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid relationship type. Must be one of: ${validTypes.join(", ")}`,
        });
      }

      // Check for circular chains: walk from sovereign upward
      const allRels = await ctx.db.countrySovereignty.findMany({
        where: { isActive: true },
        select: { sovereignId: true, subjectId: true },
      });
      const parentMap = new Map(allRels.map((r) => [r.subjectId, r.sovereignId]));

      // If we add this relation, the subject's sovereign chain must not reach back to subject
      let current = input.sovereignId;
      const visited = new Set<string>();
      while (current) {
        if (current === input.subjectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This would create a circular sovereignty chain.",
          });
        }
        if (visited.has(current)) break;
        visited.add(current);
        current = parentMap.get(current) ?? "";
      }

      const relation = await ctx.db.countrySovereignty.create({
        data: {
          sovereignId: input.sovereignId,
          subjectId: input.subjectId,
          relationshipType: input.relationshipType,
          autonomyLevel: input.autonomyLevel,
          description: input.description,
          establishedDate: input.establishedDate,
        },
      });

      // Invalidate political layer cache so map reflects the change
      clearLayerCache("political");
      // Invalidate server-side tRPC cache so queries return fresh data
      await invalidateCache([
        "geoSovereignty.getSovereigntyRelations",
        "geoSovereignty.getCountrySovereignty",
        "geoCore.getWorldMap",
      ]);
      broadcastMapUpdate("sovereignty");

      return relation;
    }),

  /** Update a sovereignty relationship (admin only) */
  updateSovereignty: adminProcedure
    .input(
      z.object({
        id: z.string(),
        relationshipType: z.string().optional(),
        autonomyLevel: z.number().min(0).max(1).optional(),
        description: z.string().optional(),
        establishedDate: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      if (data.relationshipType) {
        const validTypes = SOVEREIGNTY_TYPES.map((t) => t.value);
        if (!validTypes.includes(data.relationshipType as any)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid relationship type.`,
          });
        }
      }

      const updated = await ctx.db.countrySovereignty.update({
        where: { id },
        data,
      });

      clearLayerCache("political");
      await invalidateCache([
        "geoSovereignty.getSovereigntyRelations",
        "geoSovereignty.getCountrySovereignty",
        "geoCore.getWorldMap",
      ]);
      broadcastMapUpdate("sovereignty");
      return updated;
    }),

  /** Delete a sovereignty relationship (admin only) */
  deleteSovereignty: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.countrySovereignty.delete({ where: { id: input.id } });
      clearLayerCache("political");
      await invalidateCache([
        "geoSovereignty.getSovereigntyRelations",
        "geoSovereignty.getCountrySovereignty",
        "geoCore.getWorldMap",
      ]);
      broadcastMapUpdate("sovereignty");
      return { success: true };
    }),

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
