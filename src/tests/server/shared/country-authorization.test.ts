import {
  assertCountryWriteAccess,
  getRoleName,
  isPrivilegedCountryWriter,
  COUNTRY_WRITE_ROLES,
} from "../../../server/shared/country-authorization";
import { TRPCError } from "@trpc/server";

describe("Plan 149: Canonical Country-Write Authorization Matrix", () => {
  const targetCountryId = "country_alpha";

  describe("getRoleName", () => {
    it("extracts string roles, object roles, and session claim roles", () => {
      expect(getRoleName({ role: "admin" })).toBe("admin");
      expect(getRoleName({ role: { name: "staff" } })).toBe("staff");
      expect(getRoleName(null, { metadata: { role: "owner" } })).toBe("owner");
      expect(getRoleName("system-owner")).toBe("system-owner");
      expect(getRoleName(null)).toBeUndefined();
    });
  });

  describe("isPrivilegedCountryWriter", () => {
    it("returns true for all COUNTRY_WRITE_ROLES", () => {
      for (const role of COUNTRY_WRITE_ROLES) {
        expect(isPrivilegedCountryWriter("user_regular", role)).toBe(true);
      }
    });

    it("returns false for non-privileged roles", () => {
      expect(isPrivilegedCountryWriter("user_regular", "member")).toBe(false);
      expect(isPrivilegedCountryWriter("user_regular", "viewer")).toBe(false);
      expect(isPrivilegedCountryWriter("user_regular", undefined)).toBe(false);
    });
  });

  describe("assertCountryWriteAccess", () => {
    it("fast path: allows direct owner from cached context without DB user query", async () => {
      const mockUserFindUnique = jest.fn();
      const ctx = {
        auth: { userId: "user_owner" },
        user: {
          clerkUserId: "user_owner",
          countryId: targetCountryId,
          role: "member",
        },
        db: {
          user: { findUnique: mockUserFindUnique },
        },
      };

      await expect(assertCountryWriteAccess(ctx as any, targetCountryId)).resolves.toBeUndefined();
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it("fast path: allows cached privileged roles without DB query", async () => {
      for (const role of ["admin", "owner", "staff", "system-owner"]) {
        const mockUserFindUnique = jest.fn();
        const ctx = {
          auth: { userId: `user_${role}` },
          user: {
            clerkUserId: `user_${role}`,
            countryId: "other_country",
            role: { name: role },
          },
          db: {
            user: { findUnique: mockUserFindUnique },
          },
        };

        await expect(assertCountryWriteAccess(ctx as any, targetCountryId)).resolves.toBeUndefined();
        expect(mockUserFindUnique).not.toHaveBeenCalled();
      }
    });

    it("stale cache fallback: performs fresh DB lookup and succeeds if DB user owns target", async () => {
      const mockUserFindUnique = jest.fn().mockResolvedValue({
        clerkUserId: "user_stale",
        countryId: targetCountryId,
        role: { name: "member" },
      });

      const ctx = {
        auth: { userId: "user_stale" },
        user: {
          clerkUserId: "user_stale",
          countryId: "old_country",
          role: { name: "member" },
        },
        db: {
          user: { findUnique: mockUserFindUnique },
        },
      };

      await expect(assertCountryWriteAccess(ctx as any, targetCountryId)).resolves.toBeUndefined();
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { clerkUserId: "user_stale" },
        include: { role: true },
      });
    });

    it("stale cache fallback: performs fresh DB lookup and succeeds if fresh DB user is privileged", async () => {
      const mockUserFindUnique = jest.fn().mockResolvedValue({
        clerkUserId: "user_promoted",
        countryId: "other_country",
        role: { name: "admin" },
      });

      const ctx = {
        auth: { userId: "user_promoted" },
        user: {
          clerkUserId: "user_promoted",
          countryId: "other_country",
          role: "member",
        },
        db: {
          user: { findUnique: mockUserFindUnique },
        },
      };

      await expect(assertCountryWriteAccess(ctx as any, targetCountryId)).resolves.toBeUndefined();
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    });

    it("throws NOT_FOUND when foreign user attempts write on non-existent country", async () => {
      const mockUserFindUnique = jest.fn().mockResolvedValue({
        clerkUserId: "user_regular",
        countryId: "user_home_country",
        role: { name: "member" },
      });
      const mockCountryFindUnique = jest.fn().mockResolvedValue(null);

      const ctx = {
        auth: { userId: "user_regular" },
        user: {
          clerkUserId: "user_regular",
          countryId: "user_home_country",
          role: "member",
        },
        db: {
          user: { findUnique: mockUserFindUnique },
          country: { findUnique: mockCountryFindUnique },
        },
      };

      await expect(
        assertCountryWriteAccess(ctx as any, "non_existent_country")
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws FORBIDDEN when foreign user attempts write on existing foreign country", async () => {
      const mockUserFindUnique = jest.fn().mockResolvedValue({
        clerkUserId: "user_foreign",
        countryId: "other_country",
        role: { name: "member" },
      });
      const mockCountryFindUnique = jest.fn().mockResolvedValue({ id: targetCountryId });

      const ctx = {
        auth: { userId: "user_foreign" },
        user: {
          clerkUserId: "user_foreign",
          countryId: "other_country",
          role: "member",
        },
        db: {
          user: { findUnique: mockUserFindUnique },
          country: { findUnique: mockCountryFindUnique },
        },
      };

      await expect(assertCountryWriteAccess(ctx as any, targetCountryId)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("throws UNAUTHORIZED defensively when no auth is present", async () => {
      const ctx = {
        auth: null,
        user: null,
        db: {
          user: { findUnique: jest.fn() },
        },
      };

      await expect(assertCountryWriteAccess(ctx as any, targetCountryId)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });
});
