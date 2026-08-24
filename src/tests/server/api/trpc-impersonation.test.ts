// Mock Clerk before any imports
jest.mock("@clerk/nextjs/server", () => ({
  __esModule: true,
  getAuth: (req: any) => req?.auth ?? null,
  verifyToken: jest.fn(),
  clerkClient: jest.fn(),
}));
jest.mock("@clerk/nextjs", () => ({
  __esModule: true,
  getAuth: (req: any) => req?.auth ?? null,
  verifyToken: jest.fn(),
  clerkClient: jest.fn(),
}));

// Mock dependencies
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: {
      findUnique: jest.fn(),
    },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "system_owner_id",
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "system_owner_id",
}));

import { describe, it, expect, jest } from "@jest/globals";
import { createTRPCContext } from "~/server/api/trpc/context";
import { db } from "~/server/db";

describe("TRPC Context Impersonation", () => {
  it("swaps context to target user when requested by an authorized system owner", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(db.user, "findUnique").mockImplementation((async ({ where }: any) => {
      if (where.clerkUserId === "system_owner_id") {
        return { clerkUserId: "system_owner_id", role: { name: "owner", level: 0 } } as any;
      }
      if (where.clerkUserId === "target_user_id") {
        return { clerkUserId: "target_user_id", role: null } as any;
      }
      return null;
    }) as any);

    const headers = new Headers();
    headers.set("x-play-as-user", "target_user_id");

    const reqHeaders = new Headers();
    reqHeaders.set("x-clerk-auth-status", "signed-in");

    const ctx = await createTRPCContext({
      headers,
      req: {
        auth: { userId: "system_owner_id" },
        headers: reqHeaders,
      } as any,
    });

    expect(ctx.auth?.userId).toBe("target_user_id");
    expect(ctx.user?.clerkUserId).toBe("target_user_id");
    expect(ctx.impersonatorId).toBe("system_owner_id");
    logSpy.mockRestore();
  });

  it("does NOT swap context if the requester is not an admin", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(db.user, "findUnique").mockImplementation((async ({ where }: any) => {
      if (where.clerkUserId === "regular_user_id") {
        return { clerkUserId: "regular_user_id", role: null } as any;
      }
      return null;
    }) as any);

    const headers = new Headers();
    headers.set("x-play-as-user", "target_user_id");

    const reqHeaders = new Headers();
    reqHeaders.set("x-clerk-auth-status", "signed-in");

    const ctx = await createTRPCContext({
      headers,
      req: {
        auth: { userId: "regular_user_id" },
        headers: reqHeaders,
      } as any,
    });

    expect(ctx.auth?.userId).toBe("regular_user_id");
    expect(ctx.user?.clerkUserId).toBe("regular_user_id");
    expect(ctx.impersonatorId).toBeUndefined();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});
