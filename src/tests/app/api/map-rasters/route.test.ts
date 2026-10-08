/** @jest-environment node */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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

import { GET as getTile } from "~/app/api/map-rasters/[realm]/[layer]/[version]/[z]/[x]/[y]/route";
import { GET as getLegend } from "~/app/api/map-rasters/[realm]/[layer]/[version]/legend/route";

const VERSION = "0123456789abcdef";
let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "map-rasters-"));
  process.env.MAP_RASTER_DIR = root;
  const dir = path.join(root, "r_eurth", "geography", VERSION);
  mkdirSync(path.join(dir, "2", "1"), { recursive: true });
  writeFileSync(path.join(dir, "2", "1", "3.webp"), Uint8Array.from([7, 8, 9]));
  writeFileSync(path.join(dir, "legend.webp"), Uint8Array.from([4, 5]));
  // A file next to the realm folders that no URL may reach
  writeFileSync(path.join(root, "secret.webp"), Uint8Array.from([1]));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.MAP_RASTER_DIR;
});

beforeEach(() => {
  jest.clearAllMocks();
  realmFind.mockResolvedValue({ id: "r_eurth", status: "active", ownerId: "clerk_owner" });
});

const tile = (realm: string, layer: string, version: string, z: string, x: string, y: string) =>
  getTile(
    new NextRequest(`http://localhost/api/map-rasters/${realm}/${layer}/${version}/${z}/${x}/${y}`),
    {
      params: Promise.resolve({ realm, layer, version, z, x, y }),
    }
  );

const legend = (realm: string, layer: string, version: string) =>
  getLegend(
    new NextRequest(`http://localhost/api/map-rasters/${realm}/${layer}/${version}/legend`),
    {
      params: Promise.resolve({ realm, layer, version }),
    }
  );

describe("GET /api/map-rasters", () => {
  it("serves a published realm's tile as WebP, cached for good (the URL names the version)", async () => {
    const res = await tile("r_eurth", "geography", VERSION, "2", "1", "3");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(Uint8Array.from([7, 8, 9]));
  });

  it("serves the layer's legend", async () => {
    const res = await legend("r_eurth", "geography", VERSION);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(Uint8Array.from([4, 5]));
  });

  it("404s on a tile that was not built", async () => {
    expect((await tile("r_eurth", "geography", VERSION, "2", "0", "0")).status).toBe(404);
    expect((await legend("r_eurth", "climate", VERSION)).status).toBe(404);
  });

  it.each([
    ["a realm with a dot", "..", "geography", VERSION, "0", "0", "0"],
    ["a layer that climbs out", "r_eurth", "..", VERSION, "0", "0", "0"],
    ["a version that is not a hash", "r_eurth", "geography", "../..", "0", "0", "0"],
    ["an empty coordinate", "r_eurth", "geography", VERSION, "", "0", "0"],
    ["a coordinate outside the pyramid", "r_eurth", "geography", VERSION, "2", "4", "0"],
    ["a zoom above the largest", "r_eurth", "geography", VERSION, "9", "0", "0"],
    ["a signed coordinate", "r_eurth", "geography", VERSION, "2", "+1", "3"],
  ])("404s on %s without looking up the realm", async (_n, realm, layer, version, z, x, y) => {
    expect((await tile(realm, layer, version, z, x, y)).status).toBe(404);
    expect(realmFind).not.toHaveBeenCalled();
  });

  it("hides a draft realm's art from anyone who cannot see the realm", async () => {
    realmFind.mockResolvedValue({ id: "r_eurth", status: "draft", ownerId: "clerk_owner" });
    expect((await tile("r_eurth", "geography", VERSION, "2", "1", "3")).status).toBe(404);
  });

  it("serves a draft realm's art to its owner, uncached", async () => {
    realmFind.mockResolvedValue({ id: "r_eurth", status: "draft", ownerId: "clerk_owner" });
    auth.mockResolvedValueOnce({ userId: "clerk_owner" });
    userFind.mockResolvedValueOnce({
      id: "u1",
      clerkUserId: "clerk_owner",
      role: { name: "user", level: 100 },
    });
    const res = await tile("r_eurth", "geography", VERSION, "2", "1", "3");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
