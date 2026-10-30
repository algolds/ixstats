/** The one admin rule the proxy, the admin layout, the nav and tRPC share: an owner/admin/staff role name, or a level of 20 or less. */
import { isAdminRole } from "~/lib/auth/admin-rule";

describe("isAdminRole", () => {
  it.each([
    [{ name: "staff", level: 20 }, true],
    [{ name: "owner", level: 0 }, true],
    [{ name: "admin", level: null }, true],
    [{ name: "member", level: 15 }, true],
    [{ name: "member", level: 20 }, true],
    [{ name: null, level: 10 }, true],
    [{ name: "member", level: 21 }, false],
    [{ name: "member", level: 50 }, false],
    [{ name: "moderator", level: 30 }, false],
    [{ name: "", level: null }, false],
    [{ name: null, level: null }, false],
  ])("%j is %s", (role, expected) => {
    expect(isAdminRole(role)).toBe(expected);
  });

  it("is false with no role", () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });

  it("does not match a role name by case or prefix", () => {
    expect(isAdminRole({ name: "Admin", level: 100 })).toBe(false);
    expect(isAdminRole({ name: "admins", level: 100 })).toBe(false);
  });
});
