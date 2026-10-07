/**
 * Realm source sync: a realm's nations, figures, borders and alliances kept in step with an outside source
 * (a public GitHub repository read through a source adapter). Configuration is per realm (RealmSourceSync);
 * every run, dry or applied, is logged as a RealmSyncRun with its per-nation diff.
 *
 * Who: site admins and the realm's founder (canModerateRealm). Runs of one realm never overlap: each holds the
 * job lease `realm-source-sync:<realmId>`, whether it was started by a moderator, the script or the scheduled job.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { sourceAdapter, type SourceSnapshot } from "~/lib/realms/sources/adapters";
import {
  continentMapSchema,
  intervalHoursSchema,
  readContinentMap,
  readOptions,
  readOverrides,
  realmSyncOptionsSchema,
  realmSyncOverridesSchema,
  refSchema,
  repoSchema,
  SOURCE_PROVIDERS,
  type RealmSyncOptions,
} from "~/lib/realms/sources/config";
import { fetchRepoFile } from "~/lib/realms/sources/fetch";
import {
  realmWikiSettings,
  withRealmWikiSettings,
  type RealmWikiSettings,
} from "~/lib/realms/realm-wiki-settings";
import { planSourceSync, type SyncPlan } from "~/lib/realms/sources/plan";
import { dueSyncs } from "~/lib/realms/sources/schedule";
import { sourcePreset } from "~/lib/realms/sources/presets";
import { summarizePlan, type SyncSummary } from "~/lib/realms/sources/summary";
import { withJobLock } from "~/lib/system/job-lock";
import { WIKI_SOURCES } from "~/lib/wiki-os/config";
import type { InfoboxFacts } from "~/lib/realms/sources/stats";
import { canModerateRealm, type RealmActor } from "./realms.access";
import { fetchNationPagePrefill } from "./realms.prefill";
import { applySyncPlan, type ApplyDeps } from "./realms.source-apply";

type SyncErrorCode = "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST" | "CONFLICT";

export class SourceSyncError extends Error {
  constructor(
    public readonly code: SyncErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SourceSyncError";
  }
}

/** How long one realm's run may hold its lease. A run reads up to a few hundred wiki pages, paced. */
export const SOURCE_SYNC_LOCK_MS = 60 * 60_000;
export const sourceSyncLockName = (realmId: string) => `realm-source-sync:${realmId}`;
const RUN_HISTORY = 20;

/** Everything a run needs from a realm's row, validated. */
export interface SourceSyncConfig {
  realmId: string;
  enabled: boolean;
  provider: string;
  repo: string;
  ref: string;
  format: string;
  settings: Record<string, unknown>;
  intervalHours: number | null;
  options: RealmSyncOptions;
  continentMap: Record<string, string>;
  overrides: z.infer<typeof realmSyncOverridesSchema>;
}

export const sourceSyncConfigInput = z.object({
  enabled: z.boolean(),
  provider: z.enum(SOURCE_PROVIDERS),
  repo: repoSchema,
  ref: refSchema,
  format: z.string().min(1).max(60),
  settings: z.record(z.string(), z.unknown()),
  intervalHours: intervalHoursSchema,
  options: realmSyncOptionsSchema,
  continentMap: continentMapSchema,
  overrides: realmSyncOverridesSchema,
});
export type SourceSyncConfigInput = z.infer<typeof sourceSyncConfigInput>;

interface RealmRef {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
}

export async function loadManagedRealm(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  slug: string
): Promise<RealmRef> {
  const realm = await db.realm.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, ownerId: true },
  });
  if (!realm) throw new SourceSyncError("NOT_FOUND", "Realm not found");
  if (!canModerateRealm(actor, realm))
    throw new SourceSyncError("FORBIDDEN", "Only site admins and the realm's founder manage its source sync");
  return realm;
}

/** The adapter settings a format accepts; a bad setting is refused with the field it is on. */
export function validateSettings(format: string, settings: unknown): Record<string, unknown> {
  const adapter = sourceAdapter(format);
  if (!adapter) throw new SourceSyncError("BAD_REQUEST", `Unknown source format "${format}"`);
  const parsed = adapter.settingsSchema.safeParse(settings);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SourceSyncError(
      "BAD_REQUEST",
      `Source settings: ${issue?.path.join(".") || "settings"}: ${issue?.message ?? "invalid"}`
    );
  }
  return parsed.data as Record<string, unknown>;
}

function toConfig(row: Prisma.RealmSourceSyncGetPayload<object>): SourceSyncConfig {
  return {
    realmId: row.realmId,
    enabled: row.enabled,
    provider: row.provider,
    repo: row.repo,
    ref: row.ref,
    format: row.format,
    settings: (row.settings ?? {}) as Record<string, unknown>,
    intervalHours: row.intervalHours,
    options: readOptions(row.options),
    continentMap: readContinentMap(row.continentMap),
    overrides: readOverrides(row.overrides),
  };
}

export async function loadSourceSyncConfig(
  db: Pick<PrismaClient, "realmSourceSync">,
  realmId: string
): Promise<SourceSyncConfig | null> {
  const row = await db.realmSourceSync.findUnique({ where: { realmId } });
  return row ? toConfig(row) : null;
}

/** The settings page: the realm's config (or null), its last runs, and the realm's nations for manual matches. */
export async function getSourceSyncView(db: PrismaClient, actor: RealmActor, slug: string) {
  const realm = await loadManagedRealm(db, actor, slug);
  const [row, runs, countries] = await Promise.all([
    db.realmSourceSync.findUnique({ where: { realmId: realm.id } }),
    db.realmSyncRun.findMany({
      where: { realmId: realm.id },
      orderBy: { startedAt: "desc" },
      take: RUN_HISTORY,
    }),
    db.country.findMany({
      where: { realmId: realm.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, externalSourceKey: true, ownerUserId: true },
    }),
  ]);
  return {
    realm,
    config: row ? { ...toConfig(row), presetId: row.presetId, lastRunAt: row.lastRunAt, lastStatus: row.lastStatus } : null,
    runs: runs.map((run) => ({
      ...run,
      summary: run.summary as SyncSummary | null,
      errors: (run.errors as string[] | null) ?? [],
    })),
    countries: countries.map(({ ownerUserId, ...c }) => ({ ...c, claimed: ownerUserId !== null })),
  };
}

export async function saveSourceSyncConfig(
  db: PrismaClient,
  actor: RealmActor,
  slug: string,
  input: SourceSyncConfigInput
) {
  const realm = await loadManagedRealm(db, actor, slug);
  const settings = validateSettings(input.format, input.settings);
  const data = {
    enabled: input.enabled,
    provider: input.provider,
    repo: input.repo,
    ref: input.ref,
    format: input.format,
    settings: settings as Prisma.InputJsonValue,
    intervalHours: input.intervalHours,
    options: input.options,
    continentMap: input.continentMap,
    overrides: input.overrides as Prisma.InputJsonValue,
    updatedBy: actor.clerkUserId,
  };
  await db.realmSourceSync.upsert({
    where: { realmId: realm.id },
    update: data,
    create: { realmId: realm.id, ...data },
  });
  return { success: true };
}

/**
 * Fill a realm's config from a preset. Loading copies every value the preset has (repository, ref, format,
 * settings, options, continent table); the schedule switch stays off and staff overrides are kept.
 */
export async function loadSourcePreset(db: PrismaClient, actor: RealmActor | null, realmId: string, presetId: string) {
  const preset = sourcePreset(presetId);
  if (!preset) throw new SourceSyncError("NOT_FOUND", `No preset "${presetId}"`);
  const settings = validateSettings(preset.format, preset.settings);
  const data = {
    provider: preset.provider,
    repo: preset.repo,
    ref: preset.ref,
    format: preset.format,
    settings: settings as Prisma.InputJsonValue,
    options: realmSyncOptionsSchema.parse(preset.options ?? {}),
    continentMap: preset.continentMap ?? {},
    presetId: preset.id,
    updatedBy: actor?.clerkUserId ?? "script",
  };
  await db.realmSourceSync.upsert({
    where: { realmId },
    update: { ...data, ...(preset.intervalHours !== undefined && { intervalHours: preset.intervalHours }) },
    create: { realmId, ...data, intervalHours: preset.intervalHours ?? null, enabled: false },
  });
  const wikiFilled = preset.wiki ? await fillRealmWikiFromPreset(db, realmId, preset.wiki) : false;
  return { success: true, presetId: preset.id, wikiFilled };
}

/** The preset's wiki values become the realm's wiki settings, unless the realm already has its own. */
async function fillRealmWikiFromPreset(
  db: Pick<PrismaClient, "realm">,
  realmId: string,
  wiki: RealmWikiSettings
): Promise<boolean> {
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  if (!realm || realmWikiSettings(realm.settings)) return false;
  await db.realm.update({ where: { id: realmId }, data: { settings: withRealmWikiSettings(realm.settings, wiki) } });
  return true;
}

export interface ReadDeps {
  fetchFile?: typeof fetchRepoFile;
}

/** Read and parse the source's files. Throws on an unreadable required file or a malformed one. */
export async function readSourceSnapshot(config: SourceSyncConfig, deps: ReadDeps = {}): Promise<SourceSnapshot> {
  const adapter = sourceAdapter(config.format);
  if (!adapter) throw new SourceSyncError("BAD_REQUEST", `Unknown source format "${config.format}"`);
  const settings = validateSettings(config.format, config.settings);
  const fetchFile = deps.fetchFile ?? fetchRepoFile;
  const files: Record<string, string | null> = {};
  const warnings: string[] = [];
  for (const file of adapter.files(settings)) {
    try {
      files[file.role] = await fetchFile({ repo: config.repo, ref: config.ref, path: file.path });
    } catch (error) {
      if (file.required) throw error;
      files[file.role] = null;
      warnings.push(`${file.role} not read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const snapshot = adapter.parse(files, settings);
  return { ...snapshot, warnings: [...warnings, ...snapshot.warnings] };
}

/** The realm wiki named in the settings, when WikiOS knows it. */
export function settingsWikiSource(settings: Record<string, unknown>): string | null {
  const source = typeof settings.wikiSource === "string" ? settings.wikiSource : null;
  return source && Object.hasOwn(WIKI_SOURCES, source) ? source : null;
}

export function settingsAttribution(settings: Record<string, unknown>): string | null {
  return typeof settings.attribution === "string" && settings.attribution.trim()
    ? settings.attribution.trim()
    : null;
}

/** Load the realm's current state and plan the run. */
export async function buildSyncPlan(
  db: PrismaClient,
  config: SourceSyncConfig,
  snapshot: SourceSnapshot
): Promise<{ plan: SyncPlan; countryNames: Map<string, string> }> {
  const realmId = config.realmId;
  const [countries, pages, features, alliances] = await Promise.all([
    db.country.findMany({
      where: { realmId },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
        externalSourceKey: true,
        wikiPageTitle: true,
        baselinePopulation: true,
        baselineGdpPerCapita: true,
        landArea: true,
        continent: true,
        nationalIdentity: { select: { capitalCity: true, officialName: true } },
      },
    }),
    db.realmPage.findMany({ where: { realmId, kind: "nation" }, select: { title: true } }),
    db.mapLayer.findMany({
      where: { realmId, layerType: "political", isActive: true },
      select: { featureId: true, countryId: true, properties: true },
    }),
    db.alliance.findMany({
      where: { realmId },
      select: {
        id: true,
        name: true,
        shortName: true,
        color: true,
        type: true,
        externalSourceKey: true,
        members: { where: { isActive: true }, select: { countryId: true } },
      },
    }),
  ]);
  const linkedFeatureByCountry: Record<string, string> = {};
  for (const f of features) if (f.countryId) linkedFeatureByCountry[f.countryId] ??= f.featureId;
  const plan = planSourceSync({
    snapshot,
    countries: countries.map(({ nationalIdentity, ...c }) => ({
      ...c,
      capital: nationalIdentity?.capitalCity ?? null,
      officialName: nationalIdentity?.officialName ?? null,
    })),
    rosterPages: pages,
    features: features.map((f) => {
      const hash = (f.properties as { sourceHash?: unknown } | null)?.sourceHash;
      return { featureId: f.featureId, countryId: f.countryId, sourceHash: typeof hash === "string" ? hash : null };
    }),
    alliances: alliances.map(({ members, ...a }) => ({ ...a, activeMemberIds: members.map((m) => m.countryId) })),
    linkedFeatureByCountry,
    options: config.options,
    overrides: config.overrides,
    continentMap: config.continentMap,
    wikiSource: settingsWikiSource(config.settings),
  });
  return { plan, countryNames: new Map(countries.map((c) => [c.id, c.name])) };
}

export interface RunInput {
  realmId: string;
  dryRun: boolean;
  /** Clerk userId, "cron" or "script". */
  triggeredBy: string;
  /** A run row created beforehand (a background apply), else one is created here. */
  runId?: string;
}

export interface RunDeps extends ReadDeps, ApplyDeps {}

/** A new nation's infobox facts, read the way an approved claim reads them (8 s timeout, never throws). */
export async function prefillInfobox(wikiSource: string, title: string): Promise<InfoboxFacts> {
  const prefill = await fetchNationPagePrefill(wikiSource, title);
  return { country: prefill.country, identity: { ...prefill.identity } };
}

/** What production runs use: the real fetch and the wiki infobox reader. */
export const LIVE_RUN_DEPS: RunDeps = { fetchInfobox: prefillInfobox };

export interface RunOutcome {
  runId: string;
  status: "success" | "partial" | "failed";
  summary: SyncSummary | null;
  errors: string[];
}

async function finishRun(
  db: PrismaClient,
  runId: string,
  outcome: Omit<RunOutcome, "runId">,
  config: SourceSyncConfig | null,
  dryRun: boolean
): Promise<RunOutcome> {
  const finishedAt = new Date();
  await db.realmSyncRun.update({
    where: { id: runId },
    data: {
      finishedAt,
      status: outcome.status,
      summary: (outcome.summary ?? undefined) as Prisma.InputJsonValue | undefined,
      errors: outcome.errors,
    },
  });
  // An applied run (even a failed one) moves the schedule on, so a broken source is retried at the next interval.
  if (!dryRun && config)
    await db.realmSourceSync.update({
      where: { realmId: config.realmId },
      data: {
        lastRunAt: finishedAt,
        lastStatus: outcome.status,
        lastSummary: (outcome.summary ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  return { runId, ...outcome };
}

async function executeRun(db: PrismaClient, input: RunInput, runId: string, deps: RunDeps): Promise<RunOutcome> {
  const config = await loadSourceSyncConfig(db, input.realmId);
  if (!config)
    return finishRun(db, runId, { status: "failed", summary: null, errors: ["This realm has no source sync configured"] }, null, true);
  try {
    const realm = await db.realm.findUnique({ where: { id: input.realmId }, select: { slug: true } });
    if (!realm) throw new SourceSyncError("NOT_FOUND", "Realm not found");
    const snapshot = await readSourceSnapshot(config, deps);
    const { plan, countryNames } = await buildSyncPlan(db, config, snapshot);
    const summary: SyncSummary = summarizePlan(plan, countryNames);
    if (input.dryRun) return finishRun(db, runId, { status: "success", summary, errors: [] }, config, true);
    const applied = await applySyncPlan(
      db,
      {
        realmId: input.realmId,
        realmSlug: realm.slug,
        wikiSource: settingsWikiSource(config.settings),
        attribution: settingsAttribution(config.settings),
      },
      plan,
      deps
    );
    return finishRun(
      db,
      runId,
      { status: applied.errors.length > 0 ? "partial" : "success", summary: { ...summary, applied }, errors: applied.errors },
      config,
      false
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return finishRun(db, runId, { status: "failed", summary: null, errors: [reason] }, config, input.dryRun);
  }
}

/**
 * One run of a realm's sync under its lease. A run already holding the lease makes this one fail at once
 * ("already running") instead of waiting or overlapping.
 */
export async function runSourceSync(db: PrismaClient, input: RunInput, deps: RunDeps = {}): Promise<RunOutcome> {
  const runId =
    input.runId ??
    (await db.realmSyncRun.create({
      data: { realmId: input.realmId, dryRun: input.dryRun, triggeredBy: input.triggeredBy },
      select: { id: true },
    })).id;
  const outcome = await withJobLock(db, sourceSyncLockName(input.realmId), () => executeRun(db, input, runId, deps), {
    timeoutMs: SOURCE_SYNC_LOCK_MS,
  });
  if (outcome.ran) return outcome.result;
  return finishRun(
    db,
    runId,
    { status: "failed", summary: null, errors: ["Another run of this realm's sync is in progress"] },
    null,
    true
  );
}

/**
 * An applied run started from the settings page: the run row is created now and returned, and the run goes on
 * in the background (it may read many wiki pages). The page follows it through the run history.
 */
export async function startSourceSyncApply(db: PrismaClient, realmId: string, triggeredBy: string, deps: RunDeps = {}) {
  const config = await loadSourceSyncConfig(db, realmId);
  if (!config) throw new SourceSyncError("BAD_REQUEST", "Save a source first");
  const run = await db.realmSyncRun.create({
    data: { realmId, dryRun: false, triggeredBy },
    select: { id: true },
  });
  void runSourceSync(db, { realmId, dryRun: false, triggeredBy, runId: run.id }, deps).catch((error: unknown) =>
    console.error("[realm-source-sync] background run failed:", error)
  );
  return { runId: run.id };
}

/**
 * The scheduled job: every enabled realm whose interval has passed, one realm at a time (longest overdue
 * first). Returns what it did for the CronRun record.
 */
export async function runDueSourceSyncs(db: PrismaClient, deps: RunDeps = {}, now: Date = new Date()) {
  const syncs = await db.realmSourceSync.findMany({
    where: { enabled: true, intervalHours: { not: null } },
    select: { realmId: true, enabled: true, intervalHours: true, lastRunAt: true },
  });
  const due = dueSyncs(syncs, now);
  const results: Array<{ realmId: string; status: string; runId: string }> = [];
  for (const sync of due) {
    const outcome = await runSourceSync(db, { realmId: sync.realmId, dryRun: false, triggeredBy: "cron" }, deps);
    results.push({ realmId: sync.realmId, status: outcome.status, runId: outcome.runId });
  }
  return { checked: syncs.length, ran: results.length, results };
}

/** The attribution line a realm's map shows, from its source settings; null when none is set. */
export async function realmMapAttribution(db: Pick<PrismaClient, "realm" | "realmSourceSync">, slug: string) {
  const realm = await db.realm.findUnique({ where: { slug }, select: { id: true } });
  if (!realm) return null;
  const row = await db.realmSourceSync.findUnique({ where: { realmId: realm.id }, select: { settings: true } });
  return row ? settingsAttribution((row.settings ?? {}) as Record<string, unknown>) : null;
}
