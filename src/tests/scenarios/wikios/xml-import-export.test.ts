/** @jest-environment node */
/**
 * Scenario: a wiki administrator moves pages between wikis with Special:Import and Special:Export. The page picks
 * `ixwiki.xml.gz` and sends it to POST /api/wiki/import with the type the import helper chooses; a dry run reports and
 * writes nothing; the sysop's real run imports a module, a template, a talk page, a section redirect and an article
 * with history, and skips the site script and user style pages as permission errors, which an interface administrator
 * then imports. Uploading the same dump again changes nothing. Special:Export builds its query for those titles, GET
 * /api/wiki/export streams the dump with every revision, and importing that export into the same database changes
 * nothing; every page goes out in its title's content model, and the redirect keeps its section.
 *
 * Real routes, import-request and export-request helpers, reader, importer, ArticleRepository's import, exporter and
 * writer, over the importer's in-memory tables (xml/fake-wiki-db.ts). The render the import queues is a spy.
 *
 * Folds:
 * - xml/import-request.test.ts: contentTypeFor sends `.gz` as application/gzip whatever the browser said (and for
 *   `.XML.GZ`), keeps an XML type and makes an empty or odd one application/xml; uploadKind takes the XML and gzip
 *   types and refuses others; DEFAULT_MAX_UPLOAD_BYTES is 9,961,472 and formatLimit words it "10 MB".
 * - xml/export-request.test.ts: parseTitleList splits on line breaks and pipes, trims, drops blanks and repeats;
 *   exportQuery joins the pages with `|` (`&` and `<` survive) and asks for history only when told; pageLimit is 500
 *   current / 50 with history; the URL cap is 7000.
 * - xml/content-model.test.ts: Module: pages (any case, subpages) are Scribunto except `/doc`; MediaWiki: and user
 *   `.css`/`.js`/`.json` pages are css, javascript and json; `Template:Foo.css`, `User:Jane.css`, `Node.js` and
 *   `Help:Module:Foo` stay wikitext.
 * - app/api/wiki-import-route.test.ts: who may (401 before the body is read, 403 importing nothing), dryRun only when
 *   exactly false, 415 for other types, 413 from Content-Length alone and for a chunked or gzip body by the bytes on
 *   the wire, a body that is not an export, and the unknown namespace only an administrator may import into.
 * - app/api/wiki-export-route.test.ts: published pages only, a file name a title cannot break, 500 pages (50 with
 *   history, which needs a signed-in user), a realm name for the source, 429 from the bucket, and YAML frontmatter and
 *   Markdown file names a title or slug cannot break out of.
 */
import { gzipSync } from "node:zlib";
import { NextRequest } from "next/server";
import { resetStore, snapshotStore, store } from "~/tests/lib/wiki-os/xml/fake-wiki-db";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/lib/wiki-os/rights", () => ({ getWikiPermissionsForAuthId: jest.fn() }));
jest.mock("~/lib/cache/rate-limiter", () => ({
  rateLimiter: { check: jest.fn().mockResolvedValue({ success: true, remaining: 9, resetAt: new Date() }) },
}));
jest.mock("~/server/db", () => ({
  db: jest.requireActual("~/tests/lib/wiki-os/xml/fake-wiki-db").createFakeDbModule().db,
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({ notifyWatchers: jest.fn().mockResolvedValue(0) }));

import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "node:crypto";
import { GET as importGate, POST as importRoute } from "~/app/api/wiki/import/route";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import type { ArticleRow } from "~/tests/lib/wiki-os/xml/fake-wiki-db";
import { GET as exportRoute } from "~/app/api/wiki/export/route";
import { getWikiPermissionsForAuthId } from "~/lib/wiki-os/rights";
import { enqueueRender } from "~/lib/wiki-os/services/render-service";
import { contentTypeFor, DEFAULT_MAX_UPLOAD_BYTES, formatLimit, uploadKind } from "~/lib/wiki-os/xml/import-request";
import {
  exportQuery,
  MAX_EXPORT_URL_LENGTH,
  pageLimit,
  parseTitleList,
} from "~/lib/wiki-os/xml/export-request";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";

const SYSOP = ["read", "edit", "createpage", "createtalk", "import", "editprotected", "editinterface"];
const INTERFACE = ["editsitecss", "editsitejs", "editsitejson", "editusercss", "edituserjs", "edituserjson"];
const holding = (...rights: string[]) =>
  jest.mocked(getWikiPermissionsForAuthId).mockResolvedValue({
    groups: [],
    rights: new Set(rights),
    block: null,
    ownUserNames: [],
  } as never);

interface DumpRevision {
  id: number;
  at: string;
  user: string;
  comment: string;
  text: string;
  minor?: boolean;
}
interface DumpPage {
  title: string;
  ns: number;
  id: number;
  model?: [string, string];
  redirect?: string;
  revisions: DumpRevision[];
}

const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** A MediaWiki export-0.11 document of `pages`, as Special:Export writes one. */
function dump(pages: DumpPage[]): string {
  const page = ({ title, ns, id, model = ["wikitext", "text/x-wiki"], redirect, revisions }: DumpPage) =>
    `<page><title>${escape(title)}</title><ns>${ns}</ns><id>${id}</id>${redirect ? `<redirect title="${escape(redirect)}" />` : ""}${revisions
      .map(
        (r) =>
          `<revision><id>${r.id}</id><timestamp>${r.at}</timestamp><contributor><username>${r.user}</username><id>1</id></contributor>${r.minor ? "<minor />" : ""}<comment>${escape(r.comment)}</comment><model>${model[0]}</model><format>${model[1]}</format><text bytes="${Buffer.byteLength(r.text)}" xml:space="preserve">${escape(r.text)}</text><sha1>${mwSha1Base36(r.text)}</sha1></revision>`
      )
      .join("")}</page>`;
  return `<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/" version="0.11" xml:lang="en"><siteinfo><sitename>IxWiki</sitename><dbname>ixwiki</dbname><base>https://ixwiki.com/wiki/Main_Page</base><generator>MediaWiki 1.45.1</generator><case>first-letter</case><namespaces><namespace key="0" case="first-letter" /></namespaces></siteinfo>${pages.map(page).join("")}</mediawiki>`;
}

const one = (id: number, text: string, user = "Jane"): DumpRevision[] => [
  { id, at: "2026-03-01T10:00:00Z", user, comment: "create", text },
];
const SCRIBUNTO: [string, string] = ["Scribunto", "text/plain"];
const CSS: [string, string] = ["css", "text/css"];
const JS: [string, string] = ["javascript", "text/javascript"];
const JSON_MODEL: [string, string] = ["json", "application/json"];

const PAGES: DumpPage[] = [
  {
    title: "Caphiria",
    ns: 0,
    id: 1,
    revisions: [
      { id: 101, at: "2026-01-02T03:04:05Z", user: "Jane", comment: "Create the page", text: "Caphiria is a kingdom." },
      { id: 102, at: "2026-01-03T10:00:00Z", user: "Kim", comment: "typo & <nowiki> fix", text: "Caphiria is an empire.", minor: true },
    ],
  },
  { title: "Talk:Caphiria", ns: 1, id: 2, revisions: one(103, "Is it an empire?") },
  {
    title: "Caphirian history",
    ns: 0,
    id: 3,
    redirect: "Caphiria",
    revisions: one(104, "#REDIRECT [[Caphiria#History]]"),
  },
  { title: "Talk:Baz & co", ns: 1, id: 4, revisions: one(105, "Odd title.") },
  { title: "Template:Infobox country", ns: 10, id: 5, revisions: one(106, "{{{name}}}") },
  { title: "Template:Foo.css", ns: 10, id: 6, revisions: one(107, "not a stylesheet") },
  { title: "Module:Flag", ns: 828, id: 7, model: SCRIBUNTO, revisions: one(108, "return {}") },
  { title: "Module:Foo bar/sandbox", ns: 828, id: 8, model: SCRIBUNTO, revisions: one(109, "return 1") },
  { title: "Module:Flag/doc", ns: 828, id: 9, revisions: one(110, "Docs.") },
  { title: "Help:Module:Foo", ns: 12, id: 10, revisions: one(111, "Help.") },
  { title: "Node.js", ns: 0, id: 11, revisions: one(112, "A runtime.") },
  // the pages only an interface administrator may write (WikiOS holds User:Jane.css to that too, a wikitext page)
  { title: "User:Jane.css", ns: 2, id: 12, revisions: one(113, "Jane's page.") },
  { title: "MediaWiki:Common.css", ns: 8, id: 13, model: CSS, revisions: one(114, "body{}") },
  { title: "MediaWiki:Common.js", ns: 8, id: 14, model: JS, revisions: one(115, "void 0;") },
  { title: "MediaWiki:Gadgets/Foo.JSON", ns: 8, id: 15, model: JSON_MODEL, revisions: one(116, "{}") },
  { title: "User:Jane/common.css", ns: 2, id: 16, model: CSS, revisions: one(117, "a{}") },
  { title: "User:Jane/vector.js", ns: 2, id: 17, model: JS, revisions: one(118, "1;") },
  { title: "User:Jane/data.json", ns: 2, id: 18, model: JSON_MODEL, revisions: one(119, "[]") },
];
const INTERFACE_PAGES = PAGES.slice(11).map((page) => page.title);

/** The file the admin picked, as the import page sends it: the helper's type, the bytes as the body. */
function pick(name: string, browserType: string, bytes: Uint8Array<ArrayBuffer>, query = "") {
  const type = contentTypeFor({ name, type: browserType });
  return importRoute(
    new NextRequest(`http://localhost:3000/api/wiki/import${query}`, {
      method: "POST",
      body: bytes,
      headers: { "content-type": type },
    })
  );
}

const exportOf = (titles: string[], history: boolean) =>
  exportRoute(new NextRequest(`http://localhost:3000/api/wiki/export?${exportQuery(titles, history)}`));

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  jest.mocked(auth).mockResolvedValue({ userId: "user_admin" } as never);
  holding(...SYSOP);
});

describe("Special:Import, then Special:Export, then importing the export again", () => {
  it("picks the request type and the size limit the import page shows", () => {
    for (const browserType of ["application/x-gzip", "application/octet-stream", ""]) {
      expect(contentTypeFor({ name: "ixwiki.xml.gz", type: browserType })).toBe("application/gzip");
    }
    expect(contentTypeFor({ name: "ixwiki.XML.GZ", type: "" })).toBe("application/gzip");
    expect(contentTypeFor({ name: "a.xml", type: "text/xml" })).toBe("text/xml");
    expect(contentTypeFor({ name: "a.xml", type: "application/xml" })).toBe("application/xml");
    expect(contentTypeFor({ name: "a.xml", type: "" })).toBe("application/xml");
    expect(contentTypeFor({ name: "a.xml", type: "application/octet-stream" })).toBe("application/xml");
    expect(["application/xml", "text/xml; charset=utf-8", "application/gzip", "application/x-gzip", "text/html"].map(uploadKind)).toEqual([
      "xml",
      "xml",
      "gzip",
      "gzip",
      null,
    ]);
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(9_961_472);
    expect(formatLimit(DEFAULT_MAX_UPLOAD_BYTES)).toBe("10 MB");
  });

  it("imports what the sysop may write, the rest for the interface administrator, and round-trips through the export", async () => {
    const archive = gzipSync(dump(PAGES));

    // a dry run reports what would happen and writes nothing
    const dry = await (await pick("ixwiki.xml.gz", "application/x-gzip", archive)).json();
    expect(dry).toMatchObject({ dryRun: true, pages: PAGES.length, pagesCreated: PAGES.length - INTERFACE_PAGES.length });
    expect(store.articles).toEqual([]);

    // the sysop's import: the site script and user style pages are permission errors, the rest is written
    const real = await (await pick("ixwiki.xml.gz", "application/x-gzip", archive, "?dryRun=false")).json();
    expect(real).toMatchObject({ dryRun: false, pagesCreated: PAGES.length - INTERFACE_PAGES.length, revisionsImported: 12 });
    expect(real.errors.map((error: { title: string; message: string }) => error.title).sort()).toEqual([...INTERFACE_PAGES].sort());
    expect(real.errors.every((error: { message: string }) => error.message.startsWith("permission:"))).toBe(true);
    expect(real.warnings).toEqual([]);

    // revisions keep their id, time, author, summary and minor flag; the head is the newest, stale and queued
    const caphiria = store.articles.find((article) => article.title === "Caphiria")!;
    expect(
      store.revisions
        .filter((row) => row.articleId === caphiria.id)
        .map((row) => [row.mwRevId, row.createdAt.toISOString(), row.author, row.summary, row.minor])
    ).toEqual([
      [101, "2026-01-02T03:04:05.000Z", "Jane", "Create the page", false],
      [102, "2026-01-03T10:00:00.000Z", "Kim", "typo & <nowiki> fix", true],
    ]);
    expect(caphiria).toMatchObject({ wikitext: "Caphiria is an empire.", htmlSyncedAt: null, mwLatestRevId: 102 });
    expect(jest.mocked(enqueueRender)).toHaveBeenCalledWith(caphiria.id, expect.anything());
    expect(store.articles.find((article) => article.title === "Caphirian history")).toMatchObject({
      redirectTargetSlug: "Caphiria",
      redirectTargetFragment: "History",
    });

    // the interface administrator takes the pages the sysop could not
    holding(...SYSOP, ...INTERFACE);
    const rest = await (await pick("ixwiki.xml.gz", "application/gzip", archive, "?dryRun=false")).json();
    expect(rest).toMatchObject({ pagesCreated: INTERFACE_PAGES.length, errors: [] });

    // the same dump again: everything skipped
    const before = snapshotStore();
    const again = await (await pick("ixwiki.xml.gz", "application/gzip", archive, "?dryRun=false")).json();
    expect(again).toMatchObject({ pagesCreated: 0, revisionsImported: 0, revisionsSkipped: PAGES.flatMap((page) => page.revisions).length });
    expect(snapshotStore()).toEqual(before);

    // Special:Export: the form's titles become the query, and the route streams every revision
    const typed = "  Caphiria \n\nCaphirian history|Talk:Baz & co\r\nCaphiria\n | \n";
    expect(parseTitleList(typed)).toEqual(["Caphiria", "Caphirian history", "Talk:Baz & co"]);
    expect(parseTitleList("")).toEqual([]);
    const query = new URLSearchParams(exportQuery([...parseTitleList(typed), "Talk:<x>"], false));
    expect([query.get("format"), query.get("pages"), query.has("history")]).toEqual([
      "xml",
      "Caphiria|Caphirian history|Talk:Baz & co|Talk:<x>",
      false,
    ]);
    expect(new URLSearchParams(exportQuery(["Caphiria"], true)).get("history")).toBe("1");
    expect([pageLimit(false), pageLimit(true), MAX_EXPORT_URL_LENGTH]).toEqual([500, 50, 7000]);

    const titles = PAGES.map((page) => page.title);
    const exported = await exportOf(titles, true);
    expect(exported.status).toBe(200);
    const xml = await exported.text();
    // every page in its title's content model
    const modelOf = (title: string) =>
      new RegExp(`<title>${escape(title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</title>[\\s\\S]*?<model>([^<]+)</model>\\s*<format>([^<]+)</format>`).exec(xml)?.slice(1);
    expect(Object.fromEntries(titles.map((title) => [title, modelOf(title)?.join(" ")]))).toEqual(
      Object.fromEntries(PAGES.map((page) => [page.title, (page.model ?? ["wikitext", "text/x-wiki"]).join(" ")]))
    );
    // the redirect's section, which the dump's <redirect> left out, comes from its text and goes out with it
    expect(xml).toContain('<redirect title="Caphiria#History" />');
    expect(xml).toContain("#REDIRECT [[Caphiria#History]]");
    expect(xml).toContain("<title>Talk:Baz &amp; co</title>");

    // the export imported into the database it came from changes nothing
    const unchanged = snapshotStore();
    const roundTrip = await (await pick("export.xml", "text/xml", new TextEncoder().encode(xml), "?dryRun=false")).json();
    expect(roundTrip).toMatchObject({ pagesCreated: 0, revisionsImported: 0, errors: [] });
    expect(snapshotStore()).toEqual(unchanged);
  });
});

describe("the import route refuses before it writes", () => {
  const MIB = 1024 * 1024;
  const DUMP = dump(PAGES.slice(0, 3));
  /** A POST whose body is `body` (a string, bytes, or a stream: streams have no Content-Length). */
  const post = (
    body: string | Uint8Array | ReadableStream<Uint8Array>,
    { type = "application/xml", query = "", headers = {} }: { type?: string | null; query?: string; headers?: Record<string, string> } = {}
  ) =>
    importRoute(
      new NextRequest(`http://localhost:3000/api/wiki/import${query}`, {
        method: "POST",
        body,
        headers: { ...(type ? { "content-type": type } : {}), ...headers },
        duplex: "half",
      } as ConstructorParameters<typeof NextRequest>[1])
    );
  /** A stream of `count` chunks of `size` bytes that records how many chunks were pulled from it. */
  const countedStream = (count: number, size: number) => {
    const pulled = { chunks: 0 };
    const chunk = new Uint8Array(size).fill(32); // spaces: harmless XML whitespace
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled.chunks >= count) return controller.close();
        pulled.chunks += 1;
        controller.enqueue(chunk);
      },
    });
    return { stream, pulled };
  };

  it("tells the page who may import: 200 with the limit for an administrator, 403 for a member, 401 signed out", async () => {
    const ok = await importGate();
    expect([ok.status, await ok.json()]).toEqual([200, { admin: true, maxBytes: DEFAULT_MAX_UPLOAD_BYTES }]);
    holding("read", "edit");
    expect((await importGate()).status).toBe(403);
    jest.mocked(auth).mockResolvedValue({ userId: null } as never);
    expect((await importGate()).status).toBe(401);
  });

  it("refuses a signed-out caller with 401 before reading the body, and a member with 403, importing nothing", async () => {
    jest.mocked(auth).mockResolvedValue({ userId: null } as never);
    const { stream, pulled } = countedStream(10, 1024);
    expect((await post(stream)).status).toBe(401);
    // (A Request with a stream body primes the stream with one chunk before any handler runs.)
    expect(pulled.chunks).toBeLessThanOrEqual(1);

    jest.mocked(auth).mockResolvedValue({ userId: "user_admin" } as never);
    holding("read", "edit");
    expect((await post(DUMP, { query: "?dryRun=false" })).status).toBe(403);
    expect(store.writes).toBe(0);
    expect(store.articles).toEqual([]);
  });

  it.each(["", "?dryRun=1", "?dryRun=no", "?dryrun=false"])(
    "only reports, writing nothing, unless dryRun is exactly false (%j)",
    async (query) => {
      const body = await (await post(DUMP, { query })).json();
      expect(body).toMatchObject({ dryRun: true, pagesCreated: 3 });
      expect(store.writes).toBe(0);
    }
  );

  it.each([["multipart/form-data; boundary=x"], ["application/json"], ["application/octet-stream"], [null]])(
    "answers 415 to Content-Type %j",
    async (type) => {
      expect((await post(DUMP, { type })).status).toBe(415);
      expect(store.articles).toEqual([]);
    }
  );

  it("refuses an oversized body from Content-Length alone, without reading it", async () => {
    const { stream, pulled } = countedStream(10, 1024);
    expect((await post(stream, { headers: { "content-length": String(200 * MIB) } })).status).toBe(413);
    expect(pulled.chunks).toBeLessThanOrEqual(1);
  });

  it("cuts off a chunked body (no Content-Length) just past the limit, without reading it all", async () => {
    // 1000 MiB offered in 1 MiB chunks: the stream is abandoned just past 9.5 MiB
    const { stream, pulled } = countedStream(1000, MIB);
    const res = await post(stream);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/larger than 9961472 bytes/);
    expect(pulled.chunks).toBeGreaterThanOrEqual(10);
    expect(pulled.chunks).toBeLessThan(15);
  });

  it("cuts off a chunked gzip body the same way, by the bytes on the wire", async () => {
    // a real archive of well-formed XML that does not compress (a comment of random base64), about 14 MiB as sent
    const archive = gzipSync(`<mediawiki><!-- ${randomBytes(14 * MIB).toString("base64")} --></mediawiki>`);
    expect(archive.length).toBeGreaterThan(DEFAULT_MAX_UPLOAD_BYTES);
    let offered = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offered >= archive.length) return controller.close();
        controller.enqueue(archive.subarray(offered, offered + MIB));
        offered += MIB;
      },
    });
    expect((await post(stream, { type: "application/gzip" })).status).toBe(413);
    expect(offered).toBeLessThan(archive.length);
  });

  it("reports a body that is not an export, and a corrupt archive, as a summary error", async () => {
    expect((await (await post("<html/>")).json()).errors[0]).toMatchObject({ title: "(dump)" });
    const corrupt = await post(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), { type: "application/gzip" });
    expect(corrupt.status).toBe(200);
    expect((await corrupt.json()).errors[0]).toMatchObject({ title: "(dump)" });
  });

  it("imports into a namespace the wiki does not know only for an administrator", async () => {
    const portal = dump([{ title: "Portal:Testia", ns: 100, id: 9, revisions: one(901, "A portal.") }]);
    holding("read", "edit", "import");
    expect((await (await post(portal, { query: "?dryRun=false" })).json()).errors).toEqual([
      { title: "Portal:Testia", message: "permission: Only wiki administrators can import pages in this namespace." },
    ]);
    holding(...SYSOP);
    expect(await (await post(portal, { query: "?dryRun=false" })).json()).toMatchObject({ pagesCreated: 1, errorCount: 0 });
  });
});

describe("the export route's bounds", () => {
  const request = (query: string) => exportRoute(new NextRequest(`http://localhost:3000/api/wiki/export?${query}`));
  const seed = (overrides: Partial<ArticleRow>) => {
    const article: ArticleRow = {
      id: `a${store.articles.length + 1}`,
      source: "ixwiki",
      title: "Alpha",
      slug: "alpha",
      status: "PUBLISHED",
      format: "WIKITEXT",
      namespace: 0,
      namespacePrefix: null,
      wikitext: "alpha text",
      contentHtml: null,
      htmlSyncedAt: null,
      summary: null,
      wordCount: 2,
      readingTime: 1,
      mwPageId: 11,
      mwLatestRevId: 21,
      redirectTargetSlug: null,
      redirectTargetFragment: null,
      protectionLevel: "ALL",
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      ...overrides,
    };
    store.articles.push(article);
    store.revisions.push({
      id: `r${store.revisions.length + 1}`,
      articleId: article.id,
      source: "ixwiki",
      mwRevId: 21 + store.revisions.length,
      author: "Jane",
      authorId: null,
      summary: null,
      minor: false,
      textDeleted: false,
      commentDeleted: false,
      userDeleted: false,
      byteSize: 10,
      byteDelta: 10,
      sha1: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      wikitext: article.wikitext,
      format: "WIKITEXT",
    });
  };
  const titlesIn = (xml: string) => [...xml.matchAll(/<title>([^<]*)<\/title>/g)].map((match) => match[1]);
  const pages = (count: number) => encodeURIComponent(Array.from({ length: count }, (_, i) => `Page ${i}`).join("|"));
  // js-yaml comes with the toolchain (an override in package.json) and has no type declarations here.
  const { load: parseYaml } = require("js-yaml") as { load: (text: string) => unknown };

  beforeEach(() => jest.mocked(auth).mockResolvedValue({ userId: null } as never));

  it("exports only published pages, under a file name no title can break", async () => {
    seed({ title: "Alpha" });
    seed({ title: "Draft page", slug: "draft_page", status: "DRAFT" });
    seed({ title: "Archived page", slug: "archived_page", status: "ARCHIVED" });
    expect(titlesIn(await (await request("format=xml&pages=Alpha|Draft page|Archived page")).text())).toEqual(["Alpha"]);

    const res = await request(`format=xml&pages=${encodeURIComponent('a"\r\nX-Injected: 1')}`);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="[A-Za-z0-9._-]+\.xml"$/);
    expect(res.headers.get("x-injected")).toBeNull();
    await res.text();
  });

  it("needs pages, at most 500, and a realm name for the source", async () => {
    expect((await request("format=xml")).status).toBe(400);
    const tooMany = await request(`format=xml&pages=${pages(501)}`);
    expect([tooMany.status, await tooMany.json()]).toEqual([400, { error: "Too many pages: at most 500 per export" }]);
    expect((await request(`format=xml&pages=${pages(500)}`)).status).toBe(200);
    expect((await request(`format=xml&pages=Alpha&source=${encodeURIComponent("x'; --")}`)).status).toBe(400);
  });

  it("exports history only to a signed-in user, and at most 50 pages of it", async () => {
    seed({ title: "Alpha" });
    expect((await request("format=xml&pages=Alpha&history=1")).status).toBe(401);
    expect(jest.mocked(rateLimiter.check)).not.toHaveBeenCalled();
    jest.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
    expect((await request(`format=xml&history=1&pages=${pages(50)}`)).status).toBe(200);
    const res = await request(`format=xml&history=1&pages=${pages(51)}`);
    expect([res.status, await res.json()]).toEqual([400, { error: "Too many pages: at most 50 per export with history" }]);
  });

  it("answers 429 once the bucket is empty", async () => {
    jest.mocked(rateLimiter.check).mockResolvedValueOnce({ success: false, remaining: 0, resetAt: new Date() } as never);
    expect((await request("format=xml&pages=Alpha")).status).toBe(429);
  });

  it("writes Markdown frontmatter and a file name that a title or slug cannot break out of", async () => {
    const title = 'He said "hi": a\nb # c --- [d] {e}\\';
    const slug = 'slug: "x"\n---\nfoo: bar';
    seed({ title, slug, wikitext: "body text" });
    const text = await (await request(`slug=${encodeURIComponent(slug)}`)).text();
    const parsed = parseYaml(/^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "") as Record<string, unknown>;
    expect(parsed).toMatchObject({ title, slug, realm: "ixwiki", status: "PUBLISHED" });
    expect(Object.keys(parsed).sort()).toEqual(["exportedAt", "readingTime", "realm", "slug", "status", "title", "wordCount"]);
    expect(text.endsWith("body text")).toBe(true);

    seed({ title: "Weird", slug: 'we"ird/../name\r\nX: 1' });
    const weird = await request(`slug=${encodeURIComponent('we"ird/../name\r\nX: 1')}`);
    expect(weird.headers.get("content-disposition")).toMatch(/^attachment; filename="[A-Za-z0-9._-]+\.mdx"$/);
  });
});
