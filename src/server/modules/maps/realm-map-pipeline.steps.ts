/**
 * The map pipeline's lighter steps: `labels` (the realm's ocean, sea, region and continent labels, matched by key),
 * `flags` (the nations' wiki flags and arms as local files), `defaultView` (where the map opens) and `areas`
 * (every feature measured again on the realm's planet). Each one is idempotent: a second apply finds nothing to do.
 * The heavier steps have files of their own (realm-map-pipeline.repair/physical/rasters.ts).
 */
import type { Prisma } from "@prisma/client";
import { GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS, invalidateCache } from "~/lib/cache";
import { isPostGISAvailable } from "~/lib/maps/geo-validation";
import { EARTH_RADIUS_KM } from "~/lib/maps/planet";
import { CROSSES_ANTIMERIDIAN_SQL } from "~/lib/maps/realm-geometry-repair";
import { realmLabelSeedFileSchema, type RealmLabelSeedEntry } from "~/lib/maps/realm-labels";
import { AUTO_VIEW_ZOOM, firstIssue } from "~/lib/maps/realm-map-pipeline";
import {
  parseRealmMapSettings,
  realmRadiusKm,
  withRealmMapSettings,
  type RealmMapDefaultView,
} from "~/lib/maps/realm-map-settings";
import { localizeRealmFlags } from "~/server/modules/realms/realms.flags";
import { recomputeRealmMapAreas } from "~/server/modules/realms/realms.map";
import { artText } from "./realm-map-pipeline.art";
import {
  capDetails,
  changedStatus,
  currentSettings,
  skipped,
  type StepContext,
  type StepReport,
} from "./realm-map-pipeline.context";
import { seedRealmLabels } from "./realm-labels";

async function labelEntries(ctx: StepContext): Promise<RealmLabelSeedEntry[] | null> {
  const labels = ctx.pipeline.labels;
  if (!labels) return null;
  if (!("art" in labels)) return labels.labels;
  const parsed = realmLabelSeedFileSchema.safeParse(JSON.parse(await artText(ctx.art, labels.art)));
  if (!parsed.success)
    throw new Error(`The label file "${labels.art}": ${firstIssue(parsed.error)}`);
  return parsed.data.labels;
}

export async function runLabelsStep(ctx: StepContext): Promise<StepReport> {
  const entries = await labelEntries(ctx);
  if (!entries) return skipped("No labels in the pipeline (they are edited in the map editor)");
  const report = await seedRealmLabels(ctx.db, ctx.realm.id, entries, {
    apply: !ctx.dryRun,
    submittedBy: ctx.requestedBy,
  });
  const changes = report.created.length + report.updated.length;
  if (!ctx.dryRun && changes > 0)
    await invalidateCache(GEO_FEATURE_INVALIDATE_KEYS_WITH_MAP_LABELS);
  return {
    status: changes > 0 ? changedStatus(ctx) : "unchanged",
    summary: `${entries.length} labels: ${report.created.length} new, ${report.updated.length} changed, ${report.unchanged} unchanged`,
    details: capDetails([
      ...report.created.map((key) => `new ${key}`),
      ...report.updated.map((key) => `changed ${key}`),
    ]),
    counts: {
      created: report.created.length,
      updated: report.updated.length,
      unchanged: report.unchanged,
    },
  };
}

export async function runFlagsStep(ctx: StepContext): Promise<StepReport> {
  if (!ctx.pipeline.flags?.localize) return skipped("Flags are not localized for this realm");
  ctx.progress(0.1, "Resolving the wiki files");
  const report = await localizeRealmFlags(ctx.db, ctx.realm, {
    apply: !ctx.dryRun,
    progress: (done, total) =>
      ctx.progress(0.2 + (done / total) * 0.8, `${done} of ${total} images`),
  });
  const changes = report.localized + report.cleared;
  const verb = ctx.dryRun ? "would localize" : "localized";
  return {
    status: changes > 0 ? changedStatus(ctx) : "unchanged",
    summary: `${report.nations} nations, ${report.alreadyLocal} images local: ${verb} ${report.localized}, ${report.failures.length} not resolved`,
    details: capDetails([...report.lines, ...report.failures.map((f) => `failed ${f}`)]),
    counts: {
      tasks: report.tasks,
      localized: report.localized,
      cleared: report.cleared,
      failed: report.failures.length,
    },
  };
}

interface NationArea {
  continent: string | null;
  lng: number;
  lat: number;
  area: number;
}

/** Each linked border's centre (PostGIS's planar centroid, else the stored one), area and nation's continent. */
async function nationAreas(ctx: StepContext): Promise<NationArea[]> {
  const postgis = await isPostGISAvailable(ctx.db);
  const centre = postgis
    ? "ST_X(ST_Centroid(geom_postgis)) AS lng, ST_Y(ST_Centroid(geom_postgis)) AS lat"
    : `(centroid->>0)::float8 AS lng, (centroid->>1)::float8 AS lat`;
  const crossing = postgis ? `AND NOT ${CROSSES_ANTIMERIDIAN_SQL}` : "";
  return ctx.db.$queryRawUnsafe<NationArea[]>(
    `SELECT continent, ${centre}, area
       FROM (SELECT c.continent, m.geom_postgis, m.geometry, m.centroid, m."areaSqKm" AS area
               FROM map_layers m JOIN "Country" c ON c.id = m."countryId" AND c."realmId" = m."worldId"
              WHERE m."worldId" = $1 AND m."layerType" = 'political' AND m."isActive" = true
                AND m."areaSqKm" > 0) s
      WHERE ${postgis ? "geom_postgis IS NOT NULL" : "centroid IS NOT NULL"} ${crossing}`,
    ctx.realm.id
  );
}

/** The continent with the most nations (the larger total area on a tie); all nations when none has one. */
function largestGroup(nations: readonly NationArea[]): {
  name: string | null;
  members: NationArea[];
} {
  const groups = new Map<string, NationArea[]>();
  for (const n of nations)
    if (n.continent) groups.set(n.continent, [...(groups.get(n.continent) ?? []), n]);
  const total = (list: readonly NationArea[]) => list.reduce((sum, n) => sum + n.area, 0);
  let best: [string, NationArea[]] | null = null;
  for (const entry of groups) {
    const better =
      !best ||
      entry[1].length > best[1].length ||
      (entry[1].length === best[1].length && total(entry[1]) > total(best[1]));
    if (better) best = entry;
  }
  return best ? { name: best[0], members: best[1] } : { name: null, members: [...nations] };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * The area-weighted centre of the nations' border centres. Longitudes are taken around the largest nation's, so a
 * continent across ±180° is not averaged to the far side of the globe.
 */
export function autoDefaultView(nations: readonly NationArea[]): {
  view: RealmMapDefaultView;
  continent: string | null;
  nations: number;
} | null {
  const { name, members } = largestGroup(nations);
  if (members.length === 0) return null;
  const anchor = members.reduce((a, b) => (b.area > a.area ? b : a)).lng;
  const weight = members.reduce((sum, n) => sum + n.area, 0);
  const unwrap = (lng: number) => lng + 360 * Math.round((anchor - lng) / 360);
  const lng = members.reduce((sum, n) => sum + unwrap(n.lng) * n.area, 0) / weight;
  const lat = members.reduce((sum, n) => sum + n.lat * n.area, 0) / weight;
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return {
    view: {
      center: [round1(wrapped), round1(Math.max(-85, Math.min(85, lat)))],
      zoom: AUTO_VIEW_ZOOM,
    },
    continent: name,
    nations: members.length,
  };
}

const sameView = (a: RealmMapDefaultView | undefined, b: RealmMapDefaultView) =>
  !!a && a.zoom === b.zoom && a.center[0] === b.center[0] && a.center[1] === b.center[1];

export async function runDefaultViewStep(ctx: StepContext): Promise<StepReport> {
  if (ctx.pipeline.defaultView !== "auto") {
    return skipped("The default view is kept as saved in the map editor");
  }
  const auto = autoDefaultView(await nationAreas(ctx));
  if (!auto) return skipped("No nation has a border to centre the map on");
  const settings = await currentSettings(ctx);
  const stored = parseRealmMapSettings(settings).defaultView;
  const changed = !sameView(stored, auto.view);
  if (changed && !ctx.dryRun) {
    await ctx.db.realm.update({
      where: { id: ctx.realm.id },
      data: {
        settings: withRealmMapSettings(settings, {
          defaultView: auto.view,
        }) as Prisma.InputJsonValue,
      },
    });
  }
  const where = `[${auto.view.center.join(", ")}], zoom ${auto.view.zoom}`;
  return {
    status: changed ? changedStatus(ctx) : "unchanged",
    summary: `${auto.continent ?? "All nations"} (${auto.nations} nations): ${where}`,
    details: stored
      ? [`saved: [${stored.center.join(", ")}], zoom ${stored.zoom}`]
      : ["saved: none"],
  };
}

/** How many features a recompute would measure, and how many of them it would change. */
async function areaChanges(ctx: StepContext): Promise<{ total: number; changed: number } | null> {
  if (!(await isPostGISAvailable(ctx.db))) return null;
  const factor = (realmRadiusKm(await currentSettings(ctx)) / EARTH_RADIUS_KM) ** 2;
  const rows = await ctx.db.$queryRawUnsafe<
    Array<{ total: bigint | number; changed: bigint | number }>
  >(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE "areaSqKm" IS NULL OR abs("areaSqKm" - a) > 1e-9 * greatest(abs(a), 1)) AS changed
       FROM (SELECT "areaSqKm", ST_Area(geom_postgis::geography) / 1000000.0 * $2 AS a
               FROM map_layers
              WHERE "worldId" = $1 AND "isActive" = true AND geom_postgis IS NOT NULL
                AND ST_GeometryType(geom_postgis) IN ('ST_Polygon', 'ST_MultiPolygon')) s`,
    ctx.realm.id,
    factor
  );
  return { total: Number(rows[0]?.total ?? 0), changed: Number(rows[0]?.changed ?? 0) };
}

export async function runAreasStep(ctx: StepContext): Promise<StepReport> {
  const planned = await areaChanges(ctx);
  if (planned && planned.changed === 0) {
    return {
      status: "unchanged",
      summary: `${planned.total} features: every area is measured already`,
      details: [],
      counts: planned,
    };
  }
  if (ctx.dryRun) {
    return {
      status: "would-change",
      summary: planned
        ? `${planned.total} features: ${planned.changed} areas would change`
        : "Areas would be measured again (no PostGIS to compare first)",
      details: [],
      ...(planned && { counts: planned }),
    };
  }
  const areas = await recomputeRealmMapAreas(ctx.db, ctx.actor, ctx.realm.id);
  return {
    status: "changed",
    summary: `areas measured again: ${areas.updated} features (radius ${areas.radiusKm} km)`,
    details: [],
    counts: { updated: areas.updated },
  };
}
