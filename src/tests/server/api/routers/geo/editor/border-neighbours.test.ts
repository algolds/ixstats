/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorBordersRouter } from "~/server/api/routers/geo/editor/borders";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const EURTH = "r_eurth";
const SAVED = new Date("2026-10-11T10:00:00Z");
const hoursBefore = (hours: number) => new Date(SAVED.getTime() - hours * 3_600_000);
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

function makeDb(neighbours: object[] = []) {
  return {
    mapLayer: {
      findFirst: jest.fn().mockResolvedValue({
        id: "ml1",
        featureId: "Gallambria",
        boundingBox: [10, 20, 12, 23],
        updatedAt: hoursBefore(5),
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    mapEditorSession: {
      upsert: jest.fn().mockResolvedValue({
        id: "s1",
        userId: "admin_1",
        featureId: "Gallambria",
        sessionData: {},
      }),
    },
    realm: { findUnique: jest.fn().mockResolvedValue({ id: EURTH }) },
    $queryRawUnsafe: jest.fn().mockResolvedValue(neighbours),
  };
}

function open(db: ReturnType<typeof makeDb>) {
  const ctx = createMockRouterContext({
    db,
    auth: { userId: "admin_1" },
    user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
  }) as never;
  return createCallerFactory(geoEditorBordersRouter)(ctx).startBorderEditSession({
    featureId: "Gallambria",
    realm: "eurth",
  });
}

describe("startBorderEditSession neighbours", () => {
  it("asks PostGIS for the realm's features inside the padded box, served by the geometry index", async () => {
    const db = makeDb();
    await open(db);

    const [sql, ...params] = db.$queryRawUnsafe.mock.calls[0]!;
    expect(sql).toContain("geom_postgis && ST_MakeEnvelope($3, $4, $5, $6, 4326)");
    expect(sql).toContain(`"worldId" = $1`);
    expect(sql).toContain(`"featureId" <> $2`);
    expect(sql).not.toContain("ST_MakeValid");
    expect(params).toEqual([EURTH, "Gallambria", 9, 19, 13, 24]);
    expect(db.mapLayer.findMany).not.toHaveBeenCalled();
  });

  it("returns the neighbours as feature stubs without their update times", async () => {
    const db = makeDb([
      { featureId: "Daxia", displayName: "Daxia", geometry: square, updatedAt: hoursBefore(9) },
    ]);
    const result = await open(db);

    expect(result.neighbors).toEqual([
      { featureId: "Daxia", displayName: "Daxia", geometry: square },
    ]);
  });

  it("reads no neighbours for a feature without a bounding box", async () => {
    const db = makeDb();
    db.mapLayer.findFirst.mockResolvedValue({
      id: "ml1",
      featureId: "Gallambria",
      boundingBox: null,
    });
    const result = await open(db);

    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(result.neighbors).toEqual([]);
  });

  describe("restoring a draft that moved neighbours", () => {
    function withDraft(db: ReturnType<typeof makeDb>) {
      db.mapEditorSession.upsert.mockResolvedValue({
        id: "s1",
        userId: "admin_1",
        featureId: "Gallambria",
        sessionData: {
          featureId: "Gallambria",
          geometry: square,
          dirtyNeighbors: { Daxia: square, Xalesia: square },
          savedAt: SAVED.getTime(),
        },
      });
      return db;
    }
    const neighbour = (featureId: string, updatedAt: Date) => ({
      featureId,
      displayName: featureId,
      geometry: square,
      updatedAt,
    });

    it("drops a moved neighbour saved at or after the draft, which would overwrite that save", async () => {
      const db = withDraft(
        makeDb([neighbour("Daxia", hoursBefore(1)), neighbour("Xalesia", SAVED)])
      );
      const result = await open(db);

      expect(Object.keys(result.draft?.dirtyNeighbors ?? {})).toEqual(["Daxia"]);
    });

    it("drops a moved neighbour that is no longer next to the feature", async () => {
      const db = withDraft(makeDb([neighbour("Daxia", hoursBefore(1))]));
      const result = await open(db);

      expect(Object.keys(result.draft?.dirtyNeighbors ?? {})).toEqual(["Daxia"]);
    });
  });
});
