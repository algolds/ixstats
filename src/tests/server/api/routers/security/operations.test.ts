import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { securityConflictsRouter } from "~/server/api/routers/security/conflicts";
import { newsGenerator } from "~/lib/diplomacy/news-generator";
import { notificationAPI } from "~/lib/notifications/api";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: {
    systemLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: false,
}));

const mockGenerateNews = jest.spyOn(newsGenerator, "generateDiplomaticNews").mockResolvedValue("post_1" as any);
const mockNotifCreate = jest.spyOn(notificationAPI, "create").mockResolvedValue({ success: true } as any);

type MockFn = any;

const mockDb = {
  user: { findUnique: jest.fn() as MockFn },
  country: { findUnique: jest.fn() as MockFn },
  militaryConflict: {
    findFirst: jest.fn() as MockFn,
    findUnique: jest.fn() as MockFn,
    create: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
  },
  militaryBranch: { findMany: jest.fn() as MockFn },
  storytellerEffect: { createMany: jest.fn() as MockFn },
  systemLog: { create: jest.fn() as MockFn },
  auditLog: { create: jest.fn() as MockFn },
};

const baseContext = {
  db: mockDb,
  user: { id: "user_1", countryId: "country_1", membershipTier: "mycountry_premium" },
  auth: { userId: "user_1" },
  headers: new Headers(),
  rateLimitIdentifier: "test",
} as any;

const defenderContext = {
  ...baseContext,
  user: { id: "user_2", countryId: "country_2", membershipTier: "mycountry_premium" },
  auth: { userId: "user_2" },
};

const conflictBase = {
  id: "conflict_1",
  type: "pvp",
  status: "proposed",
  initiatorId: "country_1",
  defenderId: "country_2",
  initiatorApproved: true,
  defenderApproved: false,
  reason: "Border dispute",
};

const proposedConflict = {
  ...conflictBase,
  initiator: { id: "country_1", name: "Aggressorland" },
  defender: { id: "country_2", name: "Defenderland" },
};

const acceptedConflict = {
  ...conflictBase,
  status: "active",
  defenderApproved: true,
  startDate: new Date(),
  initiator: { id: "country_1", name: "Aggressorland" },
  defender: { id: "country_2", name: "Defenderland" },
};

describe("securityConflictsRouter conflict news", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.systemLog.create.mockResolvedValue({ id: "log_1" });
    mockGenerateNews.mockResolvedValue("post_1" as any);
    mockNotifCreate.mockResolvedValue({ success: true } as any);
  });

  it("fires pvp_conflict_proposed news on both sides when proposing a conflict", async () => {
    mockDb.user.findUnique.mockResolvedValue({ countryId: "country_1" });
    mockDb.militaryConflict.findFirst.mockResolvedValue(null);
    mockDb.militaryConflict.create.mockResolvedValue(proposedConflict);
    mockDb.country.findUnique.mockResolvedValue({
      name: "Defenderland",
      users: [{ clerkUserId: "user_2" }],
    });

    const caller = securityConflictsRouter.createCaller(baseContext);

    await caller.proposePvPConflict({ defenderId: "country_2", reason: "Border dispute" });

    expect(mockGenerateNews).toHaveBeenCalledTimes(2);
    expect(mockGenerateNews).toHaveBeenCalledWith(
      expect.anything(),
      "country_1",
      "pvp_conflict_proposed",
      expect.objectContaining({
        countryName: "Aggressorland",
        targetName: "Defenderland",
        reason: "Border dispute",
      })
    );
    expect(mockGenerateNews).toHaveBeenCalledWith(
      expect.anything(),
      "country_2",
      "pvp_conflict_proposed",
      expect.objectContaining({
        countryName: "Aggressorland",
        targetName: "Defenderland",
        reason: "Border dispute",
      })
    );
  });

  it("fires pvp_conflict_accepted news on both sides when accepting a conflict", async () => {
    mockDb.user.findUnique.mockResolvedValue({ countryId: "country_2" });
    mockDb.militaryConflict.findUnique.mockResolvedValue(conflictBase);
    mockDb.militaryConflict.update.mockResolvedValue(acceptedConflict);
    mockDb.country.findUnique.mockResolvedValue({
      users: [{ clerkUserId: "user_1" }],
    });

    const caller = securityConflictsRouter.createCaller(defenderContext);

    await caller.respondToConflict({ conflictId: "conflict_1", accept: true });

    expect(mockGenerateNews).toHaveBeenCalledTimes(2);
    expect(mockGenerateNews).toHaveBeenCalledWith(
      expect.anything(),
      "country_2",
      "pvp_conflict_accepted",
      expect.objectContaining({
        countryName: "Defenderland",
        targetName: "Aggressorland",
      })
    );
    expect(mockGenerateNews).toHaveBeenCalledWith(
      expect.anything(),
      "country_1",
      "pvp_conflict_accepted",
      expect.objectContaining({
        countryName: "Defenderland",
        targetName: "Aggressorland",
      })
    );
  });

  it("does not fire accepted news when declining a conflict", async () => {
    mockDb.user.findUnique.mockResolvedValue({ countryId: "country_2" });
    mockDb.militaryConflict.findUnique.mockResolvedValue(conflictBase);
    mockDb.militaryConflict.update.mockResolvedValue({
      ...conflictBase,
      status: "resolved",
      winner: "declined",
    });
    mockDb.country.findUnique.mockResolvedValue({
      users: [{ clerkUserId: "user_1" }],
    });

    const caller = securityConflictsRouter.createCaller(defenderContext);

    await caller.respondToConflict({ conflictId: "conflict_1", accept: false });

    expect(mockGenerateNews).not.toHaveBeenCalled();
  });

  it("fires pvnpc_conflict_resolved news on both sides with the winner", async () => {
    mockDb.user.findUnique.mockResolvedValue({ countryId: "country_1", id: "user_1" });
    mockDb.militaryBranch.findMany.mockImplementation((args: { where: { countryId: string } }) => {
      if (args.where.countryId === "country_1") {
        return Promise.resolve([
          {
            units: [{ personnel: 1000, readiness: 100 }],
            assets: [{ quantity: 10, operational: 10 }],
          },
        ]);
      }
      return Promise.resolve([
        {
          units: [{ personnel: 100, readiness: 100 }],
          assets: [{ quantity: 1, operational: 1 }],
        },
      ]);
    });
    mockDb.country.findUnique.mockImplementation((args: { where: { id: string } }) => {
      if (args.where.id === "country_1") {
        return Promise.resolve({
          id: "country_1",
          name: "Aggressorland",
          currentGdpPerCapita: 20000,
          currentPopulation: 1000000,
        });
      }
      return Promise.resolve({
        id: "country_2",
        name: "Defenderland",
        currentGdpPerCapita: 20000,
        currentPopulation: 1000000,
      });
    });
    mockDb.militaryConflict.create.mockResolvedValue({
      id: "conflict_pvnpc_1",
      type: "pvnpc",
      status: "resolved",
      initiatorId: "country_1",
      defenderId: "country_2",
      winner: "country_1",
      initiator: { id: "country_1", name: "Aggressorland" },
      defender: { id: "country_2", name: "Defenderland" },
    });
    mockDb.storytellerEffect.createMany.mockResolvedValue({ count: 2 });

    const caller = securityConflictsRouter.createCaller(baseContext);

    await caller.resolvePvNPCConflict({ targetCountryId: "country_2", reason: "Skirmish" });

    expect(mockGenerateNews).toHaveBeenCalledTimes(2);
    expect(mockGenerateNews).toHaveBeenCalledWith(
      expect.anything(),
      "country_1",
      "pvnpc_conflict_resolved",
      expect.objectContaining({
        countryName: "Aggressorland",
        targetName: "Defenderland",
        winner: "Aggressorland",
      })
    );
    expect(mockGenerateNews).toHaveBeenCalledWith(
      expect.anything(),
      "country_2",
      "pvnpc_conflict_resolved",
      expect.objectContaining({
        countryName: "Aggressorland",
        targetName: "Defenderland",
        winner: "Aggressorland",
      })
    );
  });
});
