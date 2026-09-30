/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals" (see cards-archetypes-admin-auth.test.ts):
// the hoisted jest.mock() factories rely on the ambient global.
//
// NEXT_PUBLIC_PREMIUM_FOR_ALL is the test-build switch for MyCountry Premium: the server gate
// (premiumProcedure) and the client ability must both honour it, and it must be off by default.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { user: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } },
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

import { describe, it, expect, afterEach } from "@jest/globals";
import { createCallerFactory, createTRPCRouter, premiumProcedure } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { defineAbilityFor } from "~/lib/auth/ability";

const router = createTRPCRouter({ ping: premiumProcedure.query(() => "pong") });

const basicUserCtx = () =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: {
      id: "db1",
      clerkUserId: "user_1",
      countryId: "c1",
      membershipTier: "basic",
      role: { name: "user", level: 100 },
    },
  }) as never;

describe("NEXT_PUBLIC_PREMIUM_FOR_ALL", () => {
  const original = process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL;
    else process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL = original;
  });

  it("keeps premium procedures closed to basic users by default", async () => {
    delete process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL;
    const caller = createCallerFactory(router)(basicUserCtx());
    await expect(caller.ping()).rejects.toThrow("MyCountry Premium membership required");
    expect(defineAbilityFor("user", [], "basic").can("access", "MyCountryFeature", "defense")).toBe(
      false
    );
  });

  it("opens premium procedures and the Defense section to everyone when set", async () => {
    process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL = "true";
    const caller = createCallerFactory(router)(basicUserCtx());
    await expect(caller.ping()).resolves.toBe("pong");
    expect(defineAbilityFor("user", [], "basic").can("access", "MyCountryFeature", "defense")).toBe(
      true
    );
  });
});
