import { describe, it, expect, beforeEach, jest } from "@jest/globals";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "../../trpc";
import { unifiedIntelligenceRouter } from "../unified-intelligence";

const mockDb = {
  intelligenceAlert: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe("Unified Intelligence Alert Actions", () => {
  const baseContext = {
    db: mockDb,
    user: { id: "user_1", countryId: "country_1" },
    auth: { userId: "user_1" },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("acknowledges an alert and marks it resolved", async () => {
    const alert = {
      id: "alert_1",
      countryId: "country_1",
      isActive: true,
      isResolved: false,
      resolvedAt: null,
    };

    mockDb.intelligenceAlert.findUnique.mockResolvedValue(alert);
    mockDb.intelligenceAlert.update.mockImplementation(async ({ data }: any) => ({
      ...alert,
      ...data,
    }));

    const caller = createCallerFactory(unifiedIntelligenceRouter)(baseContext);

    const result = await caller.acknowledgeAlert({ alertId: "alert_1" });

    expect(mockDb.intelligenceAlert.findUnique).toHaveBeenCalledWith({
      where: { id: "alert_1" },
    });
    expect(mockDb.intelligenceAlert.update).toHaveBeenCalledWith({
      where: { id: "alert_1" },
      data: expect.objectContaining({
        isResolved: true,
        isActive: false,
      }),
    });
    expect(result.isResolved).toBe(true);
    expect(result.resolvedAt).toBeInstanceOf(Date);
  });

  it("archives an alert without resolving it", async () => {
    const alert = {
      id: "alert_2",
      countryId: "country_1",
      isActive: true,
      isResolved: false,
      resolvedAt: null,
    };

    mockDb.intelligenceAlert.findUnique.mockResolvedValue(alert);
    mockDb.intelligenceAlert.update.mockImplementation(async ({ data }: any) => ({
      ...alert,
      ...data,
    }));

    const caller = createCallerFactory(unifiedIntelligenceRouter)(baseContext);

    const result = await caller.archiveAlert({ alertId: "alert_2" });

    expect(mockDb.intelligenceAlert.update).toHaveBeenCalledWith({
      where: { id: "alert_2" },
      data: expect.objectContaining({
        isActive: false,
      }),
    });
    expect(result.id).toBe("alert_2");
  });

  it("prevents acknowledging alerts for other countries", async () => {
    const alert = {
      id: "alert_3",
      countryId: "other_country",
      isActive: true,
      isResolved: false,
      resolvedAt: null,
    };

    mockDb.intelligenceAlert.findUnique.mockResolvedValue(alert);

    const caller = createCallerFactory(unifiedIntelligenceRouter)(baseContext);

    await expect(caller.acknowledgeAlert({ alertId: "alert_3" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
