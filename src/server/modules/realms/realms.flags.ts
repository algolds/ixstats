/**
 * A realm's nation flags and coats of arms as local files, the way IxWorld's flags are: the image in
 * `public/flags/`, registered in `public/flags/metadata.json`, and `Country.flag` / `Country.coatOfArms` set to
 * `/flags/<file>`. Realm nations otherwise show their wiki's file through the media proxy on every view. The map
 * pipeline's `flags` step and `scripts/realms/localize-realm-flags.ts`.
 *
 * Any realm and any wiki WikiOS reads (IxWiki, IIWiki, AltHistory): each image URL names its wiki (`wiki-image-ref`).
 * Files are `<realm>--<country>.<ext>` and `<realm>--<country>--arms.<ext>`; an SVG becomes a PNG
 * (`wiki-image-download`). A dry run resolves every file on its wiki and lists what an apply would write.
 * Idempotent: an image already under /flags/ is left alone, so a rerun picks up only what failed or what a source
 * sync or claim approval added since. A file the wiki confirms it does not have is cleared (the app then shows its
 * placeholder).
 *
 * Writes `public/flags/` under the process's working directory (the app root). Production serves the standalone
 * build's copy (`.next/standalone/public`, copied by scripts/post-build.sh), so new files are copied there too.
 */
import type { PrismaClient } from "@prisma/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { invalidateCache } from "~/lib/cache";
import {
  downloadWikiImage,
  resolveWikiImages,
  toStoredImage,
  type ResolvedWikiImage,
} from "~/lib/flags/wiki-image-download";
import {
  LOCAL_FLAG_PREFIX,
  localImageFileName,
  planImageLocalization,
  type ImageTask,
} from "~/lib/flags/wiki-image-ref";
import { wikiQuery } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { WIKI_SOURCES, type WikiSource } from "~/lib/wiki-os/config";

const flagsDir = () => path.join(process.cwd(), "public", "flags");
const metadataPath = () => path.join(flagsDir(), "metadata.json");

const MetadataEntry = z.object({ fileName: z.string() }).passthrough();
const MetadataFile = z
  .object({ lastUpdateTime: z.number().optional(), flags: z.record(z.string(), MetadataEntry) })
  .passthrough();
type MetadataFile = z.infer<typeof MetadataFile>;

/** `public/flags/metadata.json`, which `local-flag-cache.server.ts` indexes. */
async function loadMetadata(): Promise<MetadataFile> {
  try {
    return MetadataFile.parse(JSON.parse(await readFile(metadataPath(), "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { flags: {} };
    throw error;
  }
}

async function saveMetadata(metadata: MetadataFile): Promise<void> {
  await writeFile(
    metadataPath(),
    JSON.stringify({ ...metadata, lastUpdateTime: Date.now() }, null, 2)
  );
}

type Resolved = Map<WikiSource, Map<string, ResolvedWikiImage> | string>;

/** Each wiki's files for the tasks, read 20 at a time; a wiki that does not answer gives its reason instead. */
async function resolveAll(tasks: readonly ImageTask[]): Promise<Resolved> {
  const bySource = new Map<WikiSource, string[]>();
  for (const { ref } of tasks)
    bySource.set(ref.source, [...(bySource.get(ref.source) ?? []), ref.fileName]);
  const resolved: Resolved = new Map();
  for (const [source, names] of bySource) {
    try {
      resolved.set(source, await resolveWikiImages((p, s) => wikiQuery(source, p, s), names));
    } catch (error) {
      resolved.set(source, error instanceof Error ? error.message : String(error));
    }
  }
  return resolved;
}

type FlagsDb = Pick<PrismaClient, "country">;

/** Download, store and register one image, then point the country at it. Returns what was written. */
async function localize(
  db: FlagsDb,
  realmSlug: string,
  task: ImageTask,
  file: ResolvedWikiImage,
  metadata: MetadataFile
): Promise<string> {
  const { buffer, via } = await downloadWikiImage(file);
  const stored = await toStoredImage(buffer);
  const fileName = localImageFileName(realmSlug, task.countrySlug, task.field, stored.ext);
  if (!fileName) throw new Error("the realm or country slug has no usable characters");
  await mkdir(flagsDir(), { recursive: true });
  await writeFile(path.join(flagsDir(), fileName), stored.data);
  const wiki = WIKI_SOURCES[task.ref.source];
  metadata.flags[fileName.replace(/\.[^.]+$/, "")] = {
    fileName,
    originalUrl: file.url,
    downloadedAt: Date.now(),
    fileSize: stored.data.byteLength,
    source: { name: wiki.name, baseUrl: wiki.baseUrl, priority: 1 },
  };
  const local = `${LOCAL_FLAG_PREFIX}${fileName}`;
  await db.country.update({
    where: { id: task.countryId },
    data: task.field === "flag" ? { flag: local } : { coatOfArms: local },
  });
  return `${local} (${via}, ${(stored.data.byteLength / 1024).toFixed(1)} KB)`;
}

/** The task's file, or why there is none (its wiki did not answer, or has no such file). */
function fileFor(task: ImageTask, resolved: Resolved): ResolvedWikiImage | string {
  const files = resolved.get(task.ref.source);
  if (typeof files === "string") return files;
  return files?.get(task.ref.fileName) ?? `"${task.ref.fileName}" not found on ${task.ref.source}`;
}

/** The wiki answered and has no such file: the stored address can only ever show a broken image. */
function isMissingOnWiki(task: ImageTask, resolved: Resolved): boolean {
  const files = resolved.get(task.ref.source);
  return typeof files !== "string" && files !== undefined && !files.has(task.ref.fileName);
}

interface FlagLocalizeReport {
  nations: number;
  tasks: number;
  alreadyLocal: number;
  /** What was done or would be done, one line per image. */
  lines: string[];
  failures: string[];
  /** Images an apply writes (dry run) or wrote. */
  localized: number;
  /** Fields cleared (or to clear) because their wiki has no such file. */
  cleared: number;
}

interface RunState {
  db: FlagsDb;
  realmSlug: string;
  apply: boolean;
  resolved: Resolved;
  metadata: MetadataFile;
  report: FlagLocalizeReport;
}

async function runTask(state: RunState, task: ImageTask): Promise<void> {
  const { report, apply } = state;
  const label = `${task.countrySlug} ${task.field}`;
  const file = fileFor(task, state.resolved);
  if (typeof file === "string") {
    const missing = isMissingOnWiki(task, state.resolved);
    if (missing) report.cleared++;
    if (apply && missing) {
      await state.db.country.update({
        where: { id: task.countryId },
        data: task.field === "flag" ? { flag: null } : { coatOfArms: null },
      });
    }
    const note = missing ? (apply ? " (cleared)" : " (would be cleared)") : "";
    report.failures.push(`${label}: ${file}${note}`);
    return;
  }
  if (!apply) {
    const target = localImageFileName(state.realmSlug, task.countrySlug, task.field, "<ext>");
    report.lines.push(
      `${label}: ${task.ref.source} "${task.ref.fileName}" -> ${LOCAL_FLAG_PREFIX}${target}`
    );
    report.localized++;
    return;
  }
  try {
    report.lines.push(
      `${label}: ${await localize(state.db, state.realmSlug, task, file, state.metadata)}`
    );
    report.localized++;
  } catch (error) {
    report.failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Localize (or, without `apply`, plan) the realm's nations' wiki flags and arms. */
export async function localizeRealmFlags(
  db: FlagsDb,
  realm: { id: string; slug: string },
  { apply, progress }: { apply: boolean; progress?: (done: number, total: number) => void }
): Promise<FlagLocalizeReport> {
  const countries = await db.country.findMany({
    where: { realmId: realm.id },
    select: { id: true, slug: true, flag: true, coatOfArms: true },
    orderBy: { name: "asc" },
  });
  const plan = planImageLocalization(countries.map((c) => ({ ...c, slug: c.slug ?? c.id })));
  const report: FlagLocalizeReport = {
    nations: countries.length,
    tasks: plan.tasks.length,
    alreadyLocal: plan.skipped.filter((s) => s.reason === "local").length,
    lines: plan.skipped
      .filter((s) => s.reason !== "local")
      .map((s) => `${s.countrySlug} ${s.field}: left as is (${s.reason})`),
    failures: [],
    localized: 0,
    cleared: 0,
  };
  const state: RunState = {
    db,
    realmSlug: realm.slug,
    apply,
    resolved: await resolveAll(plan.tasks),
    metadata: await loadMetadata(),
    report,
  };
  for (const [i, task] of plan.tasks.entries()) {
    progress?.(i, plan.tasks.length);
    await runTask(state, task);
  }
  if (apply && report.localized > 0) {
    await saveMetadata(state.metadata);
    // Country reads (profiles, lists, the map's country panel) are cached for up to an hour.
    await invalidateCache(["countries.", "geoCore."]);
  }
  return report;
}
