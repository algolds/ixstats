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
  countryOwnerProcedure,
  standardMutationCountryOwnerProcedure,
  cachedPublicProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { checkNameUniqueness } from "~/lib/geo-validation";
import { geometryAreaSqKm } from "~/lib/geo-math";

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const geoAdminProvincesRouter = createTRPCRouter({
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

  // ──────────────────────────────────────────────
  // Map Pipeline Endpoints
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Province Import Endpoints
  // ──────────────────────────────────────────────

  /**
   * Parse an uploaded province SVG and return parsed province features.
   * Also returns the country border geometry for alignment.
   */
  parseProvinceUpload: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        uploadId: z.string().optional(),
        svgContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only import provinces for your own country",
        });
      }

      // Get content from upload record or direct input
      let svgContent = input.svgContent;
      let isPng = false;
      let pngBase64: string | undefined;

      if (!svgContent && input.uploadId) {
        const upload = await ctx.db.svgUpload.findUnique({
          where: { id: input.uploadId },
        });
        if (!upload) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
        }
        const isAdmin = !ctx.country; // countryOwnerMiddleware sets ctx.country = null for admins
        if (!isAdmin && upload.uploadedBy !== (ctx.auth?.userId ?? ctx.user?.clerkUserId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this upload" });
        }

        // Detect PNG: check file extension from metadata or filename
        const meta = upload.svgMetadata as Record<string, unknown> | null;
        const fileType = (meta?.fileType as string) ?? "";
        const fileName = upload.fileName ?? "";
        isPng = fileType === "png" || fileName.toLowerCase().endsWith(".png");

        if (isPng) {
          pngBase64 = upload.svgContent ?? undefined;
        } else {
          svgContent = upload.svgContent ?? undefined;
        }
      }

      // Also detect PNG from direct svgContent (base64-encoded PNG starts without '<')
      if (svgContent && !svgContent.trimStart().startsWith("<")) {
        isPng = true;
        pngBase64 = svgContent;
        svgContent = undefined;
      }

      // Get country border geometry (needed for both SVG and PNG paths)
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { countryId: input.countryId, layerType: "political" },
        select: { geometry: true },
      });

      if (isPng && pngBase64) {
        // PNG path: extract provinces directly via boundary-line detection
        const pngBuffer = Buffer.from(pngBase64, "base64");
        const { extractProvincesFromPng } = await import("~/lib/png-to-svg");

        const result = await extractProvincesFromPng(pngBuffer);

        return {
          provinces: result.provinces,
          viewBox: { width: result.width, height: result.height },
          log: result.log,
          layersFound: ["png-boundary-detection"],
          countryBorder: mapLayer?.geometry ?? null,
        };
      }

      if (!svgContent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "SVG or PNG content required (provide uploadId or svgContent)",
        });
      }

      // Preprocess SVG (strip non-visual elements, remove fragments, normalize)
      const { preprocessSvg } = await import("~/lib/province-importer/svg-preprocessor");
      const preprocessed = preprocessSvg(svgContent);

      // Parse provinces from cleaned SVG
      const { parseProvinceSvg } = await import("~/lib/province-importer/parse-provinces");
      const result = parseProvinceSvg(preprocessed.svgContent);

      // Prepend preprocessing log
      result.log.unshift(...preprocessed.log);

      return {
        provinces: result.provinces,
        viewBox: result.viewBox,
        log: result.log,
        layersFound: result.layersFound,
        countryBorder: mapLayer?.geometry ?? null,
      };
    }),

  /**
   * Validate province geometries against the country border using PostGIS.
   */
  validateProvinceImport: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        provinces: z.array(
          z.object({
            name: z.string(),
            geometry: z.record(z.string(), z.unknown()),
          })
        ),
      })
    )
    .query(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only validate provinces for your own country",
        });
      }

      const validationResults: Array<{
        name: string;
        isValid: boolean;
        isContained: boolean;
        issues: string[];
      }> = [];

      for (const province of input.provinces) {
        const issues: string[] = [];
        let isValid = true;
        let isContained = true;

        try {
          const geoJson = JSON.stringify(province.geometry);

          // Check geometry validity
          const validResult = await ctx.db.$queryRawUnsafe<
            Array<{ is_valid: boolean; reason: string | null }>
          >(
            `SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as is_valid,
                    ST_IsValidReason(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) as reason`,
            geoJson
          );
          if (validResult[0] && !validResult[0].is_valid) {
            isValid = false;
            issues.push(`Invalid geometry: ${validResult[0].reason}`);
          }

          // Check containment within country
          const containResult = await ctx.db.$queryRawUnsafe<Array<{ is_inside: boolean }>>(
            `SELECT ST_Contains(
               (SELECT geom_postgis FROM map_layers WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL LIMIT 1),
               ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)
             ) as is_inside`,
            input.countryId,
            geoJson
          );
          if (containResult[0] && !containResult[0].is_inside) {
            isContained = false;
            issues.push("Province extends beyond country borders");
          }
        } catch (err) {
          issues.push(
            `PostGIS validation failed: ${err instanceof Error ? err.message : "unknown error"}`
          );
        }

        validationResults.push({
          name: province.name,
          isValid,
          isContained,
          issues,
        });
      }

      return { results: validationResults };
    }),

  /**
   * Commit imported provinces as Subdivision records.
   * Creates all subdivisions in a single transaction.
   */
  commitProvinceImport: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        provinces: z.array(
          z.object({
            name: z.string().min(1).max(100),
            type: z.string().default("province"),
            geometry: z.record(z.string(), z.unknown()),
            level: z.number().int().min(1).max(5).default(1),
            capital: z.string().optional(),
            population: z.number().int().min(0).optional(),
            color: z.string().optional(),
          })
        ),
        replaceExisting: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only import provinces for your own country",
        });
      }

      const userId = ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system";

      // Server-side validation: check coordinate bounds on all province geometries
      for (const province of input.provinces) {
        if ("coordinates" in province.geometry) {
          const { validateGeometryBounds } = await import("~/lib/geo-validation");
          validateGeometryBounds(province.geometry as unknown as import("geojson").Geometry);
        }
      }

      // Check for duplicate names within the import batch
      const nameSet = new Set<string>();
      for (const province of input.provinces) {
        const key = province.name.trim().toLowerCase();
        if (nameSet.has(key)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Duplicate province name in import: "${province.name}"`,
          });
        }
        nameSet.add(key);
      }

      // Check for name conflicts with existing subdivisions (unless replacing)
      if (!input.replaceExisting) {
        for (const province of input.provinces) {
          await checkNameUniqueness(ctx.db as any, input.countryId, province.name, "subdivision");
        }
      }

      return await ctx.db.$transaction(async (tx) => {
        // Optionally delete existing subdivisions
        if (input.replaceExisting) {
          await tx.subdivision.deleteMany({
            where: { countryId: input.countryId },
          });
        }

        // Batch create subdivisions
        const created: Array<{ id: string; name: string }> = [];
        for (const province of input.provinces) {
          const subdivision = await tx.subdivision.create({
            data: {
              name: province.name,
              countryId: input.countryId,
              type: province.type,
              level: province.level,
              geometry: province.geometry as any,
              capital: province.capital,
              population: province.population,
              color: province.color,
              status: "approved",
              submittedBy: userId,
            },
          });
          created.push({ id: subdivision.id, name: subdivision.name });
        }

        return {
          created: created.length,
          replaced: input.replaceExisting,
          subdivisions: created,
        };
      });
    }),

  /**
   * Get existing subdivisions and country border for province import preview.
   */
  getProvinceImportPreview: countryOwnerProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only preview your own country",
        });
      }

      const [subdivisions, mapLayer] = await Promise.all([
        ctx.db.subdivision.findMany({
          where: { countryId: input.countryId, status: "approved" },
          select: {
            id: true,
            name: true,
            type: true,
            level: true,
            geometry: true,
            capital: true,
            population: true,
          },
        }),
        ctx.db.mapLayer.findFirst({
          where: { countryId: input.countryId, layerType: "political" },
          select: { geometry: true, featureId: true },
        }),
      ]);

      return {
        existingSubdivisions: subdivisions,
        countryBorder: mapLayer?.geometry ?? null,
        featureId: mapLayer?.featureId ?? null,
      };
    }),

  /**
   * `sampleAreaSqKm` — compute the area of a GeoJSON Polygon or MultiPolygon in km².
   * Pure calculation, no DB writes. Returns 0 for unsupported geometry
   * types (Point, LineString, etc.) — callers should validate geometry
   * type before calling.
   */
  sampleAreaSqKm: cachedPublicProcedure
    .input(
      z.object({
        geometry: z.object({ type: z.string(), coordinates: z.any() }),
      })
    )
    .query(async ({ input }) => {
      return geometryAreaSqKm(input.geometry as Parameters<typeof geometryAreaSqKm>[0]);
    }),

  // ─── Phase 4: Visualization Overlay Endpoints ───────────────────────
});
