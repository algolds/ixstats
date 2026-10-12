/**
 * The `world` map import job: a generated world (the browser generator's gzip bundle, stored by the upload route)
 * written into a realm. Two jobs, as every import: a dry run that checks the bundle and reports what applying it
 * would do (`runWorldDryRun`), then an apply job queued from it (`applyWorld`). Nothing is written until the apply.
 *
 * The apply runs in this order (ruling A7), because `writePipelineLayers` opens transactions of its own:
 *
 *   1. guards: the person can edit the realm's map, it is not Ixnay or archived, no claim is pending or approved;
 *   2. the rollback snapshot of the layers is taken, then ONE transaction (world-import.slots.ts) locks the realm's
 *      generated countries, counts the claims again, retires the old unowned and unclaimed slots and creates the new
 *      ones (unclaimable until the map is written);
 *   3. the old nation borders are retired and the seven layers written with `slot_<key>` feature keys, each border
 *      linked to its country;
 *   4. the slots the founder left claimable are opened, `Realm.seed` and `generationParams` saved, the map refreshed;
 *   5. on any failure after step 2 the snapshot is restored: new slots removed, old ones back, layers as they were;
 *   6. after the commit, the relief tiles are built from the bundle's cells; if that fails the world stays and the
 *      result says the relief step failed (`rebuildRealmRelief` runs it again).
 *
 * The "realm map" source keeps the realm's own borders: no political layer is written, and each political feature
 * with no country gets one, claimable.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  decodeCells,
  WORLD_BUNDLE_LAYERS,
  type WorldBundleLayerName,
} from "~/lib/maps/import/world-bundle";
import { ImportCancelledError } from "~/lib/maps/import/progress";
import {
  captureMapSnapshot,
  restoreMapSnapshot,
  type MapImportSnapshot,
} from "~/lib/maps/realm-map-snapshot";
import { deactivateOtherFeatures } from "~/lib/maps/realm-map-writer";
import { ATLAS_ENGINE_VERSION } from "~/lib/buildVersion";
import { refreshRealmMap } from "./map-import.apply";
import { layerFeatures, pipelineSnapshotScopes, writePipelineLayers } from "./map-import.pipeline";
import type { ImportRealm } from "./map-import.realm";
import type { ReliefEntry, ReliefSource } from "./realm-relief";
import { assertWorldImportAllowed, jobActor } from "./world-import.guards";
import { loadWorldBundle, prepareWorld, type PreparedWorld } from "./world-import.prepare";
import {
  dedupeNames,
  openSlots,
  replaceSlots,
  retirableSlots,
  unlinkedFeatures,
  type CreatedNation,
  type SlotStep,
} from "./world-import.slots";

/** A feature edited this long after the last generation counts as a hand edit (the generation itself touches rows). */
const HAND_EDIT_GRACE_MS = 10 * 60_000;

/** The job fields the world import reads. */
export interface WorldJob {
  id: string;
  realmId: string;
  uploadId: string | null;
  requestedBy: string;
}

export interface WorldProgress {
  write: (percent: number, stage: string) => void;
  isCancelled: () => boolean;
}

const NO_PROGRESS: WorldProgress = { write: () => undefined, isCancelled: () => false };

export type ReliefRunner = (
  db: PrismaClient,
  realmId: string,
  source: ReliefSource
) => Promise<ReliefEntry>;

export interface WorldImportDeps {
  /** Builds the relief tiles (default: realm-relief.ts `buildRealmRelief`). Tests replace it. */
  runRelief?: ReliefRunner;
}

async function defaultRelief(db: PrismaClient, realmId: string, source: ReliefSource) {
  return (await import("./realm-relief")).buildRealmRelief(db, realmId, source);
}

// The dry run

export interface WorldLayerDiff {
  /** Features the layer gets that it has no feature of that key for. */
  create: number;
  /** Features that replace an existing feature of the same key. */
  change: number;
  /** Active features the world no longer has. */
  retire: number;
}

export interface WorldDiff {
  source: PreparedWorld["bundle"]["source"];
  seed: number;
  developmentLevel: PreparedWorld["bundle"]["params"]["developmentLevel"];
  layers: Record<WorldBundleLayerName, WorldLayerDiff>;
  slots: {
    create: number;
    /** Old generated slots no player has: retired. */
    retire: number;
    /** Old generated slots a player holds or has a claim row for: kept as they are. */
    keep: number;
    /** New slots whose name was taken in the realm and got a number. */
    renamed: number;
  };
  warnings: string[];
}

interface MapRow {
  layerType: string;
  featureId: string;
  isActive: boolean;
  countryId: string | null;
  updatedAt: Date;
}

function layerDiff(
  prepared: PreparedWorld,
  layer: WorldBundleLayerName,
  rows: readonly MapRow[]
): WorldLayerDiff {
  const incoming = prepared.layers[layer];
  if (!incoming) return { create: 0, change: 0, retire: 0 };
  const keys = new Set(layerFeatures(layer, incoming).map((feature) => feature.key));
  const existing = rows.filter((row) => row.layerType === layer);
  const present = new Set(existing.map((row) => row.featureId));
  return {
    create: [...keys].filter((key) => !present.has(key)).length,
    change: [...keys].filter((key) => present.has(key)).length,
    retire: existing.filter((row) => row.isActive && !keys.has(row.featureId)).length,
  };
}

const summarySource = (summary: Prisma.JsonValue): string | null =>
  summary && typeof summary === "object" && !Array.isArray(summary) && "source" in summary
    ? String(summary.source)
    : null;

/** What replacing the realm's current map loses: hand edits since the last generation, or the map itself. */
async function replacedWarnings(
  db: PrismaClient,
  realmId: string,
  rows: readonly MapRow[],
  survivorLinks: number
): Promise<string[]> {
  const active = rows.filter((row) => row.isActive);
  const imports = await db.mapImport.findMany({
    where: { realmId, rolledBackAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { createdAt: true, summary: true },
  });
  const last = imports.find((record) => summarySource(record.summary) === "world");
  const warnings: string[] = [];
  if (!last) {
    if (active.length > 0)
      warnings.push(`The realm's current map (${active.length} features) will be replaced`);
  } else {
    const since = last.createdAt.getTime() + HAND_EDIT_GRACE_MS;
    const edited = active.filter((row) => row.updatedAt.getTime() > since).length;
    const later = imports.filter((record) => record.createdAt > last.createdAt).length;
    if (edited > 0)
      warnings.push(
        `${edited} features were edited by hand since the last generation and will be replaced`
      );
    if (later > 0)
      warnings.push(
        `${later} map imports were applied since the last generation and will be replaced`
      );
  }
  if (survivorLinks > 0) {
    warnings.push(
      `${survivorLinks} nations that are not generated slots, or that a player holds, keep their country but lose their border`
    );
  }
  return warnings;
}

async function diffWorld(
  db: PrismaClient,
  realm: ImportRealm,
  prepared: PreparedWorld
): Promise<WorldDiff> {
  const { bundle } = prepared;
  const preset = bundle.source === "preset";
  const [rows, countries] = await Promise.all([
    db.mapLayer.findMany({
      where: { realmId: realm.id },
      select: {
        layerType: true,
        featureId: true,
        isActive: true,
        countryId: true,
        updatedAt: true,
      },
    }),
    db.country.findMany({
      where: { realmId: realm.id },
      select: { id: true, name: true, worldgen: true },
    }),
  ]);
  const retirable = preset ? await retirableSlots(db, realm.id) : [];
  const unlinked = preset ? [] : await unlinkedFeatures(db, realm.id);
  const retiredIds = new Set(retirable.map((slot) => slot.id));
  const survivors = countries.filter((country) => !retiredIds.has(country.id));
  const wanted = preset
    ? prepared.slots.map((planned) => planned.slot.name)
    : unlinked.map((n) => n.name);
  const names = dedupeNames(
    wanted,
    survivors.map((country) => country.name)
  );
  const renamed = names.filter((name, i) => name.toLowerCase() !== wanted[i]!.trim().toLowerCase());

  const warnings = [...prepared.warnings];
  if (preset) {
    const links = rows.filter(
      (row) => row.layerType === "political" && row.isActive && row.countryId !== null
    );
    const kept = links.filter((row) => !retiredIds.has(row.countryId!)).length;
    warnings.push(...(await replacedWarnings(db, realm.id, rows, kept)));
    const empty = prepared.slots.filter((planned) => planned.slot.population === 0).length;
    if (empty > 0)
      warnings.push(`${empty} slots have no habitable land and start as token nations`);
  } else {
    warnings.push(
      `The realm's borders are kept: ${unlinked.length} regions with no nation become claimable nations`
    );
  }
  if (renamed.length > 0) {
    warnings.push(`${renamed.length} names were already taken in this realm and got a number`);
  }

  return {
    source: bundle.source,
    seed: bundle.seed,
    developmentLevel: bundle.params.developmentLevel,
    layers: Object.fromEntries(
      WORLD_BUNDLE_LAYERS.map((layer) => [layer, layerDiff(prepared, layer, rows)])
    ) as WorldDiff["layers"],
    slots: {
      create: wanted.length,
      retire: retirable.length,
      keep: countries.filter((country) => country.worldgen).length - retirable.length,
      renamed: renamed.length,
    },
    warnings,
  };
}

/**
 * The dry run: read the stored bundle, check it against the realm (permissions, lock, geometry, figures) and say what
 * applying it would do. Writes nothing. Throws a MapImportError with every reason when the bundle cannot be applied.
 */
export async function runWorldDryRun(
  db: PrismaClient,
  job: WorldJob,
  progress: WorldProgress = NO_PROGRESS
): Promise<WorldDiff> {
  progress.write(2, "Reading the world");
  const bundle = await loadWorldBundle(job.uploadId);
  const realm = await assertWorldImportAllowed(
    db,
    await jobActor(db, job.requestedBy),
    job.realmId
  );
  progress.write(10, "Checking the geometry");
  const prepared = await prepareWorld(db, realm, bundle);
  if (progress.isCancelled()) throw new ImportCancelledError();
  progress.write(80, "Comparing with the realm's map");
  return diffWorld(db, realm, prepared);
}

// The apply

export interface WorldApplyResult {
  written: number;
  rejected: Array<{ layerType: string; key: string; reason: string }>;
  deactivated: number;
  slots: { created: number; retired: number; opened: number };
  mapImportId: string | null;
  rollbackAvailable: boolean;
  /** The relief step runs after the world is committed: a failure leaves the world and says why. */
  relief: {
    status: "built" | "failed";
    version: string | null;
    tiles: number;
    error: string | null;
  };
}

/** The political features named after their countries, so the map shows the names the nations were given. */
function nameBorders(prepared: PreparedWorld, created: readonly CreatedNation[]) {
  const political = prepared.layers.political;
  if (!political) return prepared.layers;
  const names = new Map(created.map((nation) => [nation.featureKey, nation.name]));
  return {
    ...prepared.layers,
    political: {
      ...political,
      features: political.features.map((feature) => {
        const name = names.get(String(feature.id));
        return name
          ? { ...feature, properties: { ...feature.properties, name, _displayName: name } }
          : feature;
      }),
    },
  };
}

/** Put the realm back as the snapshot has it, and mark the import it may have recorded as rolled back. */
async function compensate(
  db: PrismaClient,
  snapshot: MapImportSnapshot,
  jobId: string,
  cause: Error
): Promise<never> {
  const reason = cause.message;
  try {
    await restoreMapSnapshot(db, snapshot);
    await db.mapImport.updateMany({
      where: { jobId, rolledBackAt: null },
      data: { rolledBackAt: new Date(), rolledBackBy: "system:world-import" },
    });
    await refreshRealmMap(db, snapshot.realmId);
  } catch (restoreError) {
    console.error("[world-import] restoring the previous map failed:", restoreError);
    const why = restoreError instanceof Error ? restoreError.message : String(restoreError);
    throw new Error(
      `${reason}. Restoring the previous map also failed (${why}): ask a site admin to check the realm's nations and map`,
      { cause: restoreError }
    );
  }
  throw cause;
}

async function buildRelief(
  db: PrismaClient,
  realmId: string,
  cells: string,
  run: ReliefRunner
): Promise<WorldApplyResult["relief"]> {
  try {
    const decoded = decodeCells(cells);
    if (!decoded.ok) throw new Error(decoded.reason);
    const entry = await run(db, realmId, { cells: decoded.cells });
    return { status: "built", version: entry.version, tiles: entry.tiles, error: null };
  } catch (error) {
    console.error(`[world-import] relief for ${realmId} failed:`, error);
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    return { status: "failed", version: null, tiles: 0, error: message };
  }
}

const toJson = (value: object): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

/** Steps 3 and 4: the old borders retired, the layers written and linked, the slots opened, the realm's row saved. */
async function writeWorld(
  db: PrismaClient,
  job: WorldJob,
  realm: ImportRealm,
  prepared: PreparedWorld,
  step: SlotStep,
  snapshot: MapImportSnapshot
) {
  const { bundle } = prepared;
  // Old borders go first: while they are active the writer's overlap removal would trim the new ones against them
  if (bundle.source === "preset") {
    await deactivateOtherFeatures(
      db,
      realm.id,
      "political",
      step.created.map((n) => n.featureKey)
    );
  }
  const written = await writePipelineLayers(db, {
    realmId: realm.id,
    layers: nameBorders(prepared, step.created),
    mode: "replace",
    createdBy: job.requestedBy,
    jobId: job.id,
    countryLinks: Object.fromEntries(step.created.map((n) => [n.featureKey, n.countryId])),
    snapshot,
    summary: {
      source: "world",
      slotsCreated: step.created.length,
      slotsRetired: step.retired.length,
    },
  });
  const lost = written.rejected.filter((entry) => entry.layerType === "political");
  if (lost.length > 0) {
    throw new Error(`The map writer rejected ${lost.length} nation borders (${lost[0]!.reason})`);
  }
  const opened = await openSlots(db, step.created);
  await db.realm.update({
    where: { id: realm.id },
    data: {
      seed: bundle.seed,
      generationParams: toJson({
        params: bundle.params,
        engineVersion: ATLAS_ENGINE_VERSION,
        developmentLevel: bundle.params.developmentLevel,
        source: bundle.source,
      }),
    },
  });
  await refreshRealmMap(db, realm.id, { adjacency: false });
  return { written, opened };
}

/**
 * The apply (see the module comment for the order). Throws a MapImportError with nothing changed when a guard or
 * the slot transaction refuses; after that, any failure restores the previous map and slots before it is thrown.
 */
export async function applyWorld(
  db: PrismaClient,
  job: WorldJob,
  progress: WorldProgress = NO_PROGRESS,
  deps: WorldImportDeps = {}
): Promise<WorldApplyResult> {
  progress.write(2, "Reading the world");
  const bundle = await loadWorldBundle(job.uploadId);
  const realm = await assertWorldImportAllowed(
    db,
    await jobActor(db, job.requestedBy),
    job.realmId
  );
  progress.write(8, "Checking the world");
  const prepared = await prepareWorld(db, realm, bundle);
  const preset = bundle.source === "preset";
  if (progress.isCancelled()) throw new ImportCancelledError();

  progress.write(20, "Saving a snapshot to roll back to");
  const scopes = pipelineSnapshotScopes(prepared.layers, "replace");
  if (!preset) {
    const keys = (await unlinkedFeatures(db, realm.id)).map((nation) => nation.featureKey);
    scopes.push({ layerType: "political", keys, wholeLayer: false, countryIds: [] });
  }
  const snapshot = await captureMapSnapshot(db, realm.id, scopes);

  progress.write(30, "Creating nations");
  const step = await replaceSlots(db, realm, {
    retire: preset,
    slots: preset ? prepared.slots : null,
    level: bundle.params.developmentLevel,
  });
  snapshot.slots = { retired: step.retired, created: step.created.map((c) => c.countryId) };

  progress.write(45, "Writing the map");
  const outcome = await writeWorld(db, job, realm, prepared, step, snapshot).catch(
    (error: Error | string) =>
      compensate(db, snapshot, job.id, error instanceof Error ? error : new Error(error))
  );

  progress.write(90, "Building relief");
  const relief = await buildRelief(db, realm.id, bundle.cells, deps.runRelief ?? defaultRelief);
  const { written, opened } = outcome;
  const record = written.mapImportId
    ? await db.mapImport.findUnique({
        where: { id: written.mapImportId },
        select: { rollbackAvailable: true },
      })
    : null;
  return {
    written: written.imported,
    rejected: written.rejected,
    deactivated: written.deactivated,
    slots: { created: step.created.length, retired: step.retired.length, opened },
    mapImportId: written.mapImportId,
    rollbackAvailable: record?.rollbackAvailable ?? false,
    relief,
  };
}

// Jobs

export type WorldDryRunSummary = WorldDiff & { phase: "world-dry-run" };
export type WorldApplySummary = WorldApplyResult & { phase: "world-apply" };

/** A queued `world` job: the dry run or, for the child apply job, the apply. */
export async function runWorldJob(
  db: PrismaClient,
  job: WorldJob & { dryRun: boolean },
  progress: WorldProgress,
  deps: WorldImportDeps = {}
): Promise<WorldDryRunSummary | WorldApplySummary> {
  if (job.dryRun) return { phase: "world-dry-run", ...(await runWorldDryRun(db, job, progress)) };
  return { phase: "world-apply", ...(await applyWorld(db, job, progress, deps)) };
}

// Relief

export interface ReliefRebuild {
  /** "cells": from the last world import's stored bundle. "bands": from the realm's altitude bands. */
  source: "cells" | "bands";
  version: string;
  built: boolean;
  tiles: number;
}

/** The heights to shade: the cells of the realm's latest applied world import while its altitudes stand, else bands. */
async function reliefSource(db: PrismaClient, realmId: string): Promise<ReliefSource> {
  const imports = await db.mapImport.findMany({
    where: { realmId, rolledBackAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { jobId: true, layerTypes: true, summary: true },
  });
  const latest = imports.find((record) => record.layerTypes.includes("altitudes"));
  if (latest?.jobId && summarySource(latest.summary) === "world") {
    const job = await db.mapImportJob.findUnique({
      where: { id: latest.jobId },
      select: { uploadId: true },
    });
    const bundle = await loadWorldBundle(job?.uploadId ?? null).catch(() => null);
    const decoded = bundle && decodeCells(bundle.cells);
    if (decoded?.ok) return { cells: decoded.cells };
  }
  return { bands: true };
}

/**
 * Build the realm's relief again: from the cells of its latest world import when the map came from one (and its
 * bundle is still stored), else from its altitude bands. The World tab's "Rebuild relief"; the caller has checked who
 * may (`rebuildWorldRelief` in map-import.jobs.ts).
 */
export async function rebuildRealmRelief(
  db: PrismaClient,
  realmId: string,
  deps: WorldImportDeps = {}
): Promise<ReliefRebuild> {
  const source = await reliefSource(db, realmId);
  const entry = await (deps.runRelief ?? defaultRelief)(db, realmId, source);
  return {
    source: "cells" in source ? "cells" : "bands",
    version: entry.version,
    built: entry.built,
    tiles: entry.tiles,
  };
}
