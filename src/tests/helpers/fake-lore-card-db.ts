/**
 * The parts of the database the lore-card generator reads IxWiki through (plan 418), on top of the fake
 * WikiOS tables (`fake-wiki-db`): raw queries answered from the fake `wikiArticle` table, plus empty
 * category, image and asset tables.
 *
 * A raw query that does not name `"status" = 'PUBLISHED'` is answered with deleted pages too, so a test
 * that expects a deleted page to be left out fails when the query forgets to say so.
 */

import { fakeWikiDb } from "./fake-wiki-db";

type Row = Record<string, unknown>;

/** The values a `Prisma.join(...)` embedded in a raw query carries (the titles of an `IN (...)`). */
function joined(values: unknown[]): unknown[] {
  return values.flatMap((value) =>
    typeof value === "object" && value !== null && "values" in value
      ? (value as { values: unknown[] }).values
      : []
  );
}

/** What `db.$queryRaw` answers for the generator's queries, by the shape of the SQL. */
export function loreCardQueryRaw(strings: TemplateStringsArray, ...values: unknown[]): Row[] {
  const sql = strings.join("?");
  const published = sql.includes(`"status" = 'PUBLISHED'`);
  const pages = fakeWikiDb.tables.wikiArticle.rows.filter(
    (row) => !published || row.status === "PUBLISHED"
  );

  // The earliest revisions and the categories of each article: none here.
  if (sql.includes("row_number()")) return [];

  if (sql.includes("octet_length")) {
    const asked = joined(values);
    return pages
      .filter((row) => asked.includes(row.title))
      .map((row) => ({
        id: row.id,
        title: row.title,
        length: 5000,
        head: "Some intro text. [[File:Pic.png]]",
      }));
  }
  // Category members, the main namespace and random pages: every page the table holds.
  return pages.map((row) => ({ title: row.title, head: "Some intro text. [[File:Pic.png]]" }));
}

/** The extra tables, to spread into the `db` a test hands out. */
export function loreCardDbExtras(queryRaw: (...args: never[]) => unknown) {
  return {
    $queryRaw: queryRaw,
    wikiCategoryMember: { findMany: async () => [] },
    wikiImageLink: { findMany: async () => [] },
    wikiAsset: { findMany: async () => [] },
    wikiRevision: { ...fakeWikiDb.tables.wikiRevision, groupBy: async () => [] },
    lorewardUserStats: { findFirst: async () => null },
  };
}
