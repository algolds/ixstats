/** @jest-environment node */
/**
 * Plan 408: exporting WikiOS pages as XML, and the whole loop: XML dump -> WikiOS tables -> XML
 * dump -> WikiOS tables (an export is a dump WikiOS itself can import without loss).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeExport, contributorOf } from "~/lib/wiki-os/xml/exporter";
import { readExport, type ImportEvent, type ImportPage } from "~/lib/wiki-os/xml/import-reader";
import { importExport } from "~/lib/wiki-os/xml/importer";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import { resetStore, store, type ArticleRow, type RevisionRow } from "./fake-wiki-db";

jest.mock("~/server/db", () => jest.requireActual("./fake-wiki-db").createFakeDbModule());
jest.mock("~/lib/wiki-os/core/link-graph-service", () => ({
  LinkGraphService: { syncArticleLinks: jest.fn().mockResolvedValue(0) },
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  MediaAssetService: { processContentImages: jest.fn().mockResolvedValue(undefined) },
}));

const FIXTURE = readFileSync(
  join(__dirname, "../../../fixtures/xml/mediawiki-export-0.11.xml"),
  "utf8"
);

async function* chunks(text: string): AsyncGenerator<string> {
  yield text;
}

async function collect(source: AsyncIterable<ImportEvent>): Promise<ImportPage[]> {
  const pages: ImportPage[] = [];
  for await (const event of source) if (event.type === "page") pages.push(event.page);
  return pages;
}

async function exportXml(selection: Parameters<typeof writeExport>[1]): Promise<string> {
  let xml = "";
  await writeExport((chunk) => {
    xml += chunk;
  }, selection);
  return xml;
}

const readXml = (xml: string) => collect(readExport(chunks(xml)));

/** The stored tables without generated ids and bookkeeping timestamps, for before/after comparison. */
function tables() {
  const titleOf = (id: string) => store.articles.find((a) => a.id === id)?.title;
  return {
    articles: store.articles
      .map(({ id: _id, updatedAt: _updatedAt, protectionLevel: _protection, ...rest }) => rest)
      .sort((a, b) => a.title.localeCompare(b.title)),
    revisions: store.revisions
      .map(({ id: _id, articleId, ...rest }) => ({ page: titleOf(articleId), ...rest }))
      .sort((a, b) =>
        `${a.page}${a.createdAt.toISOString()}`.localeCompare(
          `${b.page}${b.createdAt.toISOString()}`
        )
      ),
  };
}

const seedPage = (overrides: Partial<ArticleRow>, revisions: Array<Partial<RevisionRow>> = []) => {
  const article: ArticleRow = {
    id: `a${store.articles.length + 1}`,
    source: "ixwiki",
    title: "Page",
    slug: "page",
    status: "PUBLISHED",
    format: "WIKITEXT",
    namespace: 0,
    namespacePrefix: null,
    wikitext: "head text",
    contentHtml: null,
    htmlSyncedAt: null,
    summary: null,
    wordCount: 2,
    readingTime: 1,
    mwPageId: null,
    mwLatestRevId: null,
    redirectTargetSlug: null,
    redirectTargetFragment: null,
    protectionLevel: "ALL",
    updatedAt: new Date("2026-05-05T05:05:05Z"),
    ...overrides,
  };
  store.articles.push(article);
  revisions.forEach((revision, index) =>
    store.revisions.push({
      id: `r${store.revisions.length + 1}`,
      articleId: article.id,
      source: "ixwiki",
      mwRevId: null,
      author: "Jane",
      authorId: null,
      summary: null,
      minor: false,
      textDeleted: false,
      commentDeleted: false,
      userDeleted: false,
      byteSize: 9,
      byteDelta: 9,
      sha1: null,
      createdAt: new Date(Date.UTC(2026, 0, 1 + index)),
      wikitext: "head text",
      format: "WIKITEXT",
      ...revision,
    })
  );
  return article;
};

beforeEach(() => {
  resetStore();
});

describe("contributorOf", () => {
  it("tells an account, an IP (v4 and v6) and a hidden contributor apart", () => {
    expect(contributorOf("Jane Doe")).toEqual({ username: "Jane Doe", id: null });
    expect(contributorOf("192.0.2.7")).toEqual({ ip: "192.0.2.7" });
    expect(contributorOf("2001:db8::1")).toEqual({ ip: "2001:db8::1" });
    expect(contributorOf("(deleted)")).toEqual({ deleted: true });
    expect(contributorOf(null)).toEqual({ deleted: true });
  });
});

describe("writeExport", () => {
  it("writes only PUBLISHED pages, selected by canonical title", async () => {
    seedPage({ title: "Alpha" }, [{}]);
    seedPage({ title: "Beta", status: "DRAFT" }, [{}]);
    seedPage({ title: "Gamma", source: "iiwiki" }, [{}]);

    const pages = await readXml(
      await exportXml({
        source: "ixwiki",
        titles: ["alpha", "Beta", "Gamma", "not a page|"],
        history: false,
      })
    );

    expect(pages.map((p) => p.title)).toEqual(["Alpha"]);
  });

  it("exports a page's head with the attribution of the revision it came from", async () => {
    seedPage({ title: "Alpha", wikitext: "new text", mwPageId: 9, namespace: 0 }, [
      { mwRevId: 1, wikitext: "old text", author: "Old" },
      { mwRevId: 2, wikitext: "new text", author: "192.0.2.1", summary: "tweak", minor: true },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: false })
    );

    expect(page).toMatchObject({ title: "Alpha", id: 9, ns: 0 });
    expect(page?.revisions).toHaveLength(1);
    expect(page?.revisions[0]).toMatchObject({
      id: 2,
      contributor: { ip: "192.0.2.1" },
      comment: "tweak",
      minor: true,
      text: "new text",
    });
  });

  it("does not read the revision hash for a current-only export, only for full history", async () => {
    seedPage({ title: "Alpha" }, [{ mwRevId: 1 }]);
    const { db } = jest.requireMock("~/server/db") as {
      db: {
        wikiRevision: {
          findFirst: (...a: unknown[]) => Promise<unknown>;
          findMany: (...a: unknown[]) => Promise<unknown>;
        };
      };
    };
    const first = jest.spyOn(db.wikiRevision, "findFirst");
    const many = jest.spyOn(db.wikiRevision, "findMany");

    await exportXml({ source: "ixwiki", titles: ["Alpha"], history: false });
    const currentSelect = (first.mock.calls[0]?.[0] as { select: Record<string, boolean> }).select;
    await exportXml({ source: "ixwiki", titles: ["Alpha"], history: true });
    const historySelect = (many.mock.calls[0]?.[0] as { select: Record<string, boolean> }).select;
    first.mockRestore();
    many.mockRestore();

    expect(currentSelect).not.toHaveProperty("sha1");
    expect(historySelect).toHaveProperty("sha1", true);
  });

  it("skips a newer unfilled placeholder when choosing the head's revision", async () => {
    seedPage({ title: "Alpha", wikitext: "real text" }, [
      { mwRevId: 1, wikitext: "real text", author: "Jane" },
      { mwRevId: 2, wikitext: "", byteSize: 500, author: "Bob" },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: false })
    );

    expect(page?.revisions[0]).toMatchObject({
      id: 1,
      contributor: { username: "Jane", id: null },
    });
  });

  it("exports a page with no revision rows from its own fields", async () => {
    seedPage({
      title: "Alpha",
      wikitext: "only text",
      updatedAt: new Date("2026-05-05T05:05:05.900Z"),
    });

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: false })
    );

    expect(page?.revisions[0]).toMatchObject({
      id: null,
      timestamp: "2026-05-05T05:05:05Z",
      contributor: { deleted: true },
      text: "only text",
    });
  });

  it("exports full history oldest first, chaining parent ids and writing placeholders as unavailable text", async () => {
    seedPage({ title: "Alpha" }, [
      { mwRevId: 10, wikitext: "v1" },
      { mwRevId: 11, wikitext: "", byteSize: 123, sha1: "abc" },
      { mwRevId: null, wikitext: "v3" },
      { mwRevId: 13, wikitext: "", byteSize: 0 },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: true })
    );

    expect(page?.revisions.map((r) => [r.id, r.parentId, r.text, r.bytes])).toEqual([
      [10, null, "v1", 2],
      [11, 10, null, 123],
      [null, 11, "v3", 2],
      [13, null, "", 0],
    ]);
    expect(page?.revisions[1]?.sha1).toBe("abc");
  });

  it("exports the head of a page that has no revision rows, in history mode too", async () => {
    seedPage({
      title: "Alpha",
      wikitext: "only text",
      updatedAt: new Date("2026-05-05T05:05:05.900Z"),
    });

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: true })
    );

    expect(page?.revisions).toHaveLength(1);
    expect(page?.revisions[0]).toMatchObject({
      id: null,
      timestamp: "2026-05-05T05:05:05Z",
      contributor: { deleted: true },
      text: "only text",
      textDeleted: false,
    });
  });

  it("does not add the synthetic head when the page has revision rows", async () => {
    seedPage({ title: "Alpha", wikitext: "head" }, [{ mwRevId: 7, wikitext: "head" }]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: true })
    );

    expect(page?.revisions.map((r) => r.id)).toEqual([7]);
  });

  it("writes the content model of the page's title on every revision", async () => {
    seedPage(
      { title: "Module:Foo", wikitext: "return {}", namespace: 828, namespacePrefix: "Module" },
      [{ mwRevId: 1, wikitext: "return {}" }]
    );
    seedPage(
      {
        title: "MediaWiki:Common.css",
        wikitext: "a{}",
        namespace: 8,
        namespacePrefix: "MediaWiki",
      },
      [
        { mwRevId: 2, wikitext: "a{}" },
        { mwRevId: 3, wikitext: "b{}" },
      ]
    );
    seedPage({ title: "Node.js", wikitext: "x" }, [{ mwRevId: 4, wikitext: "x" }]);

    const pages = await readXml(await exportXml({ source: "ixwiki", history: true }));

    const models = (title: string) =>
      pages.find((p) => p.title === title)?.revisions.map((r) => `${r.model} ${r.format}`);
    expect(models("Module:Foo")).toEqual(["Scribunto text/plain"]);
    expect(models("MediaWiki:Common.css")).toEqual(["css text/css", "css text/css"]);
    expect(models("Node.js")).toEqual(["wikitext text/x-wiki"]);
  });

  it("exports a section redirect with its fragment, from the wikitext", async () => {
    seedPage(
      {
        title: "Duncala city",
        wikitext: "#REDIRECT [[Duncala#History of Duncala]]\n[[Category:Redirects]]",
        redirectTargetSlug: "Duncala",
        redirectTargetFragment: "History of Duncala",
      },
      [{ wikitext: "#REDIRECT [[Duncala#History of Duncala]]" }]
    );

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Duncala city"], history: false })
    );

    expect(page?.redirectTitle).toBe("Duncala#History of Duncala");
  });

  it("never exports a redirect the wikitext does not make, whatever stale columns say", async () => {
    seedPage(
      {
        title: "Was redirect",
        wikitext: "now an article",
        redirectTargetSlug: "Old target",
        redirectTargetFragment: "x",
      },
      [{ wikitext: "now an article" }]
    );

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Was redirect"], history: false })
    );

    expect(page?.redirectTitle).toBeNull();
  });

  it("pages through histories longer than one batch", async () => {
    seedPage(
      { title: "Alpha" },
      Array.from({ length: 450 }, (_, i) => ({ mwRevId: i + 1, wikitext: `text ${i}` }))
    );

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: true })
    );

    expect(page?.revisions).toHaveLength(450);
    expect(page?.revisions.map((r) => r.id)).toEqual(Array.from({ length: 450 }, (_, i) => i + 1));
  });

  it("writes deleted text, summaries and authors back as deleted, and unfetched history as unavailable", async () => {
    seedPage({ title: "Alpha" }, [
      { mwRevId: 1, wikitext: "visible" },
      { mwRevId: 2, wikitext: "", textDeleted: true, byteSize: 0, sha1: "gone" },
      {
        mwRevId: 3,
        wikitext: "t",
        commentDeleted: true,
        summary: "never exported",
        userDeleted: true,
        author: "(deleted)",
      },
      { mwRevId: 4, wikitext: "", byteSize: 4096 },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: true })
    );

    const [visible, deleted, hiddenMeta, unfetched] = page?.revisions ?? [];
    expect(visible).toMatchObject({ text: "visible", textDeleted: false });
    // A deleted text with size 0 is still deleted: never a visible empty revision.
    expect(deleted).toMatchObject({ text: null, textDeleted: true, bytes: 0, sha1: "gone" });
    expect(hiddenMeta).toMatchObject({
      text: "t",
      comment: null,
      commentDeleted: true,
      contributor: { deleted: true },
    });
    expect(unfetched).toMatchObject({ text: null, textDeleted: false, bytes: 4096 });
  });

  it("a current-only export never takes a revision with deleted text as the head's", async () => {
    seedPage({ title: "Alpha", wikitext: "real" }, [
      { mwRevId: 1, wikitext: "real", author: "Jane" },
      { mwRevId: 2, wikitext: "", textDeleted: true, byteSize: 0, author: "Bob" },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Alpha"], history: false })
    );

    expect(page?.revisions[0]).toMatchObject({
      id: 1,
      contributor: { username: "Jane", id: null },
    });
  });

  it("exports a redirect's target by its canonical title, read from the wikitext", async () => {
    seedPage({ title: "Old", wikitext: "#REDIRECT [[new_name]]" }, [
      { wikitext: "#REDIRECT [[new_name]]" },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Old"], history: false })
    );

    expect(page?.redirectTitle).toBe("New name");
  });

  it("uses the stored target for another wiki's redirects, fragment included", async () => {
    seedPage(
      {
        title: "Old",
        source: "iiwiki",
        wikitext: "#REDIRECT [[New name#Part]]",
        redirectTargetSlug: "New name",
        redirectTargetFragment: "Part",
      },
      [{ source: "iiwiki", wikitext: "x" }]
    );

    const [page] = await readXml(
      await exportXml({ source: "iiwiki", titles: ["Old"], history: false })
    );

    expect(page?.redirectTitle).toBe("New name#Part");
  });

  it("without titles, exports every published page of the namespaces asked for, in batches", async () => {
    for (let i = 0; i < 450; i++) seedPage({ title: `Page ${i}` }, [{}]);
    seedPage({ title: "Talk:Page 0", namespace: 1, namespacePrefix: "Talk" }, [{}]);

    const all = await readXml(await exportXml({ source: "ixwiki", history: false }));
    const talk = await readXml(
      await exportXml({ source: "ixwiki", namespaces: [1], history: false })
    );

    expect(all).toHaveLength(451);
    expect(new Set(all.map((p) => p.title)).size).toBe(451);
    expect(talk.map((p) => p.title)).toEqual(["Talk:Page 0"]);
  });

  it("resolves with the number of pages written", async () => {
    seedPage({ title: "Alpha" }, [{}]);
    seedPage({ title: "Beta" }, [{}]);

    const written = await writeExport(() => undefined, { source: "ixwiki", history: false });

    expect(written).toBe(2);
  });
});

describe("the loop: import, export, import again", () => {
  it("an export of imported history re-imports to exactly the same pages and revisions", async () => {
    await importExport(readExport(chunks(FIXTURE)));
    const first = tables();
    expect(first.articles).toHaveLength(5);
    expect(first.revisions).toHaveLength(7);
    const xml = await exportXml({ source: "ixwiki", history: true });

    resetStore();
    const summary = await importExport(readExport(chunks(xml)));

    expect(summary.errors).toEqual([]);
    expect(summary).toMatchObject({ pages: 5, pagesCreated: 5, revisionsImported: 7 });
    expect(tables()).toEqual(first);
  });

  it("keeps deleted and never-fetched revisions exactly as they were through export and import", async () => {
    seedPage({ title: "Alpha", wikitext: "visible", mwPageId: 5 }, [
      { mwRevId: 1, wikitext: "visible", sha1: mwSha1Base36("visible"), byteSize: 7 },
      { mwRevId: 2, wikitext: "", textDeleted: true, byteSize: 0 },
      {
        mwRevId: 3,
        wikitext: "x",
        commentDeleted: true,
        summary: null,
        userDeleted: true,
        author: "(deleted)",
        byteSize: 1,
      },
      { mwRevId: 4, wikitext: "", byteSize: 4096 },
    ]);
    const before = tables();
    const xml = await exportXml({ source: "ixwiki", history: true });

    resetStore();
    const summary = await importExport(readExport(chunks(xml)));

    expect(summary).toMatchObject({ revisionsImported: 4, errors: [] });
    const rows = tables().revisions;
    expect(
      rows.map((r) => [
        r.mwRevId,
        r.textDeleted,
        r.commentDeleted,
        r.userDeleted,
        r.wikitext,
        r.byteSize,
      ])
    ).toEqual(
      before.revisions.map((r) => [
        r.mwRevId,
        r.textDeleted,
        r.commentDeleted,
        r.userDeleted,
        r.wikitext,
        r.byteSize,
      ])
    );
    expect(rows.map((r) => [r.mwRevId, r.textDeleted, r.byteSize])).toEqual([
      [1, false, 7],
      [2, true, 0],
      [3, false, 1],
      [4, false, 4096],
    ]);
  });

  it("a section redirect (Duncala#History of Duncala) survives export and import with its fragment", async () => {
    seedPage(
      {
        title: "Duncala city",
        wikitext: "#REDIRECT [[Duncala#History of Duncala]]",
        redirectTargetSlug: "Duncala",
        redirectTargetFragment: "History of Duncala",
        mwPageId: 9,
      },
      [{ mwRevId: 1, wikitext: "#REDIRECT [[Duncala#History of Duncala]]" }]
    );
    seedPage(
      { title: "Plain redirect", wikitext: "#REDIRECT [[Duncala]]", redirectTargetSlug: "Duncala" },
      [{ mwRevId: 2, wikitext: "#REDIRECT [[Duncala]]" }]
    );

    for (const history of [true, false]) {
      const xml = await exportXml({ source: "ixwiki", history });
      expect(xml).toContain('<redirect title="Duncala#History of Duncala" />');
      expect(xml).toContain('<redirect title="Duncala" />');
      const saved = store.articles.map((a) => ({ ...a }));
      const savedRevisions = store.revisions.map((r) => ({ ...r }));

      resetStore();
      await importExport(readExport(chunks(xml)));

      expect(store.articles.find((a) => a.title === "Duncala city")).toMatchObject({
        redirectTargetSlug: "Duncala",
        redirectTargetFragment: "History of Duncala",
      });
      expect(store.articles.find((a) => a.title === "Plain redirect")).toMatchObject({
        redirectTargetSlug: "Duncala",
        redirectTargetFragment: null,
      });

      resetStore();
      store.articles.push(...saved);
      store.revisions.push(...savedRevisions);
    }
  });

  it("importing the export into the database it came from changes nothing", async () => {
    await importExport(readExport(chunks(FIXTURE)));
    const before = tables();
    const xml = await exportXml({ source: "ixwiki", history: true });

    const summary = await importExport(readExport(chunks(xml)));

    expect(summary).toMatchObject({ pagesCreated: 0, revisionsImported: 0, placeholdersFilled: 0 });
    expect(summary.revisionsSkipped).toBe(7);
    expect(tables()).toEqual(before);
  });

  it("a current-only export imports as the same heads", async () => {
    await importExport(readExport(chunks(FIXTURE)));
    const headsOf = () => store.articles.map((a) => [a.title, a.wikitext]).sort();
    const heads = headsOf();
    const xml = await exportXml({ source: "ixwiki", history: false });

    resetStore();
    await importExport(readExport(chunks(xml)));

    expect(headsOf()).toEqual(heads);
    expect(store.revisions).toHaveLength(5);
  });
});
