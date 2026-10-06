/**
 * scripts/audit/wikios-title-duplicates.ts — read-only audit of WikiOS title identity (plan 403)
 *
 * Every WikiOS title has one MediaWiki-canonical form (`canonicalizeTitle`). Rows written before
 * that may differ from it. By default this prints, for `wiki_articles`:
 *   (a) rows whose `title` is not its canonical title (and titles MediaWiki would refuse),
 *   (b) groups of rows that canonicalize to the same title (they need a manual merge),
 *   (c) rows whose `namespace` is not the canonical namespace,
 *   (d) rows with a canonical title whose slug or namespace prefix is wrong.
 *
 * With --emit-sql it instead prints, to stdout and nothing else, the idempotent SQL that fixes
 * every row whose canonical title is free, plus a commented list of the collisions and invalid
 * titles it leaves for manual handling (logs go to stderr):
 *
 *   bun scripts/audit/wikios-title-duplicates.ts --emit-sql > fix.sql   # then review, then apply
 *
 * The script only reads (`findMany`, with the app's read-only guard on), and it only runs against
 * a database at localhost:5433 (the dev DB, or production through its local port): anything else
 * is skipped with a message and exit 0, without connecting.
 *
 * Usage: bun scripts/audit/wikios-title-duplicates.ts [--emit-sql]
 */

import {
  auditTitles,
  renderFixSql,
  type AuditRow,
  type TitleAudit,
} from "../../src/lib/wiki-os/core/title-audit";

const PAGE_SIZE = 5000;
const SAMPLE_LIMIT = 50;
const EMIT_SQL = process.argv.includes("--emit-sql");

/** `host:port` of DATABASE_URL, or null when it is missing or unparsable (never the credentials). */
function databaseHost(): string | null {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}:${url.port || "5432"}`;
  } catch {
    return null;
  }
}

function printRows(heading: string, total: number, lines: string[]): void {
  console.log(`\n## ${heading}: ${total}`);
  for (const line of lines.slice(0, SAMPLE_LIMIT)) console.log(`  ${line}`);
  if (total > SAMPLE_LIMIT) console.log(`  ... and ${total - SAMPLE_LIMIT} more`);
}

const describe = (row: AuditRow): string =>
  `[${row.source}] ${JSON.stringify(row.title)} (${row.id})`;

function printReport(audit: TitleAudit, host: string): void {
  console.log(`Scanned ${audit.scanned} wiki_articles rows on ${host}.`);

  const nonCanonical = [
    ...audit.nonCanonical.map((f) => `${describe(f.row)} -> ${JSON.stringify(f.title)}`),
    ...audit.invalid.map((row) => `${describe(row)} -> not a valid MediaWiki title`),
  ];
  printRows("(a) rows whose title is not canonical", nonCanonical.length, nonCanonical);

  printRows(
    "(b) groups of rows that canonicalize to the same title",
    audit.collisions.length,
    audit.collisions.map(
      (c) =>
        `[${c.source}] ${JSON.stringify(c.title)}: ` +
        c.rows.map((r) => `${JSON.stringify(r.title)} (${r.id})`).join(", ")
    )
  );

  const wrongNamespace = [...audit.nonCanonical, ...audit.misplaced].filter(
    (f) => f.namespace !== f.row.namespace
  );
  printRows(
    "(c) rows whose namespace is not the canonical namespace",
    wrongNamespace.length,
    wrongNamespace.map((f) => `${describe(f.row)} namespace ${f.row.namespace} -> ${f.namespace}`)
  );

  printRows(
    "(d) rows with a canonical title but a wrong slug or namespace prefix",
    audit.misplaced.length,
    audit.misplaced.map(
      (f) =>
        `${describe(f.row)} slug ${JSON.stringify(f.row.slug)} -> ${JSON.stringify(f.slug)}, ` +
        `prefix ${JSON.stringify(f.row.namespacePrefix)} -> ${JSON.stringify(f.namespacePrefix)}`
    )
  );
}

async function readAllRows(): Promise<AuditRow[]> {
  // The app's own write guard, belt and braces on top of this script only calling findMany.
  process.env.DATABASE_READONLY = "true";
  const { db } = await import("~/server/db");

  const rows: AuditRow[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page: AuditRow[] = await db.wikiArticle.findMany({
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        source: true,
        title: true,
        slug: true,
        namespace: true,
        namespacePrefix: true,
      },
    });
    if (page.length === 0) return rows;
    rows.push(...page);
    cursor = page[page.length - 1]?.id;
  }
}

async function main(): Promise<void> {
  // In --emit-sql mode stdout is the SQL file: everything else, the app's logs included, is stderr.
  if (EMIT_SQL) console.log = console.error;

  const host = databaseHost();
  if (host !== "localhost:5433" && host !== "127.0.0.1:5433") {
    console.log(`Skipping: DATABASE_URL points at ${host ?? "no database"}, not localhost:5433.`);
    return;
  }

  const audit = auditTitles(await readAllRows());
  if (EMIT_SQL) {
    const context = `Database ${host}, generated ${new Date().toISOString()}`;
    // Wait for the write to flush: the process exits right after, and a pipe may buffer.
    await new Promise<void>((resolve) =>
      process.stdout.write(renderFixSql(audit, context), () => resolve())
    );
  } else {
    printReport(audit, host);
  }
}

main()
  .catch((err: Error) => {
    console.error(`Audit failed: ${err.message}`);
  })
  .finally(() => process.exit(0));
