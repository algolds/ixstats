/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 411: the upload service over an in-memory fake of the WikiOS tables and a real temp directory for the staging
// store. The services behind it (the save of the File: page, the outbox) are the real ones; only the rights gate, the
// renderer and the cache purge are stubs.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
}));
jest.mock("~/lib/wiki-os/permissions", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/permissions"),
  authorizeAction: jest.fn().mockResolvedValue(undefined),
  requireRight: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TRPCError } from "@trpc/server";
import { MAX_UPLOAD_BYTES } from "~/lib/wiki-os/config";
import { hashFile } from "~/lib/wiki-os/core/file-hash";
import { authorizeAction, requireRight } from "~/lib/wiki-os/permissions";
import { scheduleMirrorKick, uploadPayloadSchema } from "~/lib/wiki-os/services/mirror-outbox";
import { UploadError } from "~/lib/wiki-os/services/upload-error";
import {
  descriptionWikitext,
  uploadFile,
  type UploadRequest,
} from "~/lib/wiki-os/services/upload-service";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { tables } = fakeWikiDb;

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
/** A PNG header with this size; `salt` makes the bytes (and so the hash) differ. */
const png = (width: number, height: number, salt = 0) =>
  Uint8Array.from([
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
    ...be32(width),
    ...be32(height),
    8,
    6,
    0,
    0,
    0,
    salt,
  ]);

const ctx = {
  auth: { userId: "clerk_1" },
  user: { id: "user-1", clerkUserId: "clerk_1", wikiUsername: "Heku" },
};

let directory: string;

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "wikios-upload-test-"));
  process.env.WIKIOS_UPLOAD_DIR = directory;
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
  delete process.env.WIKIOS_UPLOAD_DIR;
});

beforeEach(() => {
  fakeWikiDb.reset();
  for (const name of readdirSync(directory)) rmSync(join(directory, name), { force: true });
  jest.mocked(authorizeAction).mockClear().mockResolvedValue(undefined);
  jest.mocked(requireRight).mockClear().mockResolvedValue(undefined);
  jest.mocked(scheduleMirrorKick).mockClear();
  tables.user.seed({ id: "user-1", clerkUserId: "clerk_1" });
});

const request = (over: Partial<UploadRequest> = {}): UploadRequest => ({
  ctx,
  bytes: png(640, 480),
  filename: "Flag of Eurth.png",
  description: "The flag of Eurth.",
  license: "{{PD-self}}",
  categories: ["Flags"],
  comment: "First upload",
  ...over,
});

const jobs = () => tables.wikiMirrorJob.rows;
const staged = () => readdirSync(directory).filter((name) => !name.endsWith(".tmp"));

describe("a new file", () => {
  it("is staged under its hash, recorded, logged, queued for MediaWiki after its description page, and served from WikiOS", async () => {
    const bytes = png(640, 480);
    const { base36 } = hashFile(bytes);

    const result = await uploadFile(request({ bytes }));

    expect(result).toMatchObject({
      result: "Success",
      replaced: false,
      noChange: false,
      filename: "Flag of Eurth.png",
      title: "File:Flag of Eurth.png",
      url: "/api/wiki/file/Flag_of_Eurth.png",
      descriptionUrl: "/wiki/File:Flag_of_Eurth.png",
      width: 640,
      height: 480,
      size: bytes.length,
      mime: "image/png",
      sha1: hashFile(bytes).hex,
    });
    // the bytes, byte for byte, under the base-36 hash
    expect(staged()).toEqual([base36]);
    expect(readFileSync(join(directory, base36))).toEqual(Buffer.from(bytes));

    expect(tables.wikiAsset.rows).toHaveLength(1);
    expect(tables.wikiAsset.rows[0]).toMatchObject({
      title: "Flag of Eurth.png",
      slug: "flag_of_eurth.png",
      filename: "Flag_of_Eurth.png",
      url: "/api/wiki/file/Flag_of_Eurth.png",
      thumbnailUrl: null,
      mimeType: "image/png",
      sizeBytes: bytes.length,
      width: 640,
      height: 480,
      sha1: base36,
      uploaderId: "user-1",
      blurhash: null,
    });
    // MediaWiki's shard hash is of the NAME, not of the content
    expect(tables.wikiAsset.rows[0]?.md5Hash).toMatch(/^[0-9a-f]{32}$/);

    expect(tables.wikiLog.rows).toHaveLength(1);
    expect(tables.wikiLog.rows[0]).toMatchObject({
      logType: "upload",
      action: "upload",
      title: "File:Flag of Eurth.png",
      actorName: "Heku",
      comment: "First upload",
      userId: "user-1",
      params: {
        filename: "Flag of Eurth.png",
        sha1: base36,
        size: bytes.length,
        width: 640,
        height: 480,
        mime: "image/png",
      },
    });

    expect(authorizeAction).toHaveBeenCalledWith(ctx, "upload", "File:Flag of Eurth.png");
    expect(requireRight).not.toHaveBeenCalled();
    expect(scheduleMirrorKick).toHaveBeenCalled();
  });

  it("creates the File: page from the description, the license and the categories, and its revision job runs before the upload job", async () => {
    await uploadFile(request());

    const page = tables.wikiArticle.rows.find((row) => row.title === "File:Flag of Eurth.png");
    expect(page?.wikitext).toBe(
      "== Summary ==\nThe flag of Eurth.\n== Licensing ==\n{{PD-self}}\n[[Category:Flags]]"
    );
    expect(jobs().map((job) => job.kind)).toEqual(["revision", "upload"]);
    expect(jobs().every((job) => job.title === "File:Flag of Eurth.png")).toBe(true);

    const upload = jobs()[1]!;
    expect(uploadPayloadSchema.parse(upload.payload)).toEqual({
      sha1: hashFile(png(640, 480)).base36,
      comment: "First upload",
    });
    expect(upload.articleId).toBe(page?.id);
    expect(upload.logId).toBe(tables.wikiLog.rows[0]?.id);
    expect(upload.state).toBe("pending");
  });

  it("names the file as MediaWiki would: a path and a File: prefix are cut, a colon becomes a dash", async () => {
    await uploadFile(request({ filename: "C:\\fakepath\\My:Flag.png" }));

    expect(authorizeAction).toHaveBeenCalledWith(ctx, "upload", "File:My-Flag.png");
    expect(tables.wikiAsset.rows[0]?.filename).toBe("My-Flag.png");
  });

  it("keeps an existing File: page as it is (its text is the community's)", async () => {
    tables.wikiArticle.seed({
      title: "File:Flag of Eurth.png",
      source: "ixwiki",
      wikitext: "old text",
      status: "PUBLISHED",
    });

    await uploadFile(request({ ignoreWarnings: true }));

    expect(tables.wikiArticle.rows).toHaveLength(1);
    expect(tables.wikiArticle.rows[0]?.wikitext).toBe("old text");
    expect(jobs().map((job) => job.kind)).toEqual(["upload"]);
  });

  it("takes the whole page text as given when the caller sends it (api.php text)", async () => {
    await uploadFile(request({ pageText: "just this", description: "ignored" }));

    const page = tables.wikiArticle.rows.find((row) => row.title === "File:Flag of Eurth.png");
    expect(page?.wikitext).toBe("just this");
  });
});

describe("warnings", () => {
  it("returns the exists warning for a taken name and stores nothing", async () => {
    await uploadFile(request());
    const before = { jobs: jobs().length, logs: tables.wikiLog.rows.length };

    const result = await uploadFile(request({ bytes: png(10, 10, 1) }));

    expect(result).toEqual({
      result: "Warning",
      filename: "Flag of Eurth.png",
      title: "File:Flag of Eurth.png",
      warnings: { exists: "Flag of Eurth.png" },
    });
    expect({ jobs: jobs().length, logs: tables.wikiLog.rows.length }).toEqual(before);
    expect(staged()).toHaveLength(1);
  });

  it("makes a new version of the file when the uploader ignores the warning: the asset row is replaced, the log says overwrite, and reupload is required", async () => {
    await uploadFile(request());
    const second = png(10, 10, 1);

    const result = await uploadFile(
      request({ bytes: second, ignoreWarnings: true, comment: "A better flag" })
    );

    expect(result).toMatchObject({
      result: "Success",
      replaced: true,
      noChange: false,
      width: 10,
      height: 10,
    });
    expect(requireRight).toHaveBeenCalledWith(ctx, "reupload");
    expect(tables.wikiAsset.rows).toHaveLength(1);
    expect(tables.wikiAsset.rows[0]).toMatchObject({
      width: 10,
      height: 10,
      sha1: hashFile(second).base36,
      url: "/api/wiki/file/Flag_of_Eurth.png",
    });
    expect(tables.wikiLog.rows.map((row) => row.action)).toEqual(["upload", "overwrite"]);
    expect(jobs().map((job) => job.kind)).toEqual(["revision", "upload", "upload"]);
    expect(uploadPayloadSchema.parse(jobs()[2]?.payload).comment).toBe("A better flag");
    // both versions are kept until their jobs have run
    expect(staged()).toHaveLength(2);
    // the description page was not touched
    expect(tables.wikiRevision.rows).toHaveLength(1);
  });

  it("warns about a duplicate under another name, and accepts it when told to", async () => {
    await uploadFile(request());

    const warned = await uploadFile(request({ filename: "Eurth flag copy.png" }));
    expect(warned).toMatchObject({
      result: "Warning",
      warnings: { duplicate: ["Flag of Eurth.png"] },
    });
    expect(tables.wikiAsset.rows).toHaveLength(1);

    const accepted = await uploadFile(
      request({ filename: "Eurth flag copy.png", ignoreWarnings: true })
    );
    expect(accepted).toMatchObject({ result: "Success", replaced: false });
    expect(tables.wikiAsset.rows).toHaveLength(2);
    // the same bytes are staged once
    expect(staged()).toHaveLength(1);
  });

  it("is a no-op to upload the same bytes under the same name again", async () => {
    await uploadFile(request());
    const snapshot = {
      jobs: jobs().length,
      logs: tables.wikiLog.rows.length,
      revisions: tables.wikiRevision.rows.length,
      asset: { ...tables.wikiAsset.rows[0] },
    };

    const warned = await uploadFile(request());
    const ignored = await uploadFile(request({ ignoreWarnings: true }));

    expect(warned).toMatchObject({
      result: "Warning",
      warnings: { exists: "Flag of Eurth.png", nochange: true },
    });
    expect(ignored).toMatchObject({
      result: "Success",
      noChange: true,
      replaced: true,
      url: "/api/wiki/file/Flag_of_Eurth.png",
    });
    expect({
      jobs: jobs().length,
      logs: tables.wikiLog.rows.length,
      revisions: tables.wikiRevision.rows.length,
      asset: tables.wikiAsset.rows[0],
    }).toEqual(snapshot);
  });
});

describe("refusals", () => {
  it("refuses a scripted SVG and stores nothing", async () => {
    const bytes = new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`
    );

    await expect(uploadFile(request({ bytes, filename: "Evil.svg" }))).rejects.toMatchObject({
      code: "unsafe-svg",
    });
    expect(staged()).toEqual([]);
    expect(tables.wikiAsset.rows).toHaveLength(0);
    expect(jobs()).toHaveLength(0);
  });

  it("accepts a clean SVG with the size it states", async () => {
    const bytes = new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20"/></svg>`
    );

    const result = await uploadFile(request({ bytes, filename: "Clean.svg" }));

    expect(result).toMatchObject({
      result: "Success",
      mime: "image/svg+xml",
      width: 40,
      height: 20,
    });
  });

  it.each([
    [
      "a name whose extension is wrong for the bytes",
      { filename: "Flag.jpg" },
      "filetype-mime-mismatch",
    ],
    ["a name with no extension", { filename: "Flag" }, "filetype-missing"],
    [
      "a name with an extension that may not be uploaded",
      { filename: "Flag.txt" },
      "filetype-banned",
    ],
    [
      "a file that is not an image",
      { bytes: new TextEncoder().encode("MZ not a picture"), filename: "x.png" },
      "filetype-badmime",
    ],
    ["an empty file", { bytes: new Uint8Array(0) }, "empty-file"],
    ["a file over the limit", { bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1) }, "file-too-large"],
  ] as Array<[string, Partial<UploadRequest>, string]>)("refuses %s", async (_name, over, code) => {
    const failure = await uploadFile(request(over)).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UploadError);
    expect((failure as UploadError).code).toBe(code);
    expect(staged()).toEqual([]);
    expect(jobs()).toHaveLength(0);
  });

  it("refuses a name with nothing usable in it, and turns the characters a title cannot hold into dashes", async () => {
    await expect(uploadFile(request({ filename: "folder/" }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    const result = await uploadFile(request({ filename: "[bad].png" }));
    expect(result).toMatchObject({ filename: "-bad-.png" });
  });

  it("is refused a name whose File: page was deleted", async () => {
    tables.wikiArticle.seed({
      title: "File:Flag of Eurth.png",
      source: "ixwiki",
      wikitext: "gone",
      status: "ARCHIVED",
    });

    await expect(uploadFile(request({ ignoreWarnings: true }))).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(staged()).toEqual([]);
  });

  it("stores nothing when the rights gate refuses", async () => {
    jest
      .mocked(authorizeAction)
      .mockRejectedValueOnce(
        new TRPCError({ code: "FORBIDDEN", message: "permissiondenied: no upload right" })
      );

    await expect(uploadFile(request())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(staged()).toEqual([]);
    expect(tables.wikiAsset.rows).toHaveLength(0);
    expect(jobs()).toHaveLength(0);
  });

  it("needs the reupload right to replace a file", async () => {
    await uploadFile(request());
    jest.mocked(requireRight).mockRejectedValueOnce(
      new TRPCError({
        code: "FORBIDDEN",
        message: 'permissiondenied: You do not have the "reupload" right.',
      })
    );

    await expect(
      uploadFile(request({ bytes: png(5, 5, 9), ignoreWarnings: true }))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(tables.wikiAsset.rows[0]?.width).toBe(640);
  });
});

describe("nothing is left staged when an upload fails (review M1)", () => {
  /** What the database stands in for: the tables it writes, made to fail once. */
  const failing = (table: { create?: unknown; upsert?: unknown }, method: "create" | "upsert") =>
    jest
      .spyOn(table as Record<string, () => Promise<unknown>>, method)
      .mockRejectedValueOnce(new Error("db down"));

  afterEach(() => jest.restoreAllMocks());

  it.each([
    [
      "a NUL in the page text (api.php text), which PostgreSQL refuses",
      { pageText: "a\u0000b" },
      "invalidtext",
    ],
    ["a NUL in the description", { description: "a\u0000b" }, "invalidtext"],
    ["a page text over MediaWiki's limit", { pageText: "x".repeat(2_000_001) }, "toobig"],
    ["a description over MediaWiki's limit", { description: "x".repeat(2_000_001) }, "toobig"],
  ] as Array<[string, Partial<UploadRequest>, string]>)(
    "refuses %s before staging anything",
    async (_name, over, code) => {
      const failure = await uploadFile(request(over)).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(UploadError);
      expect((failure as UploadError).code).toBe(code);
      expect(staged()).toEqual([]);
      expect(tables.wikiAsset.rows).toHaveLength(0);
      expect(tables.wikiArticle.rows).toHaveLength(0);
      expect(jobs()).toHaveLength(0);
    }
  );

  it("refuses a PNG whose header states a width no database column holds (0xFFFFFFFF), instead of failing after staging it", async () => {
    const failure = await uploadFile(request({ bytes: png(0xffffffff, 5) })).catch(
      (error: unknown) => error
    );

    expect(failure).toMatchObject({ code: "corrupt" });
    expect(staged()).toEqual([]);
    expect(tables.wikiAsset.rows).toHaveLength(0);
  });

  it("takes an SVG that states an absurd width as one with no stated size, not as a crash", async () => {
    const bytes = new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg" width="99999999999" height="20"/>`
    );

    const result = await uploadFile(request({ bytes, filename: "Huge.svg" }));

    expect(result).toMatchObject({ result: "Success", width: null, height: 20 });
    expect(tables.wikiAsset.rows[0]).toMatchObject({ width: null, height: 20 });
  });

  it("leaves nothing staged when the record fails after the file was staged", async () => {
    failing(tables.wikiLog, "create");

    await expect(uploadFile(request())).rejects.toThrow("db down");

    expect(staged()).toEqual([]);
  });

  it("leaves nothing staged when the File: page cannot be saved (nothing was staged yet)", async () => {
    failing(tables.wikiArticle, "upsert");

    await expect(uploadFile(request())).rejects.toThrow("db down");

    expect(staged()).toEqual([]);
    expect(tables.wikiAsset.rows).toHaveLength(0);
  });

  it("keeps the file when the failed upload shares it with a name that still needs it", async () => {
    const bytes = png(10, 10, 4);
    await uploadFile(request({ bytes }));
    expect(staged()).toHaveLength(1);
    failing(tables.wikiLog, "create");

    await expect(
      uploadFile(request({ bytes, filename: "Copy of the flag.png", ignoreWarnings: true }))
    ).rejects.toThrow("db down");

    expect(staged()).toEqual([hashFile(bytes).base36]);
  });

  it("strips a NUL from the comment instead of failing on it", async () => {
    await uploadFile(request({ comment: "a\u0000b" }));

    expect(tables.wikiLog.rows[0]?.comment).toBe("ab");
  });
});

describe("the pixel area limit (review minor 3)", () => {
  afterEach(() => delete process.env.WIKIOS_MAX_IMAGE_AREA);

  it("refuses a raster above 12.5 megapixels as too large, and takes one just below it", async () => {
    const failure = await uploadFile(request({ bytes: png(5000, 5000) })).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(UploadError);
    expect(failure).toMatchObject({ code: "file-too-large" });
    expect((failure as UploadError).message).toContain(
      "25 megapixels (5000 × 5000); the limit is 12.5"
    );
    expect(staged()).toEqual([]);
    expect(tables.wikiAsset.rows).toHaveLength(0);

    await expect(uploadFile(request({ bytes: png(3535, 3535) }))).resolves.toMatchObject({
      result: "Success",
    });
  });

  it("follows WIKIOS_MAX_IMAGE_AREA for a wiki that raised $wgMaxImageArea, and ignores a bad value", async () => {
    process.env.WIKIOS_MAX_IMAGE_AREA = "30000000";
    await expect(uploadFile(request({ bytes: png(5000, 5000) }))).resolves.toMatchObject({
      result: "Success",
    });

    process.env.WIKIOS_MAX_IMAGE_AREA = "lots";
    await expect(
      uploadFile(request({ bytes: png(5000, 5001), filename: "Other.png" }))
    ).rejects.toMatchObject({ code: "file-too-large" });
  });

  it("does not hold a drawing to it: an SVG may state any size", async () => {
    const bytes = new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg" width="90000" height="90000"/>`
    );

    await expect(uploadFile(request({ bytes, filename: "Map.svg" }))).resolves.toMatchObject({
      result: "Success",
      width: 90000,
    });
  });
});

describe("descriptionWikitext", () => {
  it("writes the two sections and a link for each valid category", () => {
    expect(
      descriptionWikitext({
        description: " A map. ",
        license: "",
        categories: ["Maps", "Category:Eurth", "bad|name", "  "],
      })
    ).toBe("== Summary ==\nA map.\n== Licensing ==\n\n[[Category:Maps]]\n[[Category:Eurth]]");
  });
});
