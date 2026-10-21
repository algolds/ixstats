/** @jest-environment node */
/**
 * Scenario: on Eurth (a planet of half Earth's radius) a founder redraws an unclaimed region against a player's
 * nation, an admin makes the region a nation, and a border edit filed for review is approved. The border and queue
 * routers, the linkage router, the geometry check, the realm-scaled area, the map version bump and the live-sync bus
 * are real; the database is map-import-fakes' (a throwing transaction puts every table back), PostGIS answers its two
 * questions (is this valid, what is its area) from the scenario, and the Country outline sync is a spy.
 */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
  rateLimiter: { check: jest.fn().mockResolvedValue({ success: true }), isEnabled: () => false },
}));
jest.mock("~/lib/country-geo", () => ({
  __esModule: true,
  syncCountryGeometryFromMapLayer: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/activity", () => ({ ActivityGenerator: { createActivity: jest.fn() } }));

import type { Polygon } from "geojson";
import { syncCountryGeometryFromMapLayer } from "~/lib/country-geo";
import { IxTime } from "~/lib/ixtime";
import { mapUpdateBus, type MapUpdateEvent } from "~/lib/maps/map-update-bus";
import { calculateArea } from "~/lib/maps/border-editor";
import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorBordersRouter } from "~/server/api/routers/geo/editor/borders";
import { geoEditorLinkageAssignmentRouter } from "~/server/api/routers/geo/editor/linkage/assignment";
import { geoEditorQueueRouter } from "~/server/api/routers/geo/editor/queue";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeDb, table } from "~/tests/server/maps/map-import-fakes";

type Db = ReturnType<typeof fakeDb>;
type Row = Record<string, unknown>;

const box = (x0: number, x1: number, y1 = 2): Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [x0, 0],
      [x1, 0],
      [x1, y1],
      [x0, y1],
      [x0, 0],
    ],
  ],
});
/** A bow-tie: its two edges cross, which PostGIS calls a self-intersection. */
const BOW_TIE: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [3, 2],
      [3, 0],
      [0, 2],
      [0, 0],
    ],
  ],
};

const actors = {
  founder: { id: "u_founder", clerkUserId: "clerk_founder", role: { name: "user", level: 100 } },
  player: { id: "u_player", clerkUserId: "clerk_player", role: { name: "user", level: 100 } },
  admin: { id: "u_admin", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } },
};
type Actor = keyof typeof actors;

/** Eurth: the unclaimed region West, and East, the player's nation, sharing the border at x = 2. */
function eurth(): Db {
  const db = fakeDb();
  db.realm.rows.push({
    id: "r_eurth",
    slug: "eurth",
    ownerId: "clerk_founder",
    status: "active",
    settings: { map: { radiusKm: 6371 / 2 } },
    mapVersion: 7,
    officers: [],
  });
  db.country.rows.push({ id: "c_east", name: "East", realmId: "r_eurth", ownerUserId: "u_player" });
  const region = (featureId: string, countryId: string | null, geometry: Polygon) => ({
    id: `ml_${featureId}`,
    realmId: "r_eurth",
    layerType: "political",
    featureId,
    displayName: featureId,
    countryId,
    geometry,
    centroid: null,
    boundingBox: null,
    areaSqKm: null,
    isActive: true,
  });
  db.mapLayer.rows.push(region("west", null, box(0, 2)), region("east", "c_east", box(2, 4)));
  Object.assign(db, {
    mapEditRequest: table("e", () => ({ status: "pending" })),
    borderHistory: table("h"),
    mapEditorSession: table("s"),
    auditLog: table("a"),
  });
  // PostGIS: available; the bow-tie is the only invalid shape; a stored border's area is what the scenario says
  db.$queryRawUnsafe = jest.fn(async (sql: string, ...args: unknown[]) => {
    if (sql.includes("ST_IsValid")) {
      const valid = args[0] !== JSON.stringify(BOW_TIE);
      return [{ is_valid: valid, reason: valid ? "Valid Geometry" : "Self-intersection[1.5 1]" }];
    }
    if (sql.includes("ST_Area")) return [{ area_sq_km: 12_345 }];
    return [];
  });
  return db;
}

const call = (db: Db, who: Actor) =>
  createMockRouterContext({
    db,
    auth: { userId: actors[who].clerkUserId },
    user: { ...actors[who], country: null },
    rateLimitIdentifier: `${who}_${Math.random()}`,
  }) as never;
const borders = (db: Db, who: Actor) => createCallerFactory(geoEditorBordersRouter)(call(db, who));
const linkage = (db: Db, who: Actor) =>
  createCallerFactory(geoEditorLinkageAssignmentRouter)(call(db, who));
const queue = (db: Db, who: Actor) => createCallerFactory(geoEditorQueueRouter)(call(db, who));

const region = (db: Db, featureId: string) =>
  (db.mapLayer.rows as Row[]).find((r) => r.featureId === featureId)!;
const tables = (db: Db) =>
  JSON.stringify([db.mapLayer.rows, db.country.rows, db.borderHistory.rows]);

const events: MapUpdateEvent[] = [];
let unsubscribe: () => void;
beforeAll(() => {
  unsubscribe = mapUpdateBus.subscribe((event) => events.push(event));
  for (const level of ["info", "warn", "error"] as const)
    jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterAll(() => {
  unsubscribe();
  jest.restoreAllMocks();
});

describe("a region is drawn, checked, made a nation and its border approved", () => {
  it("refuses bad shapes whole, stores good ones on the realm's planet, and moves the map once per change", async () => {
    const db = eurth();
    const before = tables(db);
    const redraw = (geometry: Polygon, east: Polygon, who: Actor = "founder") =>
      borders(db, who).submitBorderEdit({
        featureId: "west",
        editSubtype: "redraw",
        proposedGeometry: geometry as never,
        neighborUpdates: [{ featureId: "east", geometry: east as never }],
        applyDirectly: true,
        realm: "eurth",
      });

    // A player who does not edit the realm's map is refused before anything is read or written
    await expect(redraw(box(0, 3), box(3, 4), "player")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // A self-crossing border is refused; so is a good border whose neighbour's new shape crosses itself, and the
    // transaction leaves neither moved (no half-moved shared border); the map version stays
    await expect(redraw(BOW_TIE, box(3, 4))).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Self-intersection"),
    });
    await expect(redraw(box(0, 3), BOW_TIE)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tables(db)).toBe(before);
    expect(db.realm.rows[0].mapVersion).toBe(7);

    // The good redraw moves both borders, measures each on Eurth (a quarter of Earth's area), and moves the map once
    events.length = 0;
    expect(await redraw(box(0, 3), box(3, 4))).toEqual({ applied: true, editRequestId: null });
    expect(region(db, "west").geometry).toEqual(box(0, 3));
    expect(region(db, "west").areaSqKm).toBeCloseTo(calculateArea(box(0, 3)) / 4, 6);
    expect(region(db, "east").areaSqKm).toBeCloseTo(calculateArea(box(3, 4)) / 4, 6);
    expect(syncCountryGeometryFromMapLayer).toHaveBeenCalledWith(expect.anything(), "c_east");
    expect(db.realm.rows[0].mapVersion).toBe(8);
    expect(events.map((e) => [e.changeType, e.realmId])).toEqual([
      ["version", "r_eurth"],
      ["borders", "r_eurth"],
    ]);

    // The admin makes West a nation: its border, centre and area come from the region, and the new country's
    // baseline and last calculation are the same IxTime instant, not the real time (the economy reads both as IxTime)
    await expect(
      linkage(db, "founder").createCountryFromShape({
        featureId: "west",
        name: "Westmark",
        realm: "eurth",
      })
    ).rejects.toThrow(/Admin privileges required/);
    const ixBefore = IxTime.getCurrentIxTime();
    const created = await linkage(db, "admin").createCountryFromShape({
      featureId: "west",
      name: "Westmark",
      realm: "eurth",
    });
    const ixAfter = IxTime.getCurrentIxTime();
    const westmark = (db.country.rows as Row[]).find((c) => c.id === created.countryId)!;
    expect(westmark).toMatchObject({
      name: "Westmark",
      slug: "westmark",
      realmId: "r_eurth",
      geometry: box(0, 3),
      landArea: region(db, "west").areaSqKm,
    });
    const baseline = (westmark.baselineDate as Date).getTime();
    expect((westmark.lastCalculated as Date).getTime()).toBe(baseline);
    expect(baseline).toBeGreaterThanOrEqual(ixBefore);
    expect(baseline).toBeLessThanOrEqual(ixAfter);
    expect(Math.abs(baseline - Date.now())).toBeGreaterThan(24 * 3600 * 1000);
    expect(region(db, "west").countryId).toBe(created.countryId);
    expect(db.realm.rows[0].mapVersion).toBe(9);
    // A region already linked cannot be made a second nation
    await expect(
      linkage(db, "admin").createCountryFromShape({
        featureId: "west",
        name: "Again",
        realm: "eurth",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // The founder files East's edit for review: nothing moves until an admin approves it, once
    const filed = await borders(db, "founder").submitBorderEdit({
      featureId: "east",
      editSubtype: "vertex_edit",
      proposedGeometry: box(3, 5) as never,
      realm: "eurth",
    });
    expect(filed.applied).toBe(false);
    expect(region(db, "east").geometry).toEqual(box(3, 4));
    expect(db.realm.rows[0].mapVersion).toBe(9);
    await expect(
      queue(db, "founder").approveEdit({ editId: filed.editRequestId! })
    ).rejects.toThrow(/Admin privileges required/);
    await queue(db, "admin").approveEdit({ editId: filed.editRequestId!, reviewNote: "fair" });
    expect(region(db, "east")).toMatchObject({ geometry: box(3, 5), areaSqKm: 12_345 });
    expect(db.borderHistory.rows).toEqual([
      expect.objectContaining({ countryId: "c_east", changedBy: "clerk_admin", reason: "fair" }),
    ]);
    expect(db.realm.rows[0].mapVersion).toBe(10);
    await expect(
      queue(db, "admin").approveEdit({ editId: filed.editRequestId! })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Edit already approved",
    });
    expect(db.realm.rows[0].mapVersion).toBe(10);
  });

  // KNOWN GAP (reported to the owner 2026-10-21): only the direct path asks PostGIS whether a border is valid. A
  // border filed for review is stored as filed and approved as stored, so a self-crossing outline reaches the map's
  // GeoJSON. When submitBorderEdit or approveEdit checks it, this starts failing: drop `.failing`.
  it.failing(
    "refuses a self-crossing border filed for review, as the direct path does",
    async () => {
      const db = eurth();
      const filed = await borders(db, "founder").submitBorderEdit({
        featureId: "east",
        editSubtype: "redraw",
        proposedGeometry: BOW_TIE as never,
        realm: "eurth",
      });
      await queue(db, "admin")
        .approveEdit({ editId: filed.editRequestId! })
        .catch(() => undefined);
      expect(region(db, "east").geometry).toEqual(box(2, 4));
    }
  );
});
