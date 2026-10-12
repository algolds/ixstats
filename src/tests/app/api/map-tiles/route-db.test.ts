/** @jest-environment node */
/**
 * The tile route end to end against the clone DB (real realm lookup, version read and PostGIS tiles; the tile cache
 * is a temp folder). Runs only with TILES_DB_URL set, like src/tests/server/geo/tiles-db.test.ts; read-only SQL.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { NextRequest } from "next/server";

const url = process.env.TILES_DB_URL;
const run = url ? describe : describe.skip;

jest.mock("@clerk/nextjs/server", () => ({ auth: () => Promise.resolve({ userId: null }) }));
jest.mock("~/server/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
  return { db: new PrismaClient({ datasourceUrl: process.env.TILES_DB_URL }) };
});

import { db } from "~/server/db";
import { GET } from "~/app/api/map-tiles/[realm]/[version]/[layer]/[z]/[x]/[y]/route";

const get = (realm: string, version: number, layer: string, z: number, x: number, y: number) => {
  const params = {
    realm,
    version: String(version),
    layer,
    z: String(z),
    x: String(x),
    y: String(y),
  };
  return GET(
    new NextRequest(`http://localhost/api/map-tiles/${realm}/${version}/${layer}/${z}/${x}/${y}`),
    {
      params: Promise.resolve(params),
    }
  );
};

const decode = (bytes: Uint8Array, layer: string) =>
  new VectorTile(new PbfReader(bytes)).layers[layer];

run("GET /api/map-tiles against the clone DB", () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "map-tiles-db-"));
    process.env.MAP_TILE_DIR = root;
  });
  afterAll(async () => {
    rmSync(root, { recursive: true, force: true });
    delete process.env.MAP_TILE_DIR;
    await db.$disconnect();
  });

  const versionOf = async (id: string) =>
    (await db.realm.findUnique({ where: { id }, select: { mapVersion: true } }))?.mapVersion ?? 0;

  // Ixnay's altitudes crossing +-180 lie between 34S and 25N: the z2 tiles at both edges of the world
  it.each([
    [2, 0, 2],
    [2, 3, 2],
    [2, 0, 1],
    [2, 3, 1],
  ])(
    "renders the antimeridian altitudes tile %i/%i/%i, then serves it from disk without SQL",
    async (z, x, y) => {
      const version = await versionOf("default");
      const cold = await get("default", version, "altitudes", z, x, y);
      expect(cold.status).toBe(200);
      expect(cold.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      const bytes = new Uint8Array(await cold.arrayBuffer());
      expect(bytes.length).toBeGreaterThan(0);
      expect(decode(bytes, "altitudes")?.length).toBeGreaterThan(0);

      const spy = jest.spyOn(db, "$queryRawUnsafe");
      const warm = await get("default", version, "altitudes", z, x, y);
      expect(new Uint8Array(await warm.arrayBuffer())).toEqual(bytes);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  );

  it("serves a tile with nothing in it as an empty 200", async () => {
    const version = await versionOf("default");
    const res = await get("default", version, "lakes", 6, 0, 0);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer()).length).toBe(0);
  });

  it("answers a realm by id and by slug with the same tile", async () => {
    const realm = await db.realm.findFirst({
      where: { id: { not: "default" }, status: "active" },
      select: { id: true, slug: true, mapVersion: true },
    });
    if (!realm) return;
    const byId = await get(realm.id, realm.mapVersion, "altitudes", 0, 0, 0);
    const bySlug = await get(realm.slug, realm.mapVersion, "altitudes", 0, 0, 0);
    expect([byId.status, bySlug.status]).toEqual([200, 200]);
    expect(new Uint8Array(await bySlug.arrayBuffer())).toEqual(
      new Uint8Array(await byId.arrayBuffer())
    );
  });
});
