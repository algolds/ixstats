/** @jest-environment node */
/**
 * Plan 411: the upload service and the asset records under it. A file is named as MediaWiki would, an existing File:
 * page is kept, a new version or a duplicate is a warning unless the uploader goes on, scripted SVGs and sizes no column
 * holds are refused, nothing is left staged when a step fails, the pixel and SVG limits hold; an asset switches to
 * MediaWiki's path only for the version MediaWiki holds, keeps its BlurHash per version, and listings skip files whose
 * page was deleted in a stable order, bounded.
 */
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

import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TRPCError } from "@trpc/server";
import "sharp";
import { HANDLE_REQUIRED_MESSAGE } from "~/lib/wiki-os/auth";
import { MAX_UPLOAD_BYTES } from "~/lib/wiki-os/config";
import { hashFile } from "~/lib/wiki-os/core/file-hash";
import { authorizeAction, requireRight } from "~/lib/wiki-os/permissions";
import { scheduleMirrorKick, uploadPayloadSchema } from "~/lib/wiki-os/services/mirror-outbox";
import { UploadError } from "~/lib/wiki-os/services/upload-error";
import { uploadFile, type UploadRequest } from "~/lib/wiki-os/services/upload-service";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";

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
  user: { id: "user-1", clerkUserId: "clerk_1", handle: "heku" },
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
  jest
    .mocked(requireRight)
    .mockClear()
    .mockResolvedValue(undefined as never);
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
});

describe("warnings", () => {
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

  it("refuses a player with no passport handle, even over an existing File: page, and stores nothing", async () => {
    tables.wikiArticle.seed({
      title: "File:Flag of Eurth.png",
      source: "ixwiki",
      wikitext: "old text",
      status: "PUBLISHED",
    });
    const noHandle = { ...ctx, user: { ...ctx.user, handle: null } };

    await expect(uploadFile(request({ ctx: noHandle }))).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: HANDLE_REQUIRED_MESSAGE,
    });
    expect(staged()).toEqual([]);
    expect(tables.wikiAsset.rows).toHaveLength(0);
    expect(tables.wikiLog.rows).toHaveLength(0);
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
});

describe("the SVG size limit", () => {
  afterEach(() => delete process.env.WIKIOS_MAX_SVG_BYTES);

  const svgOf = (bytes: number) => {
    const shell = `<svg xmlns="http://www.w3.org/2000/svg"><!----></svg>`;
    return new TextEncoder().encode(
      `<svg xmlns="http://www.w3.org/2000/svg"><!--${"x".repeat(bytes - shell.length)}--></svg>`
    );
  };

  it("refuses an SVG over 5 MB as too large, stages nothing, and takes one at the limit", async () => {
    const failure = await uploadFile(
      request({ bytes: svgOf(5_000_001), filename: "Map.svg" })
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UploadError);
    expect(failure).toMatchObject({ code: "file-too-large" });
    expect((failure as UploadError).message).toContain("5 MB limit for SVG files");
    expect(staged()).toEqual([]);
    expect(tables.wikiAsset.rows).toHaveLength(0);

    await expect(
      uploadFile(request({ bytes: svgOf(5_000_000), filename: "Map.svg" }))
    ).resolves.toMatchObject({ result: "Success" });
  });
});

describe("asset records", () => {
  const { db, tables } = fakeWikiDb;

  const upload = (name: string, sha1: string) => ({
    name,
    mimeType: "image/png",
    sizeBytes: 100,
    width: 10,
    height: 20,
    sha1,
    uploaderId: "user-1",
  });

  beforeEach(() => fakeWikiDb.reset());
  describe("recordUpload", () => {
    it("creates the row served from WikiOS, with no made-up blurhash and no thumbnail", async () => {
      const asset = await db.$transaction((tx) =>
        MediaAssetService.recordUpload(tx as never, upload("Flag of Eurth.png", "s".repeat(31)))
      );

      expect(asset).toMatchObject({
        title: "Flag of Eurth.png",
        slug: "flag_of_eurth.png",
        filename: "Flag_of_Eurth.png",
        url: "/api/wiki/file/Flag_of_Eurth.png",
        thumbnailUrl: null,
        blurhash: null,
        sha1: "s".repeat(31),
        uploaderId: "user-1",
      });
      expect(asset.md5Hash).toBe(MediaAssetService.getMd5ShardPath("Flag of Eurth.png").hash);
      expect(MediaAssetService.isStagedUrl(asset.url)).toBe(true);
    });
  });

  describe("markMirrored", () => {
    it("switches the asset to MediaWiki's images path once MediaWiki holds that version", async () => {
      await db.$transaction((tx) =>
        MediaAssetService.recordUpload(tx as never, upload("Flag of Eurth.png", "v".repeat(31)))
      );

      const switched = await MediaAssetService.markMirrored("Flag of Eurth.png", "v".repeat(31));

      const { shard } = MediaAssetService.getMd5ShardPath("Flag of Eurth.png");
      expect(switched).toBe(true);
      expect(tables.wikiAsset.rows[0]?.url).toMatch(
        new RegExp(`/images/${shard}/Flag_of_Eurth\\.png$`)
      );
      expect(MediaAssetService.isStagedUrl(String(tables.wikiAsset.rows[0]?.url))).toBe(false);
    });

    it("leaves an asset that has moved on to a newer version, which still waits for its own job", async () => {
      await db.$transaction((tx) =>
        MediaAssetService.recordUpload(tx as never, upload("Flag.png", "2".repeat(31)))
      );

      const switched = await MediaAssetService.markMirrored("Flag.png", "1".repeat(31));

      expect(switched).toBe(false);
      expect(tables.wikiAsset.rows[0]?.url).toBe("/api/wiki/file/Flag.png");
      expect(await MediaAssetService.isStillStaged("2".repeat(31))).toBe(true);
      expect(await MediaAssetService.isStillStaged("1".repeat(31))).toBe(false);
    });
  });
  describe("registerAsset", () => {
    it("keeps a file's BlurHash while its size is the same, and drops it for a new version (WK-17)", async () => {
      const hash = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";
      await MediaAssetService.registerAsset({
        filename: "Harbour.png",
        sizeBytes: 500,
        blurhash: hash,
      });

      await MediaAssetService.registerAsset({ filename: "Harbour.png", sizeBytes: 500 });
      expect(tables.wikiAsset.rows[0]?.blurhash).toBe(hash);
      await MediaAssetService.registerAsset({ filename: "Harbour.png" });
      expect(tables.wikiAsset.rows[0]?.blurhash).toBe(hash);

      await MediaAssetService.registerAsset({ filename: "Harbour.png", sizeBytes: 900 });
      expect(tables.wikiAsset.rows[0]?.blurhash).toBeNull();
    });
  });

  describe("search", () => {
    const seedAsset = (title: string, extra: Record<string, unknown> = {}) =>
      tables.wikiAsset.insert({
        title,
        slug: title.toLowerCase().replace(/ /g, "_"),
        filename: title.replace(/ /g, "_"),
        url: `/images/${title}`,
        mimeType: "image/png",
        sizeBytes: 1,
        md5Hash: `md5-${title}`,
        ...extra,
      });
    /** The `File:` page of `title` that WikiOS deleted. */
    const archiveFilePage = (title: string) =>
      tables.wikiArticle.insert({ source: "ixwiki", title: `File:${title}`, status: "ARCHIVED" });
    const names = (assets: Array<{ title: string }>) => assets.map((asset) => asset.title);

    it("skips files whose page was deleted and still returns a full page, in title order", async () => {
      for (let i = 0; i < 120; i++) {
        const title = `Flag ${String(i).padStart(3, "0")}.png`;
        seedAsset(title);
        if (i < 70) archiveFilePage(title);
      }

      const found = await MediaAssetService.search({ limit: 20 });

      expect(names(found)).toEqual(
        Array.from({ length: 20 }, (_, i) => `Flag ${String(70 + i).padStart(3, "0")}.png`)
      );
    });
    it("gives files that share a title a stable order across batches (no repeat, no loss)", async () => {
      // 60 assets with one title: the second batch starts inside the tie
      const rows = Array.from({ length: 60 }, (_, i) =>
        seedAsset("Same title.png", { slug: `same_${i}`, md5Hash: `h${i}` })
      );

      const found = await MediaAssetService.search({ limit: 55 });

      const byId = rows.map((row) => row.id).sort();
      expect(found.map((asset) => asset.id)).toEqual(byId.slice(0, 55));
    });
    it("stops after 500 assets however many of them are hidden, instead of reading on", async () => {
      for (let i = 0; i < 700; i++) {
        const title = `Hidden ${String(i).padStart(3, "0")}.png`;
        seedAsset(title);
        archiveFilePage(title);
      }
      const findMany = jest.spyOn(tables.wikiAsset, "findMany");

      const found = await MediaAssetService.search({ limit: 5 });

      expect(found).toEqual([]);
      expect(findMany).toHaveBeenCalledTimes(10);
      findMany.mockRestore();
    });
  });
});
