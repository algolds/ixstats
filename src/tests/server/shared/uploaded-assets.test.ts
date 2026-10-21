/** @jest-environment node */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
const mockUpsert = jest.fn<Promise<unknown>, [unknown]>();
const mockFindMany = jest.fn<Promise<unknown[]>, [unknown]>();

jest.mock("~/server/db", () => ({
  db: {
    uploadedAsset: {
      upsert: (a: unknown) => mockUpsert(a),
      findMany: (a: unknown) => mockFindMany(a),
    },
  },
}));

import {
  registerUploadedAsset,
  listUploadedAssets,
  type RegisterUploadedAssetInput,
  type UploadedAssetRecord,
} from "~/server/shared/uploaded-assets";

async function registered(input: RegisterUploadedAssetInput): Promise<UploadedAssetRecord> {
  const result = await registerUploadedAsset(input);
  if (!result.ok) throw new Error(`register failed: ${result.reason}`);
  return result.record;
}

let dir: string;
let pngPath: string;
const originalUploadDir = process.env.UPLOAD_DIR;

beforeEach(async () => {
  mockUpsert.mockReset();
  mockFindMany.mockReset();
  mockUpsert.mockImplementation(async (args) => {
    const { create } = args as { create: Record<string, unknown> };
    return { id: "a1", createdAt: new Date("2026-10-09T00:00:00Z"), ...create };
  });
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "uploaded-assets-"));
  process.env.UPLOAD_DIR = dir;
  pngPath = path.join(dir, "tiny.png");
  const png = await sharp({
    create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
    .png()
    .toBuffer();
  await fs.writeFile(pngPath, png);
});

afterEach(async () => {
  if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = originalUploadDir;
  await fs.rm(dir, { recursive: true, force: true });
});

describe("registerUploadedAsset", () => {
  it("makes no thumbnail for a picture over the pixel limit", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.WIKIOS_MAX_IMAGE_AREA = "100";
    try {
      const record = await registered({
        filePath: pngPath,
        url: "/images/uploads/tiny.png",
        mimeType: "image/png",
        source: "upload",
      });
      expect(record.thumbUrl).toBeNull();
      await expect(fs.stat(`${pngPath}.thumb.webp`)).rejects.toThrow();
    } finally {
      delete process.env.WIKIOS_MAX_IMAGE_AREA;
      warn.mockRestore();
    }
  });

  it("stores a restricted visibility", async () => {
    await registerUploadedAsset({
      filePath: pngPath,
      url: "/images/uploads/forum/staff.png",
      mimeType: "image/png",
      source: "forum",
      sourceRef: "s1",
      visibility: "restricted",
    });
    const args = mockUpsert.mock.calls[0]![0] as { create: { visibility: string } };
    expect(args.create.visibility).toBe("restricted");
  });
  describe("input validation", () => {
    const rejects = async (input: RegisterUploadedAssetInput) => {
      const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const result = await registerUploadedAsset(input);
      error.mockRestore();
      expect(result).toEqual({ ok: false, reason: "invalid-input", retryable: false });
      expect(mockUpsert).not.toHaveBeenCalled();
    };

    it("rejects a file outside uploadsDir with no fs write", async () => {
      const outside = await fs.mkdtemp(path.join(os.tmpdir(), "outside-"));
      const outsidePng = path.join(outside, "o.png");
      await fs.copyFile(pngPath, outsidePng);
      try {
        await rejects({ filePath: outsidePng, url: "/images/uploads/o.png", mimeType: "image/png", source: "forum" });
        await expect(fs.stat(`${outsidePng}.thumb.webp`)).rejects.toThrow();
      } finally {
        await fs.rm(outside, { recursive: true, force: true });
      }
    });

    it("rejects a sibling directory that merely shares the uploadsDir prefix", async () => {
      const sibling = `${dir}-evil`;
      await fs.mkdir(sibling);
      const siblingPng = path.join(sibling, "s.png");
      await fs.copyFile(pngPath, siblingPng);
      try {
        await rejects({ filePath: siblingPng, url: "/images/uploads/s.png", mimeType: "image/png", source: "forum" });
        await expect(fs.stat(`${siblingPng}.thumb.webp`)).rejects.toThrow();
      } finally {
        await fs.rm(sibling, { recursive: true, force: true });
      }
    });

    it("rejects a path that climbs out of uploadsDir", async () => {
      await rejects({
        filePath: path.join(dir, "..", path.basename(dir) + "-x", "a.png"),
        url: "/images/uploads/a.png",
        mimeType: "image/png",
        source: "forum",
      });
    });

    it("rejects an external url", async () => {
      await rejects({ filePath: pngPath, url: "https://evil.example/a.png", mimeType: "image/png", source: "forum" });
      await expect(fs.stat(`${pngPath}.thumb.webp`)).rejects.toThrow();
    });

    it("rejects a javascript: url and a url with ..", async () => {
      await rejects({ filePath: pngPath, url: "javascript:alert(1)", mimeType: "image/png", source: "forum" });
      await rejects({ filePath: pngPath, url: "/images/uploads/../../a.png", mimeType: "image/png", source: "forum" });
      await expect(fs.stat(`${pngPath}.thumb.webp`)).rejects.toThrow();
    });
  });
});

describe("listUploadedAssets", () => {
  const row = (id: string, iso: string) => ({
    id,
    url: `/u/${id}.png`,
    thumbUrl: null,
    title: id,
    mimeType: "image/png",
    width: 1,
    height: 1,
    sizeBytes: 1,
    blurhash: null,
    source: "upload",
    visibility: "public",
    createdAt: new Date(iso),
  });
  it("lists only public assets for the forum source", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await listUploadedAssets({ source: "forum", limit: 5 });
    const args = mockFindMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(args.where).toMatchObject({ source: "forum", visibility: "public" });
  });

  it("lists the caller's own uploads regardless of visibility", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await listUploadedAssets({ source: "upload", uploaderClerkId: "user_1", limit: 5 });
    const args = mockFindMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(args.where).not.toHaveProperty("visibility");
  });
});
