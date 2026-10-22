/** @jest-environment node */
/**
 * Uploaded files: the upload route stores an SVG only once it is sanitised and records it as the uploader's, a
 * registered file must sit inside the uploads directory under a local URL (no traversal, no sibling directory that
 * shares the prefix, no javascript: URL), an oversized picture gets no thumbnail, and the forum source lists public
 * assets only. Folds app/api/upload/image-route.
 */
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
jest.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "user_1" }) }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { check: async () => ({ success: true, resetAt: new Date() }) },
}));

import type { NextRequest } from "next/server";
import { POST } from "~/app/api/upload/image/route";
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
        await rejects({
          filePath: outsidePng,
          url: "/images/uploads/o.png",
          mimeType: "image/png",
          source: "forum",
        });
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
        await rejects({
          filePath: siblingPng,
          url: "/images/uploads/s.png",
          mimeType: "image/png",
          source: "forum",
        });
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

    it("rejects a javascript: url and a url with ..", async () => {
      await rejects({
        filePath: pngPath,
        url: "javascript:alert(1)",
        mimeType: "image/png",
        source: "forum",
      });
      await rejects({
        filePath: pngPath,
        url: "/images/uploads/../../a.png",
        mimeType: "image/png",
        source: "forum",
      });
      await expect(fs.stat(`${pngPath}.thumb.webp`)).rejects.toThrow();
    });
  });
});

describe("listUploadedAssets", () => {
  it("lists only public assets for the forum source", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await listUploadedAssets({ source: "forum", limit: 5 });
    const args = mockFindMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(args.where).toMatchObject({ source: "forum", visibility: "public" });
  });
});

describe("the upload route", () => {
  const upload = (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return POST({ formData: async () => form } as unknown as NextRequest);
  };

  it("refuses an SVG it cannot sanitise, writing and recording nothing", async () => {
    const before = await fs.readdir(dir);
    const res = await upload(
      new File(["<script>alert(1)</script>"], "x.svg", { type: "image/svg+xml" })
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("SVG could not be sanitised");
    expect(await fs.readdir(dir)).toEqual(before);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("stores a sanitised SVG and records it as the uploader's", async () => {
    const res = await upload(
      new File(['<svg onload="x()"><rect/></svg>'], "ok.svg", { type: "image/svg+xml" })
    );
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    const stored = await fs.readFile(path.join(dir, path.basename(url)), "utf8");
    expect(stored).not.toContain("onload");
    const args = mockUpsert.mock.calls[0]![0] as { create: Record<string, unknown> };
    expect(args.create).toMatchObject({
      source: "upload",
      uploaderClerkId: "user_1",
      mimeType: "image/svg+xml",
      url,
    });
  });
});
