import { transportRouteMutationsRouter } from "~/server/api/routers/transport/routeMutations";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

/** Routes owned by each country; any other (id, countryId) pair is "not found". */
const ROUTES: Record<string, string> = {
  route_own: CALLER_COUNTRY,
  route_foreign: FOREIGN_COUNTRY,
};

type RouteLookup = { where: { id: string; countryId: string } };
const writeReached = () => Promise.reject(new Error("write path reached"));

/** The first write rejects; reaching it proves the caller passed the ownership check. */
function transportDb() {
  return {
    transportRoute: {
      findFirst: jest.fn(async ({ where }: RouteLookup) =>
        ROUTES[where.id] === where.countryId ? { countryId: where.countryId } : null
      ),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(writeReached),
      update: jest.fn(writeReached),
      delete: jest.fn(writeReached),
      deleteMany: jest.fn(writeReached),
    },
    countryGeoProfile: { findUnique: jest.fn().mockResolvedValue(null) },
  };
}

const geometry = { type: "LineString", coordinates: [] };

describe("Plan 332: transport route mutations require country ownership", () => {
  it("generateRoutes rejects a member generating for another country", async () => {
    const db = transportDb();
    const caller = transportRouteMutationsRouter.createCaller(createIdorContext(db));

    await expect(caller.generateRoutes({ countryId: FOREIGN_COUNTRY })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.transportRoute.deleteMany).not.toHaveBeenCalled();
  });

  it("generateRoutes lets the owner past the check", async () => {
    const db = transportDb();
    const ctx = createIdorContext(db);
    ctx.db.country.findUnique = jest.fn(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      name: "Testland",
      cities: [],
    }));
    const caller = transportRouteMutationsRouter.createCaller(ctx);

    await expect(caller.generateRoutes({ countryId: CALLER_COUNTRY })).rejects.toThrow(
      "Need at least 2 cities"
    );
  });

  it("createRoute rejects a member creating a route for another country", async () => {
    const db = transportDb();
    const caller = transportRouteMutationsRouter.createCaller(createIdorContext(db));

    await expect(
      caller.createRoute({ countryId: FOREIGN_COUNTRY, routeType: "rail", geometry })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.transportRoute.create).not.toHaveBeenCalled();
  });

  it("createRoute lets the owner reach the write", async () => {
    const db = transportDb();
    const caller = transportRouteMutationsRouter.createCaller(createIdorContext(db));

    await expect(
      caller.createRoute({ countryId: CALLER_COUNTRY, routeType: "rail", geometry })
    ).rejects.toThrow("write path reached");
    expect(db.transportRoute.create).toHaveBeenCalledTimes(1);
  });

  type Caller = ReturnType<typeof transportRouteMutationsRouter.createCaller>;
  type Call = (caller: Caller, id: string, countryId: string) => Promise<object>;
  const idKeyed: Array<[string, "delete" | "update", Call]> = [
    ["deleteRoute", "delete", (c, id, countryId) => c.deleteRoute({ id, countryId })],
    ["updateRoute", "update", (c, id, countryId) => c.updateRoute({ id, countryId, name: "X" })],
    [
      "updateRouteGeometry",
      "update",
      (c, id, countryId) => c.updateRouteGeometry({ id, countryId, geometry }),
    ],
  ];

  describe.each(idKeyed)("%s", (_procedure, write, invoke) => {
    const call = (
      db: ReturnType<typeof transportDb>,
      role: "member" | "admin",
      id: string,
      countryId: string
    ) =>
      invoke(
        transportRouteMutationsRouter.createCaller(createIdorContext(db, role)),
        id,
        countryId
      );

    it("rejects a member touching another country's route", async () => {
      const db = transportDb();
      await expect(call(db, "member", "route_foreign", FOREIGN_COUNTRY)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(db.transportRoute[write]).not.toHaveBeenCalled();
    });

    it("rejects a foreign route sent with the caller's own countryId as NOT_FOUND", async () => {
      const db = transportDb();
      await expect(call(db, "member", "route_foreign", CALLER_COUNTRY)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(db.transportRoute[write]).not.toHaveBeenCalled();
    });

    it("lets the owner reach the write", async () => {
      const db = transportDb();
      await expect(call(db, "member", "route_own", CALLER_COUNTRY)).rejects.toThrow(
        "write path reached"
      );
      expect(db.transportRoute[write]).toHaveBeenCalledTimes(1);
    });

    it("lets an admin reach the write on another country's route", async () => {
      const db = transportDb();
      await expect(call(db, "admin", "route_foreign", FOREIGN_COUNTRY)).rejects.toThrow(
        "write path reached"
      );
      expect(db.transportRoute[write]).toHaveBeenCalledTimes(1);
    });
  });
});
