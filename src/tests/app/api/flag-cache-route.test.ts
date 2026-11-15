/** @jest-environment node */
/** GET /api/flag-cache?action=flags is admin-only and takes at most 50 country names; stats stay public. */
const mockRequireAdmin = jest.fn();
const mockResolveBatch = jest.fn();

jest.mock("~/server/shared/route-auth", () => ({
  requireAdminSession: () => mockRequireAdmin(),
}));
jest.mock("~/lib/flags/server", () => ({
  serverFlagResolver: {
    resolveBatch: (names: string[]) => mockResolveBatch(names),
    stats: () => ({
      hits: 0,
      misses: 0,
      placeholders: 0,
      memoryCacheSize: 0,
      inFlightRequests: 0,
    }),
  },
}));
jest.mock("~/trpc/server", () => ({ api: { countries: { getAll: jest.fn() } } }));

import { NextRequest, NextResponse } from "next/server";
import { GET } from "~/app/api/flag-cache/route";

const get = (query: string) => GET(new NextRequest(`http://localhost/api/flag-cache?${query}`));

describe("GET /api/flag-cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" });
    mockResolveBatch.mockResolvedValue(new Map());
  });

  it("refuses action=flags without an admin session", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: "Admin access required" }, { status: 403 })
    );
    const res = await get("action=flags&countries=A");
    expect(res.status).toBe(403);
    expect(mockResolveBatch).not.toHaveBeenCalled();
  });

  it("refuses more than 50 names for an admin", async () => {
    const names = Array.from({ length: 51 }, (_, i) => `Country${i}`).join(",");
    const res = await get(`action=flags&countries=${names}`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("At most 50 countries per request");
    expect(mockResolveBatch).not.toHaveBeenCalled();
  });

  it("resolves 3 requested names for an admin", async () => {
    const res = await get("action=flags&countries=A,B,C");
    expect(res.status).toBe(200);
    expect(mockResolveBatch).toHaveBeenCalledWith(["A", "B", "C"]);
  });

  it("keeps action=stats public", async () => {
    const res = await get("action=stats");
    expect(res.status).toBe(200);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });
});
