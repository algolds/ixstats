import { assertCountryWriteAccess as assertCountryAccess } from "../../../server/shared/country-authorization";
import { createMockRouterContext } from "../../helpers/router-context";
import { TRPCError } from "@trpc/server";

describe("country-authorization characterization contract", () => {
  const targetCountryId = "country_target_123";

  it("fast path: authorizes immediately when ctx.user.countryId matches target without DB lookup", async () => {
    const mockFindUnique = jest.fn();
    const ctx = createMockRouterContext({
      user: {
        clerkUserId: "user_owner",
        countryId: targetCountryId,
        role: { name: "member" },
      },
      db: { user: { findUnique: mockFindUnique } },
    });

    await expect(assertCountryAccess(ctx, targetCountryId)).resolves.toBeUndefined();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("cached role: authorizes admin immediately without DB lookup", async () => {
    const mockFindUnique = jest.fn();
    const ctx = createMockRouterContext({
      user: {
        clerkUserId: "user_admin",
        countryId: "other_country",
        role: { name: "admin" },
      },
      db: { user: { findUnique: mockFindUnique } },
    });

    await expect(assertCountryAccess(ctx, targetCountryId)).resolves.toBeUndefined();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("cached role: authorizes owner immediately without DB lookup", async () => {
    const mockFindUnique = jest.fn();
    const ctx = createMockRouterContext({
      user: {
        clerkUserId: "user_owner_role",
        countryId: "other_country",
        role: { name: "owner" },
      },
      db: { user: { findUnique: mockFindUnique } },
    });

    await expect(assertCountryAccess(ctx, targetCountryId)).resolves.toBeUndefined();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("cached role: authorizes staff immediately without DB lookup", async () => {
    const mockFindUnique = jest.fn();
    const ctx = createMockRouterContext({
      user: {
        clerkUserId: "user_staff_role",
        countryId: "other_country",
        role: { name: "staff" },
      },
      db: { user: { findUnique: mockFindUnique } },
    });

    await expect(assertCountryAccess(ctx, targetCountryId)).resolves.toBeUndefined();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("cached role: authorizes system-owner role immediately without DB lookup", async () => {
    const mockFindUnique = jest.fn();
    const ctx = createMockRouterContext({
      user: {
        clerkUserId: "user_sys_owner",
        countryId: "other_country",
        role: { name: "system-owner" },
      },
      db: { user: { findUnique: mockFindUnique } },
    });

    await expect(assertCountryAccess(ctx, targetCountryId)).resolves.toBeUndefined();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("stale cache fallback: performs fresh DB lookup when cached countryId differs and succeeds if DB matches", async () => {
    const mockFindUnique = jest.fn().mockResolvedValue({
      clerkUserId: "user_stale",
      countryId: targetCountryId,
      role: { name: "member" },
    });

    const ctx = createMockRouterContext({
      auth: { userId: "user_stale" },
      user: {
        clerkUserId: "user_stale",
        countryId: "stale_old_country",
        role: { name: "member" },
      },
      db: { user: { findUnique: mockFindUnique } },
    });

    await expect(assertCountryAccess(ctx, targetCountryId)).resolves.toBeUndefined();
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { clerkUserId: "user_stale" },
      include: { role: true },
    });
  });

  it("stale cache fallback: performs fresh DB lookup and succeeds if fresh role is privileged", async () => {
    const mockFindUnique = jest.fn().mockResolvedValue({
      clerkUserId: "user_promoted",
      countryId: "other_country",
      role: { name: "admin" },
    });

    const ctx = createMockRouterContext({
      auth: { userId: "user_promoted" },
      user: {
        clerkUserId: "user_promoted",
        countryId: "other_country",
        role: { name: "member" },
      },
      db: { user: { findUnique: mockFindUnique } },
    });

    await expect(assertCountryAccess(ctx, targetCountryId)).resolves.toBeUndefined();
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });

  it("rejects with FORBIDDEN when user does not own country and is not privileged", async () => {
    const mockFindUnique = jest.fn().mockResolvedValue({
      clerkUserId: "user_foreign",
      countryId: "foreign_country_999",
      role: { name: "member" },
    });

    const ctx = createMockRouterContext({
      auth: { userId: "user_foreign" },
      user: {
        clerkUserId: "user_foreign",
        countryId: "foreign_country_999",
        role: { name: "member" },
      },
      db: { user: { findUnique: mockFindUnique } },
    });

    await expect(assertCountryAccess(ctx, targetCountryId)).rejects.toThrow(TRPCError);
    await expect(assertCountryAccess(ctx, targetCountryId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects with FORBIDDEN when DB user is not found", async () => {
    const mockFindUnique = jest.fn().mockResolvedValue(null);

    const ctx = createMockRouterContext({
      auth: { userId: "user_deleted" },
      user: null,
      db: { user: { findUnique: mockFindUnique } },
    });

    await expect(assertCountryAccess(ctx, targetCountryId)).rejects.toThrow(TRPCError);
    await expect(assertCountryAccess(ctx, targetCountryId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects with FORBIDDEN when completely unauthenticated", async () => {
    const mockFindUnique = jest.fn();
    const ctx = createMockRouterContext({
      auth: null,
      user: null,
      db: { user: { findUnique: mockFindUnique } },
    });

    await expect(assertCountryAccess(ctx, targetCountryId)).rejects.toThrow(TRPCError);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
