/** @jest-environment node */
/**
 * article-head.ts: the article's head columns follow its newest live revision. `repointArticleHead` moves them off a
 * parked (overwritten) revision's text, and leaves a page whose text already is its head's as it is.
 */
import { headFieldsOf, repointArticleHead } from "~/lib/wiki-os/core/article-head";
import { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const fake = createFakeWikiDb({ prisma: true });
const { tables } = fake;
const client = fake.db as never;
const SYNCED = new Date("2026-10-01");

function page(
  wikitext: string,
  revisions: Array<{ wikitext: string; parked: boolean; at: string }>
) {
  const row = tables.wikiArticle.insert({
    title: "Caphiria",
    wikitext,
    summary: "A hand-written excerpt.",
    htmlSyncedAt: SYNCED,
  });
  for (const revision of revisions) {
    tables.wikiRevision.insert({
      articleId: row.id,
      wikitext: revision.wikitext,
      parked: revision.parked,
      createdAt: new Date(revision.at),
    });
  }
  return row;
}

beforeEach(() => fake.reset());

describe("repointArticleHead", () => {
  it("puts the page's text and derived columns on its newest live revision, its view stale", async () => {
    const row = page("Lost text.", [
      { wikitext: "#REDIRECT [[Ixnay]]", parked: false, at: "2026-09-01" },
      { wikitext: "Lost text.", parked: true, at: "2026-10-01" },
    ]);

    await expect(repointArticleHead(client, row.id)).resolves.toBe(true);

    expect(tables.wikiArticle.rows[0]).toMatchObject({
      ...headFieldsOf("#REDIRECT [[Ixnay]]"),
      redirectTargetSlug: "Ixnay",
      htmlSyncedAt: null,
    });
  });

  it("leaves a page whose text is its head's as it is, and one with no live revision", async () => {
    const current = page("Caphiria is a kingdom.", [
      { wikitext: "Caphiria is a kingdom.", parked: false, at: "2026-09-01" },
    ]);
    const bare = page("Old text.", [{ wikitext: "Gone.", parked: true, at: "2026-09-01" }]);

    await expect(repointArticleHead(client, current.id)).resolves.toBe(false);
    await expect(repointArticleHead(client, bare.id)).resolves.toBe(false);

    expect(
      tables.wikiArticle.rows.map((row) => [row.wikitext, row.summary, row.htmlSyncedAt])
    ).toEqual([
      ["Caphiria is a kingdom.", "A hand-written excerpt.", SYNCED],
      ["Old text.", "A hand-written excerpt.", SYNCED],
    ]);
  });
});
