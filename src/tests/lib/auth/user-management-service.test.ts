/** @jest-environment node */
/**
 * getOrCreateUser on a Clerk id it has never seen: a live Clerk user gets a row; a Clerk user that no longer exists
 * (404, e.g. a still-valid session token after account erasure deleted it) gets none, so an erased account is never
 * recreated as a blank one. A Clerk outage still creates the row, as before.
 */
const getUser = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: { getUser } }),
}));
jest.mock("~/lib/vault/vault-bonus", () => ({ grantNewPlayerBonus: jest.fn() }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));

import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import { UserManagementService } from "~/lib/auth/user-management-service";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";

const env = { ...process.env };
let db: MemoryPrisma;

beforeEach(() => {
  process.env.CLERK_SECRET_KEY = "sk_test";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
  getUser.mockReset();
  db = createMemoryPrisma();
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterAll(() => {
  process.env = env;
});

describe("getOrCreateUser", () => {
  it("creates a row for a live Clerk user", async () => {
    getUser.mockResolvedValue({ publicMetadata: {} });
    const user = await new UserManagementService(db).getOrCreateUser("user_live");
    expect(user?.clerkUserId).toBe("user_live");
    expect(await db.user.count()).toBe(1);
  });

  it("creates nothing for a Clerk user that no longer exists", async () => {
    getUser.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
    expect(await new UserManagementService(db).getOrCreateUser("user_gone")).toBeNull();
    expect(await db.user.count()).toBe(0);
  });

  it("still creates the row when Clerk is unreachable", async () => {
    getUser.mockRejectedValue(Object.assign(new Error("timeout"), { status: 503 }));
    const user = await new UserManagementService(db).getOrCreateUser("user_outage");
    expect(user?.clerkUserId).toBe("user_outage");
  });
});
