import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { MAX_PNG_BASE64_LENGTH, MAX_PNG_BYTES, PngDecodeError } from "~/lib/maps/png-realm-map";
import type { PipelineInput } from "~/lib/maps/map-pipeline";

const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours are #rrggbb hex");

const runPipelineInput = z.object({
  source: z.enum(["svg", "procedural", "png"]),
  svgContent: z.string().optional(),
  worldGenParams: z.record(z.string(), z.unknown()).optional(),
  targetLayers: z.array(z.string()).optional(),
  /** PNG/JPEG image, base64 without a data: prefix */
  pngBase64: z
    .string()
    .max(MAX_PNG_BASE64_LENGTH, `PNG maps are limited to ${MAX_PNG_BYTES / 1024 / 1024} MB`)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, "pngBase64 must be plain base64")
    .optional(),
  pngConfig: z
    .object({
      /** hex → feature id (the nation's name); omitted ⇒ the pipeline auto-detects colours */
      colorMapping: z.record(hexColour, z.string().trim().min(1).max(200)).optional(),
      backgroundColor: hexColour.optional(),
      minRegionSize: z.number().int().min(0).optional(),
      smoothing: z.number().min(0).max(10).optional(),
    })
    .optional(),
});

/** PNG input: decode the image and auto-detect colours until the admin has mapped them to nations. */
function pngPipelineInput(input: z.infer<typeof runPipelineInput>): PipelineInput {
  if (!input.pngBase64) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "pngBase64 is required for PNG input" });
  }
  const pngConfig = input.pngConfig ?? {};
  return {
    source: "png",
    pngBuffer: Buffer.from(input.pngBase64, "base64"),
    pngConfig: { ...pngConfig, autoDetectColors: !pngConfig.colorMapping },
  };
}

/** An image the decoder refuses (corrupt, not an image, over the pixel limit) is the admin's input: BAD_REQUEST. */
function decodeFailureAsBadRequest(error: Error): never {
  if (error instanceof PngDecodeError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

export const geoEditorProceduralRouter = createTRPCRouter({
  /**
   * Run the map conversion pipeline (SVG, procedural or flat-colour PNG input — decisions 10–11).
   * A PNG run without pngConfig.colorMapping returns the detected colours for the colour → nation step.
   */
  runPipeline: adminProcedure.input(runPipelineInput).mutation(async ({ input }) => {
    const { runMapPipeline, validatePipelineResult } = await import("~/lib/maps/map-pipeline");

    const result = await runMapPipeline(
      input.source === "png"
        ? pngPipelineInput(input)
        : {
            source: input.source,
            svgContent: input.svgContent,
            worldGenParams: input.worldGenParams as
              import("~/lib/worldgen/types").WorldGenParams | undefined,
            targetLayers: input.targetLayers,
          }
    ).catch(decodeFailureAsBadRequest);

    const validation = validatePipelineResult(result);

    return {
      ...result,
      validation,
    };
  }),

  /**
   * Import pipeline result into the database as MapLayer records, through the shared realm map writer
   * (~/server/modules/maps/map-import.pipeline.ts): validated geometry, batched writes, display names, a rollback
   * snapshot; replace mode retires only the imported layer types' stale features.
   */
  importPipelineResult: adminProcedure
    .input(
      z.object({
        layers: z.record(z.string(), z.unknown()),
        mode: z.enum(["replace", "merge"]).default("merge"),
        realmId: z.string().default(DEFAULT_REALM_ID),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // An unknown id would otherwise write layers no realm's map ever reads
      const realm = await ctx.db.realm.findUnique({
        where: { id: input.realmId },
        select: { id: true },
      });
      if (!realm) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown realm" });

      const { writePipelineLayers } = await import("~/server/modules/maps/map-import.pipeline");
      return writePipelineLayers(ctx.db, {
        realmId: input.realmId,
        layers: input.layers as Record<string, import("geojson").FeatureCollection>,
        mode: input.mode,
        createdBy: ctx.user.clerkUserId,
      });
    }),
});
