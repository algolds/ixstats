/**
 * scripts/wikios-export-xml.ts — write WikiOS pages as a MediaWiki XML dump (plan 408)
 *
 * Usage:
 *   bun scripts/wikios-export-xml.ts [--source ixwiki] [--namespace 0,1,10] [--history] > dump.xml
 *
 * Streams every PUBLISHED page (pages read in batches of 200 by id cursor, revisions in batches of
 * 200) to stdout as export-0.11 XML; progress goes to stderr. Read-only. Without --history each
 * page is its current revision; with it, every stored revision (placeholder history that was never
 * fetched is written as unavailable text). The database guard DATABASE_READONLY is switched on, so
 * nothing here can write. The dump imports into MediaWiki with importDump.php or
 * back into WikiOS with scripts/wikios-import-xml.ts.
 */

const USAGE =
  "Usage: bun scripts/wikios-export-xml.ts [--source ixwiki] [--namespace N,N...] [--history] > dump.xml";

/** Whether the Prisma client was loaded (and so must be closed before exit). */
let databaseLoaded = false;

interface CliArgs {
  source: string;
  namespaces: number[] | undefined;
  history: boolean;
}

function parseArgs(argv: string[]): CliArgs | null {
  const args: CliArgs = { source: "ixwiki", namespaces: undefined, history: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--history") args.history = true;
    else if (arg === "--source") args.source = argv[++i] ?? "";
    else if (arg === "--namespace") {
      const ids = (argv[++i] ?? "").split(",").map((id) => Number(id.trim()));
      if (ids.some((id) => !Number.isInteger(id))) return null;
      args.namespaces = ids;
    } else return null;
  }
  return /^[a-z0-9_-]+$/i.test(args.source) ? args : null;
}

/** Write to stdout and resolve once it has been flushed (back-pressure for a slow consumer). */
const writeStdout = (chunk: string): Promise<void> =>
  new Promise((resolve, reject) => {
    process.stdout.write(chunk, (error) => (error ? reject(error) : resolve()));
  });

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    return 2;
  }
  // Read-only, and it keeps ~/server/db from running its startup writes (achievement sync).
  process.env.DATABASE_READONLY = "true";
  // stdout is the dump and nothing else: the app's own startup logs (console.log) go to stderr.
  console.log = console.error;
  // `| head` closes the pipe early: that is a normal way for an export to end.
  process.stdout.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") process.exit(0);
    throw error;
  });

  databaseLoaded = true;
  const { writeExport } = await import("../src/lib/wiki-os/xml/exporter");
  const pages = await writeExport(writeStdout, {
    source: args.source,
    namespaces: args.namespaces,
    history: args.history,
  });
  console.error(`Exported ${pages} pages.`);
  return 0;
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
    console.error(`Export failed: ${error.message}`);
    process.exit(1);
  });
