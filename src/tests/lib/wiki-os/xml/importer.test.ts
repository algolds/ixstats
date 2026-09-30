/** @jest-environment node */
/**
 * Plan 408: the XML importer against an in-memory stand-in for the WikiOS tables
 * (see fake-wiki-db.ts): fresh import, idempotent re-import, placeholder fill, head rules,
 * redirects, authors, errors, dry run and atomicity.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LinkGraphService } from "~/lib/wiki-os/core/link-graph-service";
import { createExportWriter } from "~/lib/wiki-os/xml/export-writer";
import { readExport, type ImportEvent } from "~/lib/wiki-os/xml/import-reader";
import { importExport, type ImportSummary } from "~/lib/wiki-os/xml/importer";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import type { XmlRevision } from "~/lib/wiki-os/xml/types";
import {
  resetStore,
  snapshotStore,
  store,
  transactionOptions,
  type ArticleRow,
  type RevisionRow,
} from "./fake-wiki-db";

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
const syncLinks = jest.mocked(LinkGraphService.syncArticleLinks);

async function* chunks(text: string): AsyncGenerator<string> {
  yield text;
}

const importXml = (xml: string, options: Parameters<typeof importExport>[1] = {}) =>
  importExport(readExport(chunks(xml)), options);
const importFixture = (options: Parameters<typeof importExport>[1] = {}) =>
  importXml(FIXTURE, options);

const article = (title: string, source = "ixwiki"): ArticleRow => {
  const found = store.articles.find((a) => a.title === title && a.source === source);
  if (!found) throw new Error(`no article ${title}`);
  return found;
};
const revisionsOf = (title: string): RevisionRow[] =>
  store.revisions
    .filter((r) => r.articleId === article(title).id)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

const seedArticle = (overrides: Partial<ArticleRow> = {}): ArticleRow => {
  const row: ArticleRow = {
    id: `seed-article-${store.articles.length + 1}`,
    source: "ixwiki",
    title: "Kingdom of Testia",
    slug: "kingdom_of_testia",
    status: "PUBLISHED",
    format: "WIKITEXT",
    namespace: 0,
    namespacePrefix: null,
    wikitext: "SEEDED",
    contentHtml: "<p>seeded</p>",
    htmlSyncedAt: new Date("2025-01-01T00:00:00Z"),
    summary: null,
    wordCount: 1,
    readingTime: 1,
    mwPageId: null,
    mwLatestRevId: null,
    redirectTargetSlug: null,
    redirectTargetFragment: null,
    protectionLevel: "ALL",
    ...overrides,
  };
  store.articles.push(row);
  return row;
};

const seedRevision = (articleId: string, overrides: Partial<RevisionRow> = {}): RevisionRow => {
  const row: RevisionRow = {
    id: `seed-rev-${store.revisions.length + 1}`,
    articleId,
    source: "ixwiki",
    mwRevId: null,
    author: "Seeder",
    authorId: null,
    summary: null,
    minor: false,
    byteSize: 6,
    byteDelta: 6,
    sha1: null,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    wikitext: "SEEDED",
    format: "WIKITEXT",
    ...overrides,
  };
  store.revisions.push(row);
  return row;
};

const KINGDOM_V2 = "Testia is a [[kingdom]] & <nowiki>more</nowiki>.";

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  transactionOptions.length = 0;
});

describe("fresh import of the export-0.11 fixture", () => {
  let summary: ImportSummary;
  beforeEach(async () => {
    summary = await importFixture();
  });

  it("creates every page and revision and reports it", () => {
    expect(summary).toEqual({
      pages: 5,
      pagesCreated: 5,
      revisionsImported: 7,
      revisionsSkipped: 0,
      placeholdersFilled: 0,
      uploadsSkipped: 1,
      errors: [],
    });
    expect(store.articles.map((a) => a.title)).toEqual([
      "Kingdom of Testia",
      "Testia",
      "Talk:Kingdom of Testia",
      "Template:Infobox testia",
      "File:Testia flag.png",
    ]);
    expect(store.revisions).toHaveLength(7);
  });

  it("keeps each revision's id, time, author, summary and minor flag", () => {
    const [first, second] = revisionsOf("Kingdom of Testia");

    expect(first).toMatchObject({
      mwRevId: 1001,
      author: "Jane",
      authorId: null,
      summary: "Create the page",
      minor: false,
      createdAt: new Date("2026-01-02T03:04:05Z"),
      wikitext: "Testia is a [[kingdom]].",
      byteSize: 24,
      byteDelta: 24,
      sha1: "5m4a1twcqtk8kln29696qjq0i7jb99b",
      source: "ixwiki",
    });
    expect(second).toMatchObject({
      mwRevId: 1002,
      author: "192.0.2.7",
      minor: true,
      byteSize: 48,
      byteDelta: 24,
    });
  });

  it("stores a hidden revision as an empty placeholder with its declared size, author (deleted)", () => {
    const hidden = revisionsOf("Kingdom of Testia")[2];

    expect(hidden).toMatchObject({
      mwRevId: 1003,
      author: "(deleted)",
      authorId: null,
      summary: null,
      wikitext: "",
      byteSize: 54,
      byteDelta: 6,
      sha1: "ih14qtmq7un0xyinywzceva6okr6l5u",
    });
  });

  it("makes the newest revision with text the page's head, and marks it for re-render", () => {
    expect(article("Kingdom of Testia")).toMatchObject({
      wikitext: KINGDOM_V2,
      mwLatestRevId: 1002,
      mwPageId: 101,
      contentHtml: "",
      htmlSyncedAt: null,
      wordCount: 6,
      readingTime: 1,
      namespace: 0,
      namespacePrefix: null,
      status: "PUBLISHED",
      format: "WIKITEXT",
      slug: "kingdom_of_testia",
    });
    expect(article("Kingdom of Testia").summary).toContain("Testia is a kingdom");
  });

  it("stores namespaces from <ns> with the canonical prefix", () => {
    expect(article("Talk:Kingdom of Testia")).toMatchObject({
      namespace: 1,
      namespacePrefix: "Talk",
    });
    expect(article("Template:Infobox testia")).toMatchObject({
      namespace: 10,
      namespacePrefix: "Template",
    });
    expect(article("File:Testia flag.png")).toMatchObject({
      namespace: 6,
      namespacePrefix: "File",
    });
  });

  it("sets redirect fields from <redirect title>", () => {
    expect(article("Testia")).toMatchObject({
      wikitext: "#REDIRECT [[Kingdom of Testia]]",
      redirectTargetSlug: "Kingdom of Testia",
      redirectTargetFragment: null,
    });
    expect(article("Kingdom of Testia").redirectTargetSlug).toBeNull();
  });

  it("maps legacy edit restrictions to a protection level", () => {
    expect(article("Kingdom of Testia").protectionLevel).toBe("SYSOP");
    expect(article("Testia").protectionLevel).toBe("ALL");
  });

  it("syncs the link graph of each page it gave a head, outside the transaction", () => {
    expect(syncLinks).toHaveBeenCalledTimes(5);
    expect(syncLinks).toHaveBeenCalledWith(
      article("Kingdom of Testia").id,
      KINGDOM_V2,
      "",
      "ixwiki"
    );
  });

  it("imports each page in one transaction with room for a long history", () => {
    expect(transactionOptions).toHaveLength(5);
    expect(transactionOptions[0]?.timeout).toBeGreaterThanOrEqual(60_000);
  });

  it("never authors a revision as the importer", () => {
    expect(store.revisions.map((r) => r.author).sort()).toEqual(
      ["(deleted)", "192.0.2.7", "Bob the Builder", "Jane", "Jane", "Jane", "Jane"].sort()
    );
  });
});

describe("re-import", () => {
  it("is a no-op: everything is skipped and nothing changes", async () => {
    await importFixture();
    const before = snapshotStore();
    syncLinks.mockClear();
    store.writes = 0;

    const again = await importFixture();

    expect(again).toEqual({
      pages: 5,
      pagesCreated: 0,
      revisionsImported: 0,
      revisionsSkipped: 7,
      placeholdersFilled: 0,
      uploadsSkipped: 1,
      errors: [],
    });
    expect(snapshotStore()).toEqual(before);
    expect(store.writes).toBe(0);
    expect(syncLinks).not.toHaveBeenCalled();
  });
});

describe("placeholder revisions from scripts/sync-ixwiki-full.ts", () => {
  it("fills an empty revision that carries the same MediaWiki id, and its hash", async () => {
    const seeded = seedArticle({ wikitext: KINGDOM_V2, mwLatestRevId: 1002 });
    seedRevision(seeded.id, {
      mwRevId: 1001,
      wikitext: "",
      byteSize: 24,
      createdAt: new Date("2026-01-02T03:04:05Z"),
    });
    seedRevision(seeded.id, {
      mwRevId: 1002,
      wikitext: KINGDOM_V2,
      byteSize: 48,
      createdAt: new Date("2026-01-03T10:00:00Z"),
    });

    const summary = await importFixture();

    expect(summary).toMatchObject({ placeholdersFilled: 1, pagesCreated: 4, errors: [] });
    const filled = store.revisions.find((r) => r.mwRevId === 1001);
    expect(filled).toMatchObject({
      wikitext: "Testia is a [[kingdom]].",
      sha1: "5m4a1twcqtk8kln29696qjq0i7jb99b",
      byteSize: 24,
    });
    // 1002 was already complete: skipped. 1003 is new (hidden), so it is imported.
    expect(summary.revisionsSkipped).toBeGreaterThanOrEqual(1);
    expect(store.revisions.filter((r) => r.mwRevId === 1002)).toHaveLength(1);
  });

  it("does not turn a filled revision into a duplicate on the next import", async () => {
    const seeded = seedArticle();
    seedRevision(seeded.id, {
      mwRevId: 1001,
      wikitext: "",
      createdAt: new Date("2026-01-02T03:04:05Z"),
    });

    await importFixture();
    const again = await importFixture();

    expect(again).toMatchObject({ revisionsImported: 0, placeholdersFilled: 0, pagesCreated: 0 });
    expect(store.revisions.filter((r) => r.mwRevId === 1001)).toHaveLength(1);
  });
});

describe("the page's head only moves forward", () => {
  it("an older dump does not overwrite a newer head, but still fills in the history", async () => {
    const seeded = seedArticle({ wikitext: "NEWER LOCAL EDIT", mwLatestRevId: 9999 });
    seedRevision(seeded.id, {
      wikitext: "NEWER LOCAL EDIT",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });

    const summary = await importFixture();

    expect(summary.revisionsImported).toBe(7);
    expect(article("Kingdom of Testia")).toMatchObject({
      wikitext: "NEWER LOCAL EDIT",
      mwLatestRevId: 9999,
      contentHtml: "<p>seeded</p>",
    });
    expect(syncLinks).not.toHaveBeenCalledWith(seeded.id, expect.anything(), "", "ixwiki");
    expect(revisionsOf("Kingdom of Testia")).toHaveLength(4);
  });

  it("a newer dump replaces an older head and invalidates its rendering", async () => {
    const seeded = seedArticle({ wikitext: "OLD", mwLatestRevId: 5 });
    seedRevision(seeded.id, { wikitext: "OLD", createdAt: new Date("2025-12-01T00:00:00Z") });

    await importFixture();

    expect(article("Kingdom of Testia")).toMatchObject({
      wikitext: KINGDOM_V2,
      mwLatestRevId: 1002,
      contentHtml: "",
      htmlSyncedAt: null,
      mwPageId: 101,
    });
    expect(syncLinks).toHaveBeenCalledWith(seeded.id, KINGDOM_V2, "", "ixwiki");
  });

  it("leaves an existing protection alone and only protects an unprotected page", async () => {
    seedArticle({ protectionLevel: "PROTECTED" });

    await importFixture();

    expect(article("Kingdom of Testia").protectionLevel).toBe("PROTECTED");
  });

  it("keeps a page's existing MediaWiki page id", async () => {
    seedArticle({ mwPageId: 555 });

    await importFixture();

    expect(article("Kingdom of Testia").mwPageId).toBe(555);
  });
});

describe("WikiOS revisions that MediaWiki also has", () => {
  it("stamps the MediaWiki id on a native revision of the same text and time, without duplicating it", async () => {
    const seeded = seedArticle();
    const native = seedRevision(seeded.id, {
      mwRevId: null,
      wikitext: "Testia is a [[kingdom]].",
      sha1: mwSha1Base36("Testia is a [[kingdom]]."),
      createdAt: new Date("2026-01-02T03:04:05.420Z"),
    });

    const summary = await importFixture();

    expect(native.mwRevId).toBe(1001);
    expect(revisionsOf("Kingdom of Testia")).toHaveLength(3);
    expect(summary.revisionsSkipped).toBe(1);
  });

  it("reports a MediaWiki id that belongs to another page instead of failing or duplicating it", async () => {
    const other = seedArticle({ title: "Moved page", slug: "moved_page" });
    seedRevision(other.id, { mwRevId: 1001, wikitext: "x" });

    const summary = await importFixture();

    expect(summary.revisionsImported).toBe(6);
    expect(summary.errors).toEqual([
      {
        title: "Kingdom of Testia",
        message: "1 revision(s) already belong to another page and were skipped",
      },
    ]);
    expect(store.revisions.filter((r) => r.mwRevId === 1001)).toHaveLength(1);
  });
});

describe("authors", () => {
  it("links a revision to a WikiOS user only through a verified account link, one lookup per name", async () => {
    store.accountLinks.push(
      { source: "ixwiki", username: "Jane", userId: "user-jane", verifiedAt: new Date() },
      { source: "ixwiki", username: "Bob the Builder", userId: "user-bob", verifiedAt: null }
    );
    const { db } = jest.requireMock("~/server/db") as {
      db: { wikiAccountLink: { findMany: (...a: unknown[]) => Promise<unknown> } };
    };
    const lookup = jest.spyOn(db.wikiAccountLink, "findMany");

    await importFixture();

    const byAuthor = (name: string) => store.revisions.filter((r) => r.author === name);
    expect(byAuthor("Jane").every((r) => r.authorId === "user-jane")).toBe(true);
    expect(byAuthor("Bob the Builder")[0]?.authorId).toBeNull();
    expect(byAuthor("192.0.2.7")[0]?.authorId).toBeNull();
    // Page 1 asks for Jane, page 3 for Bob; Jane is cached for pages 2, 4 and 5.
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup.mock.calls[0]?.[0]).toMatchObject({
      where: { source: "ixwiki", username: { in: ["Jane"] }, verifiedAt: { not: null } },
    });
  });
});

describe("redirects", () => {
  async function dumpOf(
    revisions: XmlRevision[],
    redirectTitle: string | null,
    title = "Old name"
  ) {
    let xml = "";
    const writer = createExportWriter((chunk) => {
      xml += chunk;
    });
    await writer.start();
    await writer.page({ title, ns: 0, pageId: 9, redirectTitle, revisions });
    await writer.end();
    return xml;
  }
  const rev = (text: string, overrides: Partial<XmlRevision> = {}): XmlRevision => ({
    id: 1,
    parentId: null,
    timestamp: "2026-01-01T00:00:00Z",
    contributor: { username: "Jane", id: 7 },
    minor: false,
    comment: null,
    model: "wikitext",
    format: "text/x-wiki",
    text,
    ...overrides,
  });

  it("canonicalizes the target and keeps its fragment", async () => {
    await importXml(
      await dumpOf([rev("#REDIRECT [[new_name#Section_one]]")], "new_name#Section_one")
    );

    expect(article("Old name")).toMatchObject({
      redirectTargetSlug: "New name",
      redirectTargetFragment: "Section one",
    });
  });

  it("clears the redirect when a newer head is not a redirect", async () => {
    const seeded = seedArticle({
      title: "Old name",
      slug: "old_name",
      wikitext: "#REDIRECT [[Somewhere]]",
      redirectTargetSlug: "Somewhere",
    });
    seedRevision(seeded.id, { createdAt: new Date("2025-01-01T00:00:00Z") });

    await importXml(await dumpOf([rev("now a real page")], null));

    expect(article("Old name")).toMatchObject({
      wikitext: "now a real page",
      redirectTargetSlug: null,
      redirectTargetFragment: null,
    });
  });
});

describe("pages that cannot be imported", () => {
  const pageXml = (
    title: string,
    ns: string,
    body = "<revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><text>x</text></revision>"
  ) => `<page><title>${title}</title><ns>${ns}</ns><id>1</id>${body}</page>`;
  const dump = (...pages: string[]) => `<mediawiki version="0.11">${pages.join("")}</mediawiki>`;

  it("reports an invalid title and goes on with the next page", async () => {
    const summary = await importXml(
      dump(
        pageXml("Bad|title", "0"),
        pageXml("Good", "0").replace(
          "<id>1</id><revision><id>1</id>",
          "<id>2</id><revision><id>2</id>"
        )
      )
    );

    expect(summary.pages).toBe(2);
    expect(summary.errors).toEqual([{ title: "Bad|title", message: 'Invalid title "Bad|title"' }]);
    expect(store.articles.map((a) => a.title)).toEqual(["Good"]);
  });

  it("rejects a title with a fragment, which MediaWiki never exports", async () => {
    const summary = await importXml(dump(pageXml("Foo#Bar", "0")));

    expect(summary.errors[0]?.message).toMatch(/Invalid title/);
    expect(store.articles).toHaveLength(0);
  });

  it("rejects a namespace that disagrees with the title's prefix", async () => {
    const summary = await importXml(dump(pageXml("Talk:Foo", "0"), pageXml("Bar", "1")));

    expect(summary.errors.map((e) => e.title)).toEqual(["Talk:Foo", "Bar"]);
    expect(summary.errors[0]?.message).toMatch(/Namespace 0 does not match/);
    expect(store.articles).toHaveLength(0);
  });

  it("accepts a namespace the canonical table does not know, keeping MediaWiki's id", async () => {
    await importXml(dump(pageXml("Portal:Foo", "100")));

    expect(article("Portal:Foo")).toMatchObject({ namespace: 100, namespacePrefix: "Portal" });
  });

  it("accepts a colon in a main-namespace title", async () => {
    await importXml(dump(pageXml("Star Wars: Episode One", "0")));

    expect(article("Star Wars: Episode One")).toMatchObject({
      namespace: 0,
      namespacePrefix: null,
    });
  });

  it("rejects a revision with an invalid timestamp, importing nothing of that page", async () => {
    const summary = await importXml(
      dump(
        pageXml(
          "Foo",
          "0",
          "<revision><id>1</id><timestamp>yesterday</timestamp><text>x</text></revision>"
        )
      )
    );

    expect(summary.errors[0]?.message).toMatch(/invalid timestamp/);
    expect(store.articles).toHaveLength(0);
  });

  it("rejects a page with no revisions", async () => {
    const summary = await importXml(dump(pageXml("Foo", "0", "")));

    expect(summary.errors).toEqual([{ title: "Foo", message: "The page has no revisions" }]);
  });

  it("rolls the whole page back when a write fails, and imports the pages after it", async () => {
    const { db } = jest.requireMock("~/server/db") as {
      db: { wikiRevision: { createMany: (...a: unknown[]) => Promise<unknown> } };
    };
    const createMany = db.wikiRevision.createMany;
    const failOnce = jest
      .spyOn(db.wikiRevision, "createMany")
      .mockImplementationOnce(async () => {
        throw new Error("connection reset");
      })
      .mockImplementation(createMany);
    const second = pageXml("Second", "0").replace(
      "<id>1</id><revision><id>1</id>",
      "<id>3</id><revision><id>3</id>"
    );

    const summary = await importXml(dump(pageXml("First", "0"), second));

    expect(failOnce).toHaveBeenCalledTimes(2);
    expect(summary.errors).toEqual([{ title: "First", message: "connection reset" }]);
    // "First"'s article row was created before its revisions failed: the rollback removed it.
    expect(store.articles.map((a) => a.title)).toEqual(["Second"]);
    expect(store.revisions).toHaveLength(1);
  });
});

describe("a malformed dump", () => {
  it("stops at the damage, reports it once, and keeps what was imported before", async () => {
    const truncated = FIXTURE.slice(0, FIXTURE.indexOf("<title>Testia</title>") + 40);

    const summary = await importXml(truncated);

    expect(summary.pages).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]?.title).toBe("(dump)");
    expect(store.articles.map((a) => a.title)).toEqual(["Kingdom of Testia"]);
  });

  it("reports a file that is not an export", async () => {
    const summary = await importXml("<html/>");

    expect(summary.errors[0]).toMatchObject({ title: "(dump)" });
    expect(summary.errors[0]?.message).toMatch(/not a MediaWiki export/i);
  });
});

describe("dry run", () => {
  it("reports what would happen and writes nothing", async () => {
    const summary = await importFixture({ dryRun: true });

    expect(summary).toEqual({
      pages: 5,
      pagesCreated: 5,
      revisionsImported: 7,
      revisionsSkipped: 0,
      placeholdersFilled: 0,
      uploadsSkipped: 1,
      errors: [],
    });
    expect(store.writes).toBe(0);
    expect(store.articles).toHaveLength(0);
    expect(store.revisions).toHaveLength(0);
    expect(syncLinks).not.toHaveBeenCalled();
    expect(transactionOptions).toHaveLength(0);
  });

  it("agrees with the real import that follows it, on a database with existing rows", async () => {
    const seeded = seedArticle();
    seedRevision(seeded.id, {
      mwRevId: 1001,
      wikitext: "",
      createdAt: new Date("2026-01-02T03:04:05Z"),
    });
    const before = snapshotStore();

    const planned = await importFixture({ dryRun: true });

    expect(snapshotStore()).toEqual(before);
    expect(store.writes).toBe(0);
    const real = await importFixture();
    expect(real).toEqual(planned);
  });
});

describe("options", () => {
  it("reports progress after every page with the running summary", async () => {
    const seen: number[] = [];

    await importFixture({ onProgress: (summary) => seen.push(summary.pages) });

    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it("imports another wiki's pages under its own source, with no IxWiki namespaces", async () => {
    await importFixture({ source: "iiwiki" });

    const talk = article("Talk:Kingdom of Testia", "iiwiki");
    expect(talk).toMatchObject({ source: "iiwiki", namespace: 1, namespacePrefix: "Talk" });
    expect(store.revisions.every((r) => r.source === "iiwiki")).toBe(true);
    expect(store.articles.filter((a) => a.source === "ixwiki")).toHaveLength(0);
  });
});

describe("events that are not pages", () => {
  it("ignores siteinfo and counts only pages", async () => {
    const events: ImportEvent[] = [
      {
        type: "siteinfo",
        siteinfo: { sitename: "X", dbname: "x", base: "", generator: "", case: "", namespaces: [] },
      },
    ];
    async function* source() {
      for (const event of events) yield event;
    }

    const summary = await importExport(source());

    expect(summary.pages).toBe(0);
  });
});
