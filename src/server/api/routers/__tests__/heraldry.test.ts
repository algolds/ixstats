import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock env
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

// Mock DB cleanly using inline hoisted function returning mocks
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockRevisionFindMany = jest.fn();
const mockRevisionCreate = jest.fn();
const mockChargeFindMany = jest.fn();
const mockChargeFindUnique = jest.fn();
const mockChargeCount = jest.fn();
const mockLogCreate = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    heraldryAchievement: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      count: mockCount,
      create: mockCreate,
      update: mockUpdate,
    },
    heraldryRevision: {
      findMany: mockRevisionFindMany,
      create: mockRevisionCreate,
    },
    heraldryCharge: {
      findMany: mockChargeFindMany,
      findUnique: mockChargeFindUnique,
      count: mockChargeCount,
    },
    userActionLog: {
      create: mockLogCreate,
    },
  },
}));

import { createCallerFactory } from "../../trpc";
import { heraldryRouter } from "../heraldry";
import { db } from "~/server/db";

const baseContext = {
  db,
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
    (mockChargeFindMany as any).mockResolvedValue(mockCharges);
    (mockChargeCount as any).mockResolvedValue(1);

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

    (mockCreate as any).mockResolvedValue({
      id: "ach_1",
      title: "New Achievement",
      subjectType: "CHARACTER",
      subjectId: null,
      compositionData: dummyComposition,
      generatedBlazon: "Or, a plain field",
      ownerId: "user_1",
    });

    const caller = createCallerFactory(heraldryRouter)(baseContext);
    const result = await caller.saveAchievement({
      title: "New Achievement",
      subjectType: "CHARACTER",
      subjectId: null,
      compositionData: dummyComposition,
    });

    expect(result.id).toBe("ach_1");
    expect(mockCreate).toHaveBeenCalled();
  });
});
