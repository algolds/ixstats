jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("fs/promises", () => ({ readFile: jest.fn() }));

import { readFile } from "fs/promises";
import { loadLayerFromDB, loadLayerWithFallback } from "~/server/modules/maps/layer-loader";
import { clearLayerCache } from "~/server/shared/layer-cache";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
/** @jest-environment node */
/**
 * Who may read a realm's map tiles. The realm row is memoised for 60 s; the answer for the viewer never is (a
 * staff member's "private" must not reach an anonymous viewer). A tile URL names the realm by id or by slug.
 */
const auth = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const realmFind = jest.fn();
const userFind = jest.fn();
jest.mock("~/server/db", () => ({
  db: {
    realm: { findUnique: (a: unknown) => realmFind(a) },
    user: { findUnique: (a: unknown) => userFind(a) },
  },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

type Access = typeof import("~/server/modules/maps/realm-tile-access");
type Invalidation = typeof import("~/server/shared/map-invalidation");

interface Row {
  id: string;
  slug: string;
  status: string;
  ownerId: string;
}
let rows: Row[];

let access: Access;
let invalidation: Invalidation;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-10-11T12:00:00Z") });
  rows = [
    { id: "r_eurth", slug: "eurth", status: "active", ownerId: "clerk_owner" },
    { id: "r_draft", slug: "draft-world", status: "draft", ownerId: "clerk_owner" },
  ];
  realmFind.mockReset();
  realmFind.mockImplementation(async ({ where }: { where: { id?: string; slug?: string } }) => {
    const row = rows.find((r) =>
      where.id !== undefined ? r.id === where.id : r.slug === where.slug
    );
    return row ? { id: row.id, status: row.status, ownerId: row.ownerId } : null;
  });
  auth.mockReset();
  auth.mockResolvedValue({ userId: null });
  userFind.mockReset();
  userFind.mockResolvedValue(null);
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  access = require("~/server/modules/maps/realm-tile-access") as Access;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  invalidation = require("~/server/shared/map-invalidation") as Invalidation;
});
afterEach(() => jest.useRealTimers());

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

describe("resolveTileRealm", () => {
  it("is null for an unknown id or slug, and does not remember it", async () => {
    expect(await access.resolveTileRealm("nowhere")).toBeNull();
    expect(await access.resolveTileRealm("nowhere")).toBeNull();
    rows.push({ id: "r_new", slug: "nowhere", status: "active", ownerId: "clerk_owner" });
    expect(await access.resolveTileRealm("nowhere")).toEqual({ id: "r_new", access: "public" });
  });
  it("hides an unpublished realm from anyone who cannot moderate it", async () => {
    expect(await access.resolveTileRealm("r_draft")).toBeNull();
    expect(await access.resolveTileRealm("draft-world")).toBeNull();
  });
  it("never lets a staff member's answer reach an anonymous viewer through the memo", async () => {
    asOwner();
    expect(await access.resolveTileRealm("r_draft")).toEqual({ id: "r_draft", access: "private" });
    asAnonymous();
    expect(await access.resolveTileRealm("r_draft")).toBeNull();
    expect(await access.resolveTileRealm("draft-world")).toBeNull();
    asOwner();
    expect(await access.resolveTileRealm("r_draft")).toEqual({ id: "r_draft", access: "private" });
    // The realm row was read once per name; the viewer was asked every time
    expect(realmFind.mock.calls.filter(([a]) => a.where.id === "r_draft")).toHaveLength(1);
    expect(auth).toHaveBeenCalledTimes(4);
  });
  it("reads the realm again after its map was invalidated", async () => {
    expect(await access.resolveTileRealm("r_draft")).toBeNull();
    rows[1]!.status = "active";
    expect(await access.resolveTileRealm("r_draft")).toBeNull();
    await invalidation.invalidateRealmMap(
      { $queryRaw: jest.fn().mockResolvedValue([{ mapVersion: 1 }]) },
      "r_draft"
    );
    expect(await access.resolveTileRealm("r_draft")).toEqual({ id: "r_draft", access: "public" });
  });
});

describe("layers load per realm", () => {
  const readFileMock = readFile as unknown as jest.Mock;
  const square = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  };
  function row(featureId: string) {
    return {
      featureId,
      geometry: square,
      properties: {},
      displayName: featureId,
      countryId: null,
      areaSqKm: 1,
      centroid: [0.5, 0.5],
    };
  }
  function makeDb(rows: ReturnType<typeof row>[]) {
    return {
      mapLayer: { findMany: jest.fn().mockResolvedValue(rows) },
      countrySovereignty: { findMany: jest.fn().mockResolvedValue([]) },
    };
  }
  function whereOf(db: ReturnType<typeof makeDb>, call = 0) {
    return db.mapLayer.findMany.mock.calls[call][0].where;
  }
  describe("loadLayerFromDB is realm-scoped", () => {
    beforeEach(() => {
      clearLayerCache();
      readFileMock.mockReset();
    });

    it("filters the layer query by the requested realm", async () => {
      const db = makeDb([row("l1")]);
      await loadLayerFromDB(db, "lakes", 1, "r_eurth");

      expect(whereOf(db)).toMatchObject({ layerType: "lakes", isActive: true, realmId: "r_eurth" });
    });
    it("never serves one realm's cached layer to another realm", async () => {
      const db = makeDb([row("l1")]);
      await loadLayerFromDB(db, "lakes", 1, DEFAULT_REALM_ID);
      await loadLayerFromDB(db, "lakes", 1, "r_eurth");

      expect(db.mapLayer.findMany).toHaveBeenCalledTimes(2);
      expect(whereOf(db, 1)).toMatchObject({ realmId: "r_eurth" });
    });
  });
  describe("loadLayerWithFallback: the static GeoJSON fallback is Ixnay's only", () => {
    beforeEach(() => {
      clearLayerCache();
      readFileMock.mockReset();
    });

    it("returns an empty FeatureCollection for another realm with no DB layer, without reading files", async () => {
      const db = makeDb([]);
      const fc = await loadLayerWithFallback(db, "political", 1, "r_eurth");

      expect(fc).toEqual({ type: "FeatureCollection", features: [] });
      expect(readFileMock).not.toHaveBeenCalled();
    });
  });
});
