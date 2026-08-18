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
  // eslint-disable-next-line unused-imports/no-unused-imports
  publicProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  rateLimitedPublicProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  cachedPublicProcedure,
  adminProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  countryOwnerProcedure,
  // eslint-disable-next-line unused-imports/no-unused-imports
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/trpc-cache";
// eslint-disable-next-line unused-imports/no-unused-imports
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
// eslint-disable-next-line unused-imports/no-unused-imports
import { clearLayerCache } from "../core";
// eslint-disable-next-line unused-imports/no-unused-imports
import { ActivityGenerator } from "~/lib/activity-generator";
// eslint-disable-next-line unused-imports/no-unused-imports
import { normalizeFlagUrl } from "~/lib/flags/unified-flag-service";
// eslint-disable-next-line unused-imports/no-unused-imports
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
// eslint-disable-next-line unused-imports/no-unused-imports
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo-service";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoEditorProceduralRouter = createTRPCRouter({
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

  // ──────────────────────────────────────────────────────────────
  // Procedural World Generation (Phase 4)
  // ──────────────────────────────────────────────────────────────

  /** Generate a procedural world from seed and parameters */
  generateProceduralWorld: adminProcedure
    .input(
      z.object({
        seed: z.number().int(),
        continentCount: z.number().int().min(1).max(8).default(4),
        countryCountRange: z
          .tuple([z.number().int().min(1), z.number().int().max(200)])
          .default([20, 60]),
        oceanPercentage: z.number().min(0.2).max(0.95).default(0.65),
        terrainRoughness: z.number().min(0).max(1).default(0.5),
        hasIcecaps: z.boolean().default(true),
        hasRivers: z.boolean().default(true),
        hasLakes: z.boolean().default(true),
        gridResolution: z.number().int().min(128).max(512).default(512),
        similarity: z.number().min(0).max(1).default(0.5),
        profileName: z.string().default("IxWorld"),
        erosionIntensity: z.number().min(0).max(1).default(0.8),
        climateDetail: z.enum(["simple", "full"]).default("full"),
        useTectonicElevation: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Dynamic import to avoid loading heavy generation code on every request
      const { generateWorld } = await import("~/lib/worldgen/engine");

      const result = generateWorld(input);

      // Save to database
      const world = await ctx.db.proceduralWorld.create({
        data: {
          seed: input.seed,
          parameters: input as any,
          status: "completed",
          generatedData: result.layers as any,
          metadata: result.stats as any,
          createdBy: ctx.auth!.userId ?? "system",
        },
      });

      return {
        worldId: world.id,
        seed: result.seed,
        stats: result.stats,
      };
    }),

  /** Get preview data for a generated world */
  getProceduralWorldPreview: adminProcedure
    .input(z.object({ worldId: z.string() }))
    .query(async ({ ctx, input }) => {
      const world = await ctx.db.proceduralWorld.findUnique({
        where: { id: input.worldId },
      });
      if (!world) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        seed: world.seed,
        parameters: world.parameters,
        layers: world.generatedData,
        stats: world.metadata,
        status: world.status,
      };
    }),

  /** Commit a procedural world to the map layers table */
  commitProceduralWorld: adminProcedure
    .input(
      z.object({
        worldId: z.string(),
        saveAsTemplate: z.boolean().default(false),
        templateName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const world = await ctx.db.proceduralWorld.findUnique({
        where: { id: input.worldId },
      });
      if (!world) throw new TRPCError({ code: "NOT_FOUND" });

      const layers = world.generatedData as Record<
        string,
        {
          features?: Array<{
            id?: string;
            geometry: unknown;
            properties?: Record<string, unknown>;
          }>;
        }
      >;
      if (!layers) throw new TRPCError({ code: "BAD_REQUEST", message: "No generated data" });

      // Deactivate all existing features
      await ctx.db.mapLayer.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      let totalImported = 0;
      const log: string[] = [];

      for (const [layerType, fc] of Object.entries(layers)) {
        if (!fc.features || !Array.isArray(fc.features)) continue;

        const records = fc.features.map((f) => {
          const props = (f.properties || {}) as Record<string, unknown>;
          return {
            layerType,
            featureId:
              (props.featureId as string) ||
              (f.id as string) ||
              `proc-${Math.random().toString(36).slice(2, 10)}`,
            geometry: f.geometry as any,
            properties: props as any,
            displayName: (props.displayName as string) || null,
            areaSqKm: (props.areaKm2 as number) || null,
            isActive: true,
            worldId: `proc-${world.seed}`,
          };
        });

        const created = await ctx.db.mapLayer.createMany({
          data: records,
          skipDuplicates: true,
        });
        log.push(`${layerType}: ${created.count} features`);
        totalImported += created.count;
      }

      // Optionally save as template
      let templateId: string | null = null;
      if (input.saveAsTemplate) {
        const template = await ctx.db.worldTemplate.create({
          data: {
            name: input.templateName || `Procedural World (seed: ${world.seed})`,
            description: `Auto-generated world with seed ${world.seed}`,
            createdBy: ctx.auth!.userId ?? "system",
            metadata: world.metadata as any,
            layers: world.generatedData as any,
            isPublic: false,
          },
        });
        templateId = template.id;

        await ctx.db.proceduralWorld.update({
          where: { id: world.id },
          data: { templateId },
        });
      }

      return { totalImported, log, templateId };
    }),

  /** Regenerate a single layer of a procedural world */
  regenerateLayer: adminProcedure
    .input(
      z.object({
        worldId: z.string(),
        layerType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const world = await ctx.db.proceduralWorld.findUnique({
        where: { id: input.worldId },
      });
      if (!world) throw new TRPCError({ code: "NOT_FOUND" });

      const params = world.parameters as Record<string, unknown>;
      const { generateWorld } = await import("~/lib/worldgen/engine");

      // Regenerate with a shifted seed for the target layer
      const newSeed = (params.seed as number) + input.layerType.length * 1000;
      const newParams = { ...params, seed: newSeed } as Parameters<typeof generateWorld>[0];
      const result = generateWorld(newParams);

      // Replace only the target layer
      const existingLayers = (world.generatedData || {}) as Record<string, unknown>;
      const layerKey = input.layerType;
      if (layerKey in result.layers) {
        existingLayers[layerKey] = result.layers[layerKey as keyof typeof result.layers];
      }

      await ctx.db.proceduralWorld.update({
        where: { id: world.id },
        data: {
          generatedData: existingLayers as any,
          metadata: {
            ...(world.metadata as Record<string, unknown>),
            lastRegenerated: input.layerType,
          } as any,
        },
      });

      return {
        layerType: input.layerType,
        featureCount: result.layers[layerKey as keyof typeof result.layers]?.features.length ?? 0,
      };
    }),

  /** List procedural world generation history */
  listProceduralWorlds: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.proceduralWorld.findMany({
      where: { createdBy: ctx.auth!.userId ?? "system" },
      select: {
        id: true,
        seed: true,
        parameters: true,
        status: true,
        metadata: true,
        templateId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  // ──────────────────────────────────────────────
  // Map Pipeline Endpoints
  // ──────────────────────────────────────────────

  /**
   * Run the map conversion pipeline (SVG or procedural input).
   * PNG input should be pre-processed to SVG on the client or via uploadAndProcessImage.
   */
  runPipeline: adminProcedure
    .input(
      z.object({
        source: z.enum(["svg", "procedural"]),
        svgContent: z.string().optional(),
        worldGenParams: z.record(z.string(), z.unknown()).optional(),
        targetLayers: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { runMapPipeline, validatePipelineResult } = await import("~/lib/maps/map-pipeline/);

      const result = await runMapPipeline({
        source: input.source,
        svgContent: input.svgContent,
        worldGenParams: input.worldGenParams as
          import("~/lib/worldgen/types").WorldGenParams | undefined,
        targetLayers: input.targetLayers,
      });

      const validation = validatePipelineResult(result);

      return {
        ...result,
        validation,
      };
    }),

  /**
   * Import pipeline result into the database as MapLayer records.
   */
  importPipelineResult: adminProcedure
    .input(
      z.object({
        layers: z.record(z.string(), z.unknown()),
        mode: z.enum(["replace", "merge"]).default("merge"),
        worldId: z.string().default("default"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const layers = input.layers as Record<string, import("geojson").FeatureCollection>;
      let imported = 0;

      await ctx.db.$transaction(async (tx) => {
        if (input.mode === "replace") {
          // Deactivate existing layers for this world
          await tx.mapLayer.updateMany({
            where: { worldId: input.worldId, isActive: true },
            data: { isActive: false },
          });
        }

        for (const [layerType, collection] of Object.entries(layers)) {
          if (!collection?.features) continue;

          for (const feature of collection.features) {
            const featureId =
              (feature.properties?.featureId as string) ??
              (feature.id as string) ??
              `${layerType}_${imported}`;

            await tx.mapLayer.upsert({
              where: {
                layerType_featureId: { layerType, featureId },
              },
              update: {
                geometry: feature.geometry as any,
                properties: (feature.properties ?? {}) as any,
                isActive: true,
                worldId: input.worldId,
              },
              create: {
                layerType,
                featureId,
                geometry: feature.geometry as any,
                properties: (feature.properties ?? {}) as any,
                isActive: true,
                worldId: input.worldId,
              },
            });
            imported++;
          }
        }
      });

      // Build shared vertex index for political features
      if (layers.political) {
        try {
          const { buildSharedVertexIndex } = await import("~/lib/maps/shared-vertex-builder/);
          const politicalFeatures = layers.political.features
            .filter((f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon")
            .map((f) => ({
              featureId: (f.properties?.featureId as string) ?? (f.id as string) ?? "",
              geometry: f.geometry as import("geojson").Polygon | import("geojson").MultiPolygon,
            }));

          const sharedVertices = buildSharedVertexIndex(politicalFeatures);

          // Clear existing shared vertices for this world
          await ctx.db.sharedVertex.deleteMany({
            where: { worldId: input.worldId },
          });

          // Insert new shared vertices
          if (sharedVertices.length > 0) {
            await ctx.db.sharedVertex.createMany({
              data: sharedVertices.map((sv) => ({
                lng: sv.lng,
                lat: sv.lat,
                featureRefs: sv.featureRefs as any,
                worldId: input.worldId,
              })),
            });
          }
        } catch {
          // Shared vertex build failed — non-blocking
        }
      }

      // Invalidate layer cache
      invalidateCache(["geoCore.getWorldMap"]);

      return { imported, mode: input.mode };
    }),

  // ──────────────────────────────────────────────
  // Province Import Endpoints
  // ──────────────────────────────────────────────

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────
});
