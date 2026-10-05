/**
 * SL-27: Labs routes have a server-side gate that matches the navigation shell: signed-in users
 * while `showLabsTab` is on (the default); with it off only admins, `labs.access` holders and dev
 * builds. Signed-out visitors are sent to sign-in and a failed lookup denies.
 */
jest.mock("@clerk/nextjs/server", () => ({ __esModule: true, auth: jest.fn() }));
jest.mock("next/navigation", () => ({ __esModule: true, unstable_rethrow: jest.fn() }));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { user: { findUnique: jest.fn() }, systemConfig: { findMany: jest.fn() } },
}));

import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { getLabsAccess } from "~/lib/auth/labs-access.server";
import { labsAccessDecision } from "~/lib/navigation/labs-gate";

type AuthResult = Awaited<ReturnType<typeof auth>>;
const authMock = jest.mocked(auth);
const findUser = db.user.findUnique as unknown as jest.Mock;
const findConfig = db.systemConfig.findMany as unknown as jest.Mock;

function user(level: number, permissions: string[] = []) {
  return {
    role: { level, rolePermissions: permissions.map((name) => ({ permission: { name } })) },
  };
}

describe("labsAccessDecision", () => {
  const base = { signedIn: true, isAdmin: false, hasLabsAccess: false };

  it("lets every signed-in user in while Labs is shown (the default)", () => {
    expect(labsAccessDecision({ ...base, showLabsTab: undefined })).toBe("allowed");
    expect(labsAccessDecision({ ...base, showLabsTab: true })).toBe("allowed");
  });

  it("with Labs hidden, admits only admins and labs.access holders", () => {
    expect(labsAccessDecision({ ...base, showLabsTab: false })).toBe("denied");
    expect(labsAccessDecision({ ...base, isAdmin: true, showLabsTab: false })).toBe("allowed");
    expect(labsAccessDecision({ ...base, hasLabsAccess: true, showLabsTab: false })).toBe(
      "allowed"
    );
  });

  it("sends signed-out visitors to sign-in", () => {
    expect(labsAccessDecision({ ...base, signedIn: false, showLabsTab: true })).toBe("signed-out");
  });
});

describe("getLabsAccess", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("is signed-out for guests without touching the database", async () => {
    authMock.mockResolvedValue({ userId: null } as AuthResult);
    await expect(getLabsAccess()).resolves.toBe("signed-out");
    expect(findUser).not.toHaveBeenCalled();
  });

  it("denies a regular user when showLabsTab is off, allows a labs.access holder", async () => {
    authMock.mockResolvedValue({ userId: "user_1" } as AuthResult);
    findConfig.mockResolvedValue([{ key: "showLabsTab", value: "false" }]);
    findUser.mockResolvedValue(user(100));
    await expect(getLabsAccess()).resolves.toBe("denied");

    findUser.mockResolvedValue(user(100, ["labs.access"]));
    await expect(getLabsAccess()).resolves.toBe("allowed");

    findUser.mockResolvedValue(user(10));
    await expect(getLabsAccess()).resolves.toBe("allowed");
  });

  it("allows a regular user when the setting was never saved", async () => {
    authMock.mockResolvedValue({ userId: "user_1" } as AuthResult);
    findConfig.mockResolvedValue([]);
    findUser.mockResolvedValue(null);
    await expect(getLabsAccess()).resolves.toBe("allowed");
  });

  it("denies when the lookup fails", async () => {
    authMock.mockResolvedValue({ userId: "user_1" } as AuthResult);
    findConfig.mockRejectedValue(new Error("db down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(getLabsAccess()).resolves.toBe("denied");
    spy.mockRestore();
  });
});
