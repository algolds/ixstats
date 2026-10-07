/**
 * Realm source sync from the command line (the same run the admin panel and the realm-source-sync job make).
 * Dry run by default: it prints the diff and records the run; --apply writes.
 *   bun scripts/realms/sync-realm-source.ts --realm eurth [--preset eurth-map]
 *     [--configure --repo <owner/repo> --ref <ref> --format <adapter>] [--source-dir <dir>] [--skip-wiki] [--apply]
 * --preset fills the realm's config from a preset (src/lib/realms/sources/presets); --configure changes the
 * repository, ref or format of a config that already exists. --source-dir reads the source's files from a local
 * checkout instead of GitHub (for testing); --skip-wiki creates new nations without reading their wiki infobox.
 * New nations are unclaimed; nothing is deleted and no claimed nation changes hands.
 */
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { refSchema, repoPathSchema, repoSchema } from "~/lib/realms/sources/config";
import { summaryLines } from "~/lib/realms/sources/summary";
import {
  LIVE_RUN_DEPS,
  loadSourcePreset,
  loadSourceSyncConfig,
  runSourceSync,
  validateSettings,
  type RunDeps,
} from "~/server/modules/realms/realms.source-sync";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

function optionalArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`--${name} needs a value`);
  return value;
}

function arg(name: string): string {
  const value = optionalArg(name);
  if (value === undefined) throw new Error(`missing --${name}`);
  return value;
}

/** Read the source's files from a local directory, never outside it. */
function localFiles(dir: string): RunDeps["fetchFile"] {
  const root = path.resolve(dir);
  return async ({ path: file }) => {
    const relative = repoPathSchema.parse(file);
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`${file} is outside --source-dir`);
    return readFile(full, "utf8");
  };
}

async function configure(realmId: string) {
  const config = await loadSourceSyncConfig(db, realmId);
  if (!config) throw new Error("no source configured yet: load a preset first (--preset <id>) or use /admin/realms");
  const repo = repoSchema.parse(optionalArg("repo") ?? config.repo);
  const ref = refSchema.parse(optionalArg("ref") ?? config.ref);
  const format = optionalArg("format") ?? config.format;
  validateSettings(format, config.settings);
  await db.realmSourceSync.update({ where: { realmId }, data: { repo, ref, format, updatedBy: "script" } });
  console.log(`configured: ${repo}@${ref} (${format})`);
}

async function main() {
  const slug = arg("realm");
  const realm = await db.realm.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!realm) {
    console.error(`no realm with slug "${slug}": create it in /admin/realms first`);
    process.exitCode = 1;
    return;
  }
  const preset = optionalArg("preset");
  if (preset) {
    await loadSourcePreset(db, null, realm.id, preset);
    console.log(`preset ${preset} loaded into ${realm.name}`);
  }
  if (process.argv.includes("--configure")) await configure(realm.id);

  const config = await loadSourceSyncConfig(db, realm.id);
  if (!config) {
    console.error("this realm has no source sync: pass --preset <id>, or configure it in /admin/realms");
    process.exitCode = 1;
    return;
  }
  console.log(apply ? "APPLY mode: writing" : "DRY RUN: pass --apply to write");
  console.log(`realm ${realm.name} (${realm.id}) <- ${config.repo}@${config.ref} (${config.format})`);

  const sourceDir = optionalArg("source-dir");
  const deps: RunDeps = {
    ...(process.argv.includes("--skip-wiki") ? {} : LIVE_RUN_DEPS),
    ...(sourceDir && { fetchFile: localFiles(sourceDir) }),
  };
  const outcome = await runSourceSync(db, { realmId: realm.id, dryRun: !apply, triggeredBy: "script" }, deps);
  if (outcome.summary) for (const line of summaryLines(outcome.summary)) console.log(line);
  for (const error of outcome.errors) console.error(`ERROR ${error}`);
  console.log(`run ${outcome.runId}: ${outcome.status}`);
  if (outcome.status === "failed") process.exitCode = 1;
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
