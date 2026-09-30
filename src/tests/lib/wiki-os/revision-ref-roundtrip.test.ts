/**
 * A history entry's `revid` must fetch that same revision through getRevisionWikitext —
 * diff, undo and rollback all depend on it. Runs the real history → reader path against an
 * in-memory wiki_revisions table.
 */
import { getArticleHistoryShadow } from "~/lib/wiki-os/adapters/mediawiki/article-store";
import { getRevisionWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";

interface MockRevisionRow {
  id: string;
  mwRevId: number | null;
  source: string;
  articleId: string;
  wikitext: string;
  summary: string | null;
  minor: boolean;
  author: string | null;
  authorId: string | null;
  createdAt: Date;
  byteSize: number;
  byteDelta: number;
  format: string;
}

interface MockRevisionWhere {
  id?: string;
  source?: string;
  mwRevId?: number;
}

const mockRow = (
  id: string,
  mwRevId: number | null,
  wikitext: string,
  day: number,
  byteDelta: number
): MockRevisionRow => ({
  id,
  mwRevId,
  source: "ixwiki",
  articleId: "art-1",
  wikitext,
  summary: null,
  minor: false,
  author: "Editor",
  authorId: null,
  createdAt: new Date(Date.UTC(2026, 5, day)),
  byteSize: wikitext.length,
  byteDelta,
  format: "WIKITEXT",
});

// Newest first, as history is ordered: a native WikiOS edit on top of two synced revisions.
const mockRows: MockRevisionRow[] = [
  mockRow("cnativeedit0001", null, "third body, edited in WikiOS", 3, 14),
  mockRow("csyncedrev00002", 5002, "second body", 2, 2),
  mockRow("csyncedrev00001", 5001, "first body", 1, 10),
];

// Both reference kinds must be scoped to IxWiki's revisions (a row id of another wiki is no match).
const mockMatches = (row: MockRevisionRow, where: MockRevisionWhere): boolean =>
  row.source === where.source &&
  (where.id !== undefined ? row.id === where.id : row.mwRevId === where.mwRevId);

jest.mock("~/server/db", () => ({
  db: {
    // History resolves the article first (plan 403); "Foo Bar" is the canonical row for Foo_Bar.
    wikiArticle: { findUnique: async () => ({ id: "art-1", title: "Foo Bar" }) },
    wikiRevision: {
      findMany: async () => mockRows,
      findFirst: async ({ where }: { where: MockRevisionWhere }) => {
        const row = mockRows.find((r) => mockMatches(r, where));
        return row
          ? {
              wikitext: row.wikitext,
              byteSize: row.byteSize,
              mwRevId: row.mwRevId,
              source: row.source,
              createdAt: row.createdAt,
              article: { title: "Foo Bar" },
            }
          : null;
      },
    },
  },
}));

test("every history revid round-trips through getRevisionWikitext", async () => {
  const history = await getArticleHistoryShadow("Foo_Bar", 50);

  expect(history.fromShadow).toBe(true);
  expect(history.revisions.map((r) => r.revid)).toEqual(["cnativeedit0001", "5002", "5001"]);
  expect(history.revisions.map((r) => r.byteDelta)).toEqual([14, 2, 10]);

  for (const [index, entry] of history.revisions.entries()) {
    const row = mockRows[index]!;
    await expect(getRevisionWikitext(entry.revid)).resolves.toEqual({
      wikitext: row.wikitext,
      title: "Foo Bar",
      source: "ixwiki",
      timestamp: row.createdAt.toISOString(),
    });
  }
});

test("an unknown revision reference resolves to null", async () => {
  await expect(getRevisionWikitext("9999")).resolves.toBeNull();
  await expect(getRevisionWikitext("cmissing")).resolves.toBeNull();
});
