/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factory relies on the ambient global.
//
// Plan 411: the `upload` mirror job. MediaWiki is a scripted fake (tests never touch a real wiki); the staging directory
// is a real temp directory and the WikiOS tables an in-memory fake. The upload must carry the very bytes that were staged
// (compared by SHA-1), an upload MediaWiki already holds is a success, and a wrong bot password writes nothing.
// The mirror's api.php and bot login come from `wikiosConfig`; this test sets their variables as it runs.
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
}));

import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WikiMirrorJob } from "@prisma/client";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { mediaWikiOrigin, STAGED_FILE_PATH } from "~/lib/wiki-os/config";
import { hashFile } from "~/lib/wiki-os/core/file-hash";
import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { runUploadJob } from "~/lib/wiki-os/services/mirror-upload";
import { isStaged, stageBytes } from "~/lib/wiki-os/services/upload-staging";
import { API_URL, createFakeMediaWiki } from "~/tests/helpers/fake-mediawiki";
import { executedSql, fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { db, tables } = fakeWikiDb;
const realFetch = globalThis.fetch;
let wiki: ReturnType<typeof createFakeMediaWiki>;
let directory: string;

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
/** A PNG header with a binary tail (bytes above 127: a UTF-8 round trip would corrupt them). */
const png = (salt: number) =>
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
    ...be32(32),
    ...be32(16),
    8,
    6,
    0,
    0,
    0,
    0xff,
    0xfe,
    0x80,
    0x00,
    salt,
  ]);

const sha1Of = (bytes: Uint8Array) => createHash("sha1").update(bytes).digest("hex");

const uploadJob = (sha1: string, over: Partial<WikiMirrorJob> = {}): WikiMirrorJob => ({
  id: "job-up-1",
  source: "ixwiki",
  kind: "upload",
  title: "File:Flag of Eurth.png",
  articleId: "art-1",
  revisionId: null,
  logId: "log-1",
  payload: { sha1, comment: "First upload" },
  state: "running",
  attempts: 1,
  nextAttemptAt: new Date(),
  lastError: null,
  mwRevId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

/** The staged file, its asset row (still served from WikiOS) and the log row the job reads the uploader from. */
async function stagedUpload(bytes: Uint8Array) {
  const { base36 } = hashFile(bytes);
  await stageBytes(base36, bytes);
  await db.$transaction((tx) =>
    MediaAssetService.recordUpload(tx as never, {
      name: "Flag of Eurth.png",
      mimeType: "image/png",
      sizeBytes: bytes.length,
      width: 32,
      height: 16,
      sha1: base36,
      uploaderId: "user-1",
    })
  );
  return base36;
}

const calls = (action: string) =>
  wiki.calls().filter((request) => request.params.action === action);

/** MediaWiki answers `prop=imageinfo` as it would for a file with this SHA-1 (hex), or for no file. */
function imageInfo(hex: string | null) {
  wiki.on("query", () => ({
    query: {
      pages: [
        hex
          ? { title: "File:Flag of Eurth.png", imageinfo: [{ sha1: hex }] }
          : { title: "File:Flag of Eurth.png", missing: true },
      ],
    },
  }));
}

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "wikios-mirror-upload-test-"));
  process.env.WIKIOS_UPLOAD_DIR = directory;
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
  delete process.env.WIKIOS_UPLOAD_DIR;
});

beforeEach(() => {
  fakeWikiDb.reset();
  for (const name of readdirSync(directory)) rmSync(join(directory, name), { force: true });
  invalidateCsrfToken();
  process.env.WIKIOS_MEDIAWIKI_API = API_URL;
  process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
  process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
  wiki = createFakeMediaWiki();
  globalThis.fetch = wiki.fetch as unknown as typeof fetch;
  tables.wikiLog.seed({ id: "log-1", actorName: "Heku" });
  tables.wikiArticle.seed({
    source: "ixwiki",
    title: "File:Flag of Eurth.png",
    wikitext: "== Summary ==\nThe flag.",
  });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("uploading a staged file", () => {
  it("sends the staged bytes unchanged, as the bot, with the page text and the uploader in the comment, and the token last", async () => {
    const bytes = png(1);
    const sha1 = await stagedUpload(bytes);
    imageInfo(null);
    wiki.on("upload", () => ({ upload: { result: "Success", filename: "Flag_of_Eurth.png" } }));

    await runUploadJob(uploadJob(sha1));

    const [call] = calls("upload");
    expect(call?.method).toBe("POST");
    expect(call?.params).toMatchObject({
      action: "upload",
      filename: "Flag of Eurth.png",
      ignorewarnings: "1",
      comment: "First upload (uploaded in WikiOS by Heku)",
      text: "== Summary ==\nThe flag.",
      format: "json",
    });
    expect(call?.params.token).toBe("csrf-token+\\x");
    expect(call?.order.at(-1)).toBe("token");
    expect(call?.file).toMatchObject({
      field: "file",
      filename: "Flag of Eurth.png",
      type: "image/png",
    });
    expect(sha1Of(call!.file!.bytes)).toBe(sha1Of(bytes));
  });

  it("asks MediaWiki for the file's hash first, so a retry never makes a second version", async () => {
    const bytes = png(2);
    const sha1 = await stagedUpload(bytes);
    imageInfo(sha1Of(bytes));

    await runUploadJob(uploadJob(sha1));

    expect(calls("upload")).toHaveLength(0);
    const [ask] = calls("query");
    expect(ask?.params).toMatchObject({
      prop: "imageinfo",
      iiprop: "sha1",
      titles: "File:Flag of Eurth.png",
    });
    // ... and it is still finished: served from MediaWiki, the staged copy released
    expect(String(tables.wikiAsset.rows[0]?.url)).toContain("/images/");
    expect(await isStaged(sha1)).toBe(false);
  });

  it("switches the asset to MediaWiki's images path, drops the staged copy and marks the pages that use the file stale", async () => {
    const sha1 = await stagedUpload(png(3));
    imageInfo(null);
    wiki.on("upload", () => ({ upload: { result: "Success" } }));

    await runUploadJob(uploadJob(sha1));

    const { shard } = MediaAssetService.getMd5ShardPath("Flag of Eurth.png");
    expect(tables.wikiAsset.rows[0]).toMatchObject({
      url: `${mediaWikiOrigin().replace(/\/+$/, "")}/images/${shard}/Flag_of_Eurth.png`,
      thumbnailUrl: null,
      sha1,
    });
    expect(String(tables.wikiAsset.rows[0]?.url).startsWith(STAGED_FILE_PATH)).toBe(false);
    expect(await isStaged(sha1)).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
    expect(executedSql).toHaveLength(1);
    expect(executedSql[0]?.sql).toContain("wiki_image_links");
    expect(executedSql[0]?.values).toContain("Flag of Eurth.png");
  });

  it("fails the job, and switches nothing, when the pages that use the file cannot be marked stale; the retry does both (review minor 2)", async () => {
    const bytes = png(21);
    const sha1 = await stagedUpload(bytes);
    imageInfo(null);
    wiki.on("upload", () => ({ upload: { result: "Success" } }));
    jest.spyOn(db, "$executeRaw").mockRejectedValueOnce(new Error("db down"));

    await expect(runUploadJob(uploadJob(sha1))).rejects.toThrow("db down");

    // one transaction: the asset still serves the staged copy, which is still there
    expect(tables.wikiAsset.rows[0]?.url).toBe(`${STAGED_FILE_PATH}Flag_of_Eurth.png`);
    expect(await isStaged(sha1)).toBe(true);

    // the retry finds the file in MediaWiki already, and finishes
    imageInfo(sha1Of(bytes));
    await runUploadJob(uploadJob(sha1));
    expect(String(tables.wikiAsset.rows[0]?.url)).toContain("/images/");
    expect(await isStaged(sha1)).toBe(false);
    expect(calls("upload")).toHaveLength(1);
  });

  it("is done when MediaWiki refuses the upload as no change and its hash agrees", async () => {
    const bytes = png(4);
    const sha1 = await stagedUpload(bytes);
    let asked = 0;
    wiki.on("query", () => ({
      query: {
        pages: [
          ++asked === 1
            ? { title: "File:Flag of Eurth.png", missing: true }
            : { title: "File:Flag of Eurth.png", imageinfo: [{ sha1: sha1Of(bytes) }] },
        ],
      },
    }));
    wiki.on("upload", () => ({
      error: { code: "fileexists-no-change", info: "an exact duplicate" },
    }));

    await expect(runUploadJob(uploadJob(sha1))).resolves.toBeUndefined();
    expect(String(tables.wikiAsset.rows[0]?.url)).toContain("/images/");
  });

  it("fails when MediaWiki refuses it as no change but does not hold the bytes", async () => {
    const sha1 = await stagedUpload(png(5));
    imageInfo(null);
    wiki.on("upload", () => ({
      error: { code: "fileexists-no-change", info: "an exact duplicate" },
    }));

    await expect(runUploadJob(uploadJob(sha1))).rejects.toThrow("fileexists-no-change");
    expect(tables.wikiAsset.rows[0]?.url).toBe(`${STAGED_FILE_PATH}Flag_of_Eurth.png`);
    expect(await isStaged(sha1)).toBe(true);
  });

  it("fails on a refusal (the bot may not upload) and keeps everything for the retry", async () => {
    const sha1 = await stagedUpload(png(6));
    imageInfo(null);
    wiki.on("upload", () => ({ error: { code: "permissiondenied", info: "no upload right" } }));

    await expect(runUploadJob(uploadJob(sha1))).rejects.toThrow("permissiondenied");
    expect(tables.wikiAsset.rows[0]?.url).toBe(`${STAGED_FILE_PATH}Flag_of_Eurth.png`);
    expect(await isStaged(sha1)).toBe(true);
    expect(executedSql).toHaveLength(0);
  });

  it("fails on a warning answer (WikiOS asked to ignore them, so it is not a success)", async () => {
    const sha1 = await stagedUpload(png(7));
    imageInfo(null);
    wiki.on("upload", () => ({ upload: { result: "Warning", warnings: { badfilename: "x" } } }));

    await expect(runUploadJob(uploadJob(sha1))).rejects.toThrow("did not take the upload");
    expect(await isStaged(sha1)).toBe(true);
  });

  it("writes nothing when the bot password is wrong: the job fails before any upload", async () => {
    const sha1 = await stagedUpload(png(8));
    wiki = createFakeMediaWiki({ loginResult: "Failed" });
    globalThis.fetch = wiki.fetch as unknown as typeof fetch;

    await expect(runUploadJob(uploadJob(sha1))).rejects.toThrow(
      "MediaWiki bot login failed: Failed"
    );

    expect(calls("upload")).toHaveLength(0);
    expect(calls("query")).toHaveLength(0);
    expect(tables.wikiAsset.rows[0]?.url).toBe(`${STAGED_FILE_PATH}Flag_of_Eurth.png`);
    expect(await isStaged(sha1)).toBe(true);
  });

  it("fails, for the retry and the alert, when the staged file is gone and MediaWiki does not hold it", async () => {
    const sha1 = await stagedUpload(png(9));
    rmSync(join(directory, sha1));
    imageInfo(null);

    await expect(runUploadJob(uploadJob(sha1))).rejects.toThrow(
      "is gone, and MediaWiki does not hold it"
    );
    expect(calls("upload")).toHaveLength(0);
  });

  it("finishes a job whose staged file is gone when MediaWiki holds the bytes (a run that died after the upload)", async () => {
    const bytes = png(10);
    const sha1 = await stagedUpload(bytes);
    rmSync(join(directory, sha1));
    imageInfo(sha1Of(bytes));

    await runUploadJob(uploadJob(sha1));

    expect(String(tables.wikiAsset.rows[0]?.url)).toContain("/images/");
  });
});

describe("what the staged copy is kept for", () => {
  it("keeps the copy of an older version that another upload job still names, and the asset on its newer version", async () => {
    const older = png(11);
    const newer = png(12);
    const olderSha1 = await stagedUpload(older);
    const newerSha1 = await stagedUpload(newer); // the asset row is now on the newer version
    tables.wikiMirrorJob.seed(
      uploadJob(olderSha1, { id: "job-up-1" }),
      uploadJob(newerSha1, { id: "job-up-2", state: "pending", attempts: 0 })
    );
    imageInfo(null);
    wiki.on("upload", () => ({ upload: { result: "Success" } }));

    await runUploadJob(uploadJob(olderSha1, { id: "job-up-1" }));

    // the asset's newer version is still waiting for its own job: nothing was switched, both copies stay
    expect(tables.wikiAsset.rows[0]).toMatchObject({
      sha1: newerSha1,
      url: `${STAGED_FILE_PATH}Flag_of_Eurth.png`,
    });
    expect(await isStaged(newerSha1)).toBe(true);
    // the older copy is no longer anyone's but this job's: released
    expect(await isStaged(olderSha1)).toBe(false);
  });

  it("keeps a copy that a dead upload job needs for its requeue, and one a duplicate asset still serves", async () => {
    const bytes = png(13);
    const sha1 = await stagedUpload(bytes);
    tables.wikiMirrorJob.seed(uploadJob(sha1, { id: "job-dead", state: "dead", attempts: 8 }));
    imageInfo(sha1Of(bytes));

    await runUploadJob(uploadJob(sha1, { id: "job-up-1" }));
    expect(await isStaged(sha1)).toBe(true);

    // an asset under another name still serves the same bytes from the staging directory
    tables.wikiMirrorJob.reset();
    tables.wikiAsset.seed({
      title: "Copy.png",
      slug: "copy.png",
      filename: "Copy.png",
      md5Hash: "c".repeat(32),
      url: `${STAGED_FILE_PATH}Copy.png`,
      mimeType: "image/png",
      sizeBytes: bytes.length,
      sha1,
    });
    await runUploadJob(uploadJob(sha1, { id: "job-up-1" }));
    expect(await isStaged(sha1)).toBe(true);
  });
});
