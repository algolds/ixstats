/** @jest-environment node */
/**
 * SL-7: the activity producers that remain are the ones a real game event calls. Each one
 * records a typed ActivityFeed row and never throws (a failed write is logged, the action that
 * triggered it carries on).
 */
const mockDb = {
  country: { findUnique: jest.fn() },
  activityFeed: { create: jest.fn() },
  user: { findFirst: jest.fn().mockResolvedValue(null) },
};
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/event-bus", () => ({ eventBus: { publish: jest.fn() } }));
jest.mock("~/lib/notifications", () => ({
  notificationHooks: { onDiplomaticEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { ActivityHooks } from "~/lib/activity/hooks";
beforeEach(() => {
  jest.clearAllMocks();
  mockDb.country.findUnique.mockResolvedValue({ name: "Arcadia" });
  mockDb.activityFeed.create.mockResolvedValue({ id: "a1" });
});

describe("ActivityHooks producers", () => {
  it("never throws when the write fails", async () => {
    mockDb.activityFeed.create.mockRejectedValue(new Error("db down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      ActivityHooks.Diplomatic.onAllianceFormed("c1", "Pact", "economic")
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
