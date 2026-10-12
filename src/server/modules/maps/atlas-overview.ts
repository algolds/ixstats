/**
 * Atlas realm overview: one row per realm for the Realms tab and the realm page, read in a fixed number of batched
 * queries (groupBy and raw SQL grouped by realm) however many realms there are. Relief folders are checked under a
 * time budget. Server only.
 */
import type { PrismaClient } from "@prisma/client";
import { WORLD_BUNDLE_LAYERS } from "~/lib/maps/import/world-bundle";
import { RELIEF_LAYER_ID } from "~/lib/maps/raster-tiles";
import { parseRealmMapSettings } from "~/lib/maps/realm-map-settings";
import { MapImportError } from "./map-import.realm";
import { rasterVersionDir, rasterVersionExists } from "./realm-rasters.storage";

type OverviewDb = Pick<PrismaClient, "realm" | "mapLayer" | "realmClaim" | "$queryRaw">;

/** `unknown`: the folder check ran out of time before this realm's folder was looked at */
export type ReliefState = "built" | "missing" | "failed" | "unknown";
export type RealmFlag =
  "missing-layers" | "relief" | "last-job-failed" | "unlinked" | "invalid-geometry";

export interface RealmOverviewRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  visibility: string;
  mapVersion: number;
  /** The seven layers a realm map has (background, altitudes, climate, political, rivers, lakes, icecaps) */
  layers: { present: number; total: number; missing: string[] };
  relief: ReliefState;
  /** Active political features linked to a country, of all active political features */
  linkage: { linked: number; total: number };
  /** `reserved`: generated slots nobody may claim (scenery) */
  nations: { total: number; owned: number; open: number; reserved: number };
  pendingClaims: number;
  lastJob: {
    id: string;
    kind: string;
    status: string;
    dryRun: boolean;
    /** finishedAt, else createdAt */
    at: Date;
  } | null;
  /** Countries whose stored outline (geometry) has no PostGIS copy (geom_postgis) */
  invalidGeometry: number;
  flags: RealmFlag[];
}

export interface RealmOverview {
  realms: RealmOverviewRow[];
  /** The relief folder checks ran out of time: the realms not checked have relief `unknown` */
  partial: boolean;
  /** Active feature count per layer type, per realm id (the realm page's breakdown) */
  layerCounts: Record<string, Record<string, number>>;
}

export interface OverviewDeps {
  /** Whether a relief version's folder exists (tests replace it). */
  folderExists?: (dir: string) => Promise<boolean>;
  /** How long the relief folder checks may take in all (default 1.5 s). */
  budgetMs?: number;
}

const FOLDER_BUDGET_MS = 1_500;

interface NationRow {
  realmId: string;
  total: number;
  owned: number;
  open: number;
  reserved: number;
  invalid: number;
}
interface LastJobRow {
  id: string;
  realmId: string;
  kind: string;
  status: string;
  dryRun: boolean;
  createdAt: Date;
  finishedAt: Date | null;
}
interface ReliefRow {
  realmId: string;
  status: string | null;
  rolledBack: boolean;
}

const countsOf = (rows: Array<{ realmId: string | null; _count: { _all: number } }>) =>
  new Map(rows.map((row) => [row.realmId ?? "", row._count._all]));

/** Nations, owned, open, reserved and countries with no PostGIS outline, per realm. */
const nationRows = (db: OverviewDb, ids: string[]) =>
  db.$queryRaw<NationRow[]>`
    SELECT "realmId",
      count(*)::int AS total,
      count("ownerUserId")::int AS owned,
      (count(*) FILTER (WHERE "ownerUserId" IS NULL AND claimable))::int AS open,
      (count(*) FILTER (WHERE "ownerUserId" IS NULL AND NOT claimable AND worldgen))::int AS reserved,
      (count(*) FILTER (WHERE geom_postgis IS NULL AND geometry IS NOT NULL))::int AS invalid
    FROM "Country" WHERE "realmId" = ANY(${ids}) GROUP BY "realmId"`;

/** Each realm's newest job, whatever its kind. */
const lastJobRows = (db: OverviewDb, ids: string[]) =>
  db.$queryRaw<LastJobRow[]>`
    SELECT DISTINCT ON ("realmId") id, "realmId", kind, status, "dryRun", "createdAt", "finishedAt"
    FROM map_import_jobs WHERE "realmId" = ANY(${ids})
    ORDER BY "realmId", "createdAt" DESC`;

/** Each realm's latest succeeded world apply: its relief step's outcome and whether the import was rolled back. */
const reliefRows = (db: OverviewDb, ids: string[]) =>
  db.$queryRaw<ReliefRow[]>`
    SELECT DISTINCT ON (j."realmId") j."realmId",
      j.result->'relief'->>'status' AS status,
      (i."rolledBackAt" IS NOT NULL) AS "rolledBack"
    FROM map_import_jobs j LEFT JOIN map_imports i ON i."jobId" = j.id
    WHERE j."realmId" = ANY(${ids}) AND j.kind = 'world' AND j."dryRun" = false AND j.status = 'succeeded'
    ORDER BY j."realmId", j."createdAt" DESC`;

/** The realms whose recorded relief folder exists; `checked` is false for the folders the budget cut off. */
async function reliefFolders(
  dirs: Map<string, string>,
  exists: (dir: string) => Promise<boolean>,
  budgetMs: number
) {
  const present = new Set<string>();
  const unchecked = new Set(dirs.keys());
  const work = Promise.all(
    [...dirs].map(async ([realmId, dir]) => {
      if (await exists(dir)) present.add(realmId);
      unchecked.delete(realmId);
    })
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, budgetMs);
    timer.unref?.();
  });
  await Promise.race([work, late]);
  clearTimeout(timer);
  return { present, unchecked };
}

function flagsOf(row: Omit<RealmOverviewRow, "flags">): RealmFlag[] {
  const flags: RealmFlag[] = [];
  if (row.layers.present < row.layers.total) flags.push("missing-layers");
  if (row.relief === "missing" || row.relief === "failed") flags.push("relief");
  if (row.lastJob?.status === "failed") flags.push("last-job-failed");
  if (row.linkage.linked < row.linkage.total) flags.push("unlinked");
  if (row.invalidGeometry > 0) flags.push("invalid-geometry");
  return flags;
}

/** A realm's id from an id or a slug (an id wins over a slug that spells the same), null when there is none. */
export async function atlasRealmId(
  db: Pick<PrismaClient, "realm">,
  realm: string
): Promise<string | null> {
  const select = { id: true } as const;
  const found =
    (await db.realm.findUnique({ where: { id: realm }, select })) ??
    (await db.realm.findFirst({ where: { slug: realm }, select }));
  return found?.id ?? null;
}

/**
 * Every realm's figures, or the one realm `match` names (id, else slug). The number of queries does not depend on the
 * number of realms.
 */
export async function realmOverview(
  db: OverviewDb,
  options: { match?: string } = {},
  deps: OverviewDeps = {}
): Promise<RealmOverview> {
  const { match } = options;
  const matchedId = match ? await atlasRealmId(db, match) : undefined;
  if (matchedId === null) throw new MapImportError("NOT_FOUND", "Realm not found");
  const realms = await db.realm.findMany({
    where: matchedId ? { id: matchedId } : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      visibility: true,
      mapVersion: true,
      settings: true,
    },
  });
  const ids = realms.map((realm) => realm.id);
  const active = { isActive: true, realmId: { in: ids } };

  const [layerGroups, linkedGroups, claimGroups, nationData, lastJobs, reliefData] =
    await Promise.all([
      db.mapLayer.groupBy({
        by: ["realmId", "layerType"],
        where: { ...active, layerType: { in: [...WORLD_BUNDLE_LAYERS] } },
        _count: { _all: true },
      }),
      db.mapLayer.groupBy({
        by: ["realmId"],
        where: { ...active, layerType: "political", countryId: { not: null } },
        _count: { _all: true },
      }),
      db.realmClaim.groupBy({
        by: ["realmId"],
        where: { realmId: { in: ids }, status: "pending" },
        _count: { _all: true },
      }),
      nationRows(db, ids),
      lastJobRows(db, ids),
      reliefRows(db, ids),
    ]);

  const layerCounts: RealmOverview["layerCounts"] = {};
  for (const group of layerGroups) {
    (layerCounts[group.realmId ?? ""] ??= {})[group.layerType] = group._count._all;
  }
  const linked = countsOf(linkedGroups);
  const claims = countsOf(claimGroups);
  const nations = new Map(nationData.map((row) => [row.realmId, row]));
  const lastJob = new Map(lastJobs.map((row) => [row.realmId, row]));
  const failedRelief = new Set(
    reliefData.filter((r) => r.status === "failed" && !r.rolledBack).map((r) => r.realmId)
  );

  const dirs = new Map<string, string>();
  for (const realm of realms) {
    const entry = parseRealmMapSettings(realm.settings).rasterLayers?.find(
      (layer) => layer.id === RELIEF_LAYER_ID
    );
    const dir = entry && rasterVersionDir(realm.id, entry.id, entry.version);
    if (dir) dirs.set(realm.id, dir);
  }
  const { present, unchecked } = await reliefFolders(
    dirs,
    deps.folderExists ?? rasterVersionExists,
    deps.budgetMs ?? FOLDER_BUDGET_MS
  );

  const rows = realms.map((realm): RealmOverviewRow => {
    const counts = layerCounts[realm.id] ?? {};
    const missing = WORLD_BUNDLE_LAYERS.filter((layer) => !counts[layer]);
    const nation = nations.get(realm.id);
    const job = lastJob.get(realm.id);
    const base = {
      id: realm.id,
      slug: realm.slug,
      name: realm.name,
      status: realm.status,
      visibility: realm.visibility,
      mapVersion: realm.mapVersion,
      layers: {
        present: WORLD_BUNDLE_LAYERS.length - missing.length,
        total: WORLD_BUNDLE_LAYERS.length,
        missing,
      },
      relief: failedRelief.has(realm.id)
        ? "failed"
        : present.has(realm.id)
          ? "built"
          : unchecked.has(realm.id)
            ? "unknown"
            : "missing",
      linkage: { linked: linked.get(realm.id) ?? 0, total: counts.political ?? 0 },
      nations: {
        total: nation?.total ?? 0,
        owned: nation?.owned ?? 0,
        open: nation?.open ?? 0,
        reserved: nation?.reserved ?? 0,
      },
      pendingClaims: claims.get(realm.id) ?? 0,
      lastJob: job
        ? {
            id: job.id,
            kind: job.kind,
            status: job.status,
            dryRun: job.dryRun,
            at: job.finishedAt ?? job.createdAt,
          }
        : null,
      invalidGeometry: nation?.invalid ?? 0,
    } satisfies Omit<RealmOverviewRow, "flags">;
    return { ...base, flags: flagsOf(base) };
  });
  return { realms: rows, partial: unchecked.size > 0, layerCounts };
}
