/** @jest-environment node */
/**
 * Plan 408: the XML importer against an in-memory stand-in for the WikiOS tables
 * (see fake-wiki-db.ts): fresh import, idempotent re-import, placeholder fill, head rules,
 * redirects, authors, errors, dry run and atomicity.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { enqueueRender, invalidateDependents } from "~/lib/wiki-os/services/render-service";
import { notifyWatchers } from "~/lib/wiki-os/services/watchlist-notify";
import { createExportWriter } from "~/lib/wiki-os/xml/export-writer";
import { readExport, type ImportEvent } from "~/lib/wiki-os/xml/import-reader";
import {
  importExport,
  MAX_CONSECUTIVE_WRITE_FAILURES,
  type ImportSummary,
} from "~/lib/wiki-os/xml/importer";
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
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
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
    updatedAt: new Date("2025-01-01T00:00:00Z"),
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
    textDeleted: false,
    commentDeleted: false,
    userDeleted: false,
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
      warnings: [],
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
      textDeleted: true,
      commentDeleted: true,
      userDeleted: true,
      byteSize: 54,
      byteDelta: 6,
      sha1: "ih14qtmq7un0xyinywzceva6okr6l5u",
    });
    // Nothing else in the fixture is deleted.
    expect(store.revisions.filter((r) => r.mwRevId !== 1003)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ textDeleted: false, commentDeleted: false, userDeleted: false }),
      ])
    );
    expect(
      store.revisions.filter((r) => r.textDeleted || r.commentDeleted || r.userDeleted)
    ).toHaveLength(1);
  });

  it("makes the newest revision with text the page's head, and marks it stale and queues its render", () => {
    expect(article("Kingdom of Testia")).toMatchObject({
      wikitext: KINGDOM_V2,
      mwLatestRevId: 1002,
      mwPageId: 101,
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

  it("leaves the link graph, templates and categories of each page it gave a head to the render it queues (plan 406)", () => {
    expect(enqueueRender).toHaveBeenCalledTimes(5);
    expect(enqueueRender).toHaveBeenCalledWith(article("Kingdom of Testia").id, {
      background: true,
    });
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
    jest.mocked(enqueueRender).mockClear();
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
      warnings: [],
    });
    expect(snapshotStore()).toEqual(before);
    expect(store.writes).toBe(0);
    expect(enqueueRender).not.toHaveBeenCalled();
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

  it("never fills a revision whose text an administrator deleted: hidden stays hidden", async () => {
    const seeded = seedArticle();
    const hidden = seedRevision(seeded.id, {
      mwRevId: 1001,
      wikitext: "",
      textDeleted: true,
      byteSize: 24,
      createdAt: new Date("2026-01-02T03:04:05Z"),
    });

    const summary = await importFixture();

    expect(summary.placeholdersFilled).toBe(0);
    expect(hidden).toMatchObject({ wikitext: "", textDeleted: true });
    expect(store.revisions.filter((r) => r.mwRevId === 1001)).toHaveLength(1);
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
    expect(enqueueRender).not.toHaveBeenCalledWith(seeded.id, expect.anything()); // its head did not change: nothing to render
    expect(revisionsOf("Kingdom of Testia")).toHaveLength(4);
  });

  it("a newer dump replaces an older head, marks its rendering stale (the HTML stays until the render lands) and queues the render", async () => {
    const seeded = seedArticle({ wikitext: "OLD", mwLatestRevId: 5 });
    seedRevision(seeded.id, { wikitext: "OLD", createdAt: new Date("2025-12-01T00:00:00Z") });

    await importFixture();

    expect(article("Kingdom of Testia")).toMatchObject({
      wikitext: KINGDOM_V2,
      mwLatestRevId: 1002,
      contentHtml: "<p>seeded</p>",
      htmlSyncedAt: null,
      mwPageId: 101,
    });
    expect(enqueueRender).toHaveBeenCalledWith(seeded.id, { background: true });
  });

  it("marks the pages that transclude a page stale when its head changes (plan 406)", async () => {
    const seeded = seedArticle({ wikitext: "OLD", mwLatestRevId: 5 });
    seedRevision(seeded.id, { wikitext: "OLD", createdAt: new Date("2025-12-01T00:00:00Z") });

    await importFixture();

    expect(invalidateDependents).toHaveBeenCalledWith("Kingdom of Testia", "ixwiki");
  });

  it("does not count a parked revision as the head: a dump's head still replaces an older one (plan 406)", async () => {
    const seeded = seedArticle({ wikitext: "OLD", mwLatestRevId: 5 });
    seedRevision(seeded.id, { wikitext: "OLD", createdAt: new Date("2025-12-01T00:00:00Z") });
    // A MediaWiki edit that did not go live, dated after everything the dump holds.
    seedRevision(seeded.id, {
      mwRevId: 777,
      wikitext: "A CONFLICTING EDIT",
      createdAt: new Date("2030-01-01T00:00:00Z"),
      parked: true,
      parkReason: "conflict:5",
    });

    await importFixture();

    expect(article("Kingdom of Testia").wikitext).toBe(KINGDOM_V2);
  });

  it("does count a newer revision that is not parked", async () => {
    const seeded = seedArticle({ wikitext: "NEWER LOCAL EDIT", mwLatestRevId: 9999 });
    seedRevision(seeded.id, {
      wikitext: "NEWER LOCAL EDIT",
      createdAt: new Date("2030-01-01T00:00:00Z"),
      parked: false,
    });

    await importFixture();

    expect(article("Kingdom of Testia").wikitext).toBe("NEWER LOCAL EDIT");
  });

  it("tells the watchers of an existing page whose head the dump moved, naming the dump's author", async () => {
    const seeded = seedArticle({ wikitext: "OLD", mwLatestRevId: 5 });
    seedRevision(seeded.id, { wikitext: "OLD", createdAt: new Date("2025-12-01T00:00:00Z") });

    await importFixture();

    expect(notifyWatchers).toHaveBeenCalledTimes(1);
    expect(notifyWatchers).toHaveBeenCalledWith({
      kind: "edited",
      articleId: seeded.id,
      title: "Kingdom of Testia",
      editor: "192.0.2.7",
      editorUserId: null,
      summary: "typo & <nowiki> fix",
      currentRef: "1002",
    });
  });

  it("links the diff in the watchers' notification when the caller knows the head the page had (the inbound sync does)", async () => {
    const seeded = seedArticle({ wikitext: "OLD", mwLatestRevId: 5 });
    seedRevision(seeded.id, { wikitext: "OLD", createdAt: new Date("2025-12-01T00:00:00Z") });

    await ArticleRepository.importPageRevisions({
      source: "ixwiki",
      title: "Kingdom of Testia",
      slug: "kingdom_of_testia",
      namespace: 0,
      namespacePrefix: null,
      mwPageId: 101,
      protectionLevel: null,
      restrictions: [],
      revisions: [
        {
          mwRevId: 1002,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          author: "alice",
          authorId: null,
          summary: "edit",
          commentDeleted: false,
          textDeleted: false,
          userDeleted: false,
          minor: false,
          byteSize: 3,
          byteDelta: 3,
          sha1: mwSha1Base36("new"),
          wikitext: "new",
        },
      ],
      head: {
        createdAt: new Date("2026-01-01T00:00:00Z"),
        mwRevId: 1002,
        wikitext: "new",
        summary: null,
        wordCount: 1,
        readingTime: 1,
        redirectTargetSlug: null,
        redirectTargetFragment: null,
      },
      previousRef: "1001",
      dryRun: false,
    });

    expect(notifyWatchers).toHaveBeenCalledWith(
      expect.objectContaining({ previousRef: "1001", currentRef: "1002", editor: "alice" })
    );
  });

  it("tells nobody when the dump creates the pages: nobody watches them yet", async () => {
    await importFixture();

    expect(notifyWatchers).not.toHaveBeenCalled();
  });

  it("tells nobody when the page's head did not change, or on a dry run", async () => {
    const seeded = seedArticle({ wikitext: "NEWER LOCAL EDIT", mwLatestRevId: 9999 });
    seedRevision(seeded.id, {
      wikitext: "NEWER LOCAL EDIT",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    await importFixture();
    expect(notifyWatchers).not.toHaveBeenCalled();

    const older = seedArticle({ title: "Other", slug: "other", wikitext: "OLD" });
    seedRevision(older.id, { wikitext: "OLD", createdAt: new Date("2025-12-01T00:00:00Z") });
    await importFixture({ dryRun: true });
    expect(notifyWatchers).not.toHaveBeenCalled();
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

describe("a page with a long history", () => {
  const longDump = (count: number) =>
    `<mediawiki><page><title>Long page</title><ns>0</ns><id>1</id>${Array.from(
      { length: count },
      (_, i) =>
        `<revision><id>${i + 1}</id><timestamp>2026-01-01T00:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z</timestamp><contributor><username>Jane</username></contributor><text>v${i}</text></revision>`
    ).join("")}</page></mediawiki>`;

  it("re-imports as a no-op even when the page has more rows than a capped read returns", async () => {
    // 2400 revisions: over the 1000-row cap the read-only db guard puts on an unbounded findMany,
    // and over IMPORT_BATCH (500), so inserts and lookups are both chunked.
    const first = await importXml(longDump(2400));
    expect(first).toMatchObject({ revisionsImported: 2400, errors: [] });
    expect(store.revisions).toHaveLength(2400);

    const again = await importXml(longDump(2400));

    expect(again).toMatchObject({
      revisionsImported: 0,
      revisionsSkipped: 2400,
      placeholdersFilled: 0,
      errors: [],
    });
    expect(store.revisions).toHaveLength(2400);
  });

  it("fills placeholders of a long history beyond the capped read", async () => {
    const seeded = seedArticle({ title: "Long page", slug: "long_page" });
    for (let i = 0; i < 1500; i++) {
      seedRevision(seeded.id, {
        mwRevId: i + 1,
        wikitext: "",
        byteSize: 3,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, Math.floor(i / 60) % 60, i % 60)),
      });
    }

    const summary = await importXml(longDump(1500));

    expect(summary).toMatchObject({ placeholdersFilled: 1500, revisionsImported: 0, errors: [] });
    expect(store.revisions.every((r) => r.wikitext !== "")).toBe(true);
  });
});

describe("values a dump may not carry", () => {
  const revXml = (fields: { id?: string; ts?: string; text?: string; extra?: string }) =>
    `<revision><id>${fields.id ?? "1"}</id><timestamp>${fields.ts ?? "2026-01-01T00:00:00Z"}</timestamp>` +
    `${fields.extra ?? ""}<text${fields.text?.startsWith("<") ? "" : ""}>${fields.text ?? "x"}</text></revision>`;
  const pageXml = (title: string, revisions: string, head = "<ns>0</ns><id>1</id>") =>
    `<page><title>${title}</title>${head}${revisions}</page>`;
  const dump = (...pages: string[]) => `<mediawiki>${pages.join("")}</mediawiki>`;
  const good = pageXml("Good page", revXml({ id: "500" }), "<ns>0</ns><id>500</id>");

  it.each([
    "2026-01-02 03:04:05",
    "2026-01-02T03:04:05.000Z",
    "2026-01-02T03:04:05+00:00",
    "2026-02-30T00:00:00Z",
    "yesterday",
    "",
  ])("rejects the timestamp %j and imports the rest of the dump", async (ts) => {
    const summary = await importXml(dump(pageXml("Bad", revXml({ ts })), good));

    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]?.title).toBe("Bad");
    expect(summary.errors[0]?.message).toMatch(/invalid timestamp .*expected YYYY-MM-DDTHH:MM:SSZ/);
    expect(store.articles.map((a) => a.title)).toEqual(["Good page"]);
  });

  it("rejects a revision id that does not fit an integer column, with a readable message", async () => {
    const summary = await importXml(
      dump(
        pageXml("Big", revXml({ id: "99999999999" })),
        pageXml("Neg", revXml({ id: "-7" })),
        good
      )
    );

    expect(summary.errors.map((e) => e.message)).toEqual([
      "The revision id must be a whole number from 0 to 2147483647, not 99999999999",
      "The revision id must be a whole number from 0 to 2147483647, not -7",
    ]);
    expect(store.articles.map((a) => a.title)).toEqual(["Good page"]);
  });

  it("rejects a declared size, page id or namespace that is out of range", async () => {
    const summary = await importXml(
      dump(
        pageXml(
          "BadSize",
          '<revision><id>2</id><timestamp>2026-01-01T00:00:00Z</timestamp><text bytes="-5" deleted="deleted" /></revision>'
        ),
        pageXml(
          "HugeSize",
          '<revision><id>3</id><timestamp>2026-01-01T00:00:00Z</timestamp><text bytes="3000000000" deleted="deleted" /></revision>'
        ),
        pageXml("BadPage", revXml({}), "<ns>0</ns><id>3000000000</id>"),
        pageXml("BadNs", revXml({}), "<ns>-1</ns><id>4</id>"),
        good
      )
    );

    expect(summary.errors.map((e) => e.message)).toEqual([
      "The size of revision 2 must be a whole number from 0 to 2147483647, not -5",
      "The size of revision 3 must be a whole number from 0 to 2147483647, not 3000000000",
      "The page id must be a whole number from 0 to 2147483647, not 3000000000",
      "The namespace must be a whole number from 0 to 2147483647, not -1",
    ]);
    expect(store.articles.map((a) => a.title)).toEqual(["Good page"]);
  });

  it("accepts the largest values that fit", async () => {
    const summary = await importXml(
      dump(pageXml("Edge", revXml({ id: "2147483647" }), "<ns>0</ns><id>2147483647</id>"))
    );

    expect(summary.errors).toEqual([]);
    expect(store.revisions[0]?.mwRevId).toBe(2147483647);
  });
});

describe("hashes and content models", () => {
  const withSha = (sha: string, text = "hello") =>
    `<mediawiki><page><title>Foo</title><ns>0</ns><id>1</id><revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp>` +
    `<text xml:space="preserve">${text}</text><sha1>${sha}</sha1></revision></page></mediawiki>`;

  it("stores the hash computed from the text and warns when the dump's hash disagrees", async () => {
    const summary = await importXml(withSha("notthehashofhello"));

    expect(store.revisions[0]?.sha1).toBe(mwSha1Base36("hello"));
    expect(summary.errors).toEqual([]);
    expect(summary.warnings).toEqual([
      {
        title: "Foo",
        message:
          "1 revision(s) have a sha1 that does not match their text (the recomputed hash is stored)",
      },
    ]);
  });

  it("stays quiet when the dump's hash is right, and needs none", async () => {
    expect((await importXml(withSha(mwSha1Base36("hello")))).warnings).toEqual([]);
    resetStore();
    const noHash = `<mediawiki><page><title>Foo</title><ns>0</ns><revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><text>hello</text></revision></page></mediawiki>`;

    const summary = await importXml(noHash);

    expect(summary.warnings).toEqual([]);
    expect(store.revisions[0]?.sha1).toBe(mwSha1Base36("hello"));
  });

  it("keeps the dump's hash for text that is not available", async () => {
    const hidden = `<mediawiki><page><title>Foo</title><ns>0</ns><revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><text bytes="5" sha1="kept" deleted="deleted" /></revision></page></mediawiki>`;

    const summary = await importXml(hidden);

    expect(summary.warnings).toEqual([]);
    expect(store.revisions[0]).toMatchObject({ sha1: "kept", wikitext: "", textDeleted: true });
  });

  const withModel = (title: string, model: string, ns = 0) =>
    `<mediawiki><page><title>${title}</title><ns>${ns}</ns><revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp>` +
    `<model>${model}</model><text>x</text></revision></page></mediawiki>`;

  it("warns, without failing, when a revision's model is not the one the title implies", async () => {
    const summary = await importXml(withModel("Module:Foo", "wikitext", 828));

    expect(summary.errors).toEqual([]);
    expect(store.articles.map((a) => a.title)).toEqual(["Module:Foo"]);
    expect(summary.warnings).toEqual([
      {
        title: "Module:Foo",
        message:
          'Content model "wikitext" differs from "Scribunto", the model MediaWiki\'s defaults give this title',
      },
    ]);
  });

  it("does not warn when the model matches", async () => {
    expect((await importXml(withModel("Module:Foo", "Scribunto", 828))).warnings).toEqual([]);
    resetStore();
    expect((await importXml(withModel("MediaWiki:Common.css", "css", 8))).warnings).toEqual([]);
  });
});

describe("a WikiOS revision without a hash", () => {
  const TEXT = "Testia is a [[kingdom]].";
  const seedNative = (overrides: Partial<RevisionRow> = {}) => {
    const seeded = seedArticle();
    return seedRevision(seeded.id, {
      mwRevId: null,
      wikitext: TEXT,
      sha1: null,
      byteSize: 24,
      createdAt: new Date("2026-01-02T03:04:05.420Z"),
      ...overrides,
    });
  };

  it("is hashed from its text, matched to the dump's revision and stamped, not duplicated", async () => {
    const native = seedNative();

    const summary = await importFixture();

    expect(native).toMatchObject({ mwRevId: 1001, sha1: mwSha1Base36(TEXT) });
    expect(revisionsOf("Kingdom of Testia")).toHaveLength(3);
    expect(summary.revisionsSkipped).toBe(1);
    expect(summary.revisionsImported).toBe(6);
  });

  it("is only hashed in memory on a dry run, which still reports the match", async () => {
    const native = seedNative();
    store.writes = 0;

    const summary = await importFixture({ dryRun: true });

    expect(native).toMatchObject({ mwRevId: null, sha1: null });
    expect(store.writes).toBe(0);
    expect(summary.revisionsSkipped).toBe(1);
    expect(summary.revisionsImported).toBe(6);
  });

  it("gets its hash written back even when nothing matches it", async () => {
    const native = seedNative({
      wikitext: "something else entirely",
      createdAt: new Date("2025-05-05T00:00:00Z"),
    });

    const summary = await importFixture();

    expect(native.sha1).toBe(mwSha1Base36("something else entirely"));
    expect(native.mwRevId).toBeNull();
    expect(summary.revisionsImported).toBe(7);
  });

  it("is not read when it cannot be a twin: rows with a MediaWiki id are matched by id, and deleted rows have no text to hash", async () => {
    const seeded = seedArticle();
    const synced = seedRevision(seeded.id, {
      mwRevId: 1001,
      wikitext: TEXT,
      sha1: null,
      createdAt: new Date("2026-01-02T03:04:05Z"),
    });
    const deleted = seedRevision(seeded.id, {
      mwRevId: null,
      wikitext: "",
      textDeleted: true,
      sha1: null,
      byteSize: 0,
    });

    await importFixture();

    expect(synced.sha1).toBeNull();
    expect(deleted.sha1).toBeNull();
  });
});

describe("redirects read from the head's wikitext", () => {
  const redirectDump = (tag: string, text: string) =>
    `<mediawiki><page><title>Duncala city</title><ns>0</ns><id>1</id>${tag}<revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><text xml:space="preserve">${text}</text></revision></page></mediawiki>`;

  it("takes the section from the wikitext when <redirect title> has none", async () => {
    await importXml(
      redirectDump('<redirect title="Duncala" />', "#REDIRECT [[Duncala#History of Duncala]]")
    );

    expect(article("Duncala city")).toMatchObject({
      redirectTargetSlug: "Duncala",
      redirectTargetFragment: "History of Duncala",
    });
  });

  it("lets the wikitext win over a disagreeing tag", async () => {
    await importXml(
      redirectDump('<redirect title="Elsewhere#Other" />', "#REDIRECT [[duncala#Geography]]")
    );

    expect(article("Duncala city")).toMatchObject({
      redirectTargetSlug: "Duncala",
      redirectTargetFragment: "Geography",
    });
  });

  it("derives the redirect from the wikitext when the dump has no <redirect> element", async () => {
    await importXml(redirectDump("", "#REDIRECT [[Duncala]]"));

    expect(article("Duncala city")).toMatchObject({
      redirectTargetSlug: "Duncala",
      redirectTargetFragment: null,
    });
  });

  it("falls back to <redirect title>, fragment included, for text the redirect rule does not read", async () => {
    await importXml(
      redirectDump('<redirect title="duncala#Part one" />', "Moved: see the section.")
    );

    expect(article("Duncala city")).toMatchObject({
      redirectTargetSlug: "Duncala",
      redirectTargetFragment: "Part one",
    });
  });

  it("stores no redirect for an ordinary page", async () => {
    await importXml(redirectDump("", "Just an article."));

    expect(article("Duncala city")).toMatchObject({
      redirectTargetSlug: null,
      redirectTargetFragment: null,
    });
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

describe("a database that is down or not migrated", () => {
  const goodPage = (n: number) =>
    `<page><title>Page ${n}</title><ns>0</ns><revision><id>${n}</id><timestamp>2026-01-01T00:00:00Z</timestamp><text>x</text></revision></page>`;
  const badPage = (n: number) =>
    `<page><title>Bad|${n}</title><ns>0</ns><revision><timestamp>2026-01-01T00:00:00Z</timestamp><text>x</text></revision></page>`;
  const dump = (...pages: string[]) => `<mediawiki>${pages.join("")}</mediawiki>`;

  const findUnique = () => {
    const { db } = jest.requireMock("~/server/db") as {
      db: { wikiArticle: { findUnique: (...a: unknown[]) => Promise<unknown> } };
    };
    return jest.spyOn(db.wikiArticle, "findUnique");
  };

  it("stops after a run of failed pages instead of failing the whole dump", async () => {
    const broken = findUnique().mockRejectedValue(
      new Error("The column `wiki_revisions.sha1` does not exist in the current database.")
    );

    const pages = Array.from({ length: MAX_CONSECUTIVE_WRITE_FAILURES + 15 }, (_, i) =>
      goodPage(i)
    );
    const summary = await importXml(dump(...pages));
    const calls = broken.mock.calls.length;
    broken.mockRestore();

    expect(calls).toBe(MAX_CONSECUTIVE_WRITE_FAILURES);
    expect(summary.pages).toBe(MAX_CONSECUTIVE_WRITE_FAILURES);
    expect(summary.errors).toHaveLength(MAX_CONSECUTIVE_WRITE_FAILURES + 1);
    expect(summary.errors[MAX_CONSECUTIVE_WRITE_FAILURES]).toMatchObject({ title: "(dump)" });
    expect(summary.errors[MAX_CONSECUTIVE_WRITE_FAILURES]?.message).toMatch(
      /Stopped after 10 pages in a row.*sha1.*migrated/
    );
  });

  it("reports a Prisma failure as the one line that says what went wrong", async () => {
    const broken = findUnique().mockRejectedValue(
      new Error(
        "\nInvalid `client.wikiRevision.findMany()` invocation in\n/app/article-repository.ts:126:37\n\n  123 : [];\n→ 126 ...(await client.wikiRevision.findMany(\nThe column `t0.sha1` does not exist in the current database."
      )
    );

    const summary = await importXml(dump(goodPage(1)));
    broken.mockRestore();

    expect(summary.errors).toEqual([
      { title: "Page 1", message: "The column `t0.sha1` does not exist in the current database." },
    ]);
  });

  it("keeps going after an isolated failure, and malformed pages never count towards stopping", async () => {
    const blip = findUnique().mockRejectedValueOnce(new Error("blip"));

    const summary = await importXml(
      dump(goodPage(1), ...Array.from({ length: 15 }, (_, i) => badPage(i)), goodPage(2))
    );
    blip.mockRestore();

    expect(summary.pages).toBe(17);
    expect(summary.errors.filter((e) => e.title === "(dump)")).toEqual([]);
    expect(summary.errors).toHaveLength(16);
    expect(store.articles.map((a) => a.title)).toEqual(["Page 2"]);
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
      warnings: [],
    });
    expect(store.writes).toBe(0);
    expect(store.articles).toHaveLength(0);
    expect(store.revisions).toHaveLength(0);
    expect(enqueueRender).not.toHaveBeenCalled();
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

describe("legacy <restrictions> become wiki_restrictions rows (plan 409 review)", () => {
  const rulesOf = (title: string) =>
    store.restrictions
      .filter((r) => r.title === title)
      .map((r) => `${r.action}:${r.level}`)
      .sort();
  const dumpWith = (restrictions: string) =>
    FIXTURE.replace(
      "<restrictions>edit=sysop:move=sysop</restrictions>",
      `<restrictions>${restrictions}</restrictions>`
    );

  it("creates the enforced rows (the table the rights engine reads), next to the legacy mirror", async () => {
    await importFixture();

    expect(rulesOf("Kingdom of Testia")).toEqual(["edit:sysop", "move:sysop"]);
    expect(store.restrictions[0]).toMatchObject({
      source: "ixwiki",
      title: "Kingdom of Testia",
      reason: "Imported from a MediaWiki dump",
    });
    expect(article("Kingdom of Testia").protectionLevel).toBe("SYSOP");
    // pages the dump did not protect get none
    expect(rulesOf("Testia")).toEqual([]);
  });

  it("reads edit, move and upload rules, autoconfirmed and sysop levels, and ignores the rest", async () => {
    await importXml(
      dumpWith("edit=autoconfirmed:move=sysop:upload=sysop:create=sysop:delete=sysop")
    );

    expect(rulesOf("Kingdom of Testia")).toEqual([
      "edit:autoconfirmed",
      "move:sysop",
      "upload:sysop",
    ]);
    expect(article("Kingdom of Testia").protectionLevel).toBe("AUTOCONFIRMED");
  });

  it("tightens a level it has no counterpart for to sysop and warns", async () => {
    const summary = await importXml(dumpWith("edit=templateeditor"));

    expect(rulesOf("Kingdom of Testia")).toEqual(["edit:sysop"]);
    expect(summary.warnings).toContainEqual({
      title: "Kingdom of Testia",
      message: "protection edit=templateeditor has no WikiOS counterpart; imported as sysop",
    });
  });

  it("is idempotent and never changes a restriction WikiOS already has", async () => {
    store.restrictions.push({
      source: "ixwiki",
      title: "Kingdom of Testia",
      action: "edit",
      level: "autoconfirmed",
      reason: null,
    });

    await importFixture();
    await importFixture();

    expect(store.restrictions.filter((r) => r.title === "Kingdom of Testia")).toHaveLength(2);
    expect(rulesOf("Kingdom of Testia")).toEqual(["edit:autoconfirmed", "move:sysop"]);
  });

  it("writes none in a dry run, and files another wiki's under its own source", async () => {
    await importFixture({ dryRun: true });
    expect(store.restrictions).toEqual([]);

    await importFixture({ source: "iiwiki" });
    expect(store.restrictions.every((r) => r.source === "iiwiki")).toBe(true);
    expect(store.restrictions).toHaveLength(2);
  });

  it("a page that fails to import leaves no restriction behind", async () => {
    const broken = dumpWith("edit=sysop").replace("2026-01-02T03:04:05Z", "not a timestamp");
    const summary = await importXml(broken);
    expect(summary.errors.length).toBeGreaterThan(0);
    expect(rulesOf("Kingdom of Testia")).toEqual([]);
  });
});

describe("per-page authorization (plan 409: canWritePage)", () => {
  const deny = (reason: string) => ({ allowed: false as const, reason });

  it("skips a page the callback refuses, lists it as a permission error, and imports the rest", async () => {
    const summary = await importFixture({
      canWritePage: (_title, namespaceId) =>
        namespaceId === 10
          ? deny("Only wiki administrators can edit pages in this namespace.")
          : { allowed: true },
    });

    expect(summary.pages).toBe(5);
    expect(summary.pagesCreated).toBe(4);
    expect(summary.errors).toEqual([
      {
        title: "Template:Infobox testia",
        message: "permission: Only wiki administrators can edit pages in this namespace.",
      },
    ]);
    expect(store.articles.map((a) => a.title).sort()).toEqual([
      "File:Testia flag.png",
      "Kingdom of Testia",
      "Talk:Kingdom of Testia",
      "Testia",
    ]);
  });

  it("asks with the canonical title and the stored namespace of every page", async () => {
    const asked: Array<[string, number]> = [];
    await importFixture({
      canWritePage: (title, namespaceId) => {
        asked.push([title, namespaceId]);
        return { allowed: true };
      },
    });

    expect(asked).toEqual([
      ["Kingdom of Testia", 0],
      ["Testia", 0],
      ["Talk:Kingdom of Testia", 1],
      ["Template:Infobox testia", 10],
      ["File:Testia flag.png", 6],
    ]);
  });

  it("writes nothing for a refused page in a dry run either, and does not count it as a write failure", async () => {
    const summary = await importFixture({ dryRun: true, canWritePage: () => deny("no") });

    expect(store.writes).toBe(0);
    expect(summary.pagesCreated).toBe(0);
    expect(summary.errors).toHaveLength(5);
    expect(summary.errors.every((e) => e.message === "permission: no")).toBe(true);
    // a refusal is a rejection, not a database failure: the import never gives up early
    expect(summary.errors.some((e) => e.title === "(dump)")).toBe(false);
  });

  it("writes every page when there is no callback (the operator's command line tools)", async () => {
    const summary = await importFixture();
    expect(summary.errors).toEqual([]);
    expect(store.articles).toHaveLength(5);
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
