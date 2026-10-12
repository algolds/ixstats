/**
 * The `world` map import job: a generated world (the browser generator's gzip bundle, stored by the upload route)
 * written into a realm. Two jobs, as every import: a dry run that checks the bundle and reports what applying it
 * would do (`runWorldDryRun`), then an apply job queued from it (`applyWorld`). Nothing is written until the apply.
 *
 * The apply runs in this order (ruling A7), because `writePipelineLayers` opens transactions of its own:
 *
 *   1. guards: the person can edit the realm's map, it is not Ixnay or archived, no claim is pending or approved;
 *   2. the rollback snapshot (the layers, and the realm's generation record and relief layer) is taken, then ONE
 *      transaction (world-import.slots.ts) locks the realm's generated countries and then the realm, checks the guards
 *      again, retires the old unowned and unclaimed slots and creates the new ones (unclaimable until the map is
 *      written);
 *   3. the old nation borders are retired and the seven layers written with `slot_<key>` feature keys, each border
 *      linked to its country;
 *   4. `Realm.seed` and `generationParams` are saved, then the slots the founder left claimable are opened and the map
 *      refreshed: nothing that can fail runs after the slots open;
 *   5. on any failure after step 2 the snapshot is restored: new slots removed, old ones back, layers as they were;
 *   6. after the commit, the relief tiles are built from the bundle's cells; if that fails the world stays and the
 *      result says the relief step failed (`rebuildRealmRelief` runs it again).
 *
 * A site admin's layer choice (`options.layers`, a world fitted to the realm's map, Ixnay allowed) writes exactly the
 * ticked physical layers in replace mode and nothing else: no slot is created or retired, no claim lock applies (no
 * nation is touched), and the realm's seed and generation record stay as they are. Rolling it back restores those
 * layers from the normal snapshot.
 *
 * The "realm map" source keeps what the realm drew: no political layer and no land layer is written, each political
 * feature with no country gets one (claimable), and only the other layers the realm has none of are generated. The
 * relief is shaded from the elevation, so it is built only when the elevation is written.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { decodeCells } from "~/lib/maps/import/world-bundle";
import { ImportCancelledError } from "~/lib/maps/import/progress";
import {
  captureMapSnapshot,
  captureRealmState,
  restoreMapSnapshot,
  type MapImportSnapshot,
} from "~/lib/maps/realm-map-snapshot";
import { deactivateOtherFeatures } from "~/lib/maps/realm-map-writer";
import { ATLAS_ENGINE_VERSION } from "~/lib/buildVersion";
import { withJobLock } from "~/lib/system/job-lock";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import { refreshRealmMap } from "./map-import.apply";
import { pipelineSnapshotScopes, writePipelineLayers } from "./map-import.pipeline";
import {
  MAP_IMPORT_LOCK_MS,
  mapImportLockName,
  MapImportError,
  type ImportRealm,
} from "./map-import.realm";
import type { ReliefEntry, ReliefSource } from "./realm-relief";
import { assertWorldImportAllowed, jobActor } from "./world-import.guards";
import { loadWorldBundle, prepareWorld, type PreparedWorld } from "./world-import.prepare";
import {
  assertFittedToMap,
  assertMapUnchangedSince,
  currentMapVersion,
  fittedMapVersionOf,
  layersOf,
  loadCheck,
  summarySource,
} from "./world-import.check";
import { diffWorld, hasNothingToAdd, type WorldDiff } from "./world-import.diff";
import { markWorldReliefBuilt } from "./world-import.relief-state";
import {
  openSlots,
  replaceSlots,
  unlinkedFeatures,
  type CreatedNation,
  type SlotStep,
} from "./world-import.slots";

/** The job fields the world import reads. */
export interface WorldJob {
  id: string;
  realmId: string;
  uploadId: string | null;
  requestedBy: string;
  /** The check an apply job was queued from */
  parentJobId?: string | null;
  /** What `start` was given (for a world: `fittedMapVersion`) */
  options?: Prisma.JsonValue;
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
  /** How often a long step reports progress (default 30 s). Tests shorten it. */
  heartbeatMs?: number;
}

/** A job that reports nothing for STALE_AFTER_MS (10 minutes) is marked failed: a long step reports far more often. */
const HEARTBEAT_MS = 30_000;

async function defaultRelief(db: PrismaClient, realmId: string, source: ReliefSource) {
  return (await import("./realm-relief")).buildRealmRelief(db, realmId, source);
}

// The dry run

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
  const chosen = layersOf(job.options);
  const realm = await assertWorldImportAllowed(
    db,
    await jobActor(db, job.requestedBy),
    job.realmId,
    { layers: chosen }
  );
  // Read before the map is, so a change while this runs shows as a newer map than the check
  const mapVersion = await currentMapVersion(db, realm.id);
  const fittedMapVersion = fittedMapVersionOf(job.options);
  if (bundle.source === "realm-map") assertFittedToMap(fittedMapVersion, mapVersion);
  progress.write(10, "Checking the geometry");
  const prepared = await prepareWorld(db, realm, bundle, chosen);
  if (progress.isCancelled()) throw new ImportCancelledError();
  progress.write(80, "Comparing with the realm's map");
  const diff = await diffWorld(db, realm, prepared, { mapVersion, fittedMapVersion });
  if (bundle.source === "realm-map" && hasNothingToAdd(diff)) {
    throw new MapImportError(
      "BAD_REQUEST",
      "This world has nothing to add: the realm has every layer it would generate, and every region has a nation"
    );
  }
  return diff;
}

// The apply

export interface WorldApplyResult {
  written: number;
  rejected: Array<{ layerType: string; key: string; reason: string }>;
  deactivated: number;
  slots: { created: number; retired: number; opened: number };
  mapImportId: string | null;
  rollbackAvailable: boolean;
  /**
   * The relief step runs after the world is committed: a failure leaves the world and says why. "kept": the world did
   * not write the elevation the relief is shaded from (a world fitted to a realm that has its own), so the realm's
   * relief is as it was.
   */
  relief: {
    status: "built" | "failed" | "kept";
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

/**
 * Run `work` while reporting `stage` every `everyMs`: writing or shading a large world can take minutes with no other
 * report, and the stale-job sweep would fail a running apply whose world then lands.
 */
async function withHeartbeat<T>(
  progress: WorldProgress,
  at: { percent: number; stage: string; everyMs: number },
  work: () => Promise<T>
): Promise<T> {
  const timer = setInterval(() => progress.write(at.percent, at.stage), at.everyMs);
  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}

/** Run one step of the compensation; the reason it failed (logged), or null when it worked. */
async function attempt(what: string, run: () => Promise<void>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    console.error(`[world-import] ${what} failed:`, error);
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Put the realm back as the snapshot has it, mark the import it may have recorded as rolled back, and rethrow `cause`.
 * The error names the step that failed, and any new nation a player claimed meanwhile, which is kept.
 */
async function compensate(
  db: PrismaClient,
  snapshot: MapImportSnapshot,
  jobId: string,
  cause: Error
): Promise<never> {
  let kept = 0;
  const restoreFailed = await attempt("restoring the previous map", async () => {
    kept = (await restoreMapSnapshot(db, snapshot)).slots?.kept ?? 0;
  });
  if (restoreFailed !== null) {
    throw new Error(
      `${cause.message}. Restoring the previous map also failed (${restoreFailed}): ask a site admin to check the realm's nations and map`,
      { cause }
    );
  }
  const notes: string[] = [];
  const marked = await attempt("marking the import as rolled back", async () => {
    await db.mapImport.updateMany({
      where: { jobId, rolledBackAt: null },
      data: { rolledBackAt: new Date(), rolledBackBy: "system:world-import" },
    });
  });
  const refreshed = await attempt("refreshing the map", async () => {
    await refreshRealmMap(db, snapshot.realmId);
  });
  const failed = [
    marked && `marking the import as rolled back failed (${marked})`,
    refreshed && `refreshing the map failed (${refreshed})`,
  ].filter((note): note is string => !!note);
  if (failed.length > 0) notes.push(`The previous map was restored, but ${failed.join(" and ")}`);
  if (kept > 0) {
    notes.push(
      `${kept === 1 ? "1 new nation was" : `${kept} new nations were`} kept because a player has claimed ${kept === 1 ? "it" : "them"}`
    );
  }
  if (notes.length === 0) throw cause;
  throw new Error(`${cause.message}. ${notes.join(". ")}`, { cause });
}

/** What a layer choice does to the nation slots. */
const NO_SLOTS: SlotStep = { created: [], retired: [], reserved: [] };

const KEPT_RELIEF: WorldApplyResult["relief"] = {
  status: "kept",
  version: null,
  tiles: 0,
  error: null,
};

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
  // A layer choice leaves the realm's generation record alone (Ixnay has none to overwrite)
  if (!prepared.chosen) {
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
  }
  // The slots open after the last step that can fail; the refresh that tells viewers swallows its own errors
  const opened = await openSlots(db, step.created);
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
  const actor = await jobActor(db, job.requestedBy);
  const chosen = layersOf(job.options);
  const realm = await assertWorldImportAllowed(db, actor, job.realmId, { layers: chosen });
  progress.write(8, "Checking the world");
  const prepared = await prepareWorld(db, realm, bundle, chosen);
  const preset = bundle.source === "preset";
  if (progress.isCancelled()) throw new ImportCancelledError();
  // The check was a diff against the map as it was. Refused here before the snapshot is taken (the slot transaction
  // compares again, with its locks held)
  const check = await loadCheck(db, job);
  await assertMapUnchangedSince(db, realm.id, check);

  progress.write(20, "Saving a snapshot to roll back to");
  const scopes = pipelineSnapshotScopes(prepared.layers, "replace");
  if (!preset && !chosen) {
    const keys = (await unlinkedFeatures(db, realm.id)).map((nation) => nation.featureKey);
    scopes.push({ layerType: "political", keys, wholeLayer: false, countryIds: [] });
  }
  const snapshot = await captureMapSnapshot(db, realm.id, scopes);
  snapshot.realm = await captureRealmState(db, realm.id);

  progress.write(30, chosen ? "Keeping the nations" : "Creating nations");
  const step = chosen
    ? NO_SLOTS
    : await replaceSlots(db, realm, {
        actor,
        retire: preset,
        slots: preset ? prepared.slots : null,
        level: bundle.params.developmentLevel,
        check,
      });
  if (!chosen) {
    snapshot.slots = {
      retired: step.retired,
      created: step.created.map((c) => c.countryId),
      reserved: step.reserved,
    };
  }

  const everyMs = deps.heartbeatMs ?? HEARTBEAT_MS;
  progress.write(45, "Writing the map");
  const outcome = await withHeartbeat(
    progress,
    { percent: 45, stage: "Writing the map", everyMs },
    () =>
      writeWorld(db, job, realm, prepared, step, snapshot).catch((error: Error | string) =>
        compensate(db, snapshot, job.id, error instanceof Error ? error : new Error(error))
      )
  );

  progress.write(90, "Building relief");
  const relief = prepared.layers.altitudes
    ? await withHeartbeat(progress, { percent: 90, stage: "Building relief", everyMs }, () =>
        buildRelief(db, realm.id, bundle.cells, deps.runRelief ?? defaultRelief)
      )
    : KEPT_RELIEF;
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
 * may (`rebuildWorldRelief`, below).
 */
export async function rebuildRealmRelief(
  db: PrismaClient,
  realmId: string,
  deps: WorldImportDeps = {}
): Promise<ReliefRebuild> {
  const source = await reliefSource(db, realmId);
  const entry = await (deps.runRelief ?? defaultRelief)(db, realmId, source);
  // The relief is there: the book-keeping that clears the "Rebuild relief" offer must not fail the rebuild
  await markWorldReliefBuilt(db, realmId, entry).catch((error: Error) =>
    console.error(`[world-import] relief of ${realmId} built, but not recorded:`, error)
  );
  return {
    source: "cells" in source ? "cells" : "bands",
    version: entry.version,
    built: entry.built,
    tiles: entry.tiles,
  };
}

/**
 * `rebuildRealmRelief` for `actor` (the World tab's "Rebuild relief"), under the realm's job lease so it never
 * overlaps an import. The same people as the apply, without the claim lock: relief leaves the nations alone.
 */
export async function rebuildWorldRelief(
  db: PrismaClient,
  actor: RealmActor,
  realmId: string,
  deps: WorldImportDeps = {}
): Promise<ReliefRebuild> {
  await assertWorldImportAllowed(db, actor, realmId, { claims: false });
  const outcome = await withJobLock(
    db,
    mapImportLockName(realmId),
    () => rebuildRealmRelief(db, realmId, deps),
    {
      timeoutMs: MAP_IMPORT_LOCK_MS,
    }
  );
  if (!outcome.ran) {
    throw new MapImportError(
      "CONFLICT",
      "Another import of this realm is running. Try again when it has finished"
    );
  }
  return outcome.result;
}
