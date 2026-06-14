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
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoAdminTemplatesRouter = createTRPCRouter({
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

  // ──────────────────────────────────────────────
  // Linkage validation & repair
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // SVG Upload & Processing Pipeline
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────
  // World Template / Clone System (Phase 3)
  // ──────────────────────────────────────────────────────────────

  /** Export current world as a template */
  exportWorldTemplate: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        isPublic: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Gather all active map layers grouped by type
      const allLayers = await ctx.db.mapLayer.findMany({
        where: { isActive: true },
        select: {
          layerType: true,
          featureId: true,
          geometry: true,
          properties: true,
          displayName: true,
          areaSqKm: true,
          centroid: true,
          boundingBox: true,
          countryId: true,
        },
      });

      // Group into FeatureCollections by layer type
      const layerMap: Record<string, { type: string; features: unknown[] }> = {};
      for (const layer of allLayers) {
        if (!layerMap[layer.layerType]) {
          layerMap[layer.layerType] = { type: "FeatureCollection", features: [] };
        }
        layerMap[layer.layerType]!.features.push({
          type: "Feature",
          id: layer.featureId,
          geometry: layer.geometry,
          properties: {
            ...(layer.properties as Record<string, unknown>),
            featureId: layer.featureId,
            displayName: layer.displayName,
            areaSqKm: layer.areaSqKm,
            countryId: layer.countryId,
          },
        });
      }

      // Gather country data
      const countries = await ctx.db.country.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          flag: true,
          region: true,
        },
      });

      // Gather sovereignty relationships
      const sovereignty = await ctx.db.countrySovereignty.findMany({
        select: {
          sovereignId: true,
          subjectId: true,
          relationshipType: true,
          autonomyLevel: true,
          description: true,
        },
      });

      // Build feature counts
      const featureCounts: Record<string, number> = {};
      for (const [layerType, fc] of Object.entries(layerMap)) {
        featureCounts[layerType] = fc.features.length;
      }

      const templateData = JSON.stringify({
        layers: layerMap,
        countries: countries.map((c) => ({
          name: c.name,
          slug: c.slug,
          flagCode: c.flag,
          region: c.region,
        })),
        sovereignty: sovereignty.map((s) => ({
          sovereign: s.sovereignId,
          subject: s.subjectId,
          type: s.relationshipType,
          autonomy: s.autonomyLevel,
          description: s.description,
        })),
      });

      const template = await ctx.db.worldTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          createdBy: ctx.auth!.userId ?? "system",
          metadata: {
            featureCounts,
            totalFeatures: allLayers.length,
            totalCountries: countries.length,
            layerTypes: Object.keys(layerMap),
            exportedAt: new Date().toISOString(),
          },
          layers: layerMap as any,
          countries: countries.map((c) => ({
            name: c.name,
            slug: c.slug,
            flagCode: c.flag,
            region: c.region,
          })),
          sovereignty: sovereignty.map((s) => ({
            sovereign: s.sovereignId,
            subject: s.subjectId,
            type: s.relationshipType,
            autonomy: s.autonomyLevel,
          })),
          fileSizeBytes: Buffer.byteLength(templateData, "utf-8"),
          isPublic: input.isPublic,
        },
      });

      return {
        templateId: template.id,
        name: template.name,
        featureCounts,
        totalFeatures: allLayers.length,
        fileSizeBytes: template.fileSizeBytes,
      };
    }),

  /** Download full template JSON for file export */
  downloadWorldTemplate: adminProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.worldTemplate.findUnique({
        where: { id: input.templateId },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        version: template.version,
        metadata: template.metadata,
        layers: template.layers,
        countries: template.countries,
        sovereignty: template.sovereignty,
        mapConfig: template.mapConfig,
      };
    }),

  /** Import a world template (replace or merge mode) */
  importWorldTemplate: adminProcedure
    .input(
      z.object({
        templateId: z.string().optional(),
        templateJson: z.string().optional(), // Direct JSON import
        mode: z.enum(["replace", "merge"]).default("replace"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let layers: Record<
        string,
        {
          features: Array<{ id?: string; geometry: unknown; properties?: Record<string, unknown> }>;
        }
      >;
      let templateName = "direct import";

      if (input.templateId) {
        const template = await ctx.db.worldTemplate.findUnique({
          where: { id: input.templateId },
        });
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });
        layers = template.layers as typeof layers;
        templateName = template.name;
      } else if (input.templateJson) {
        try {
          const parsed = JSON.parse(input.templateJson) as { layers: typeof layers };
          layers = parsed.layers;
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid template JSON",
          });
        }
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provide either templateId or templateJson",
        });
      }

      const log: string[] = [];
      let totalImported = 0;

      if (input.mode === "replace") {
        // Deactivate all existing features
        const deactivated = await ctx.db.mapLayer.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
        log.push(`Deactivated ${deactivated.count} existing features`);
      }

      // Import each layer
      for (const [layerType, fc] of Object.entries(layers)) {
        if (!fc.features || !Array.isArray(fc.features)) continue;

        if (input.mode === "merge") {
          // In merge mode, deactivate existing features of this layer type only
          await ctx.db.mapLayer.updateMany({
            where: { layerType, isActive: true },
            data: { isActive: false },
          });
        }

        const records = fc.features.map((f) => {
          const props = (f.properties || {}) as Record<string, unknown>;
          return {
            layerType,
            featureId:
              (props.featureId as string) ||
              (f.id as string) ||
              `imported-${Math.random().toString(36).slice(2, 10)}`,
            geometry: f.geometry as any,
            properties: props as any,
            displayName: (props.displayName as string) || null,
            areaSqKm: (props.areaSqKm as number) || null,
            centroid: (props.centroid as any) || null,
            boundingBox: (props.boundingBox as any) || null,
            countryId: (props.countryId as string) || null,
            isActive: true,
          };
        });

        // Batch insert
        const created = await ctx.db.mapLayer.createMany({
          data: records,
          skipDuplicates: true,
        });

        log.push(`${layerType}: imported ${created.count} features`);
        totalImported += created.count;
      }

      log.push(`Import complete from template: ${templateName}`);

      return { totalImported, log };
    }),

  /** List saved world templates (metadata only) */
  listWorldTemplates: adminProcedure
    .input(
      z
        .object({
          includePublic: z.boolean().optional().default(true),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where = input?.includePublic
        ? { OR: [{ createdBy: ctx.auth!.userId }, { isPublic: true }] }
        : { createdBy: ctx.auth!.userId };

      return ctx.db.worldTemplate.findMany({
        where: where as any,
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          createdBy: true,
          metadata: true,
          fileSizeBytes: true,
          isPublic: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /** Delete a world template */
  deleteWorldTemplate: adminProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.worldTemplate.findUnique({
        where: { id: input.templateId },
        select: { id: true, createdBy: true },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.worldTemplate.delete({ where: { id: input.templateId } });
      return { success: true };
    }),

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
