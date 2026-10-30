/** @jest-environment node */
/**
 * Who may open /admin, for the proxy: the system owner (no DB read), or a user whose DB role passes the admin rule.
 * The answer is remembered for 60 s per Clerk id; a DB failure denies and is not remembered.
 */
const findUnique = jest.fn();
jest.mock("~/server/db", () => ({
  db: { user: { findUnique: (args: object) => findUnique(args) } },
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  isSystemOwner: (id: string) => id === "user_owner",
}));

import { isAdminClerkUser } from "~/server/shared/admin-access";

const roleOf = (name: string, level: number) => ({ role: { name, level } });

beforeEach(() => {
  findUnique.mockReset();
  jest.restoreAllMocks();
});

describe("isAdminClerkUser", () => {
  it("lets the system owner in without reading the database", async () => {
    await expect(isAdminClerkUser("user_owner")).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("lets a level-15 DB user in, reading only the role", async () => {
    findUnique.mockResolvedValue(roleOf("member", 15));
    await expect(isAdminClerkUser("user_l15")).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: "user_l15" },
      select: { role: { select: { name: true, level: true } } },
    });
  });

  it("keeps a level-50 DB user out", async () => {
    findUnique.mockResolvedValue(roleOf("member", 50));
    await expect(isAdminClerkUser("user_l50")).resolves.toBe(false);
  });

  it("keeps out a user with no DB row or no role", async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ role: null });
    await expect(isAdminClerkUser("user_missing")).resolves.toBe(false);
    await expect(isAdminClerkUser("user_norole")).resolves.toBe(false);
  });

  it("answers a second call within 60 s from memory, and reads again after", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    findUnique.mockResolvedValue(roleOf("staff", 20));
    await expect(isAdminClerkUser("user_cached")).resolves.toBe(true);
    now.mockReturnValue(1_000_000 + 59_999);
    await expect(isAdminClerkUser("user_cached")).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(1);

    findUnique.mockResolvedValue(roleOf("member", 100));
    now.mockReturnValue(1_000_000 + 60_000);
    await expect(isAdminClerkUser("user_cached")).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("denies on a database error, logs it, and does not remember the denial", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    findUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(isAdminClerkUser("user_flaky")).resolves.toBe(false);
    expect(error).toHaveBeenCalled();

    findUnique.mockResolvedValueOnce(roleOf("admin", 10));
    await expect(isAdminClerkUser("user_flaky")).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
