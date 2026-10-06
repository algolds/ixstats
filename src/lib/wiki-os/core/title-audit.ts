/**
 * title-audit.ts — find the wiki_articles rows whose title identity is not canonical, and write the
 * SQL that fixes them (used by scripts/audit/wikios-title-duplicates.ts).
 *
 * Every rule comes from `canonicalizeTitle` itself, so the fix can never disagree with what the
 * app writes. Pure: it reads rows it is handed and never touches a database.
 */

import { canonicalizeTitle, storedNamespace } from "./title";

export interface AuditRow {
  id: string;
  source: string;
  title: string;
  slug: string;
  namespace: number;
  namespacePrefix: string | null;
}

/** The identity columns a row should carry. */
export interface TitleFix {
  row: AuditRow;
  title: string;
  slug: string;
  namespace: number;
  namespacePrefix: string | null;
}

/** Several rows of one wiki that are the same page once canonicalized. */
export interface TitleCollision {
  source: string;
  title: string;
  rows: AuditRow[];
}

export interface TitleAudit {
  scanned: number;
  /** Titles MediaWiki would refuse: no canonical form exists. */
  invalid: AuditRow[];
  /** Rows whose title is not its canonical title (colliding ones included). */
  nonCanonical: TitleFix[];
  /** Rows with a canonical title but a wrong slug, namespace or prefix. */
  misplaced: TitleFix[];
  collisions: TitleCollision[];
  /** What the SQL changes: every misplaced row, and each non-canonical row whose target is free. */
  fixes: TitleFix[];
}

const byIdentity = (a: TitleFix, b: TitleFix): number =>
  a.row.source.localeCompare(b.row.source) || a.row.title.localeCompare(b.row.title);

export function auditTitles(rows: readonly AuditRow[]): TitleAudit {
  const invalid: AuditRow[] = [];
  const nonCanonical: TitleFix[] = [];
  const misplaced: TitleFix[] = [];
  const claims = new Map<string, TitleFix[]>();

  for (const row of rows) {
    const canon = canonicalizeTitle(row.title, { source: row.source });
    if (!canon) {
      invalid.push(row);
      continue;
    }
    const stored = storedNamespace(canon, row.namespace);
    const fix: TitleFix = {
      row,
      title: canon.title,
      slug: canon.slug,
      namespace: stored.namespaceId,
      namespacePrefix: stored.namespacePrefix,
    };
    const key = `${row.source}\u0000${canon.title}`;
    claims.set(key, [...(claims.get(key) ?? []), fix]);

    if (canon.title !== row.title) nonCanonical.push(fix);
    else if (
      fix.slug !== row.slug ||
      fix.namespace !== row.namespace ||
      fix.namespacePrefix !== row.namespacePrefix
    ) {
      misplaced.push(fix);
    }
  }

  const collisions = [...claims.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      source: group[0]?.row.source ?? "",
      title: group[0]?.title ?? "",
      rows: group.map((fix) => fix.row),
    }));
  const colliding = new Set(collisions.flatMap((c) => c.rows.map((r) => r.id)));
  const fixes = [...misplaced, ...nonCanonical.filter((f) => !colliding.has(f.row.id))].sort(
    byIdentity
  );

  return { scanned: rows.length, invalid, nonCanonical, misplaced, collisions, fixes };
}

/** A SQL string literal (quotes doubled; the output sets standard_conforming_strings = on). */
const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/** A value for a `--` comment: JSON-escaped, so a newline in a title cannot end the comment. */
const commentValue = (value: string): string => JSON.stringify(value);

function updateStatement({ row, title, slug, namespace, namespacePrefix }: TitleFix): string {
  const prefix = namespacePrefix === null ? "NULL" : sqlString(namespacePrefix);
  const free =
    title === row.title
      ? ""
      : `\n   AND NOT EXISTS (SELECT 1 FROM wiki_articles o WHERE o.source = ${sqlString(row.source)} AND o.title = ${sqlString(title)})`;
  return (
    `UPDATE wiki_articles SET title = ${sqlString(title)}, slug = ${sqlString(slug)}, ` +
    `namespace = ${namespace}, "namespacePrefix" = ${prefix}\n` +
    ` WHERE id = ${sqlString(row.id)} AND title = ${sqlString(row.title)}${free};`
  );
}

/**
 * Idempotent SQL that brings each row in `audit.fixes` to its canonical identity. Every UPDATE is
 * guarded by the row's id and its current title (and, for a rename, by the target still being
 * free), so it is safe to re-run and to apply after the data has moved on. Collisions and invalid
 * titles are listed as comments: they need a human (merge the pages, or rename one).
 */
export function renderFixSql(audit: TitleAudit, context: string): string {
  const lines = [
    "-- WikiOS canonical titles (plan 403): generated from canonicalizeTitle(); review, then apply.",
    `-- ${context}`,
    `-- ${audit.scanned} rows scanned: ${audit.fixes.length} statement(s) below, ` +
      `${audit.collisions.length} collision group(s) and ${audit.invalid.length} invalid title(s) ` +
      "left for manual handling (listed at the end, NOT changed).",
    "-- Back up first:  pg_dump -t wiki_articles <database> > wiki_articles.sql",
    "",
    "SET standard_conforming_strings = on;",
    "BEGIN;",
    ...audit.fixes.map(updateStatement),
    "COMMIT;",
    "",
    `-- Collisions: ${audit.collisions.length} (several rows are one page once canonicalized; merge by hand: keep one, move its revisions, delete the rest)`,
    ...audit.collisions.map(
      (c) =>
        `-- [${c.source}] ${commentValue(c.title)}: ` +
        c.rows.map((r) => `${commentValue(r.title)} (${r.id})`).join(", ")
    ),
    "",
    `-- Invalid titles: ${audit.invalid.length} (MediaWiki would refuse these; rename or delete by hand)`,
    ...audit.invalid.map((r) => `-- [${r.source}] ${commentValue(r.title)} (${r.id})`),
    "",
  ];
  return lines.join("\n");
}
