/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Who may use a gated feature. The client abilities (`defineAbilityFor`): the owner manages everything, an admin users
 * and roles but not system config, database permissions map to abilities, and MyCountry Premium tools (Defense,
 * Intelligence, Map editor) need the premium tier. The server gate (`premiumProcedure`) accepts what the client shows
 * them to: premium members, beta testers, staff, admins, owners and the system owner, and nobody else.
 * NEXT_PUBLIC_PREMIUM_FOR_ALL, the test-build switch, opens both and is off by default.
 *
 * Folds premium-beta-tester and premium-for-all.
 */
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

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { createCallerFactory, createTRPCRouter, premiumProcedure } from "~/server/api/trpc";
import { defineAbilityFor } from "~/lib/auth/ability";
import { isBetaTesterRole } from "~/lib/auth/premium";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const router = createTRPCRouter({ ping: premiumProcedure.query(() => "pong") });
const ping = (role: { name: string; level: number } | null, tier = "basic", userId = "user_1") =>
  createCallerFactory(router)(
    createMockRouterContext({
      auth: { userId },
      user: { id: "db1", clerkUserId: userId, countryId: "c1", membershipTier: tier, role },
    }) as never
  ).ping();

const original = process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL;
beforeEach(() => {
  delete process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL;
  systemOwnerIds = [];
});
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL;
  else process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL = original;
});

describe("defineAbilityFor", () => {
  it("lets the owner manage everything, an admin users and roles but not system config", () => {
    const owner = defineAbilityFor("owner", [], "basic", []);
    expect(owner.can("manage", "all")).toBe(true);
    expect(owner.can("access", "MyCountryFeature", "defense")).toBe(true);
    const admin = defineAbilityFor("admin", [], "basic", []);
    expect(admin.can("manage", "all")).toBe(false);
    expect([admin.can("manage", "User"), admin.can("manage", "Role")]).toEqual([true, true]);
    expect([admin.can("read", "SystemConfig"), admin.can("update", "SystemConfig")]).toEqual([
      true,
      false,
    ]);
  });

  it("maps database permissions, and no further", () => {
    const ability = defineAbilityFor("user", ["user.manage", "role.create"], "basic", []);
    expect([ability.can("manage", "User"), ability.can("manage", "Role")]).toEqual([true, true]);
    expect(ability.can("manage", "SystemConfig")).toBe(false);
  });

  it.each([
    ["basic", false],
    ["mycountry_premium", true],
  ])("gives the %s tier the premium sections: %s", (tier, premium) => {
    const ability = defineAbilityFor("user", [], tier, []);
    expect(ability.can("access", "MyCountryFeature", "overview")).toBe(true);
    // Intelligence renders the Defense section, which the "defense" lock covers (F34).
    expect(ability.can("access", "MyCountryFeature", "intelligence")).toBe(true);
    for (const section of ["defense", "map-editor"]) {
      expect([section, ability.can("access", "MyCountryFeature", section)]).toEqual([
        section,
        premium,
      ]);
    }
  });

  it("unlocks a tool only when it is free or unlocked for the user", () => {
    const tool = (toolId: string) => ({ type: "Tool" as const, toolId, unlocked: true });
    const basic = defineAbilityFor("user", [], "basic", []);
    expect(basic.can("use", tool("basic_calculator"))).toBe(true);
    expect(basic.can("use", tool("map_measurer"))).toBe(false);
    expect(
      defineAbilityFor("user", [], "basic", ["map_measurer"]).can("use", tool("map_measurer"))
    ).toBe(true);
  });
});

describe("premiumProcedure", () => {
  it.each([
    ["a beta_tester", { name: "beta_tester", level: 50 }],
    ["a beta-tester", { name: "beta-tester", level: 50 }],
    ["a beta", { name: "beta", level: 50 }],
    ["a level-90 user", { name: "user", level: 90 }],
    ["staff", { name: "staff", level: 20 }],
    ["an admin", { name: "admin", level: 10 }],
    ["the owner role", { name: "owner", level: 0 }],
  ])("accepts %s without the premium tier, as the client ability does", async (_who, role) => {
    await expect(ping(role)).resolves.toBe("pong");
  });

  it("accepts a system owner without a role, and the premium tier", async () => {
    systemOwnerIds = ["user_owner"];
    await expect(ping(null, "basic", "user_owner")).resolves.toBe("pong");
    await expect(ping({ name: "user", level: 100 }, "mycountry_premium")).resolves.toBe("pong");
  });

  it.each([
    ["a plain user", { name: "user", level: 100 }],
    ["a user without a role", null],
  ])("refuses %s", async (_who, role) => {
    await expect(ping(role)).rejects.toThrow("MyCountry Premium membership required");
  });

  it("matches beta names and the staff and beta levels only", () => {
    expect([isBetaTesterRole("beta_tester", 50), isBetaTesterRole("user", 90)]).toEqual([
      true,
      true,
    ]);
    expect([isBetaTesterRole("moderator", 30), isBetaTesterRole("user", 100)]).toEqual([
      false,
      false,
    ]);
    expect(isBetaTesterRole(undefined, undefined)).toBe(false);
  });
});

describe("NEXT_PUBLIC_PREMIUM_FOR_ALL", () => {
  const basicDefense = () =>
    defineAbilityFor("user", [], "basic").can("access", "MyCountryFeature", "defense");

  it("keeps premium procedures and the Defense section closed to basic users by default", async () => {
    await expect(ping({ name: "user", level: 100 })).rejects.toThrow(
      "MyCountry Premium membership required"
    );
    expect(basicDefense()).toBe(false);
  });

  it("opens both to everyone when set", async () => {
    process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL = "true";
    await expect(ping({ name: "user", level: 100 })).resolves.toBe("pong");
    expect(basicDefense()).toBe(true);
  });
});
