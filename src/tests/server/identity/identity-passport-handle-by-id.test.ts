/** @jest-environment node */
/**
 * `loadPassportHandleById`: the passport handle of a user found by id, through the one chain every surface uses
 * (stored handle, verified wiki name, forum name, Clerk id), so a card surface can name a holder with no stored
 * handle.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn() },
  },
}));
jest.mock("~/server/modules/identity/identity.resolve", () => ({ resolveHandleUser: jest.fn() }));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { loadPassportHandleById } from "~/server/modules/identity/identity.passport-handle";
import { resolveHandleUser } from "~/server/modules/identity/identity.resolve";

const USER = { id: "u1", clerkUserId: "user_2abc", handle: null, forumUsername: "Helvianir" };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(db.wikiAccountLink.findFirst).mockResolvedValue(null);
  jest.mocked(resolveHandleUser).mockResolvedValue(null);
});

describe("loadPassportHandleById", () => {
  it("is the stored handle when there is one, with no further reads", async () => {
    jest.mocked(db.user.findUnique).mockResolvedValue({ ...USER, handle: "kir" } as never);
    await expect(loadPassportHandleById("u1")).resolves.toBe("kir");
    expect(jest.mocked(db.user.findUnique).mock.calls[0]![0]).toEqual({
      where: { id: "u1" },
      select: { id: true, clerkUserId: true, handle: true, forumUsername: true },
    });
    expect(db.wikiAccountLink.findFirst).not.toHaveBeenCalled();
  });

  it("is the verified wiki name, with spaces, when it names the user back", async () => {
    jest.mocked(db.user.findUnique).mockResolvedValue(USER as never);
    jest
      .mocked(db.wikiAccountLink.findFirst)
      .mockResolvedValue({ username: "Takatta Loa" } as never);
    jest.mocked(resolveHandleUser).mockResolvedValue({ id: "u1" } as never);
    await expect(loadPassportHandleById("u1")).resolves.toBe("Takatta Loa");
    expect(resolveHandleUser).toHaveBeenCalledWith("Takatta Loa");
  });

  it("falls back to the forum name, then the Clerk id", async () => {
    jest.mocked(db.user.findUnique).mockResolvedValue(USER as never);
    jest
      .mocked(resolveHandleUser)
      .mockImplementation((async (name: string) =>
        name === "Helvianir" ? { id: "u1" } : null) as never);
    await expect(loadPassportHandleById("u1")).resolves.toBe("Helvianir");
    jest.mocked(resolveHandleUser).mockResolvedValue(null);
    await expect(loadPassportHandleById("u1")).resolves.toBe("user_2abc");
  });

  it("is null for a user that does not exist", async () => {
    jest.mocked(db.user.findUnique).mockResolvedValue(null);
    await expect(loadPassportHandleById("gone")).resolves.toBeNull();
    expect(resolveHandleUser).not.toHaveBeenCalled();
  });
});
