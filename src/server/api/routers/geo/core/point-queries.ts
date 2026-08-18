import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { rateLimitedPublicProcedure, countryOwnerProcedure } from "~/server/api/trpc";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { getZoneByColor } from "~/lib/maps/elevation-config";
import { normalizeFlagUrl } from "~/lib/flags/unified-flag-service";
import { CLIMATE_COLOR_MAP } from "./shared";
import { getColorForFeature } from "./layer-loader";

/**
 * Hard ceiling (ms) for point-in-polygon lookups. A slow/unindexed ST_Contains
 * over world-scale layer geometry must never hold a pooled DB connection long
 * enough to (a) saturate the browser's connection pool during map editing or
 * (b) outlive a short-lived Clerk JWT on a queued mutation — which manifested as
 * "province geometry won't save" (countryGeo.upsertSubdivision rejected
 * UNAUTHORIZED because the token expired while the request waited in the queue).
 */
const POINT_QUERY_TIMEOUT_MS = 8000;

/**
 * Run a spatial point lookup under a per-statement timeout. On timeout PostgreSQL
 * cancels the statement and this rejects; every caller already catches and degrades
 * gracefully to "no info at this point" (returns null / empty). SET LOCAL is scoped
 * to the surrounding transaction, so it cannot leak to other pooled queries.
 */
async function withPointQueryTimeout<T>(
  db: any,
  run: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return db.$transaction(
    async (tx: any) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${POINT_QUERY_TIMEOUT_MS}`);
      return run(tx);
    },
    { timeout: POINT_QUERY_TIMEOUT_MS + 4000, maxWait: POINT_QUERY_TIMEOUT_MS + 4000 }
  );
}

export const pointQueryProcedures = {
  getCountryAtPoint: rateLimitedPublicProcedure
    .input(
      z.object({
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
      })
    )
    .query(async ({ ctx, input }) => {
      // Use PostGIS spatial query
      try {
        const results = await withPointQueryTimeout(ctx.db, (tx) =>
          tx.$queryRawUnsafe<
            Array<{
              id: string;
              featureId: string;
              displayName: string | null;
              countryId: string | null;
              properties: unknown;
            }>
          >(
            `SELECT id, "featureId", "displayName", "countryId", properties
           FROM map_layers
           WHERE "layerType" = 'political'
             AND "isActive" = true
             AND geom_postgis IS NOT NULL
             AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($1, $2), 4326))
           LIMIT 1`,
            input.lng,
            input.lat
          )
        );

        if (results.length > 0) {
          const r = results[0];
          return {
            featureId: r.featureId,
            displayName: r.displayName || featureIdToDisplayName(r.featureId),
            countryId: r.countryId,
            fillColor: getColorForFeature(r.featureId, r.properties as Record<string, unknown>),
          };
        }
      } catch {
        // PostGIS query failed, geometry may not be synced yet
      }

      return null;
    }),

  /**
   * Get comprehensive info at a map point: elevation, climate, country, subdivision.
   * Queries all relevant layers via PostGIS ST_Contains in a single call.
   */
  getPointInfo: rateLimitedPublicProcedure
    .input(
      z.object({
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Query altitude, climate, and political layers at this point
        const layerResults = await withPointQueryTimeout(ctx.db, (tx) =>
          tx.$queryRawUnsafe<
            Array<{
              layerType: string;
              featureId: string;
              displayName: string | null;
              properties: Record<string, unknown>;
              countryId: string | null;
            }>
          >(
            `SELECT "layerType", "featureId", "displayName", properties, "countryId"
           FROM map_layers
           WHERE "isActive" = true
             AND geom_postgis IS NOT NULL
             AND "layerType" IN ('altitudes', 'climate', 'political')
             AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($1, $2), 4326))`,
            input.lng,
            input.lat
          )
        );

        const altitude = layerResults.find((r) => r.layerType === "altitudes");
        const climate = layerResults.find((r) => r.layerType === "climate");
        const political = layerResults.find((r) => r.layerType === "political");

        // If we found a country, also check for subdivision
        let subdivision: { id: string; name: string; type: string | null } | null = null;
        let countryInfo: {
          id: string;
          name: string;
          slug: string | null;
          flag: string | null;
        } | null = null;

        if (political?.countryId) {
          // Get country info
          const country = await ctx.db.country.findUnique({
            where: { id: political.countryId },
            select: { id: true, name: true, slug: true, flag: true },
          });
          if (country) countryInfo = country;

          // Check for subdivision at this point
          try {
            const subResults = await withPointQueryTimeout(ctx.db, (tx) =>
              tx.$queryRawUnsafe<Array<{ id: string; name: string; type: string | null }>>(
                `SELECT id, name, type FROM subdivisions
               WHERE "countryId" = $1 AND status = 'approved'
                 AND geom_postgis IS NOT NULL
                 AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($2, $3), 4326))
               LIMIT 1`,
                political.countryId,
                input.lng,
                input.lat
              )
            );
            if (subResults.length > 0) subdivision = subResults[0]!;
          } catch {
            // Subdivision query failed — no PostGIS data yet
          }
        }

        const altProps = altitude?.properties ?? {};
        const climProps = climate?.properties ?? {};

        // Derive elevation zone from fill color if metadata not yet enriched
        const altFill = (altProps.fill as string) ?? null;
        const derivedZone = altFill ? getZoneByColor(altFill) : null;

        // Derive climate name from fill color if metadata not yet enriched
        const climFill = (climProps.fill as string) ?? null;
        const derivedClimate = climFill
          ? (CLIMATE_COLOR_MAP[climFill.toLowerCase()] ?? null)
          : null;

        return {
          coordinates: { lng: input.lng, lat: input.lat },
          elevation: altitude
            ? {
                zoneId: (altProps.zoneId as string) ?? derivedZone?.zoneId ?? null,
                zoneName: (altProps.zoneName as string) ?? derivedZone?.zoneName ?? null,
                elevationMin:
                  (altProps.elevationMin as number) ?? derivedZone?.elevationMin ?? null,
                elevationMax:
                  (altProps.elevationMax as number) ?? derivedZone?.elevationMax ?? null,
                elevationLabel:
                  (altProps.elevationLabel as string) ??
                  (derivedZone ? `${derivedZone.elevationMin}-${derivedZone.elevationMax}m` : null),
                color: altFill ?? derivedZone?.color ?? null,
              }
            : null,
          climate: climate
            ? {
                climateId: (climProps.climateId as string) ?? null,
                climateName: (climProps.climateName as string) ?? derivedClimate ?? null,
                color: climFill,
              }
            : null,
          country: political
            ? {
                featureId: political.featureId,
                displayName: political.displayName || featureIdToDisplayName(political.featureId),
                countryId: political.countryId,
                ...(countryInfo
                  ? {
                      name: countryInfo.name,
                      slug: countryInfo.slug,
                      flag: normalizeFlagUrl(countryInfo.flag),
                    }
                  : {}),
              }
            : null,
          subdivision,
        };
      } catch {
        // PostGIS not available or geometry not synced
        return {
          coordinates: { lng: input.lng, lat: input.lat },
          elevation: null,
          climate: null,
          country: null,
          subdivision: null,
        };
      }
    }),

  /**
   * List all political features with basic metadata (no geometry).
   */
  validatePointInCountry: countryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        lng: z.number(),
        lat: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const result = await withPointQueryTimeout(ctx.db, (tx) =>
          tx.$queryRawUnsafe<Array<{ is_inside: boolean }>>(
            `SELECT ST_Contains(
             (SELECT geom_postgis FROM map_layers WHERE "layerType" = 'political' AND "countryId" = $1 AND geom_postgis IS NOT NULL LIMIT 1),
             ST_SetSRID(ST_MakePoint($2, $3), 4326)
           ) as is_inside`,
            input.countryId,
            input.lng,
            input.lat
          )
        );
        return { isInside: result[0]?.is_inside ?? false };
      } catch {
        return { isInside: false };
      }
    }),

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

  /** Get all approved cities, POIs, and subdivisions as GeoJSON for the world map overlays. */
};
