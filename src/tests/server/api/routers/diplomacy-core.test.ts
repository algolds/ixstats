/** @jest-environment node */
/**
 * diplomaticCore router: following needs write access to the follower country; a stance can only
 * be set on your own side of a relation; option usage analytics are admin only; relations read
 * from either side and fall back to built-in options when the dictionary is empty.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factory below calls jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { diplomaticCoreRouter } from "~/server/api/routers/diplomacy/core";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(diplomaticCoreRouter);

const USER = { name: "user", level: 100 };
const ADMIN = { name: "admin", level: 10 };

function callerAs(db: MockPrismaProxy, id: string | null, countryId: string | null, role = USER) {
  return createCaller(
    createMockRouterContext({
      db,
      auth: id ? { userId: `clerk_${id}` } : null,
      user: id ? { id, clerkUserId: `clerk_${id}`, countryId, role } : null,
      rateLimitIdentifier: `${id}_${Math.random()}`,
    }) as never
  );
}

let db: MockPrismaProxy;

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  db.user.findUnique.mockResolvedValue(null);
  db.country.findUnique.mockImplementation(async (args: any) =>
    args.where.id === "nope" ? null : { id: args.where.id, ownerUserId: "owner", name: "Urcea" }
  );
  db.countryFollow.create.mockResolvedValue({ id: "f1" });
});

describe("follow / unfollow", () => {
  it("refuses to follow or unfollow on behalf of another country", async () => {
    const caller = callerAs(db, "u1", "c_mine");
    await expect(
      caller.followCountry({ followerCountryId: "c_other", followedCountryId: "c_mine" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.unfollowCountry({ followerCountryId: "c_other", followedCountryId: "c_third" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.countryFollow.create).not.toHaveBeenCalled();
    expect(db.countryFollow.delete).not.toHaveBeenCalled();
  });

  it("rejects signed-out callers", async () => {
    await expect(
      callerAs(db, null, null).followCountry({
        followerCountryId: "c_mine",
        followedCountryId: "c_other",
      })
    ).rejects.toThrow(/Authentication required/);
  });
});

describe("setDiplomaticGoal", () => {
  const relation = { id: "r1", country1: "c_a", country2: "c_b" };

  it("sets only the caller's own side of the relation", async () => {
    db.diplomaticRelation.findUnique.mockResolvedValue(relation);

    await callerAs(db, "u1", "c_b").setDiplomaticGoal({ relationId: "r1", goal: "RIVAL" });

    expect(db.diplomaticRelation.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { goalCountry2: "RIVAL" },
    });
  });

  it("refuses a country outside the relation", async () => {
    db.diplomaticRelation.findUnique.mockResolvedValue(relation);

    await expect(
      callerAs(db, "u1", "c_c").setDiplomaticGoal({ relationId: "r1", goal: "ALLY" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.diplomaticRelation.update).not.toHaveBeenCalled();
  });

  it("needs a country, a known relation and a valid goal", async () => {
    await expect(
      callerAs(db, "u1", null).setDiplomaticGoal({ relationId: "r1", goal: "ALLY" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    db.diplomaticRelation.findUnique.mockResolvedValue(null);
    await expect(
      callerAs(db, "u1", "c_a").setDiplomaticGoal({ relationId: "missing", goal: "ALLY" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      callerAs(db, "u1", "c_a").setDiplomaticGoal({ relationId: "r1", goal: "WAR" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
describe("diplomatic options", () => {
  it("keeps usage analytics to admins", async () => {
    await expect(callerAs(db, "u1", "c_mine").getOptionUsageStats()).rejects.toThrow(
      /Admin privileges required/
    );

    db.diplomaticOption.findMany.mockResolvedValue([
      { id: "o1", type: "t", value: "A", category: null, isActive: true, usage: [{}, {}] },
      { id: "o2", type: "t", value: "B", category: "X", isActive: false, usage: [] },
    ]);
    db.diplomaticOptionUsage.count.mockResolvedValue(2);

    const stats = await callerAs(db, "admin", null, ADMIN).getOptionUsageStats();

    expect(stats.summary).toEqual({
      totalOptions: 2,
      activeOptions: 1,
      inactiveOptions: 1,
      totalCurrentUsage: 2,
    });
    expect(stats.topOptions[0]!.id).toBe("o1");
    expect(stats.categoryStats).toEqual({
      Uncategorized: { count: 1, totalUsage: 2 },
      X: { count: 1, totalUsage: 0 },
    });
  });
});
