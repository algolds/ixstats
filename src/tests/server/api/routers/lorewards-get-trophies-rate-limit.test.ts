/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
/**
 * `lorewards.getTrophies` answers for any wiki name and runs the verified-link lookup, so it sits on the shared
 * `public` rate-limit bucket like the other public reads.
 */
const mockCheck = jest.fn();
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: (...args: unknown[]) => mockCheck(...args) },
}));
jest.mock("~/lib/lorewards", () => ({ syncCurrentWinners: jest.fn() }));
jest.mock("~/lib/lorewards/today-race", () => ({ getTodayRace: jest.fn() }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/identity/identity.privacy", () => ({
  loadPassportSettings: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { lorewardsTrophiesRouter } from "~/server/api/routers/lorewards/trophies";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

let db: ReturnType<typeof createMockPrisma>;
const caller = () =>
  createCallerFactory(lorewardsTrophiesRouter)(
    createMockRouterContext({
      auth: null,
      user: null,
      db,
      rateLimitIdentifier: "ip:203.0.113.7",
    }) as never
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  db = createMockPrisma();
});

describe("lorewards.getTrophies rate limit", () => {
  it("counts each request against the public bucket for the client", async () => {
    mockCheck.mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() });
    await caller().getTrophies({ username: "Ada" });
    expect(mockCheck).toHaveBeenCalledWith("ip:203.0.113.7", "public", {
      maxRequests: 100,
      windowMs: 60_000,
    });
  });

  it("refuses a client over the limit before looking the name up", async () => {
    mockCheck.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });
    await expect(caller().getTrophies({ username: "Ada" })).rejects.toThrow(/Too many requests/);
    expect(db.wikiAccountLink.findFirst).not.toHaveBeenCalled();
  });
});
