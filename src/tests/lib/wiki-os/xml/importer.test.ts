/** @jest-environment node */
/**
 * Plan 408: the XML importer against an in-memory stand-in for the WikiOS tables (see fake-wiki-db.ts): fresh import,
 * idempotent re-import, placeholder fill, head rules (an older dump or a save that landed meanwhile is never
 * overwritten, a parked revision is never the head), hidden text kept hidden, no author but through a name claim's tag,
 * errors, dry run and atomicity, restrictions; and the revision planner's twin rules.
 */
jest.mock("~/server/db", () => jest.requireActual("./fake-wiki-db").createFakeDbModule());
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/identity/claim-tags", () => ({
  tagRevisionsOfName: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  MediaAssetService: { processContentImages: jest.fn().mockResolvedValue(undefined) },
}));

import { readFileSync } from "node:fs";
import { tagRevisionsOfName } from "~/lib/identity/claim-tags";
import { join } from "node:path";
import { enqueueRender } from "~/lib/wiki-os/services/render-service";
import { notifyWatchers } from "~/lib/wiki-os/services/watchlist-notify";
import { createExportWriter } from "~/lib/wiki-os/xml/export-writer";
import { readExport } from "~/lib/wiki-os/xml/import-reader";
import { importExport, MAX_CONSECUTIVE_WRITE_FAILURES } from "~/lib/wiki-os/xml/importer";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import type { XmlRevision } from "~/lib/wiki-os/xml/types";
import {
  type ArticleRow,
  rawStatements,
  resetStore,
  type RevisionRow,
  snapshotStore,
  store,
  transactionOptions,
} from "./fake-wiki-db";
import {
  type ExistingRevisionRow,
  type ImportedRevision,
  planRevisionImport,
} from "~/lib/wiki-os/xml/revision-plan";

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
  beforeEach(async () => {
    await importFixture();
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

describe("parent revisions (F5)", () => {
  const parentOf = (row: RevisionRow) => row.parentRevisionId ?? null;

  it("sets every imported revision's parent to the live revision before it; the first of a page has none", async () => {
    await importFixture();

    const kingdom = revisionsOf("Kingdom of Testia");
    expect(kingdom).toHaveLength(3);
    expect(kingdom.map(parentOf)).toEqual([null, kingdom[0]!.id, kingdom[1]!.id]);
    // every page of the dump: only its first revision is a creation
    for (const page of store.articles) {
      const rows = store.revisions
        .filter((row) => row.articleId === page.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      expect(rows.filter((row) => parentOf(row) === null)).toHaveLength(1);
      expect(parentOf(rows[0]!)).toBeNull();
    }
  });

  it("chains the dump's revisions onto the page's existing live revisions, never onto a parked one", async () => {
    const seeded = seedArticle({ wikitext: "NEWER LOCAL EDIT", mwLatestRevId: 9999 });
    const early = seedRevision(seeded.id, { createdAt: new Date("2025-06-01T00:00:00Z") });
    const parked = seedRevision(seeded.id, {
      createdAt: new Date("2026-01-02T03:00:00Z"),
      parked: true,
      parkReason: "conflict:x",
    });

    await importFixture();

    const rows = revisionsOf("Kingdom of Testia");
    // early (2025), parked (2026-01-02 03:00), then the dump's three (03:04:05 ...)
    const dump = rows.filter(
      (row) => row.mwRevId !== null && [1001, 1002, 1003].includes(row.mwRevId)
    );
    expect(dump).toHaveLength(3);
    expect(parentOf(dump[0]!)).toBe(early.id);
    expect(parentOf(dump[1]!)).toBe(dump[0]!.id);
    expect(parentOf(dump[2]!)).toBe(dump[1]!.id);
    expect(parentOf(early)).toBeNull();
    expect(parentOf(parked)).toBeNull(); // a parked revision is left as it is
    expect(rows.map(parentOf)).not.toContain(parked.id);
  });
});

describe("a dump whose newest revision blanks the page (the inbound sync's write is this one)", () => {
  it("leaves the page stale with an empty text and an empty, live, unhidden newest revision, and keeps the HTML its old text rendered (the render replaces it)", async () => {
    const seeded = seedArticle({
      wikitext: "Old text.",
      contentHtml: "<p>Old text.</p>",
      mwLatestRevId: 5,
    });
    seedRevision(seeded.id, { wikitext: "Old text.", createdAt: new Date("2025-12-01T00:00:00Z") });
    const xml = (() => {
      const chunks: string[] = [];
      const writer = createExportWriter((chunk) => void chunks.push(chunk));
      const blank: XmlRevision = {
        id: 7001,
        parentId: null,
        timestamp: "2026-02-03T04:05:06Z",
        contributor: { username: "Blanker", id: null },
        minor: false,
        comment: "blank",
        commentDeleted: false,
        model: "wikitext",
        format: "text/x-wiki",
        text: "",
        textDeleted: false,
      };
      return writer
        .start()
        .then(() =>
          writer.page({ title: "Kingdom of Testia", ns: 0, pageId: 101, revisions: [blank] })
        )
        .then(() => writer.end())
        .then(() => chunks.join(""));
    })();

    const summary = await importXml(await xml);

    expect(summary.revisionsImported).toBe(1);
    expect(article("Kingdom of Testia")).toMatchObject({
      wikitext: "",
      htmlSyncedAt: null,
      contentHtml: "<p>Old text.</p>",
    });
    const newest = revisionsOf("Kingdom of Testia").at(-1)!;
    expect(newest).toMatchObject({ mwRevId: 7001, wikitext: "", byteSize: 0, textDeleted: false });
    expect(newest.parked ?? false).toBe(false);
    expect(enqueueRender).toHaveBeenCalledWith(seeded.id, { background: true });
  });
});

describe("a real import locks the page before it reads it (m6)", () => {
  it("takes the page's row lock first, once per page; a dry run takes none", async () => {
    seedArticle();

    await importFixture({ dryRun: true });
    expect(rawStatements).not.toContain("row lock");

    await importFixture();
    // five pages in the dump: each locked once (the pages the dump creates take the creation lock instead)
    expect(rawStatements.filter((statement) => statement === "row lock")).toHaveLength(5);
    expect(
      rawStatements.filter((statement) => statement.includes("pg_advisory_xact_lock"))
    ).toHaveLength(4);
    expect(rawStatements.filter((statement) => statement.includes("set_config"))).toHaveLength(5);
  });

  it("does not let an older dump head overwrite a save that landed while the import waited for the lock", async () => {
    const seeded = seedArticle({ wikitext: "OLD", mwLatestRevId: 5 });
    seedRevision(seeded.id, { wikitext: "OLD", createdAt: new Date("2025-12-01T00:00:00Z") });
    // a save commits just before the import gets the page's lock: newer than the dump's head (2026-01-02)
    store.onRowLock = (title) => {
      if (title !== "Kingdom of Testia") return;
      seeded.wikitext = "SAVED WHILE WAITING";
      seedRevision(seeded.id, {
        wikitext: "SAVED WHILE WAITING",
        createdAt: new Date("2026-06-01T00:00:00Z"),
      });
    };

    await importFixture();

    // the dump's history is filled in, but its older head did not replace the newer save
    expect(article("Kingdom of Testia").wikitext).toBe("SAVED WHILE WAITING");
    expect(revisionsOf("Kingdom of Testia").map((row) => row.wikitext)).toContain(
      "SAVED WHILE WAITING"
    );
    expect(revisionsOf("Kingdom of Testia")).toHaveLength(5);
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
      editorWikiUsername: "192.0.2.7",
      summary: "typo & <nowiki> fix",
      currentRef: "1002",
    });
  });
  it("leaves an existing protection alone and only protects an unprotected page", async () => {
    seedArticle({ protectionLevel: "PROTECTED" });

    await importFixture();

    expect(article("Kingdom of Testia").protectionLevel).toBe("PROTECTED");
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
});
describe("redirects read from the head's wikitext", () => {
  const redirectDump = (tag: string, text: string) =>
    `<mediawiki><page><title>Duncala city</title><ns>0</ns><id>1</id>${tag}<revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><text xml:space="preserve">${text}</text></revision></page></mediawiki>`;
  it("lets the wikitext win over a disagreeing tag", async () => {
    await importXml(
      redirectDump('<redirect title="Elsewhere#Other" />', "#REDIRECT [[duncala#Geography]]")
    );

    expect(article("Duncala city")).toMatchObject({
      redirectTargetSlug: "Duncala",
      redirectTargetFragment: "Geography",
    });
  });
});

describe("authors", () => {
  it("imports every revision with no WikiOS author, then tags each page's named contributors once", async () => {
    await importFixture();

    expect(store.revisions.every((r) => r.authorId === null)).toBe(true);
    // page by page: Jane; Jane; Bob the Builder; Jane; Jane (twice on the file page, tagged once). No IP, no hidden user.
    expect(
      jest.mocked(tagRevisionsOfName).mock.calls.map(([, source, name]) => `${source}:${name}`)
    ).toEqual([
      "ixwiki:Jane",
      "ixwiki:Jane",
      "ixwiki:Bob the Builder",
      "ixwiki:Jane",
      "ixwiki:Jane",
    ]);
  });

  it("tags nothing on a dry run, nor for a page that was refused", async () => {
    await importFixture({ dryRun: true });
    await importFixture({ canWritePage: () => ({ allowed: false, reason: "no" }) });

    expect(tagRevisionsOfName).not.toHaveBeenCalled();
  });

  it("tags nothing for a dump imported into another wiki: name claims are IxWiki's", async () => {
    await importFixture({ source: "iiwiki" });

    expect(store.revisions.length).toBeGreaterThan(0);
    expect(tagRevisionsOfName).not.toHaveBeenCalled();
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
    textDeleted: false,
    commentDeleted: false,
    ...overrides,
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
  it("rejects a namespace that disagrees with the title's prefix", async () => {
    const summary = await importXml(dump(pageXml("Talk:Foo", "0"), pageXml("Bar", "1")));

    expect(summary.errors.map((e) => e.title)).toEqual(["Talk:Foo", "Bar"]);
    expect(summary.errors[0]?.message).toMatch(/Namespace 0 does not match/);
    expect(store.articles).toHaveLength(0);
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
});

describe("dry run", () => {
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
  it("a page that fails to import leaves no restriction behind", async () => {
    const broken = dumpWith("edit=sysop").replace("2026-01-02T03:04:05Z", "not a timestamp");
    const summary = await importXml(broken);
    expect(summary.errors.length).toBeGreaterThan(0);
    expect(rulesOf("Kingdom of Testia")).toEqual([]);
  });
});

describe("per-page authorization (plan 409: canWritePage)", () => {
  const deny = (reason: string) => ({ allowed: false as const, reason });
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
});

describe("the revision planner's twins", () => {
  const at = (iso: string) => new Date(iso);

  const dump = (overrides: Partial<ImportedRevision> = {}): ImportedRevision => ({
    mwRevId: 10,
    createdAt: at("2026-01-01T00:00:00Z"),
    author: "Jane",
    authorId: null,
    summary: null,
    minor: false,
    byteSize: 5,
    byteDelta: 5,
    sha1: "hash-a",
    wikitext: "hello",
    textDeleted: false,
    commentDeleted: false,
    userDeleted: false,
    ...overrides,
  });

  const row = (overrides: Partial<ExistingRevisionRow> = {}): ExistingRevisionRow => ({
    id: "row-1",
    articleId: "a1",
    mwRevId: 10,
    sha1: "hash-a",
    createdAt: at("2026-01-01T00:00:00Z"),
    isPlaceholder: false,
    ...overrides,
  });

  describe("planRevisionImport", () => {
    it("does not match revisions of the same text a second apart, or with another hash", () => {
      const native = row({ mwRevId: null, createdAt: at("2026-01-01T00:00:01Z") });
      const other = row({ id: "other", mwRevId: null, sha1: "hash-b" });

      const plan = planRevisionImport("a1", [native, other], [dump({ mwRevId: 77 })]);

      expect(plan.inserts).toHaveLength(1);
      expect(plan.stamps).toEqual([]);
    });

    it("never treats two different MediaWiki revisions as twins", () => {
      const plan = planRevisionImport("a1", [row({ mwRevId: 11 })], [dump({ mwRevId: 12 })]);

      expect(plan.inserts).toHaveLength(1);
    });

    it("claims a twin once: two identical dump revisions do not both match one row", () => {
      const native = row({ id: "native", mwRevId: null });

      const plan = planRevisionImport("a1", [native], [dump({ mwRevId: 1 }), dump({ mwRevId: 2 })]);

      expect(plan.stamps).toEqual([{ rowId: "native", mwRevId: 1 }]);
      expect(plan.inserts.map((r) => r.mwRevId)).toEqual([2]);
    });
    it("skips a rev id repeated inside the dump instead of inserting it twice", () => {
      const plan = planRevisionImport("a1", [], [dump({ mwRevId: 5 }), dump({ mwRevId: 5 })]);

      expect(plan).toMatchObject({ skipped: 1 });
      expect(plan.inserts).toHaveLength(1);
    });
  });
});
