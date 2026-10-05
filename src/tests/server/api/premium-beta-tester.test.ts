/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see premium-for-all.test.ts).
//
// MyCountry Premium tools (Defense, Map editor) are for premium members and beta testers. The
// client shows them to both, so the server gate (premiumProcedure) must accept both too, or a
// beta tester would see Defense and then fail every data call.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { user: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } },
  isDatabaseReadOnly: true,
}));
let systemOwnerIds: string[] = [];
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => systemOwnerIds.includes(id),
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => systemOwnerIds.includes(id),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory, createTRPCRouter, premiumProcedure } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { isBetaTesterRole } from "~/lib/auth/premium";

const router = createTRPCRouter({ ping: premiumProcedure.query(() => "pong") });

const ctxFor = (role: { name: string; level: number } | null, tier = "basic", userId = "user_1") =>
  createMockRouterContext({
    auth: { userId },
    user: {
      id: "db1",
      clerkUserId: userId,
      countryId: "c1",
      membershipTier: tier,
      role,
    },
  }) as never;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL;
  systemOwnerIds = [];
});

describe("premiumProcedure and the beta-tester role", () => {
  it.each([
    ["beta_tester", 50],
    ["beta-tester", 50],
    ["beta", 50],
    ["user", 90],
  ])("accepts a non-premium %s (level %i)", async (name, level) => {
    const caller = createCallerFactory(router)(ctxFor({ name, level }));
    await expect(caller.ping()).resolves.toBe("pong");
  });

  it("accepts staff, admin and owner roles, as the client ability does", async () => {
    for (const [name, level] of [
      ["staff", 20],
      ["admin", 10],
      ["owner", 0],
    ] as const) {
      await expect(createCallerFactory(router)(ctxFor({ name, level })).ping()).resolves.toBe(
        "pong"
      );
    }
  });

  it("accepts a system owner", async () => {
    systemOwnerIds = ["user_owner"];
    const caller = createCallerFactory(router)(ctxFor(null, "basic", "user_owner"));
    await expect(caller.ping()).resolves.toBe("pong");
  });

  it("still accepts the premium tier", async () => {
    const caller = createCallerFactory(router)(
      ctxFor({ name: "user", level: 100 }, "mycountry_premium")
    );
    await expect(caller.ping()).resolves.toBe("pong");
  });

  it("rejects a plain user and a user without a role", async () => {
    await expect(
      createCallerFactory(router)(ctxFor({ name: "user", level: 100 })).ping()
    ).rejects.toThrow("MyCountry Premium membership required");
    await expect(createCallerFactory(router)(ctxFor(null)).ping()).rejects.toThrow(
      "MyCountry Premium membership required"
    );
  });
});

describe("isBetaTesterRole", () => {
  it("matches beta names and the staff, beta levels only", () => {
    expect(isBetaTesterRole("beta_tester", 50)).toBe(true);
    expect(isBetaTesterRole("user", 90)).toBe(true);
    expect(isBetaTesterRole("moderator", 30)).toBe(false);
    expect(isBetaTesterRole("user", 100)).toBe(false);
    expect(isBetaTesterRole(undefined, undefined)).toBe(false);
  });
});
