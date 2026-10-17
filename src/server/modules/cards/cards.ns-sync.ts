/**
 * NationStates imports for the cards admin: region syncs from the official card dumps (server-side; a sync writes
 * its progress to its SyncLog after every card, so it pauses, resumes and stops), the CTE filter, region discovery,
 * and each sync's history with the cards it created. Every card a sync creates waits in Curation.
 */
import type { Prisma, PrismaClient, SyncLog } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CardType } from "~/lib/cards/enums";
import { isJsonObject } from "~/lib/cards/ns-facts";
import { nsApiClient } from "~/lib/nationstates/api-client";
import {
  activeRunningJobs,
  processCTENationFilter,
  processRegionCardsFromDump,
} from "~/lib/nationstates/sync-processor";
import type { CardAdminActor } from "~/server/shared/admin-actor";
import { recordCardAudit } from "./cards.audit";

/** Every NationStates card season with a dump; an admin may narrow it. */
export const DEFAULT_SYNC_SEASONS: readonly number[] = Array.from({ length: 13 }, (_, i) => i + 1);

export function normalizeSeasons(input: readonly number[] | undefined): number[] {
  const seasons = [
    ...new Set((input ?? []).filter((n) => Number.isInteger(n) && n > 0 && n <= 100)),
  ];
  return seasons.length > 0 ? seasons.sort((a, b) => a - b) : [...DEFAULT_SYNC_SEASONS];
}

/**
 * A sync's metadata. `regionNames` is written by every dump sync; `regionName` only by the per-nation syncs from
 * before them, whose cards carry no sync id.
 */
const SyncMetaSchema = z.object({
  regionNames: z.array(z.string()).catch([]),
  regionName: z.string().nullable().catch(null),
  seasons: z.array(z.number()).catch([]),
  totalCards: z.number().catch(0),
  lastProcessedIndex: z.number().catch(-1),
  heartbeatAt: z.string().nullable().catch(null),
});
type SyncMeta = z.infer<typeof SyncMetaSchema>;

function syncMeta(log: Pick<SyncLog, "metadata">): SyncMeta {
  const parsed = SyncMetaSchema.safeParse(log.metadata ?? {});
  return parsed.success ? parsed.data : SyncMetaSchema.parse({});
}

const REGION_SYNC = "NS_REGION_";

/** The SyncLog, or NOT_FOUND; with `kind`, a log of another type is not found either. */
async function requireSync(db: PrismaClient, id: string, kind?: string): Promise<SyncLog> {
  const log = await db.syncLog.findUnique({ where: { id } });
  if (!log || (kind && !log.syncType.startsWith(kind))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Sync not found" });
  }
  return log;
}

/** A sync that may still be worked: running, paused, or interrupted by a restart (left running). */
const isOpen = (log: SyncLog) => log.status === "IN_PROGRESS" || log.status === "PAUSED";

/** A running sync whose run has written nothing for this long has lost it (a restart, or a crash). */
const STALL_MS = 10 * 60_000;

/**
 * Running, but its run has gone quiet: no heartbeat (each card, each season dump) for over `STALL_MS`, counted from
 * its start when it has none. A run still going in this process is never stalled.
 */
function isStalled(log: SyncLog, meta: SyncMeta): boolean {
  if (log.status !== "IN_PROGRESS" || activeRunningJobs.has(log.id)) return false;
  const beat = Date.parse(meta.heartbeatAt ?? "");
  const last = Number.isFinite(beat) ? beat : log.startedAt.getTime();
  return Date.now() - last > STALL_MS;
}

/**
 * Claims a paused or stalled sync for one new run. The write lands only while the log is as it was read, so of two
 * resumes racing for it, one starts a run.
 */
async function claimRun(db: PrismaClient, log: SyncLog): Promise<boolean> {
  const metadata = isJsonObject(log.metadata) ? log.metadata : {};
  const claimed = await db.syncLog.updateMany({
    where: { id: log.id, status: log.status, metadata: { equals: metadata } },
    data: {
      status: "IN_PROGRESS",
      metadata: { ...metadata, heartbeatAt: new Date().toISOString() },
    },
  });
  return claimed.count === 1;
}

/** A new run's SyncLog and the audit row naming who started it (the run rewrites its own metadata as it goes). */
function createSyncLog(
  db: PrismaClient,
  actor: CardAdminActor,
  data: { syncType: string; metadata: Prisma.InputJsonObject; details: string }
): Promise<SyncLog> {
  return db.$transaction(async (tx) => {
    const log = await tx.syncLog.create({
      data: {
        syncType: data.syncType,
        status: "IN_PROGRESS",
        metadata: { ...data.metadata, startedBy: actor.dbId },
      },
    });
    await recordCardAudit(tx, {
      action: "CARD_IMPORT",
      actor: actor.clerkId,
      target: log.id,
      details: data.details,
    });
    return log;
  });
}

const regionSyncType = (region: string) =>
  `${REGION_SYNC}${region.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

/** Runs a sync's work after the request returns; a run that breaks marks its SyncLog failed instead of running. */
function runInBackground<T>(db: PrismaClient, syncLogId: string, work: Promise<T>, label: string) {
  work.catch(async (error) => {
    console.error(`[NS Import] ${label} failed:`, error);
    await db.syncLog
      .update({
        where: { id: syncLogId },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      })
      .catch((writeError) => console.error(`[NS Import] ${label} not marked failed:`, writeError));
  });
}

/** The regions to sync: trimmed, blanks dropped, once each whatever their case. */
function distinctRegions(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  return raw
    .map((region) => region.trim())
    .filter((region) => {
      const key = region.toLowerCase();
      if (!region || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function startRegionSync(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { regions: readonly string[]; seasons?: readonly number[] }
): Promise<Array<{ regionName: string; syncLogId: string }>> {
  const regions = distinctRegions(input.regions);
  if (regions.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Name at least one region" });
  }
  const seasons = normalizeSeasons(input.seasons);

  const started: Array<{ regionName: string; syncLogId: string }> = [];
  for (const regionName of regions) {
    const log = await createSyncLog(db, actor, {
      syncType: regionSyncType(regionName),
      metadata: {
        regionNames: [regionName],
        seasons,
        totalCards: 0,
        lastProcessedIndex: -1,
        heartbeatAt: new Date().toISOString(),
      },
      details: `Started a NationStates region sync of ${regionName}, seasons ${seasons.join(", ")}`,
    });
    runInBackground(
      db,
      log.id,
      processRegionCardsFromDump(db, log.id, [regionName], seasons),
      `Region sync ${regionName}`
    );
    started.push({ regionName, syncLogId: log.id });
  }
  return started;
}

export async function listSyncLogs(db: PrismaClient, limit: number) {
  const logs = await db.syncLog.findMany({
    where: { syncType: { startsWith: "NS_" } },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return logs.map((log) => {
    const meta = syncMeta(log);
    return {
      id: log.id,
      syncType: log.syncType,
      region: meta.regionNames[0] ?? meta.regionName,
      status: log.status,
      cardsCreated: log.cardsCreated ?? 0,
      cardsUpdated: log.cardsUpdated ?? 0,
      itemsProcessed: log.itemsProcessed,
      errorMessage: log.errorMessage,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
    };
  });
}

/**
 * The cards a sync created, by the sync id they carry (`exact`). A sync from before syncs recorded their cards lists
 * every card first synced from its region instead, by the `importedFrom` those syncs wrote.
 */
export async function syncLogCards(
  db: PrismaClient,
  input: { syncLogId: string; search?: string; limit: number; offset: number }
) {
  const log = await requireSync(db, input.syncLogId);
  // Only a sync from before syncs recorded their cards names a single `regionName`
  const region = syncMeta(log).regionName;
  const search = input.search?.trim();
  const where: Prisma.CardWhereInput = {
    ...(region
      ? { cardType: CardType.NS, metadata: { path: ["importedFrom"], equals: `region:${region}` } }
      : { metadata: { path: ["syncLogId"], equals: log.id } }),
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
  };
  const [cards, total] = await Promise.all([
    db.card.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
      select: {
        id: true,
        title: true,
        rarity: true,
        nsCardId: true,
        nsSeason: true,
        reviewState: true,
      },
    }),
    db.card.count({ where }),
  ]);
  return { cards, total, exact: !region };
}

export async function activeSyncs(db: PrismaClient) {
  const logs = await db.syncLog.findMany({
    where: { syncType: { startsWith: REGION_SYNC }, status: { in: ["IN_PROGRESS", "PAUSED"] } },
    orderBy: { startedAt: "desc" },
  });
  return logs.map((log) => {
    const meta = syncMeta(log);
    return {
      id: log.id,
      region: meta.regionNames[0] ?? log.syncType,
      status: log.status,
      stalled: isStalled(log, meta),
      processed: meta.lastProcessedIndex + 1,
      totalCards: meta.totalCards,
      cardsCreated: log.cardsCreated ?? 0,
      cardsUpdated: log.cardsUpdated ?? 0,
      startedAt: log.startedAt,
    };
  });
}

export async function pauseSync(db: PrismaClient, id: string): Promise<void> {
  const log = await requireSync(db, id, REGION_SYNC);
  if (log.status !== "IN_PROGRESS") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only a running sync can be paused" });
  }
  await db.syncLog.update({ where: { id }, data: { status: "PAUSED" } });
}

/** `resumed` is whether a new run started; a sync still running here just has its pause lifted. */
export async function resumeSync(db: PrismaClient, id: string): Promise<{ resumed: boolean }> {
  const log = await requireSync(db, id, REGION_SYNC);
  if (!isOpen(log)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only a paused or interrupted sync can be resumed",
    });
  }
  if (activeRunningJobs.has(log.id)) {
    // The run checks the status before each card, so it carries on once the pause is lifted.
    if (log.status === "PAUSED") {
      await db.syncLog.updateMany({
        where: { id, status: "PAUSED" },
        data: { status: "IN_PROGRESS" },
      });
    }
    return { resumed: false };
  }
  const meta = syncMeta(log);
  if (log.status === "IN_PROGRESS" && !isStalled(log, meta)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This sync is still running. Resume it once it stalls, or pause it first.",
    });
  }
  if (meta.regionNames.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This sync has no region list to resume from",
    });
  }
  const from = meta.lastProcessedIndex + 1;
  if (meta.totalCards > 0 && from >= meta.totalCards) {
    await db.syncLog.update({
      where: { id },
      data: { status: "SUCCESS", completedAt: new Date() },
    });
    return { resumed: false };
  }
  if (!(await claimRun(db, log))) return { resumed: false };
  runInBackground(
    db,
    id,
    processRegionCardsFromDump(db, id, meta.regionNames, normalizeSeasons(meta.seasons), from, {
      cardsCreated: log.cardsCreated ?? 0,
      cardsUpdated: log.cardsUpdated ?? 0,
      errors: [],
    }),
    `Resumed sync ${id}`
  );
  return { resumed: true };
}

export async function stopSync(db: PrismaClient, id: string): Promise<void> {
  const log = await requireSync(db, id, REGION_SYNC);
  if (!isOpen(log)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only a running or paused sync can be stopped",
    });
  }
  await db.syncLog.update({
    where: { id },
    data: { status: "FAILED", errorMessage: "Stopped by an admin", completedAt: new Date() },
  });
}

/** The largest regions with a NationStates tag, by nation count (at most 30 asked, to respect the API's limits). */
export async function discoverTopRegions(tag: string, limit: number) {
  const names = await nsApiClient.fetchRegionsByTag(tag === "massive" ? "gargantuan" : tag);
  if (names === null) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "NationStates did not answer. Try again in a few minutes.",
    });
  }
  const regions: Array<{ id: string; name: string; numnations: number }> = [];
  for (const id of names.slice(0, 30)) {
    const info = await nsApiClient.fetchRegionNationCount(id);
    if (info) regions.push({ id, name: info.name, numnations: info.numnations });
  }
  return regions.sort((a, b) => b.numnations - a.numnations).slice(0, limit);
}

/** The CTE filter as a background job with its own SyncLog. */
export async function startCteFilter(
  db: PrismaClient,
  actor: CardAdminActor
): Promise<{ syncLogId: string }> {
  const log = await createSyncLog(db, actor, {
    syncType: "NS_CTE_FILTER",
    metadata: {},
    details: "Started the NationStates CTE filter",
  });
  runInBackground(db, log.id, processCTENationFilter(db, log.id), "CTE filter");
  return { syncLogId: log.id };
}
