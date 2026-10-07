/**
 * A realm's map settings (`Realm.settings.map`: planet radius, default view, base image, attribution), what its
 * map viewer needs, and the "Recompute areas" action. Edits go through `realmMapAccess` (site admins, the founder
 * and officers with the Map power, in their own realm; IxWorld stays with site admins).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Geometry } from "geojson";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  parseRealmMapSettings,
  realmRadiusKm,
  withRealmMapSettings,
  type RealmMapSettings,
} from "~/lib/maps/realm-map-settings";
import { EARTH_RADIUS_KM, polygonalAreaSqKm } from "~/lib/maps/planet";
import { isPostGISAvailable } from "~/lib/maps/geo-validation";
import type { RealmActor } from "./realms.access";
import { realmMapAccess } from "./realms.map-access";
import { RealmRegionError } from "./realms.region";
import { settingsAttribution } from "./realms.source-sync";

const SQ_KM_TO_SQ_MI = 0.386102;
/** Rows read per page when the database has no PostGIS and areas are measured here. */
const AREA_PAGE_SIZE = 500;

/** The realm's planet radius in km (`settings.map.radiusKm`), else Earth's. IxWorld without a row: Earth's. */
export async function realmRadiusKmById(
  db: Pick<PrismaClient, "realm">,
  realmId: string
): Promise<number> {
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  return realmRadiusKm(realm?.settings);
}

type DisplayDb = Pick<PrismaClient, "realm" | "realmSourceSync" | "country">;

/**
 * What the realm's map viewer shows beyond its layers: the planet radius (scale bar, measured areas), the
 * default view, the base image, the credit line (the realm's own, else its source sync's), the nations nobody
 * has claimed (drawn hatched), and whether the viewer may open the world editor on it.
 */
export async function getRealmMapDisplay(
  db: DisplayDb,
  viewer: RealmActor | null,
  realmId: string
) {
  const realm = await db.realm.findUnique({
    where: { id: realmId },
    select: { id: true, slug: true, name: true, settings: true },
  });
  const settings = parseRealmMapSettings(realm?.settings);
  const isIxWorld = realmId === DEFAULT_REALM_ID;

  let attribution = settings.attribution ?? null;
  if (!attribution) {
    const sync = await db.realmSourceSync.findUnique({
      where: { realmId },
      select: { settings: true },
    });
    attribution = sync
      ? settingsAttribution((sync.settings ?? {}) as Record<string, unknown>)
      : null;
  }

  // Unclaimed nations (no owner) are a realm idea: IxWorld's unowned countries keep their usual fill.
  const unclaimed = isIxWorld
    ? []
    : await db.country.findMany({
        where: { realmId, ownerUserId: null, isDemo: false },
        select: { id: true },
        take: 10_000,
      });
  const access = await realmMapAccess(db, viewer, realmId);

  return {
    realmId,
    realmSlug: realm?.slug ?? null,
    realmName: realm?.name ?? null,
    isIxWorld,
    radiusKm: settings.radiusKm ?? EARTH_RADIUS_KM,
    defaultView: settings.defaultView ?? null,
    baseImage: settings.baseImage ?? null,
    attribution,
    unclaimedCountryIds: unclaimed.map((c) => c.id),
    canEdit: access.canEdit,
    isFounder: access.canEdit && access.isFounder,
  };
}

export type RealmMapSettingsChanges = {
  [K in "radiusKm" | "baseImage" | "attribution" | "defaultView"]?: RealmMapSettings[K] | null;
};

async function requireMapEditor(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  realmId: string
) {
  const access = await realmMapAccess(db, actor, realmId);
  if (!access.canEdit)
    throw new RealmRegionError("FORBIDDEN", access.reason ?? "You can't edit this map");
  return access;
}

/** Change the realm's map settings (null removes a key); every other stored setting is kept. */
export async function updateRealmMapSettings(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  realmId: string,
  changes: RealmMapSettingsChanges
) {
  await requireMapEditor(db, actor, realmId);
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  if (!realm) {
    // IxWorld may have no realm row; staff set its settings once it has one.
    throw new RealmRegionError(
      "NOT_FOUND",
      "This realm has no settings row to store map settings in"
    );
  }
  const settings = withRealmMapSettings(realm.settings, changes);
  await db.realm.update({
    where: { id: realmId },
    data: { settings: settings as Prisma.InputJsonValue },
  });
  return parseRealmMapSettings(settings);
}

type RecomputeDb = Pick<PrismaClient, "realm" | "mapLayer" | "country" | "$queryRawUnsafe">;

/**
 * Measure every active polygon feature of the realm's map again on the realm's planet (PostGIS geography area ×
 * (r / 6371)², or the flat approximation at radius r without PostGIS) and store it as `MapLayer.areaSqKm`.
 * Nations' stated land area is left alone unless `alsoSetLandArea` is set, which needs founder powers: then each
 * linked nation's land area becomes the sum of its regions.
 */
export async function recomputeRealmMapAreas(
  db: RecomputeDb,
  actor: RealmActor,
  realmId: string,
  options: { alsoSetLandArea?: boolean } = {}
) {
  const access = await requireMapEditor(db, actor, realmId);
  if (options.alsoSetLandArea && !access.isFounder) {
    throw new RealmRegionError(
      "FORBIDDEN",
      "Only the realm's founder sets its nations' land area from the map"
    );
  }
  const radiusKm = await realmRadiusKmById(db, realmId);
  const factor = (radiusKm / EARTH_RADIUS_KM) ** 2;
  const postgis = await isPostGISAvailable(db as PrismaClient);

  let updated = 0;
  if (postgis) {
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE map_layers
          SET "areaSqKm" = ST_Area(geom_postgis::geography) / 1000000.0 * $2, "updatedAt" = NOW()
        WHERE "worldId" = $1 AND "isActive" = true AND geom_postgis IS NOT NULL
          AND ST_GeometryType(geom_postgis) IN ('ST_Polygon', 'ST_MultiPolygon')
        RETURNING id`,
      realmId,
      factor
    );
    updated = rows.length;
  } else {
    let cursor: string | undefined;
    for (;;) {
      const page = await db.mapLayer.findMany({
        where: { realmId, isActive: true },
        select: { id: true, geometry: true },
        orderBy: { id: "asc" },
        take: AREA_PAGE_SIZE,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });
      for (const row of page) {
        const geometry = row.geometry as unknown as Geometry | null;
        if (geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon") continue;
        await db.mapLayer.update({
          where: { id: row.id },
          data: { areaSqKm: polygonalAreaSqKm(geometry, radiusKm) },
        });
        updated++;
      }
      if (page.length < AREA_PAGE_SIZE) break;
      cursor = page[page.length - 1]!.id;
    }
  }

  let countriesUpdated = 0;
  if (options.alsoSetLandArea) {
    const totals = await db.mapLayer.groupBy({
      by: ["countryId"],
      where: { realmId, layerType: "political", isActive: true, countryId: { not: null } },
      _sum: { areaSqKm: true },
    });
    for (const total of totals) {
      const area = total._sum.areaSqKm;
      if (!total.countryId || area == null) continue;
      const { count } = await db.country.updateMany({
        where: { id: total.countryId, realmId },
        data: { landArea: area, areaSqMi: area * SQ_KM_TO_SQ_MI },
      });
      countriesUpdated += count;
    }
  }

  return { radiusKm, updated, countriesUpdated, postgis };
}
