import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import {
  createTRPCRouter,
  countryOwnerProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { buildProvinceMergePlan } from "~/lib/maps/province-importer/merge-plan";
import { invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { clearLayerCache } from "~/server/shared/layer-cache";

/** Country owners may only import into their own country; admins (no `ctx.country`) may import anywhere. */
function assertOwnCountry(country: { id: string } | null | undefined, countryId: string) {
  if (country && country.id !== countryId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only import provinces for your own country",
    });
  }
}

/** SVG markup or base64 PNG for the import, from the upload record or the direct input. */
async function resolveImportContent(
  ctx: {
    db: PrismaClient;
    country?: object | null;
    auth?: { userId?: string | null } | null;
    user?: { clerkUserId?: string | null } | null;
  },
  input: { uploadId?: string; svgContent?: string }
) {
  let svgContent = input.svgContent;
  let pngBase64: string | undefined;

  if (!svgContent && input.uploadId) {
    const upload = await ctx.db.svgUpload.findUnique({ where: { id: input.uploadId } });
    if (!upload) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
    }
    const isAdmin = !ctx.country; // countryOwnerMiddleware sets ctx.country = null for admins
    if (!isAdmin && upload.uploadedBy !== (ctx.auth?.userId ?? ctx.user?.clerkUserId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this upload" });
    }

    // Detect PNG: check file extension from metadata or filename
    const meta = upload.svgMetadata as Record<string, unknown> | null;
    const isPng =
      (meta?.fileType as string) === "png" ||
      (upload.fileName ?? "").toLowerCase().endsWith(".png");
    if (isPng) pngBase64 = upload.svgContent ?? undefined;
    else svgContent = upload.svgContent ?? undefined;
  }

  // Direct content that doesn't start with '<' is a base64-encoded PNG
  if (svgContent && !svgContent.trimStart().startsWith("<")) {
    pngBase64 = svgContent;
    svgContent = undefined;
  }
  return { svgContent, pngBase64 };
}

async function parseCities(svgContent: string) {
  try {
    const { parseCitySvg } = await import("~/lib/city-importer/svg-points");
    const parsed = parseCitySvg(svgContent);
    return {
      layers: parsed.layers,
      points: parsed.points,
      detectedCitiesLayerId: parsed.detectedCitiesLayerId,
      detectedCityNameLayerId: parsed.detectedCityNameLayerId,
    };
  } catch (err) {
    console.warn("[parseProvinceUpload] Failed to parse cities from SVG:", err);
    return null;
  }
}

export const geoAdminProvincesRouter = createTRPCRouter({
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
      assertOwnCountry(ctx.country as { id: string } | null, input.countryId);
      const { svgContent, pngBase64 } = await resolveImportContent(ctx, input);

      // Get country border geometry (needed for both SVG and PNG paths)
      const mapLayer = await ctx.db.mapLayer.findFirst({
        where: { countryId: input.countryId, layerType: "political" },
        select: { geometry: true },
      });

      if (pngBase64) {
        // PNG path: extract provinces directly via boundary-line detection
        const pngBuffer = Buffer.from(pngBase64, "base64");
        const { extractProvincesFromPng } = await import("~/lib/flags/png-to-svg");

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
      const { preprocessSvg } = await import("~/lib/maps/province-importer/svg-preprocessor");
      const preprocessed = preprocessSvg(svgContent);

      // Parse provinces from cleaned SVG
      const { parseProvinceSvg } = await import("~/lib/maps/province-importer/parse-provinces");
      const result = parseProvinceSvg(preprocessed.svgContent);

      // Prepend preprocessing log
      result.log.unshift(...preprocessed.log);

      return {
        provinces: result.provinces,
        viewBox: result.viewBox,
        log: result.log,
        layersFound: result.layersFound,
        countryBorder: mapLayer?.geometry ?? null,
        cityData: await parseCities(preprocessed.svgContent),
      };
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
        cities: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              coordinates: z.array(z.number()).length(2),
              isCapital: z.boolean().default(false),
            })
          )
          .optional(),
        replaceExisting: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx.country as { id: string } | null, input.countryId);

      const userId = ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system";

      // Server-side validation: check coordinate bounds on all province geometries
      for (const province of input.provinces) {
        if ("coordinates" in province.geometry) {
          const { validateGeometryBounds } = await import("~/lib/maps/geo-validation");
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

      // Load existing subdivisions to merge against (empty set when replacing)
      const existing = input.replaceExisting
        ? []
        : await ctx.db.subdivision.findMany({
            where: { countryId: input.countryId },
            select: { id: true, name: true },
          });

      const plan = buildProvinceMergePlan(input.provinces, existing, input.replaceExisting);

      const result = await ctx.db.$transaction(async (tx) => {
        // Optionally delete existing subdivisions
        if (input.replaceExisting) {
          await tx.subdivision.deleteMany({
            where: { countryId: input.countryId },
          });
        }

        const { repairGeometryGeoJSON } = await import("~/lib/maps/geo-validation");

        const created: Array<{ id: string; name: string }> = [];
        let createdCount = 0;
        let updatedCount = 0;

        for (const { province, existingId } of plan) {
          const repairedGeom = await repairGeometryGeoJSON(tx as any, province.geometry);

          if (existingId) {
            const subdivision = await tx.subdivision.update({
              where: { id: existingId },
              data: {
                type: province.type,
                level: province.level,
                geometry: repairedGeom as any,
                capital: province.capital,
                population: province.population,
                color: province.color,
                status: "approved",
              },
            });
            updatedCount++;
            created.push({ id: subdivision.id, name: subdivision.name });

            if (
              repairedGeom &&
              (repairedGeom as any).coordinates &&
              (repairedGeom as any).coordinates.length > 0
            ) {
              try {
                await tx.$executeRawUnsafe(
                  `UPDATE subdivisions SET geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) WHERE id = $2`,
                  JSON.stringify(repairedGeom),
                  subdivision.id
                );
              } catch (err) {
                console.warn(
                  `[commitProvinceImport] Failed to manually sync PostGIS geometry for updated subdivision ${subdivision.name}:`,
                  err
                );
              }
            }
          } else {
            const subdivision = await tx.subdivision.create({
              data: {
                name: province.name,
                countryId: input.countryId,
                type: province.type,
                level: province.level,
                geometry: repairedGeom as any,
                capital: province.capital,
                population: province.population,
                color: province.color,
                status: "approved",
                submittedBy: userId,
              },
            });
            createdCount++;
            created.push({ id: subdivision.id, name: subdivision.name });

            if (
              repairedGeom &&
              (repairedGeom as any).coordinates &&
              (repairedGeom as any).coordinates.length > 0
            ) {
              try {
                await tx.$executeRawUnsafe(
                  `UPDATE subdivisions SET geom_postgis = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) WHERE id = $2`,
                  JSON.stringify(repairedGeom),
                  subdivision.id
                );
              } catch (err) {
                console.warn(
                  `[commitProvinceImport] Failed to manually sync PostGIS geometry for created subdivision ${subdivision.name}:`,
                  err
                );
              }
            }
          }
        }

        // Batch create/upsert cities
        let citiesCreated = 0;
        if (input.cities && input.cities.length > 0) {
          const { upsertCity } = await import("~/lib/country-geo");
          for (const city of input.cities) {
            try {
              await upsertCity(tx, input.countryId, {
                name: city.name,
                type: "city",
                coordinates: city.coordinates,
                isNationalCapital: city.isCapital,
              });
              citiesCreated++;
            } catch (err) {
              console.error(
                `[commitProvinceImport] Failed to upsert city "${city.name}":`,
                err instanceof Error ? err.message : err
              );
            }
          }
        }

        return {
          created: createdCount,
          updated: updatedCount,
          replaced: input.replaceExisting,
          subdivisions: created,
          citiesCreated,
        };
      });

      clearLayerCache("political");
      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
      ]);
      broadcastMapUpdate("bulk", input.countryId);

      return result;
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
});
