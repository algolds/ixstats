/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import { NextRequest } from "next/server";
import { resetStore, store } from "../../lib/wiki-os/xml/fake-wiki-db";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/lib/wiki-os/rights", () => ({ getWikiPermissionsForAuthId: jest.fn() }));
jest.mock("~/server/db", () => {
  const fake = jest.requireActual("../../lib/wiki-os/xml/fake-wiki-db").createFakeDbModule();
  return { db: fake.db };
});
jest.mock("~/lib/wiki-os/core/link-graph-service", () => ({
  LinkGraphService: { syncArticleLinks: jest.fn().mockResolvedValue(0) },
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  MediaAssetService: { processContentImages: jest.fn().mockResolvedValue(undefined) },
}));

import { auth } from "@clerk/nextjs/server";
import { GET, POST } from "~/app/api/wiki/import/route";
import { getWikiPermissionsForAuthId } from "~/lib/wiki-os/rights";
import { DEFAULT_MAX_UPLOAD_BYTES } from "~/lib/wiki-os/xml/import-request";

const mockAuth = jest.mocked(auth) as unknown as jest.Mock;
const mockPermissions = jest.mocked(getWikiPermissionsForAuthId);

/** Who the caller is to the rights engine, as a permissions snapshot holding `rights`. */
const asHolding = (...rights: string[]) =>
  mockPermissions.mockResolvedValue({
    groups: [],
    rights: new Set(rights),
    block: null,
    verifiedWikiUsername: null,
  } as never);
const SYSOP_RIGHTS = [
  "read",
  "edit",
  "createpage",
  "createtalk",
  "import",
  "editprotected",
  "editinterface",
];
const INTERFACE_ADMIN_RIGHTS = [
  "editsitecss",
  "editsitejs",
  "editsitejson",
  "editusercss",
  "edituserjs",
  "edituserjson",
];
const asSysop = () => asHolding(...SYSOP_RIGHTS);
const asInterfaceAdmin = () => asHolding(...SYSOP_RIGHTS, ...INTERFACE_ADMIN_RIGHTS);
const asPlainUser = () => asHolding("read", "edit");

const FIXTURE = readFileSync(
  join(__dirname, "../../fixtures/xml/mediawiki-export-0.11.xml"),
  "utf8"
);

interface PostOptions {
  type?: string | null;
  query?: string;
  headers?: Record<string, string>;
}

/** A POST whose body is `body` (a string, bytes, or a stream: streams have no Content-Length). */
function post(body: string | Uint8Array | ReadableStream<Uint8Array>, options: PostOptions = {}) {
  const { type = "application/xml", query = "", headers = {} } = options;
  return new NextRequest(`http://localhost:3000/api/wiki/import${query}`, {
    method: "POST",
    body,
    headers: { ...(type ? { "content-type": type } : {}), ...headers },
    duplex: "half",
  } as RequestInit);
}

/** A stream of `count` chunks of `size` bytes that records how many chunks were pulled from it. */
function countedStream(count: number, size: number) {
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
}

const MIB = 1024 * 1024;

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  delete process.env.WIKIOS_IMPORT_MAX_BYTES;
  mockAuth.mockResolvedValue({ userId: "user_admin" });
  asSysop();
});

describe("GET /api/wiki/import (may this caller import?)", () => {
  it("is 200 with the size limit for a wiki admin, 403 for a signed-in user, 401 when signed out", async () => {
    const ok = await GET();
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ admin: true, maxBytes: DEFAULT_MAX_UPLOAD_BYTES });

    asPlainUser();
    expect((await GET()).status).toBe(403);

    mockAuth.mockResolvedValue({ userId: null });
    expect((await GET()).status).toBe(401);
  });

  it("reports a limit set by WIKIOS_IMPORT_MAX_BYTES, and ignores a bad value", async () => {
    process.env.WIKIOS_IMPORT_MAX_BYTES = "20971520";
    expect(await (await GET()).json()).toMatchObject({ maxBytes: 20971520 });

    process.env.WIKIOS_IMPORT_MAX_BYTES = "lots";
    expect(await (await GET()).json()).toMatchObject({ maxBytes: DEFAULT_MAX_UPLOAD_BYTES });
  });

  it("the default limit is 9.5 MiB, under Next's 10 MiB proxy body cap", () => {
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(9.5 * MIB);
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBeLessThan(10 * MIB);
  });
});

describe("POST /api/wiki/import: who may", () => {
  it("rejects a signed-out caller with 401, before reading the body", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { stream, pulled } = countedStream(10, 1024);

    const res = await POST(post(stream));

    expect(res.status).toBe(401);
    // (A Request with a stream body primes the stream with one chunk before any handler runs.)
    expect(pulled.chunks).toBeLessThanOrEqual(1);
    expect(store.articles).toHaveLength(0);
  });

  it("rejects a signed-in caller who is not a wiki admin with 403, importing nothing", async () => {
    asPlainUser();

    const res = await POST(post(FIXTURE, { query: "?dryRun=false" }));

    expect(res.status).toBe(403);
    expect(mockPermissions).toHaveBeenCalledWith("user_admin");
    expect(store.writes).toBe(0);
    expect(store.articles).toHaveLength(0);
  });
});

describe("POST /api/wiki/import: the raw body", () => {
  it("imports an XML body for ?dryRun=false and returns the summary", async () => {
    const res = await POST(post(FIXTURE, { query: "?dryRun=false" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      dryRun: false,
      pages: 5,
      pagesCreated: 5,
      revisionsImported: 7,
      revisionsSkipped: 0,
      placeholdersFilled: 0,
      uploadsSkipped: 1,
      errors: [],
      errorCount: 0,
      warnings: [],
      warningCount: 0,
    });
    expect(store.articles).toHaveLength(5);
    expect(store.revisions).toHaveLength(7);
  });

  it.each([
    "",
    "?dryRun=true",
    "?dryRun=1",
    "?dryRun=0",
    "?dryRun=",
    "?dryRun=no",
    "?dryrun=false",
    "?x=1",
  ])("only reports, writing nothing, unless dryRun is exactly false (%j)", async (query) => {
    const res = await POST(post(FIXTURE, { query }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ dryRun: true, pages: 5, pagesCreated: 5, revisionsImported: 7 });
    expect(store.writes).toBe(0);
    expect(store.articles).toHaveLength(0);
  });

  it("accepts dryRun=false in any letter case", async () => {
    const res = await POST(post(FIXTURE, { query: "?dryRun=FALSE" }));

    expect((await res.json()).dryRun).toBe(false);
    expect(store.articles).toHaveLength(5);
  });

  it("accepts text/xml and a charset parameter", async () => {
    expect((await POST(post(FIXTURE, { type: "text/xml" }))).status).toBe(200);
    expect((await POST(post(FIXTURE, { type: "application/xml; charset=utf-8" }))).status).toBe(
      200
    );
  });

  it.each(["application/gzip", "application/x-gzip"])("gunzips a %s body", async (type) => {
    const res = await POST(post(gzipSync(FIXTURE), { type, query: "?dryRun=false" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ dryRun: false, pages: 5, revisionsImported: 7, errorCount: 0 });
    expect(store.revisions).toHaveLength(7);
  });

  it("answers a second upload of the same dump with everything skipped", async () => {
    await POST(post(FIXTURE, { query: "?dryRun=false" }));

    const body = await (await POST(post(FIXTURE, { query: "?dryRun=false" }))).json();

    expect(body).toMatchObject({ pagesCreated: 0, revisionsImported: 0, revisionsSkipped: 7 });
  });

  it("reports a body that is not an export, and a corrupt archive, as a summary error", async () => {
    const notExport = await (await POST(post("<html/>"))).json();
    expect(notExport.errors[0]).toMatchObject({ title: "(dump)" });

    const corrupt = await POST(
      post(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), { type: "application/gzip" })
    );
    expect(corrupt.status).toBe(200);
    expect((await corrupt.json()).errors[0]).toMatchObject({ title: "(dump)" });
  });

  it("reports warnings and caps the lists it echoes back, with their full counts", async () => {
    const page = (n: number) =>
      `<page><title>Bad|${n}</title><ns>0</ns><revision><timestamp>2026-01-01T00:00:00Z</timestamp><text>x</text></revision></page>`;
    const xml = `<mediawiki>${Array.from({ length: 250 }, (_, i) => page(i)).join("")}</mediawiki>`;

    const body = await (await POST(post(xml))).json();

    expect(body.errorCount).toBe(250);
    expect(body.errors).toHaveLength(200);
  });

  it("surfaces import warnings", async () => {
    const xml =
      "<mediawiki><page><title>Foo</title><ns>0</ns><revision><id>1</id><timestamp>2026-01-01T00:00:00Z</timestamp><model>css</model><text>x</text></revision></page></mediawiki>";

    const body = await (await POST(post(xml))).json();

    expect(body.warningCount).toBe(1);
    expect(body.warnings[0]).toMatchObject({ title: "Foo" });
  });
});

describe("POST /api/wiki/import: what it refuses", () => {
  it.each([
    ["multipart/form-data; boundary=x"],
    ["application/json"],
    ["application/octet-stream"],
    ["text/plain"],
    [null],
  ])("answers 415 to Content-Type %j", async (type) => {
    const res = await POST(post(FIXTURE, { type }));

    expect(res.status).toBe(415);
    expect(store.articles).toHaveLength(0);
  });

  it("answers 400 to a request with no body", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/api/wiki/import", {
        method: "POST",
        headers: { "content-type": "application/xml" },
      })
    );

    expect(res.status).toBe(400);
  });

  it("refuses from Content-Length alone, without reading the body", async () => {
    const { stream, pulled } = countedStream(10, 1024);

    const res = await POST(post(stream, { headers: { "content-length": String(200 * MIB) } }));

    expect(res.status).toBe(413);
    expect(pulled.chunks).toBeLessThanOrEqual(1);
    expect(store.articles).toHaveLength(0);
  });

  it("cuts off a chunked body (no Content-Length) that goes past the limit, without reading it all", async () => {
    // 1000 MiB offered in 1 MiB chunks: the stream is abandoned just past 9.5 MiB.
    const { stream, pulled } = countedStream(1000, MIB);

    const res = await POST(post(stream));
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.error).toMatch(/larger than 9961472 bytes/);
    expect(body).toMatchObject({ dryRun: true });
    expect(pulled.chunks).toBeGreaterThanOrEqual(10);
    expect(pulled.chunks).toBeLessThan(15);
  });

  it("cuts off a chunked gzip body the same way, by the bytes on the wire", async () => {
    // A real archive of well-formed XML that does not compress (a comment of random base64),
    // about 14 MiB: over the limit as sent.
    const archive = gzipSync(
      `<mediawiki><!-- ${randomBytes(14 * MIB).toString("base64")} --></mediawiki>`
    );
    expect(archive.length).toBeGreaterThan(DEFAULT_MAX_UPLOAD_BYTES);
    let offered = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offered >= archive.length) return controller.close();
        controller.enqueue(archive.subarray(offered, offered + MIB));
        offered += MIB;
      },
    });

    const res = await POST(post(stream, { type: "application/gzip" }));

    expect(res.status).toBe(413);
    expect(offered).toBeLessThan(archive.length);
  });

  it("reads a chunked body right up to the limit", async () => {
    // A valid dump padded with whitespace to exactly the limit, in 64 KiB chunks.
    const head = `<mediawiki>${FIXTURE.slice(FIXTURE.indexOf("<siteinfo>"), FIXTURE.indexOf("</mediawiki>"))}`;
    const padding = DEFAULT_MAX_UPLOAD_BYTES - Buffer.byteLength(head) - "</mediawiki>".length;
    const bytes = Buffer.from(`${head}${" ".repeat(padding)}</mediawiki>`);
    expect(bytes.length).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    const step = 64 * 1024;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += step)
          controller.enqueue(bytes.subarray(i, i + step));
        controller.close();
      },
    });

    const res = await POST(post(stream, { query: "?dryRun=false" }));

    expect(res.status).toBe(200);
    expect((await res.json()).pages).toBe(5);

    const tooBig = await POST(post(new Uint8Array(DEFAULT_MAX_UPLOAD_BYTES + 1).fill(32)));
    expect(tooBig.status).toBe(413);
  });

  it("uses WIKIOS_IMPORT_MAX_BYTES as the limit when it is set", async () => {
    process.env.WIKIOS_IMPORT_MAX_BYTES = "2000";

    const res = await POST(post(FIXTURE));

    expect(FIXTURE.length).toBeGreaterThan(2000);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/larger than 2000 bytes/);
  });
});

describe("POST /api/wiki/import: per-page authorization (plan 409)", () => {
  const page = (title: string, ns: number, id: number, model: string, text: string) => `
  <page>
    <title>${title}</title>
    <ns>${ns}</ns>
    <id>${id}</id>
    <revision>
      <id>${id * 10}</id>
      <timestamp>2026-01-02T03:04:05Z</timestamp>
      <contributor><username>Jane</username><id>7</id></contributor>
      <model>${model}</model>
      <format>text/x-wiki</format>
      <text xml:space="preserve">${text}</text>
    </revision>
  </page>`;
  const DUMP = `<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/" version="0.11" xml:lang="en">${page("Kingdom of Testia", 0, 1, "wikitext", "Testia is a kingdom.")}${page("MediaWiki:Common.js", 8, 2, "javascript", "alert(1);")}${page("User:Bob/common.css", 2, 3, "css", "body{}")}${page("Template:Infobox testia", 10, 4, "wikitext", "{{{name}}}")}
</mediawiki>`;
  const write = (as: () => void) => {
    as();
    return POST(post(DUMP, { query: "?dryRun=false" }));
  };
  const titles = () => store.articles.map((a) => a.title).sort();

  it("lets a sysop import articles and templates, but skips the site script and user style pages", async () => {
    const res = await write(asSysop);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(titles()).toEqual(["Kingdom of Testia", "Template:Infobox testia"]);
    expect(body).toMatchObject({ pages: 4, pagesCreated: 2, errorCount: 2 });
    expect(body.errors).toEqual([
      {
        title: "MediaWiki:Common.js",
        message: "permission: Editing this MediaWiki page needs the editsitejs right.",
      },
      {
        title: "User:Bob/common.css",
        message:
          "permission: Only interface administrators can edit user script, style and data pages.",
      },
    ]);
  });

  it("lets an interface administrator import every page of the dump", async () => {
    const res = await write(asInterfaceAdmin);

    expect((await res.json()).errorCount).toBe(0);
    expect(titles()).toEqual([
      "Kingdom of Testia",
      "MediaWiki:Common.js",
      "Template:Infobox testia",
      "User:Bob/common.css",
    ]);
  });

  it("reports the skipped pages in a dry run too, without writing", async () => {
    asSysop();
    const res = await POST(post(DUMP));
    const body = await res.json();

    expect(body).toMatchObject({ dryRun: true, pagesCreated: 2, errorCount: 2 });
    expect(store.writes).toBe(0);
  });

  it("skips a page in a namespace the wiki does not know unless the caller is an administrator", async () => {
    const unknown = `<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/" version="0.11" xml:lang="en">${page("Portal:Testia", 100, 9, "wikitext", "A portal.")}</mediawiki>`;
    asHolding("read", "edit", "import");
    const refused = await (await POST(post(unknown, { query: "?dryRun=false" }))).json();
    expect(refused.errors).toEqual([
      {
        title: "Portal:Testia",
        message: "permission: Only wiki administrators can import pages in this namespace.",
      },
    ]);

    asSysop();
    const allowed = await (await POST(post(unknown, { query: "?dryRun=false" }))).json();
    expect(allowed).toMatchObject({ pagesCreated: 1, errorCount: 0 });
  });
});
