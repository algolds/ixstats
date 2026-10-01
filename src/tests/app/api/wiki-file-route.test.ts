/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 411: the route that serves an upload from WikiOS until MediaWiki holds it. The staging directory is a real temp
// directory, the WikiOS tables an in-memory fake. An SVG must not be an inline document of our origin: the app CSP of
// src/proxy.ts replaces any CSP a route sets, so the route only renders one inline when the browser loads an image.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
}));
jest.mock("~/app/api/mediawiki/_rate-limit", () => ({
  wikiMediaRateLimitResponse: jest.fn().mockResolvedValue(null),
}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { GET, OPTIONS } from "~/app/api/wiki/file/[...name]/route";
import { wikiMediaRateLimitResponse } from "~/app/api/mediawiki/_rate-limit";
import { hashFile } from "~/lib/wiki-os/core/file-hash";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { releaseStaged, stageBytes } from "~/lib/wiki-os/services/upload-staging";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { db, tables } = fakeWikiDb;

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const PNG = Uint8Array.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  ...be32(13),
  ...Buffer.from("IHDR"),
  ...be32(4),
  ...be32(4),
  8,
  6,
  0,
  0,
  0,
  0xff,
  0x80,
]);
const SVG = new TextEncoder().encode(
  `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>`
);
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");

let directory: string;

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "wikios-file-route-test-"));
  process.env.WIKIOS_UPLOAD_DIR = directory;
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
  delete process.env.WIKIOS_UPLOAD_DIR;
});

beforeEach(() => {
  fakeWikiDb.reset();
  jest.mocked(wikiMediaRateLimitResponse).mockResolvedValue(null);
});

/** A file uploaded to WikiOS: staged, with its asset row. */
async function upload(name: string, bytes: Uint8Array, mimeType: string) {
  const { base36 } = hashFile(bytes);
  await stageBytes(base36, bytes);
  await db.$transaction((tx) =>
    MediaAssetService.recordUpload(tx, {
      name,
      mimeType,
      sizeBytes: bytes.length,
      width: 4,
      height: 4,
      sha1: base36,
      uploaderId: null,
    })
  );
  return base36;
}

const get = (segments: string[], headers: Record<string, string> = {}, query = "") =>
  GET(
    new NextRequest(
      `http://localhost:3000/api/wiki/file/${segments.map(encodeURIComponent).join("/")}${query}`,
      {
        headers,
      }
    ),
    { params: Promise.resolve({ name: segments }) }
  );

const body = async (response: NextResponse) => new Uint8Array(await response.arrayBuffer());

describe("a staged raster", () => {
  it("is streamed byte for byte with its stored type, nosniff, a short cache and a hash for an ETag", async () => {
    const sha1 = await upload("Flag of Eurth.png", PNG, "image/png");

    const response = await get(["Flag_of_Eurth.png"]);

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual(PNG);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(response.headers.get("ETag")).toBe(`"${sha1}"`);
    expect(response.headers.get("Content-Length")).toBe(String(PNG.length));
  });

  it("finds the file whichever way the name is spelled: underscores or spaces, first letter in any case", async () => {
    await upload("Flag of Eurth.png", PNG, "image/png");

    for (const name of ["Flag_of_Eurth.png", "Flag of Eurth.png", "flag_of_Eurth.png"]) {
      expect((await get([name])).status).toBe(200);
    }
  });

  it("answers 304 to a request that already has this version", async () => {
    const sha1 = await upload("Flag.png", PNG, "image/png");

    const response = await get(["Flag.png"], { "If-None-Match": `"${sha1}"` });

    expect(response.status).toBe(304);
    expect((await body(response)).length).toBe(0);
    expect(response.headers.get("ETag")).toBe(`"${sha1}"`);
  });

  it("sends the original whatever width is asked for", async () => {
    await upload("Flag.png", PNG, "image/png");

    const response = await get(["Flag.png"], {}, "?width=120");

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual(PNG);
  });
});

describe("a staged SVG", () => {
  it("renders inline only when the browser is loading an image, and says so to caches", async () => {
    await upload("Flag.svg", SVG, "image/svg+xml");

    const response = await get(["Flag.svg"], { "Sec-Fetch-Dest": "image" });

    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Content-Disposition")).toBe("inline");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(response.headers.get("Vary")).toContain("Sec-Fetch-Dest");
    expect(await body(response)).toEqual(SVG);
  });

  it.each([
    ["a navigation", { "Sec-Fetch-Dest": "document" }],
    ["a frame", { "Sec-Fetch-Dest": "iframe" }],
    ["a client that sends no fetch metadata but asks for a page", { Accept: "text/html" }],
  ])(
    "is a download for %s: the app CSP would replace the sandbox, so it must not run as a page",
    async (_name, headers) => {
      await upload("Flag.svg", SVG, "image/svg+xml");

      const response = await get(["Flag.svg"], headers);

      expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Flag.svg"');
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    }
  );
});

describe("a staged PDF", () => {
  it("is always a download, with nosniff", async () => {
    await upload("Treaty of Eurth.pdf", PDF, "application/pdf");

    const response = await get(["Treaty_of_Eurth.pdf"], { "Sec-Fetch-Dest": "document" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Treaty_of_Eurth.pdf"'
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await body(response)).toEqual(PDF);
  });
});

describe("a file MediaWiki holds", () => {
  it("is a redirect to MediaWiki's copy", async () => {
    const sha1 = await upload("Flag.png", PNG, "image/png");
    await MediaAssetService.markMirrored("Flag.png", sha1);
    const { url } = tables.wikiAsset.rows[0] as { url: string };
    await releaseStaged(sha1);

    const response = await get(["Flag.png"]);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(url);
    expect(url).toMatch(/\/images\/[0-9a-f]\/[0-9a-f]{2}\/Flag\.png$/);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
  });
});

describe("what is not served", () => {
  it("answers 404 for a name with no file, a deleted file, and a file whose bytes are gone", async () => {
    expect((await get(["Nothing.png"])).status).toBe(404);

    await upload("Deleted.png", PNG, "image/png");
    tables.wikiArticle.seed({
      source: "ixwiki",
      title: "File:Deleted.png",
      status: "ARCHIVED",
      wikitext: "x",
    });
    expect((await get(["Deleted.png"])).status).toBe(404);

    await upload("Lost.png", new Uint8Array([...PNG, 1]), "image/png");
    await releaseStaged(hashFile(new Uint8Array([...PNG, 1])).base36);
    expect((await get(["Lost.png"])).status).toBe(404);
  });

  it("answers 404 for a row whose type is not one an upload can have", async () => {
    await upload("Strange.png", PNG, "text/html");

    expect((await get(["Strange.png"])).status).toBe(404);
  });

  it("answers 404 for a name that is no title, and for one with a path in it", async () => {
    await upload("Flag.png", PNG, "image/png");

    expect((await get(["[bad].png"])).status).toBe(404);
    expect((await get(["dir", "Flag.png"])).status).toBe(404);
  });

  it("answers the rate limiter's refusal as it is", async () => {
    jest
      .mocked(wikiMediaRateLimitResponse)
      .mockResolvedValue(NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }));

    expect((await get(["Flag.png"])).status).toBe(429);
  });

  it("answers an options request (CORS preflight)", () => {
    expect(OPTIONS().status).toBe(200);
  });
});
