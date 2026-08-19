/**
 * Map Pipeline Orchestrator
 *
 * Unified entry point for converting raw map data (SVG, PNG, or procedural)
 * into a working map layer set with enriched metadata.
 *
 * Pipeline: Input → Parse/Convert → Enrich → Validate → Output
 */

import type { FeatureCollection } from "geojson";
import type { SvgCoordinateConfig } from "~/lib/flags/svg-coordinate-config";
import type { WorldGenParams } from "~/lib/worldgen/types";
import type { PngToSvgConfig } from "~/lib/flags/png-to-svg";
import { getZoneByColor } from "./elevation-config";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type PipelineSource = "svg" | "png" | "procedural";

export interface PipelineInput {
  source: PipelineSource;
  /** For SVG input */
  svgContent?: string;
  /** For PNG input */
  pngBuffer?: Buffer;
  pngConfig?: PngToSvgConfig;
  /** For procedural generation */
  worldGenParams?: WorldGenParams;
  /** Coordinate calibration (required for SVG/PNG) */
  coordinateConfig?: SvgCoordinateConfig;
  /** Reference GeoJSON for auto-calibration */
  referenceGeoJson?: FeatureCollection;
  /** Which layers to extract */
  targetLayers?: string[];
}

export type PipelineStage =
  "upload" | "conversion" | "parsing" | "enrichment" | "validation" | "complete" | "error";

export interface PipelineProgress {
  stage: PipelineStage;
  progress: number; // 0-100
  message: string;
}

export interface PipelineResult {
  layers: Record<string, FeatureCollection>;
  metadata: {
    source: PipelineSource;
    featureCounts: Record<string, number>;
    coordinateSystem: SvgCoordinateConfig | null;
    log: string[];
    warnings: string[];
  };
}

// ──────────────────────────────────────────────
// Pipeline Execution
// ──────────────────────────────────────────────

/**
 * Run the complete map conversion pipeline.
 *
 * @param input - Pipeline input configuration
 * @param onProgress - Optional progress callback
 */
export async function runMapPipeline(
  input: PipelineInput,
  onProgress?: (progress: PipelineProgress) => void
): Promise<PipelineResult> {
  const log: string[] = [];
  const warnings: string[] = [];
  const layers: Record<string, FeatureCollection> = {};
  let coordConfig: SvgCoordinateConfig | null = input.coordinateConfig ?? null;

  const report = (stage: PipelineStage, progress: number, message: string) => {
    log.push(`[${stage}] ${message}`);
    onProgress?.({ stage, progress, message });
  };

  try {
    // ────── Stage 1: Convert to intermediate format ──────
    if (input.source === "png") {
      report("conversion", 10, "Converting PNG to SVG...");

      if (!input.pngBuffer) throw new Error("PNG buffer required for PNG source");

      const { convertPngToSvg } = await import("~/lib/flags/png-to-svg");
      const pngResult = await convertPngToSvg(input.pngBuffer, input.pngConfig);
      log.push(...pngResult.log);

      // Feed the generated SVG into the parsing stage
      input.svgContent = pngResult.svg;
      input.source = "svg"; // Now treat as SVG for parsing
      report("conversion", 25, `PNG converted: ${pngResult.detectedColors.length} colors detected`);
    }

    if (input.source === "svg") {
      report("parsing", 30, "Parsing SVG to GeoJSON...");

      if (!input.svgContent) throw new Error("SVG content required for SVG source");

      const { parseSvgToGeoJson } = await import("~/lib/flags/svg-parser");
      const parseResult = parseSvgToGeoJson(input.svgContent, "political", {
        coordinateConfig: coordConfig ?? undefined,
        referenceGeoJson: input.referenceGeoJson,
      });

      if (parseResult.features.length === 0) {
        warnings.push("No features extracted from SVG");
      }

      layers.political = parseResult.featureCollection;
      coordConfig = coordConfig ?? null;
      log.push(...parseResult.log);
      report("parsing", 50, `Parsed: ${parseResult.features.length} political features`);

      // Try to extract other layers if SVG has them
      if (!input.targetLayers || input.targetLayers.includes("altitudes")) {
        try {
          const altResult = parseSvgToGeoJson(input.svgContent, "altitudes", {
            coordinateConfig: coordConfig ?? undefined,
          });
          if (altResult.features.length > 0) {
            layers.altitudes = altResult.featureCollection;
            report("parsing", 55, `Parsed: ${altResult.features.length} altitude features`);
          }
        } catch {
          // No altitude layer in SVG — expected for political-only maps
        }
      }
    }

    if (input.source === "procedural") {
      report("parsing", 30, "Generating procedural world...");

      if (!input.worldGenParams) throw new Error("World gen params required for procedural source");

      const { generateWorld } = await import("~/lib/worldgen/engine");
      const world = generateWorld(input.worldGenParams);

      // Copy all generated layers
      for (const [layerType, collection] of Object.entries(world.layers)) {
        layers[layerType] = collection;
      }

      report(
        "parsing",
        50,
        `Generated: ${world.stats.countryCount} countries, ${world.stats.altitudeZoneCount} altitude zones`
      );
    }

    // ────── Stage 2: Enrich altitude features with elevation metadata ──────
    report("enrichment", 60, "Enriching altitude features with elevation data...");

    if (layers.altitudes) {
      let enriched = 0;
      for (const feature of layers.altitudes.features) {
        if (!feature.properties) feature.properties = {};
        const props = feature.properties;

        // Skip if already enriched
        if (props.elevationMin !== undefined) {
          enriched++;
          continue;
        }

        // Try to match by color
        const fillColor = props.fill as string | undefined;
        if (fillColor) {
          const zone = getZoneByColor(fillColor);
          if (zone) {
            props.zoneId = zone.zoneId;
            props.zoneName = zone.zoneName;
            props.elevationMin = zone.elevationMin;
            props.elevationMax = zone.elevationMax;
            props.elevationMidpoint = Math.round((zone.elevationMin + zone.elevationMax) / 2);
            props.elevationLabel = `${zone.elevationMin}-${zone.elevationMax}m`;
            enriched++;
          }
        }
      }
      report(
        "enrichment",
        70,
        `Enriched ${enriched}/${layers.altitudes.features.length} altitude features`
      );
    }

    // ────── Stage 3: Validate ──────
    report("validation", 80, "Validating layers...");

    for (const [layerType, collection] of Object.entries(layers)) {
      const invalidFeatures = collection.features.filter((f) => !f.geometry || !f.geometry.type);
      if (invalidFeatures.length > 0) {
        warnings.push(
          `${layerType}: ${invalidFeatures.length} features with invalid/missing geometry`
        );
      }
    }

    // Build feature counts
    const featureCounts: Record<string, number> = {};
    for (const [layerType, collection] of Object.entries(layers)) {
      featureCounts[layerType] = collection.features.length;
    }

    report("complete", 100, "Pipeline complete");

    return {
      layers,
      metadata: {
        source: input.source,
        featureCounts,
        coordinateSystem: coordConfig,
        log,
        warnings,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.push(`[error] Pipeline failed: ${msg}`);
    report("error", 0, `Pipeline failed: ${msg}`);
    throw error;
  }
}

/**
 * Validate a pipeline result before importing to database.
 */
export function validatePipelineResult(result: PipelineResult): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const totalFeatures = Object.values(result.metadata.featureCounts).reduce((sum, n) => sum + n, 0);
  if (totalFeatures === 0) {
    errors.push("No features were produced by the pipeline");
  }

  // Check for required political layer
  if (!result.layers.political || result.layers.political.features.length === 0) {
    errors.push("No political features — at least one country boundary is required");
  }

  // Check for features without IDs
  for (const [layerType, collection] of Object.entries(result.layers)) {
    const noId = collection.features.filter((f) => !f.id && !f.properties?.featureId);
    if (noId.length > 0) {
      errors.push(`${layerType}: ${noId.length} features missing featureId`);
    }
  }

  return { valid: errors.length === 0, errors };
}
