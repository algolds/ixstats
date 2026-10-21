/** @jest-environment node */
/**
 * geoSovereignty router: sovereignty relations are public to read; creating, editing and deleting
 * them is admin only, rejects unknown types, self-sovereignty and circular chains, and refreshes
 * the political map.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts. So is `expect`: the
 * imported one types toHaveBeenCalledWith(db, ...) by the real function's parameters, and a mock db is no PrismaClient.
 */
jest.mock("~/server/shared/map-invalidation", () => ({
  __esModule: true,
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
  invalidateAllRealmMaps: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("~/lib/maps/map-update-bus", () => ({
  __esModule: true,
  broadcastMapUpdate: jest.fn(),
}));

import { describe, it, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { geoSovereigntyRouter } from "~/server/api/routers/geo/sovereignty";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(geoSovereigntyRouter);

function callerAs(db: MockPrismaProxy, who: "admin" | "player" | null) {
  return createCaller(
    createMockRouterContext({
      db,
      auth: who ? { userId: `clerk_${who}` } : null,
      user: who
        ? {
            id: who,
            clerkUserId: `clerk_${who}`,
            role: who === "admin" ? { name: "admin", level: 10 } : { name: "user", level: 100 },
          }
        : null,
      rateLimitIdentifier: `${who}_${Math.random()}`,
    }) as never
  );
}

let db: MockPrismaProxy;

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  db.countrySovereignty.create.mockResolvedValue({ id: "s1", sovereignId: "a", subjectId: "b" });
  db.countrySovereignty.update.mockResolvedValue({ id: "s1", sovereignId: "a", subjectId: "b" });
  db.countrySovereignty.delete.mockResolvedValue({ id: "s1", sovereignId: "a", subjectId: "b" });
  db.country.findMany.mockResolvedValue([{ realmId: "r_eurth" }, { realmId: "r_eurth" }]);
});

describe("admin gate", () => {
  it("refuses players on every write", async () => {
    const player = callerAs(db, "player");
    await expect(
      player.createSovereignty({ sovereignId: "a", subjectId: "b", relationshipType: "vassal" })
    ).rejects.toThrow(/Admin privileges required/);
    await expect(player.updateSovereignty({ id: "s1", isActive: false })).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(player.deleteSovereignty({ id: "s1" })).rejects.toThrow(
      /Admin privileges required/
    );
    expect(db.countrySovereignty.create).not.toHaveBeenCalled();
    expect(db.countrySovereignty.update).not.toHaveBeenCalled();
    expect(db.countrySovereignty.delete).not.toHaveBeenCalled();
  });
});

describe("createSovereignty", () => {
  it("bumps both realms when the two countries are in different ones", async () => {
    db.country.findMany.mockResolvedValue([{ realmId: "r_eurth" }, { realmId: "default" }]);
    await callerAs(db, "admin").createSovereignty({
      sovereignId: "a",
      subjectId: "b",
      relationshipType: "protectorate",
    });
    expect((invalidateRealmMap as jest.Mock).mock.calls.map((call) => call[1])).toEqual([
      "r_eurth",
      "default",
    ]);
  });

  it("refuses a country as its own sovereign", async () => {
    await expect(
      callerAs(db, "admin").createSovereignty({
        sovereignId: "a",
        subjectId: "a",
        relationshipType: "vassal",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("refuses a relation that would close a sovereignty loop", async () => {
    // b is a subject of a; making a a subject of b would loop.
    db.countrySovereignty.findMany.mockResolvedValue([{ sovereignId: "a", subjectId: "b" }]);

    await expect(
      callerAs(db, "admin").createSovereignty({
        sovereignId: "b",
        subjectId: "a",
        relationshipType: "vassal",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: /circular/ });
    expect(db.countrySovereignty.create).not.toHaveBeenCalled();
  });

  it("rejects autonomy outside 0 to 1", async () => {
    await expect(
      callerAs(db, "admin").createSovereignty({
        sovereignId: "a",
        subjectId: "b",
        relationshipType: "vassal",
        autonomyLevel: 2,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
describe("getSovereigntyRelations", () => {
  it("lists only the viewer's realm (rule E-h)", async () => {
    db.realm.findUnique.mockResolvedValue({ id: "r_eurth", status: "active", ownerId: "system" });
    db.countrySovereignty.findMany.mockResolvedValue([]);
    await callerAs(db, null).getSovereigntyRelations({ realm: "eurth" });
    expect(db.countrySovereignty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, sovereign: { realmId: "r_eurth" } } })
    );
  });
});
