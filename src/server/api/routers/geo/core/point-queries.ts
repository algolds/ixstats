import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { rateLimitedPublicProcedure } from "~/server/api/trpc";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { getZoneByColor } from "~/lib/maps/elevation-config";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { CLIMATE_COLOR_MAP } from "./shared";

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

type PointLayer = { properties: Record<string, unknown> };

/** Elevation zone at the point; stored metadata wins, the fill colour fills in what is missing. */
function elevationInfo(altitude: PointLayer | undefined) {
  if (!altitude) return null;
  const props = altitude.properties ?? {};
  const fill = (props.fill as string) ?? null;
  const zone = fill ? getZoneByColor(fill) : null;
  return {
    zoneId: (props.zoneId as string) ?? zone?.zoneId ?? null,
    zoneName: (props.zoneName as string) ?? zone?.zoneName ?? null,
    elevationMin: (props.elevationMin as number) ?? zone?.elevationMin ?? null,
    elevationMax: (props.elevationMax as number) ?? zone?.elevationMax ?? null,
    elevationLabel:
      (props.elevationLabel as string) ??
      (zone ? `${zone.elevationMin}-${zone.elevationMax}m` : null),
    color: fill ?? zone?.color ?? null,
  };
}

function climateInfo(climate: PointLayer | undefined) {
  if (!climate) return null;
  const props = climate.properties ?? {};
  const fill = (props.fill as string) ?? null;
  const derivedName = fill ? CLIMATE_COLOR_MAP[fill.toLowerCase()] : null;
  return {
    climateId: (props.climateId as string) ?? null,
    climateName: (props.climateName as string) ?? derivedName ?? null,
    color: fill,
  };
}

/** The approved subdivision containing the point, or null (also when PostGIS data is not there yet). */
async function findSubdivisionAt(db: PrismaClient, countryId: string, lng: number, lat: number) {
  try {
    const rows = await withPointQueryTimeout(db, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string; name: string; type: string | null }>>(
        `SELECT id, name, type FROM subdivisions
               WHERE "countryId" = $1 AND status = 'approved'
                 AND geom_postgis IS NOT NULL
                 AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($2, $3), 4326))
               LIMIT 1`,
        countryId,
        lng,
        lat
      )
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export const pointQueryProcedures = {
  /**
   * Get comprehensive info at a map point: elevation, climate, country, subdivision.
   * Queries all relevant layers via PostGIS ST_Contains in a single call.
   */
  getPointInfo: rateLimitedPublicProcedure
    .input(
      z.object({
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
        ...realmScopeInput.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Query the viewed realm's altitude, climate, and political layers at this point
        const realmId = await viewerRealmId(ctx, input.realm);
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
             AND "worldId" = $3
             AND ST_Contains(geom_postgis, ST_SetSRID(ST_MakePoint($1, $2), 4326))`,
            input.lng,
            input.lat,
            realmId
          )
        );

        const political = layerResults.find((r) => r.layerType === "political");

        let subdivision = null;
        let countryInfo = null;
        if (political?.countryId) {
          countryInfo = await ctx.db.country.findUnique({
            where: { id: political.countryId },
            select: { id: true, name: true, slug: true, flag: true },
          });
          subdivision = await findSubdivisionAt(ctx.db, political.countryId, input.lng, input.lat);
        }

        return {
          coordinates: { lng: input.lng, lat: input.lat },
          elevation: elevationInfo(layerResults.find((r) => r.layerType === "altitudes")),
          climate: climateInfo(layerResults.find((r) => r.layerType === "climate")),
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
};
