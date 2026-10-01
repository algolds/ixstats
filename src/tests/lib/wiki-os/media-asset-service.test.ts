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

describe("MediaAssetService MD5 Shard Path Calculation", () => {
  it("calculates accurate MD5 shards and paths for filenames", () => {
    const result1 = MediaAssetService.getMd5ShardPath("Caphiria_flag.svg");
    expect(result1.shard).toBeDefined();
    expect(result1.fullPath).toContain("Caphiria_flag.svg");
    expect(result1.cleanName).toBe("Caphiria_flag.svg");

    const result2 = MediaAssetService.getMd5ShardPath("File:National Emblem of Vesper.png");
    expect(result2.cleanName).toBe("National_Emblem_of_Vesper.png");
    expect(result2.fullPath).toContain("National_Emblem_of_Vesper.png");
  });
});

describe("recordUpload", () => {
  it("creates the row served from WikiOS, with no made-up blurhash and no thumbnail", async () => {
    const asset = await db.$transaction((tx) =>
      MediaAssetService.recordUpload(tx, upload("Flag of Eurth.png", "s".repeat(31)))
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

  it("replaces the facts of a name that has a row, wherever its old URL pointed", async () => {
    tables.wikiAsset.seed({
      title: "Old.png",
      slug: "old.png",
      filename: "Old.png",
      url: "https://ixwiki.com/images/a/ab/Old.png",
      thumbnailUrl: "https://ixwiki.com/images/thumb/a/ab/Old.png/300px-Old.png",
      mimeType: "image/png",
      sizeBytes: 1,
      md5Hash: MediaAssetService.getMd5ShardPath("Old.png").hash,
    });

    await db.$transaction((tx) =>
      MediaAssetService.recordUpload(tx, upload("Old.png", "n".repeat(31)))
    );

    expect(tables.wikiAsset.rows).toHaveLength(1);
    expect(tables.wikiAsset.rows[0]).toMatchObject({
      url: "/api/wiki/file/Old.png",
      thumbnailUrl: null,
      sizeBytes: 100,
      sha1: "n".repeat(31),
    });
  });

  it("gives a name whose slug another file took a slug of its own", async () => {
    await db.$transaction((tx) =>
      MediaAssetService.recordUpload(tx, upload("Flag.png", "a".repeat(31)))
    );
    await db.$transaction((tx) =>
      MediaAssetService.recordUpload(tx, upload("Flag.PNG", "b".repeat(31)))
    );

    const slugs = tables.wikiAsset.rows.map((row) => row.slug);
    expect(new Set(slugs).size).toBe(2);
    expect(slugs[0]).toBe("flag.png");
    expect(slugs[1]).toMatch(/^flag_[0-9a-f]{6}\.png$/);
  });
});

describe("markMirrored", () => {
  it("switches the asset to MediaWiki's images path once MediaWiki holds that version", async () => {
    await db.$transaction((tx) =>
      MediaAssetService.recordUpload(tx, upload("Flag of Eurth.png", "v".repeat(31)))
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
      MediaAssetService.recordUpload(tx, upload("Flag.png", "2".repeat(31)))
    );

    const switched = await MediaAssetService.markMirrored("Flag.png", "1".repeat(31));

    expect(switched).toBe(false);
    expect(tables.wikiAsset.rows[0]?.url).toBe("/api/wiki/file/Flag.png");
    expect(await MediaAssetService.isStillStaged("2".repeat(31))).toBe(true);
    expect(await MediaAssetService.isStillStaged("1".repeat(31))).toBe(false);
  });
});

describe("findDuplicates", () => {
  it("lists the other names that hold the same content", async () => {
    await db.$transaction((tx) =>
      MediaAssetService.recordUpload(tx, upload("A.png", "d".repeat(31)))
    );
    await db.$transaction((tx) =>
      MediaAssetService.recordUpload(tx, upload("B.png", "d".repeat(31)))
    );
    await db.$transaction((tx) =>
      MediaAssetService.recordUpload(tx, upload("C.png", "e".repeat(31)))
    );

    expect(await MediaAssetService.findDuplicates("d".repeat(31), "A.png")).toEqual(["B.png"]);
    expect(await MediaAssetService.findDuplicates("d".repeat(31), "Z.png")).toEqual([
      "A.png",
      "B.png",
    ]);
  });
});

describe("registerAsset", () => {
  it("makes up no blurhash for a file it only knows by name", async () => {
    const asset = await MediaAssetService.registerAsset({ filename: "Seen_in_MediaWiki.png" });

    expect(asset.blurhash).toBeNull();
  });
});
