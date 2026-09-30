/**
 * scripts/wikios-import-xml.ts — import a MediaWiki XML dump into WikiOS (plan 408)
 *
 * Usage:
 *   bun scripts/wikios-import-xml.ts <file.xml | file.xml.gz | -> [--source ixwiki] [--dry-run] [--yes]
 *
 * `-` reads the dump from stdin (`zcat dump.xml.gz | bun scripts/wikios-import-xml.ts - --yes`).
 * A name ending in `.gz` is decompressed on the fly. The dump is streamed, never held whole.
 *
 * WRITES to the database in DATABASE_URL: the script prints which one and refuses to run without
 * --yes. With --dry-run it only reads: it reports what an import would do and changes nothing.
 * Importing the same dump twice is a no-op; a full-history dump fills the empty placeholder
 * revisions left by scripts/sync-ixwiki-full.ts. Apply
 * prisma/manual-migrations/2026-09-30-wikios-revision-sha1.sql first.
 *
 * Full-replica backfill (run on the wiki's server, then copy the file):
 *   php maintenance/run.php dumpBackup --full --output=gzip:/tmp/ixwiki.xml.gz
 *   bun scripts/wikios-import-xml.ts /tmp/ixwiki.xml.gz --yes
 */

import { openDumpInput } from "../src/lib/wiki-os/xml/dump-input";

const PROGRESS_EVERY = 100;
const ERRORS_SHOWN = 50;

/** Whether the Prisma client was loaded (and so must be closed before exit). */
let databaseLoaded = false;

interface CliArgs {
  file: string | null;
  source: string;
  dryRun: boolean;
  yes: boolean;
}

const USAGE =
  "Usage: bun scripts/wikios-import-xml.ts <file.xml|file.xml.gz|-> [--source ixwiki] [--dry-run] [--yes]";

function parseArgs(argv: string[]): CliArgs | null {
  const args: CliArgs = { file: null, source: "ixwiki", dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--yes") args.yes = true;
    else if (arg === "--source") args.source = argv[++i] ?? "";
    else if (arg.startsWith("-") && arg !== "-") return null;
    else if (args.file === null) args.file = arg;
    else return null;
  }
  return args.file && /^[a-z0-9_-]+$/i.test(args.source) ? args : null;
}

/** `host:port/database` of DATABASE_URL (never the credentials), or null when unusable. */
function databaseLabel(): string | null {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    return null;
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args?.file) {
    console.error(USAGE);
    return 2;
  }

  const label = databaseLabel();
  console.error(`Database: ${label ?? "DATABASE_URL is not set or not a URL"}`);
  if (!label) return 2;
  if (!args.dryRun && !args.yes) {
    console.error(
      "This imports into the database above. Re-run with --yes to go ahead, or --dry-run to only report."
    );
    return 1;
  }

  // A dry run only reads; this also keeps ~/server/db from running its startup writes
  // (achievement sync). Set before anything loads ~/server/db.
  if (args.dryRun) process.env.DATABASE_READONLY = "true";
  // stdout carries the JSON summary only: the app's own startup logs (console.log) go to stderr.
  console.log = console.error;

  // Loaded only now: nothing connects to the database before the checks above passed.
  databaseLoaded = true;
  const { importExport } = await import("../src/lib/wiki-os/xml/importer");
  const { readExport } = await import("../src/lib/wiki-os/xml/import-reader");

  console.error(
    `${args.dryRun ? "Dry run of" : "Importing"} ${args.file} as source "${args.source}"...`
  );
  const summary = await importExport(readExport(openDumpInput(args.file, process.stdin)), {
    source: args.source,
    dryRun: args.dryRun,
    onProgress: (progress) => {
      if (progress.pages % PROGRESS_EVERY === 0) {
        console.error(
          `  ${progress.pages} pages, ${progress.revisionsImported} revisions imported, ` +
            `${progress.revisionsSkipped} skipped, ${progress.errors.length} problems`
        );
      }
    },
  });

  const { errors, ...counts } = summary;
  process.stdout.write(
    `${JSON.stringify({ dryRun: args.dryRun, ...counts, errorCount: errors.length }, null, 2)}\n`
  );
  for (const error of errors.slice(0, ERRORS_SHOWN)) {
    console.error(`  ! ${error.title}: ${error.message}`);
  }
  if (errors.length > ERRORS_SHOWN) console.error(`  ... and ${errors.length - ERRORS_SHOWN} more`);
  return errors.length > 0 ? 1 : 0;
}

/** Close the Prisma engine before exiting: Bun aborts (exit 134) if the process ends with it open. */
async function disconnect(): Promise<void> {
  if (!databaseLoaded) return;
  const { db } = await import("~/server/db");
  await db.$disconnect();
}

main()
  .then(async (code) => {
    await disconnect();
    process.exit(code);
  })
  .catch((error: Error) => {
    console.error(`Import failed: ${error.message}`);
    process.exit(1);
  });
