/** @jest-environment node */
// `jest` is the ambient global here (not imported) so the hoisted jest.mock factory can use it.
const mockFindMany = jest.fn();

jest.mock("~/server/db", () => ({
  db: { notificationEventConfig: { findMany: mockFindMany } },
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

type GuardModule = typeof import("~/lib/notifications/guard");

function loadGuard(): GuardModule {
  let mod!: GuardModule;
  jest.isolateModules(() => {
    mod = require("~/lib/notifications/guard");
  });
  return mod;
}

describe("notification guard", () => {
  let now = 1_000_000;

  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
    now = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("unknown keys do not re-query within TTL", async () => {
    const { isNotificationEventEnabled } = loadGuard();

    const results = [
      await isNotificationEventEnabled("x.unknown"),
      await isNotificationEventEnabled("x.unknown"),
      await isNotificationEventEnabled("x.unknown"),
    ];

    expect(results).toEqual([true, true, true]);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it("disabled key returns false", async () => {
    mockFindMany.mockResolvedValue([{ eventKey: "a", enabled: false }]);
    const { isNotificationEventEnabled } = loadGuard();

    await expect(isNotificationEventEnabled("a")).resolves.toBe(false);
  });

  it("concurrent calls share one refresh", async () => {
    const { isNotificationEventEnabled } = loadGuard();

    await Promise.all([1, 2, 3, 4, 5].map(() => isNotificationEventEnabled("k")));

    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it("DB error backs off for the TTL", async () => {
    mockFindMany.mockRejectedValue(new Error("db down"));
    const { isNotificationEventEnabled } = loadGuard();

    await expect(isNotificationEventEnabled("k")).resolves.toBe(true);
    await expect(isNotificationEventEnabled("k")).resolves.toBe(true);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it("refreshes after TTL", async () => {
    const { isNotificationEventEnabled } = loadGuard();

    await isNotificationEventEnabled("k");
    now += 31_000;
    await isNotificationEventEnabled("k");

    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });
});
