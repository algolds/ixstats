/** @jest-environment node */
import { NextRequest } from "next/server";

const auth = jest.fn().mockResolvedValue({ userId: null });
jest.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const realmFind = jest.fn();
const userFind = jest.fn().mockResolvedValue(null);
jest.mock("~/server/db", () => ({
  db: {
    realm: { findUnique: (a: unknown) => realmFind(a) },
    user: { findUnique: (a: unknown) => userFind(a) },
  },
}));
const buildTile = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
jest.mock("~/server/api/routers/geo/core/tiles", () => ({
  buildTile: (...a: unknown[]) => buildTile(...a),
}));

import { GET } from "~/app/api/map-tiles/[realm]/[layer]/[z]/[x]/[y]/route";

const get = (realm: string, layer: string, z: string, x: string, y: string) =>
  GET(new NextRequest(`http://localhost/api/map-tiles/${realm}/${layer}/${z}/${x}/${y}`), {
    params: Promise.resolve({ realm, layer, z, x, y }),
  });

beforeEach(() => jest.clearAllMocks());

describe("GET /api/map-tiles", () => {
  it("serves an IxWorld tile with a public day-long cache", async () => {
    const res = await get("default", "rivers", "2", "1", "3");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-protobuf");
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(buildTile).toHaveBeenCalledWith(expect.anything(), "default", "rivers", 2, 1, 3);
  });

  it.each([
    ["unknown layer", "default", "political", "1", "0", "0"],
    ["climate (drawn from GeoJSON)", "default", "climate", "1", "0", "0"],
    ["fractional z", "default", "rivers", "1.5", "0", "0"],
    ["negative x", "default", "rivers", "2", "-1", "0"],
    ["x out of range", "default", "rivers", "2", "4", "0"],
    ["z above 6", "default", "rivers", "7", "0", "0"],
  ])("404s on %s without querying", async (_n, realm, layer, z, x, y) => {
    expect((await get(realm, layer, z, x, y)).status).toBe(404);
    expect(buildTile).not.toHaveBeenCalled();
  });

  it("404s on an unknown realm", async () => {
    realmFind.mockResolvedValue(null);
    expect((await get("r_nope", "lakes", "0", "0", "0")).status).toBe(404);
  });

  it("caches a published realm's tiles publicly", async () => {
    realmFind.mockResolvedValue({ id: "r_eurth", status: "active", ownerId: "clerk_owner" });
    const res = await get("r_eurth", "lakes", "0", "0", "0");
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
  });

  it("hides a draft realm from anyone who cannot moderate it", async () => {
    realmFind.mockResolvedValue({ id: "r_draft", status: "draft", ownerId: "clerk_owner" });
    expect((await get("r_draft", "lakes", "0", "0", "0")).status).toBe(404);
    expect(buildTile).not.toHaveBeenCalled();
  });

  it("serves a draft realm to its owner, uncached", async () => {
    realmFind.mockResolvedValue({ id: "r_draft", status: "draft", ownerId: "clerk_owner" });
    auth.mockResolvedValue({ userId: "clerk_owner" });
    userFind.mockResolvedValue({
      id: "u1",
      clerkUserId: "clerk_owner",
      role: { name: "user", level: 100 },
    });
    const res = await get("r_draft", "lakes", "0", "0", "0");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("answers 500 when the tile query fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    buildTile.mockRejectedValueOnce(new Error("db down"));
    expect((await get("default", "rivers", "0", "0", "0")).status).toBe(500);
  });
});
