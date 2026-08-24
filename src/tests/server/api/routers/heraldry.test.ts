// Mock env
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

const mockDb = {
  heraldryAchievement: {
    findUnique: jest.fn() as any,
    findMany: jest.fn() as any,
    count: jest.fn() as any,
    create: jest.fn() as any,
    update: jest.fn() as any,
  },
  heraldryRevision: {
    findMany: jest.fn() as any,
    create: jest.fn() as any,
  },
  heraldryCharge: {
    findMany: jest.fn() as any,
    findUnique: jest.fn() as any,
    count: jest.fn() as any,
  },
  userActionLog: {
    create: jest.fn() as any,
  },
};

jest.mock("~/server/db", () => ({
  __esModule: true,
  db: mockDb,
}));

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { heraldryRouter } from "~/server/api/routers/heraldry";
import { db } from "~/server/db";

const mockAchievementFindUnique = mockDb.heraldryAchievement.findUnique;
const mockAchievementFindMany = mockDb.heraldryAchievement.findMany;
const mockAchievementCount = mockDb.heraldryAchievement.count;
const mockAchievementCreate = mockDb.heraldryAchievement.create;
const mockAchievementUpdate = mockDb.heraldryAchievement.update;

const mockRevisionFindMany = mockDb.heraldryRevision.findMany;
const mockRevisionCreate = mockDb.heraldryRevision.create;

const mockChargeFindMany = mockDb.heraldryCharge.findMany;
const mockChargeFindUnique = mockDb.heraldryCharge.findUnique;
const mockChargeCount = mockDb.heraldryCharge.count;

const mockActionLogCreate = mockDb.userActionLog.create;

const baseContext = {
  db: mockDb,
  user: { clerkUserId: "user_1", countryId: "country_1" },
  auth: { userId: "user_1" },
} as any;

describe("heraldry tRPC Router", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generateRandom generates a batch of random compositions", async () => {
    const caller = createCallerFactory(heraldryRouter)(baseContext);
    const result = await caller.generateRandom({ count: 3 });

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty("shield");
    expect(result[0].shield).toHaveProperty("shape");
  });

  it("getChargeLibrary returns charges matching search term", async () => {
    const mockCharges = [
      { id: "star", name: "Star", svgData: "<svg></svg>", category: "COMMON", source: "SYSTEM" },
    ];
    mockChargeFindMany.mockResolvedValue(mockCharges);
    mockChargeCount.mockResolvedValue(1);

    const caller = createCallerFactory(heraldryRouter)(baseContext);
    const result = await caller.getChargeLibrary({ search: "star" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("star");
    expect(mockChargeFindMany).toHaveBeenCalled();
  });

  it("saveAchievement saves a new achievement and logs revision history", async () => {
    const dummyComposition = {
      shield: {
        shape: "heater" as const,
        field: {
          division: "plain" as const,
          tinctures: ["or" as const],
          lineStyle: "straight" as const,
        },
      },
    };

    mockAchievementCreate.mockResolvedValue({
      id: "ach_1",
      title: "New Achievement",
      subjectType: "CHARACTER",
      subjectId: null,
      compositionData: dummyComposition,
      generatedBlazon: "Or, a plain field",
      ownerId: "user_1",
    });
    mockRevisionCreate.mockResolvedValue({ id: "rev_1" });

    const caller = createCallerFactory(heraldryRouter)(baseContext);
    const result = await caller.saveAchievement({
      title: "New Achievement",
      subjectType: "CHARACTER",
      subjectId: null,
      compositionData: dummyComposition,
    });

    expect(result.id).toBe("ach_1");
    expect(mockAchievementCreate).toHaveBeenCalled();
  });
});
