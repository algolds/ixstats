import { describe, it, expect, beforeEach, jest } from "@jest/globals";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: {
    systemLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: false,
}));
jest.mock("~/lib/diplomatic-news-generator", () => ({
  generateDiplomaticNews: jest.fn(),
}));
jest.mock("~/lib/notification-api", () => ({
  notificationAPI: { create: jest.fn() },
}));

import { securityStabilityRouter } from "../stability";
import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";
import { notificationAPI } from "~/lib/notification-api";

type MockFn = jest.MockedFunction<any>;

const mockDb = {
  user: { findUnique: jest.fn() as MockFn },
  securityEvent: {
    findUnique: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
  },
};

const baseContext = {
  db: mockDb,
  user: { id: "user_1", countryId: "country_1", membershipTier: "mycountry_premium" },
  auth: { userId: "user_1" },
  headers: new Headers(),
  rateLimitIdentifier: "test",
} as any;

const resolvedEvent = {
  id: "event_1",
  countryId: "country_1",
  eventType: "riot",
  severity: "high",
  status: "resolved",
  endDate: new Date(),
  resolutionNotes: "Order restored",
};

describe("securityStabilityRouter resolveSecurityEvent news", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (generateDiplomaticNews as MockFn).mockResolvedValue("post_1");
    (notificationAPI.create as MockFn).mockResolvedValue(undefined);
  });

  it("fires security_event_resolved news when resolving a security event", async () => {
    mockDb.securityEvent.findUnique.mockResolvedValue({
      id: "event_1",
      countryId: "country_1",
      country: { name: "Testland" },
    });
    mockDb.user.findUnique.mockResolvedValue({ countryId: "country_1" });
    mockDb.securityEvent.update.mockResolvedValue(resolvedEvent);

    const caller = securityStabilityRouter.createCaller(baseContext);

    await caller.resolveSecurityEvent({ id: "event_1", resolutionNotes: "Order restored" });

    expect(generateDiplomaticNews).toHaveBeenCalledTimes(1);
    expect(generateDiplomaticNews).toHaveBeenCalledWith(
      expect.anything(),
      "country_1",
      "security_event_resolved",
      expect.objectContaining({
        countryName: "Testland",
        eventType: "riot",
        severity: "high",
        notes: "Order restored",
      })
    );
  });
});
