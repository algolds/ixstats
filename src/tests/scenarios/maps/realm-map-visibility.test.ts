/** @jest-environment node */
/**
 * Scenario: a realm's map while it is a draft, once it is published, and after it is taken out of publication, as
 * the three map routes serve it (vector tiles, packed layers, raster art). A draft's map is its owner's only and never
 * cacheable; a published realm's id-addressed URLs are immutable, its slug-addressed ones short-lived; unpublishing
 * moves the map version, so no URL served while it was public is reused, and a viewer never gets a tile that was
 * cached while it was public. The routes, the realm access memo, the tile disk cache, the realms router and the map
 * version bump are real; the database, Clerk, the tile SQL and the layer build are faked.
 */
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

const auth = jest.fn().mockResolvedValue({ userId: null });
jest.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

interface RealmRow {
  id: string;
  slug: string;
  status: string;
  ownerId: string;
  mapVersion: number;
}
const realms: RealmRow[] = [];
const userFind = jest.fn().mockResolvedValue(null);
const fakeDb = {
  realm: {
    findUnique: jest.fn(
      async ({ where, select }: { where: { id?: string; slug?: string }; select?: object }) => {
        const row = realms.find((r) =>
          where.id !== undefined ? r.id === where.id : r.slug === where.slug
        );
        if (!row) return null;
        return select && "mapVersion" in select && !("status" in select)
          ? { mapVersion: row.mapVersion }
          : { ...row };
      }
    ),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<RealmRow> }) => {
      const row = realms.find((r) => r.id === where.id);
      if (!row) throw new Error("no such realm");
      return Object.assign(row, data);
    }),
  },
  user: { findUnique: (a: unknown) => userFind(a) },
  auditLog: { create: jest.fn() },
  // invalidateRealmMap: UPDATE "realms" SET "mapVersion" = ... WHERE "id" = $1 RETURNING "mapVersion"
  $queryRaw: jest.fn(async (_sql: TemplateStringsArray, realmId: string) => {
    const row = realms.find((r) => r.id === realmId);
    if (row) row.mapVersion += 1;
    return row ? [{ mapVersion: row.mapVersion }] : [];
  }),
};
// The routes import the db before fakeDb is initialised, so they get a proxy that reads it on use
jest.mock("~/server/db", () => ({
  db: new Proxy({}, { get: (_t, name: string) => (fakeDb as Record<string, unknown>)[name] }),
}));
const buildTile = jest.fn();
jest.mock("~/server/modules/maps/tile-render", () => ({
  buildTile: (...a: unknown[]) => buildTile(...a),
}));
const packedLayerAt = jest.fn();
jest.mock("~/server/modules/maps/layer-delivery", () => ({
  packedLayerAt: (...a: unknown[]) => packedLayerAt(...a),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import { GET as getTile } from "~/app/api/map-tiles/[realm]/[version]/[format]/[layer]/[z]/[x]/[y]/route";
import { GET as getLayer } from "~/app/api/map-layers/[realm]/[version]/[layer]/route";
import { GET as getRaster } from "~/app/api/map-rasters/[realm]/[layer]/[version]/[z]/[x]/[y]/route";
import { LAYER_FORMAT_VERSION } from "~/lib/maps/layer-format";
import { realmsRouter } from "~/server/api/routers/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const IMMUTABLE = "public, max-age=31536000, immutable";
const SHORT = "public, max-age=300";
const PRIVATE = "private, no-store";
const ART = "0123456789abcdef";
const admin = { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } };

const tile = (realm: string, version: number) =>
  getTile(new NextRequest(`http://localhost/api/map-tiles/${realm}/${version}/f1/lakes/0/0/0`), {
    params: Promise.resolve({
      realm,
      version: String(version),
      format: "f1",
      layer: "lakes",
      z: "0",
      x: "0",
      y: "0",
    }),
  });
const layer = (realm: string, version: number) =>
  getLayer(
    new NextRequest(
      `http://localhost/api/map-layers/${realm}/${version}/political?format=${LAYER_FORMAT_VERSION}`
    ),
    { params: Promise.resolve({ realm, version: String(version), layer: "political" }) }
  );
const raster = (realm: string) =>
  getRaster(new NextRequest(`http://localhost/api/map-rasters/${realm}/geography/${ART}/2/1/3`), {
    params: Promise.resolve({ realm, layer: "geography", version: ART, z: "2", x: "1", y: "3" }),
  });

/** The three routes' answers for a realm at a map version, as [status, cache-control] each. */
async function served(realm: string, version: number) {
  const answers = await Promise.all([tile(realm, version), layer(realm, version), raster(realm)]);
  return answers.map((res) => [res.status, res.headers.get("cache-control")]);
}

const setStatus = (status: "draft" | "generating" | "active") =>
  realmsRouter
    .createCaller(
      createMockRouterContext({
        db: fakeDb,
        auth: { userId: admin.clerkUserId },
        user: admin,
      }) as never
    )
    .adminUpdateRealm({ id: "r_live", status });

const asOwner = () => {
  auth.mockResolvedValue({ userId: "clerk_owner" });
  userFind.mockResolvedValue({
    id: "u1",
    clerkUserId: "clerk_owner",
    role: { name: "user", level: 100 },
  });
};
const asAnonymous = () => {
  auth.mockResolvedValue({ userId: null });
  userFind.mockResolvedValue(null);
};
const version = () => realms[0]!.mapVersion;

let tiles: string;
let art: string;
// The routes keep a realm row for 60 s; every test starts a minute after the last, so it begins with none kept
let clock = Date.now();
beforeEach(() => {
  jest.clearAllMocks();
  clock += 61_000;
  jest.spyOn(Date, "now").mockReturnValue(clock);
  tiles = mkdtempSync(path.join(tmpdir(), "scenario-tiles-"));
  art = mkdtempSync(path.join(tmpdir(), "scenario-art-"));
  process.env.MAP_TILE_DIR = tiles;
  process.env.MAP_RASTER_DIR = art;
  const built = path.join(art, "r_live", "geography", ART, "2", "1");
  mkdirSync(built, { recursive: true });
  writeFileSync(path.join(built, "3.webp"), Uint8Array.from([7, 8, 9]));
  realms.length = 0;
  realms.push({
    id: "r_live",
    slug: "live",
    status: "draft",
    ownerId: "clerk_owner",
    mapVersion: 4,
  });
  buildTile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  packedLayerAt.mockResolvedValue('{"type":"FeatureCollection","packed":4,"features":[]}');
  asAnonymous();
  // the audit middleware logs each admin update
  for (const level of ["info", "warn"] as const)
    jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  rmSync(tiles, { recursive: true, force: true });
  rmSync(art, { recursive: true, force: true });
  delete process.env.MAP_TILE_DIR;
  delete process.env.MAP_RASTER_DIR;
});

describe("a realm's map from draft to published and back", () => {
  it("keeps a draft's map to its owner, uncacheable, and renders or caches nothing for anyone else", async () => {
    const [tileAnswer, layerAnswer, rasterAnswer] = await served("r_live", 4);
    expect([tileAnswer, layerAnswer, rasterAnswer![0]]).toEqual([
      [404, "no-store"],
      [404, PRIVATE],
      404,
    ]);
    expect(buildTile).not.toHaveBeenCalled();
    expect(packedLayerAt).not.toHaveBeenCalled();
    expect(readdirSync(tiles)).toEqual([]);

    asOwner();
    expect(await served("r_live", 4)).toEqual([
      [200, PRIVATE],
      [200, PRIVATE],
      [200, PRIVATE],
    ]);
    // with no tag to revalidate the private copy against, by id or by slug
    expect((await layer("r_live", 4)).headers.get("etag")).toBeNull();
    expect((await tile("live", 4)).headers.get("cache-control")).toBe(PRIVATE);
    // the tile the owner caused to be cached is never served to anyone else, by id or by slug
    asAnonymous();
    for (const name of ["r_live", "live"]) {
      const res = await tile(name, 4);
      expect([res.status, res.headers.get("cache-control")]).toEqual([404, "no-store"]);
      expect((await res.arrayBuffer()).byteLength).toBe(0);
    }
  });

  it("serves a published realm publicly: immutable by id, briefly by slug", async () => {
    await setStatus("active");
    expect(version()).toBe(5);
    expect(await served("r_live", 5)).toEqual([
      [200, IMMUTABLE],
      [200, IMMUTABLE],
      [200, IMMUTABLE],
    ]);
    const [byTile, byLayer] = await Promise.all([tile("live", 5), layer("live", 5)]);
    expect([byTile.headers.get("cache-control"), byLayer.headers.get("cache-control")]).toEqual([
      SHORT,
      SHORT,
    ]);
  });

  it.each(["draft", "generating"] as const)(
    "takes a realm made %s out of publication at once, at a new version, and keeps its cached tiles from viewers",
    async (status) => {
      await setStatus("active");
      expect((await tile("r_live", 5)).headers.get("cache-control")).toBe(IMMUTABLE);

      await setStatus(status);
      expect(version()).toBe(6);
      for (const v of [5, 6]) {
        const [tileAnswer, layerAnswer, rasterAnswer] = await served("r_live", v);
        expect([tileAnswer, layerAnswer[0], rasterAnswer![0]]).toEqual([
          [404, "no-store"],
          404,
          404,
        ]);
      }
      asOwner();
      expect(await served("r_live", 6)).toEqual([
        [200, PRIVATE],
        [200, PRIVATE],
        [200, PRIVATE],
      ]);
    }
  );
});
