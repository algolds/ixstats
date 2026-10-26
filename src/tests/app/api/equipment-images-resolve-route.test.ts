/** @jest-environment node */
import { NextRequest, NextResponse } from "next/server";

jest.mock("~/lib/cache", () => ({
  rateLimiter: { check: jest.fn() },
}));
jest.mock("~/server/shared/route-auth", () => ({
  requireAdminSession: jest.fn(),
}));
jest.mock("~/server/services/wikimedia-equipment-image-resolver", () => ({
  resolveEquipmentImage: jest.fn(),
  batchResolveImages: jest.fn(),
  getImageCacheStats: jest.fn(),
}));

import { rateLimiter } from "~/lib/cache";
import { requireAdminSession } from "~/server/shared/route-auth";
import {
  batchResolveImages,
  resolveEquipmentImage,
} from "~/server/services/wikimedia-equipment-image-resolver";
import { GET, POST } from "~/app/api/equipment-images/resolve/route";

const URL_BASE = "http://localhost:3000/api/equipment-images/resolve";
const post = (ids: unknown) =>
  new NextRequest(URL_BASE, { method: "POST", body: JSON.stringify({ ids }) });

describe("/api/equipment-images/resolve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireAdminSession).mockResolvedValue({ userId: "admin_1" });
    jest
      .mocked(rateLimiter.check)
      .mockResolvedValue({ success: true, resetAt: new Date(Date.now() + 60_000) } as never);
    jest.mocked(batchResolveImages).mockResolvedValue([]);
    jest.mocked(resolveEquipmentImage).mockResolvedValue({
      success: true,
      imageUrl: "https://upload.wikimedia.org/a.jpg",
      cached: true,
      source: "database",
      timestamp: new Date(),
    });
  });

  it.each([401, 403])(
    "passes the guard's %i through without resolving anything",
    async (status) => {
      jest
        .mocked(requireAdminSession)
        .mockResolvedValue(NextResponse.json({ error: "no" }, { status }));
      expect((await GET(new NextRequest(`${URL_BASE}?id=x`))).status).toBe(status);
      expect((await POST(post(["x"]))).status).toBe(status);
      expect(resolveEquipmentImage).not.toHaveBeenCalled();
      expect(batchResolveImages).not.toHaveBeenCalled();
    }
  );

  it("answers 429 past the per-admin rate limit", async () => {
    jest
      .mocked(rateLimiter.check)
      .mockResolvedValue({ success: false, resetAt: new Date(Date.now() + 30_000) } as never);
    const res = await POST(post(["x"]));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(jest.mocked(rateLimiter.check).mock.calls[0]?.[0]).toBe("admin_1");
    expect(batchResolveImages).not.toHaveBeenCalled();
  });

  it("caps a batch at 20 ids and refuses ids that are not short strings", async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `id${i}`);
    expect((await POST(post(tooMany))).status).toBe(400);
    expect((await POST(post([{ id: 1 }]))).status).toBe(400);
    expect((await POST(post(["x".repeat(65)]))).status).toBe(400);
    expect(batchResolveImages).not.toHaveBeenCalled();
  });

  it("resolves a batch for an admin, once per distinct id", async () => {
    const res = await POST(post(["a", "b", "a"]));
    expect(res.status).toBe(200);
    expect(batchResolveImages).toHaveBeenCalledWith(["a", "b"]);
  });

  it("resolves one id for an admin", async () => {
    const res = await GET(new NextRequest(`${URL_BASE}?id=a`));
    expect(res.status).toBe(200);
    expect(resolveEquipmentImage).toHaveBeenCalledWith("a");
  });
});
