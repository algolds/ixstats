/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factory relies on the ambient global.
/**
 * media-asset-service.test.ts — WikiOS Media Asset Engine: shard paths, the record an upload leaves (plan 411), and
 * the end of the made-up blurhash and of the asset rows that a save used to invent for names that were never uploaded.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
}));

import { MediaAssetService } from "~/lib/wiki-os/core/media-asset-service";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

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
