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

  it("exports a redirect's target by its canonical title", async () => {
    seedPage({ title: "Old", redirectTargetSlug: "New name" }, [
      { wikitext: "#REDIRECT [[New name]]" },
    ]);

    const [page] = await readXml(
      await exportXml({ source: "ixwiki", titles: ["Old"], history: false })
    );

    expect(page?.redirectTitle).toBe("New name");
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
