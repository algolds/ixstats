/**
 * scripts/audit/wikios-title-duplicates.ts — read-only audit of WikiOS title identity (plan 403)
 *
 * Every WikiOS title now has one MediaWiki-canonical form (`canonicalizeTitle`). Rows written
 * before that may differ from it. This prints, for `wiki_articles`:
 *   1. rows whose `title` is not its canonical title (and titles MediaWiki would refuse),
 *   2. groups of rows that canonicalize to the same title (they need a manual merge),
 *   3. rows whose `namespace` is not the canonical namespace.
 *
 * It only reads, and it only runs against a local database: if DATABASE_URL does not point at
 * localhost:5433 it prints why and exits 0 without connecting. The fixes live in
 * prisma/manual-migrations/2026-09-30-wikios-canonical-titles.sql (applied by an operator).
 *
 * Usage: bun scripts/audit/wikios-title-duplicates.ts
 */

import { canonicalizeTitle } from "../../src/lib/wiki-os/core/title";

const PAGE_SIZE = 5000;
const SAMPLE_LIMIT = 50;

interface ArticleRow {
  id: string;
  source: string;
  title: string;
  namespace: number;
}

interface Finding {
  row: ArticleRow;
  detail: string;
}

/** `host:port` of DATABASE_URL, or null when it is missing or unparsable (never the credentials). */
function databaseHost(): string | null {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}:${url.port || "5432"}`;
  } catch {
    return null;
  }
}

function printSection(heading: string, total: number, findings: Finding[]): void {
  console.log(`\n## ${heading}: ${total}`);
  for (const { row, detail } of findings.slice(0, SAMPLE_LIMIT)) {
    console.log(`  [${row.source}] ${JSON.stringify(row.title)} (${row.id}) ${detail}`);
  }
  if (total > SAMPLE_LIMIT) console.log(`  ... and ${total - SAMPLE_LIMIT} more`);
}

async function main(): Promise<void> {
  const host = databaseHost();
  if (host !== "localhost:5433" && host !== "127.0.0.1:5433") {
    console.log(`Skipping: DATABASE_URL points at ${host ?? "no database"}, not the local dev DB.`);
    return;
  }

  // The app's own write guard, belt and braces on top of this script only calling findMany.
  process.env.DATABASE_READONLY = "true";
  const { db } = await import("~/server/db");

  const notCanonical: Finding[] = [];
  const wrongNamespace: Finding[] = [];
  const groups = new Map<string, ArticleRow[]>();
  let scanned = 0;

  for (let cursor: string | undefined; ; ) {
    const page: ArticleRow[] = await db.wikiArticle.findMany({
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, source: true, title: true, namespace: true },
    });
    if (page.length === 0) break;
    scanned += page.length;
    cursor = page[page.length - 1]?.id;

    for (const row of page) {
      const canon = canonicalizeTitle(row.title);
      if (!canon) {
        notCanonical.push({ row, detail: "-> not a valid MediaWiki title" });
        continue;
      }
      if (canon.title !== row.title) {
        notCanonical.push({ row, detail: `-> ${JSON.stringify(canon.title)}` });
      }
      if (canon.namespaceId !== row.namespace) {
        wrongNamespace.push({
          row,
          detail: `namespace ${row.namespace} -> ${canon.namespaceId}`,
        });
      }
      const key = `${row.source}\u0000${canon.title}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
  }

  console.log(`Scanned ${scanned} wiki_articles rows on ${host}.`);
  printSection("(a) rows whose title is not canonical", notCanonical.length, notCanonical);

  const duplicates = [...groups.values()].filter((rows) => rows.length > 1);
  console.log(`\n## (b) groups of rows that canonicalize to the same title: ${duplicates.length}`);
  for (const rows of duplicates.slice(0, SAMPLE_LIMIT)) {
    const canon = canonicalizeTitle(rows[0]?.title ?? "");
    console.log(
      `  [${rows[0]?.source}] ${JSON.stringify(canon?.title)}: ` +
        rows.map((r) => `${JSON.stringify(r.title)} (${r.id})`).join(", ")
    );
  }
  if (duplicates.length > SAMPLE_LIMIT) {
    console.log(`  ... and ${duplicates.length - SAMPLE_LIMIT} more`);
  }

  printSection(
    "(c) rows whose namespace is not the canonical namespace",
    wrongNamespace.length,
    wrongNamespace
  );
}

main()
  .catch((err: Error) => {
    console.error(`Audit failed: ${err.message}`);
  })
  .finally(() => process.exit(0));
