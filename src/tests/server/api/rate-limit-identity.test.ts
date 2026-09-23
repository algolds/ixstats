import { describe, it, expect } from "@jest/globals";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";

describe("resolveRateLimitIdentifier (pure function)", () => {
  it("returns a user-keyed identifier when signed in, regardless of headers", () => {
    const headers = new Headers();
    headers.set("cf-connecting-ip", "9.9.9.9");
    expect(resolveRateLimitIdentifier(headers, "user_123")).toBe("user:user_123");
  });

  it("ignores client-controlled x-ratelimit-identifier and x-forwarded-for headers", () => {
    const headers = new Headers();
    headers.set("x-ratelimit-identifier", "evil");
    headers.set("x-forwarded-for", "1.1.1.1");
    expect(resolveRateLimitIdentifier(headers, null)).toBe("anonymous");
  });

  it("prefers cf-connecting-ip over x-real-ip", () => {
    const headers = new Headers();
    headers.set("cf-connecting-ip", "2.2.2.2");
    headers.set("x-real-ip", "3.3.3.3");
    expect(resolveRateLimitIdentifier(headers, null)).toBe("ip:2.2.2.2");
  });

  it("falls back to x-real-ip when cf-connecting-ip is absent", () => {
    const headers = new Headers();
    headers.set("x-real-ip", "3.3.3.3");
    expect(resolveRateLimitIdentifier(headers, null)).toBe("ip:3.3.3.3");
  });

  it("falls back to \"anonymous\" when no trusted headers and no user are present", () => {
    const headers = new Headers();
    expect(resolveRateLimitIdentifier(headers, null)).toBe("anonymous");
  });
});

// Mock dependencies for the context-level case below (spoofed header must never reach
// ctx.rateLimitIdentifier). Kept in the same file per the plan's test list. `jest` is
// deliberately NOT imported from "@jest/globals" — see the note in trpc-impersonation.test.ts:
// jest.mock() factories below call jest.fn() inline, and importing `jest` under that same name
// would shadow the ambient global those hoisted factories rely on.
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
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: () => false,
}));

import { createTRPCContext } from "~/server/api/trpc/context";
import { db } from "~/server/db";

describe("createTRPCContext rate limit identity (context-level)", () => {
  it("never lets a spoofed x-ratelimit-identifier header reach ctx.rateLimitIdentifier", async () => {
    jest.spyOn(db.user, "findUnique").mockResolvedValue({
      clerkUserId: "victim_user_id",
      role: { name: "user", level: 100 },
    } as never);

    const headers = new Headers();
    headers.set("x-ratelimit-identifier", "evil-bucket");

    const ctx = await createTRPCContext({
      headers,
      req: { auth: { userId: "victim_user_id" }, headers: new Headers() } as any,
    });

    expect(ctx.rateLimitIdentifier).toBe("user:victim_user_id");
    expect(ctx.rateLimitIdentifier).not.toContain("evil-bucket");
  });

  it("keys anonymous requests off a trusted IP header, not the client-supplied identifier", async () => {
    const headers = new Headers();
    headers.set("x-ratelimit-identifier", "evil-bucket");
    headers.set("cf-connecting-ip", "5.5.5.5");

    const ctx = await createTRPCContext({ headers });

    expect(ctx.rateLimitIdentifier).toBe("ip:5.5.5.5");
  });
});
