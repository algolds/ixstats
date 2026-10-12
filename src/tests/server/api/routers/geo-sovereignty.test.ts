/** @jest-environment node */
/**
 * geoSovereignty router: sovereignty relations are public to read; creating, editing and deleting
 * them is admin only, rejects unknown types, self-sovereignty and circular chains, and refreshes
 * the political map.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts.
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

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { geoSovereigntyRouter } from "~/server/api/routers/geo/sovereignty";
import { invalidateAllRealmMaps, invalidateRealmMap } from "~/server/shared/map-invalidation";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
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
  it("creates the relation and refreshes the political layer", async () => {
    db.countrySovereignty.create.mockResolvedValue({
      id: "s1",
      sovereignId: "caphiria",
      subjectId: "colony",
    });
    await callerAs(db, "admin").createSovereignty({
      sovereignId: "caphiria",
      subjectId: "colony",
      relationshipType: "protectorate",
    });

    expect(db.countrySovereignty.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sovereignId: "caphiria",
        subjectId: "colony",
        relationshipType: "protectorate",
        autonomyLevel: 0.5,
      }),
    });
    // The map version moves for the realm the two countries are in
    expect(db.country.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["caphiria", "colony"] } },
      select: { realmId: true },
    });
    expect(invalidateRealmMap).toHaveBeenCalledTimes(1);
    expect(invalidateRealmMap).toHaveBeenCalledWith(db, "r_eurth");
    expect(broadcastMapUpdate).toHaveBeenCalledWith("sovereignty");
  });

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

  it("refuses an unknown relationship type", async () => {
    await expect(
      callerAs(db, "admin").createSovereignty({
        sovereignId: "a",
        subjectId: "b",
        relationshipType: "best_friends",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: /Invalid relationship type/ });
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

describe("update and delete", () => {
  it("validates a changed type and updates", async () => {
    const admin = callerAs(db, "admin");
    await expect(admin.updateSovereignty({ id: "s1", relationshipType: "nope" })).rejects.toThrow(
      /Invalid relationship type/
    );

    await admin.updateSovereignty({ id: "s1", autonomyLevel: 0.9 });
    expect(db.countrySovereignty.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { autonomyLevel: 0.9 },
    });
    expect(invalidateRealmMap).toHaveBeenCalledTimes(1);
    expect(invalidateRealmMap).toHaveBeenCalledWith(db, "r_eurth");
  });

  it("deletes and refreshes the map", async () => {
    await expect(callerAs(db, "admin").deleteSovereignty({ id: "s1" })).resolves.toEqual({
      success: true,
    });
    expect(db.countrySovereignty.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    expect(invalidateRealmMap).toHaveBeenCalledWith(db, "r_eurth");
    expect(broadcastMapUpdate).toHaveBeenCalledWith("sovereignty");
  });

  it("bumps every realm when the countries of the relation cannot be found", async () => {
    db.countrySovereignty.delete.mockResolvedValue(null);
    await callerAs(db, "admin").deleteSovereignty({ id: "s1" });
    expect(invalidateRealmMap).not.toHaveBeenCalled();
    expect(invalidateAllRealmMaps).toHaveBeenCalledWith(db);
  });
});

describe("public reads", () => {
  it("returns a country's sovereign and subjects", async () => {
    db.countrySovereignty.findFirst.mockResolvedValue({
      id: "s0",
      sovereignId: "top",
      sovereign: { name: "Top", flag: null, slug: "top" },
      relationshipType: "dominion",
      autonomyLevel: 0.7,
    });
    db.countrySovereignty.findMany.mockResolvedValue([
      {
        id: "s2",
        subjectId: "low",
        subject: { name: "Low", flag: null, slug: "low" },
        relationshipType: "vassal",
        autonomyLevel: 0.2,
      },
    ]);

    const result = await callerAs(db, null).getCountrySovereignty({ countryId: "mid" });

    expect(result.sovereign).toMatchObject({ countryId: "top", name: "Top" });
    expect(result.subjects).toEqual([
      expect.objectContaining({ countryId: "low", name: "Low", autonomyLevel: 0.2 }),
    ]);
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
