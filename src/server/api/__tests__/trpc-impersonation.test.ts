import { describe, it, expect, jest } from "@jest/globals";
import { createTRPCContext } from "../trpc";
import { db } from "~/server/db";

// Mock dependencies
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock("~/lib/system-owner-constants", () => ({
  isSystemOwner: (id: string) => id === "system_owner_id",
}));
jest.mock("@clerk/nextjs/server", () => {
  const original = jest.requireActual("@clerk/nextjs/server") as any;
  return {
    ...original,
    getAuth: jest.fn((req: any) => req.auth || null),
  };
});

describe("TRPC Context Impersonation", () => {
  it("swaps context to target user when requested by an authorized system owner", async () => {
    const mockFindUnique = db.user.findUnique as any;
    mockFindUnique.mockImplementation(async ({ where }: { where: { clerkUserId: string } }) => {
      if (where.clerkUserId === "system_owner_id") {
        return { clerkUserId: "system_owner_id", role: { name: "owner", level: 0 } };
      }
      if (where.clerkUserId === "target_user_id") {
        return { clerkUserId: "target_user_id", role: null };
      }
      return null;
    });

    const headers = new Headers();
    headers.set("x-play-as-user", "target_user_id");

    const ctx = await createTRPCContext({
      headers,
      req: {
        auth: { userId: "system_owner_id" },
      } as any,
    });

    expect(ctx.auth?.userId).toBe("target_user_id");
    expect(ctx.user?.clerkUserId).toBe("target_user_id");
    expect(ctx.impersonatorId).toBe("system_owner_id");
  });

  it("does NOT swap context if the requester is not an admin", async () => {
    const mockFindUnique = db.user.findUnique as any;
    mockFindUnique.mockImplementation(async ({ where }: { where: { clerkUserId: string } }) => {
      if (where.clerkUserId === "regular_user_id") {
        return { clerkUserId: "regular_user_id", role: null };
      }
      return null;
    });

    const headers = new Headers();
    headers.set("x-play-as-user", "target_user_id");

    const ctx = await createTRPCContext({
      headers,
      req: {
        auth: { userId: "regular_user_id" },
      } as any,
    });

    expect(ctx.auth?.userId).toBe("regular_user_id");
    expect(ctx.user?.clerkUserId).toBe("regular_user_id");
    expect(ctx.impersonatorId).toBeUndefined();
  });
});
