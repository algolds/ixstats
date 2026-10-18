/** @jest-environment node */
/**
 * `loadPassportHandlesById`: many players' passport handles at once, through the one chain every surface uses (stored
 * handle, verified wiki name, forum name, Clerk id). One read of the players and one of their verified wiki names,
 * however many rows name them.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findMany: jest.fn() },
    wikiAccountLink: { findMany: jest.fn() },
  },
}));
jest.mock("~/server/modules/identity/identity.resolve", () => ({ resolveHandleUser: jest.fn() }));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { loadPassportHandlesById } from "~/server/modules/identity/identity.passport-handles";
import { resolveHandleUser } from "~/server/modules/identity/identity.resolve";

const user = (id: string, handle: string | null, forumUsername: string | null = null) => ({
  id,
  clerkUserId: `user_${id}`,
  handle,
  forumUsername,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(db.wikiAccountLink.findMany).mockResolvedValue([]);
  jest.mocked(resolveHandleUser).mockResolvedValue(null);
});

describe("loadPassportHandlesById", () => {
  it("names each player once, by the chain, with one read of the players and one of their wiki names", async () => {
    jest
      .mocked(db.user.findMany)
      .mockResolvedValue([
        user("ann", "ann"),
        user("kir", null, "Helvianir"),
        user("loa", null),
        user("nul", null),
      ] as never);
    jest.mocked(db.wikiAccountLink.findMany).mockResolvedValue([
      { userId: "loa", username: "Takatta Loa" },
      { userId: "loa", username: "Older Name" },
    ] as never);
    jest
      .mocked(resolveHandleUser)
      .mockImplementation(
        (async (name: string) =>
          ({ Helvianir: { id: "kir" }, "Takatta Loa": { id: "loa" } })[name] ?? null) as never
      );

    const handles = await loadPassportHandlesById(["ann", "kir", "ann", "loa", "nul", "kir"]);

    expect(Object.fromEntries(handles)).toEqual({
      ann: "ann",
      kir: "Helvianir",
      loa: "Takatta Loa",
      nul: "user_nul",
    });
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
    expect(jest.mocked(db.user.findMany).mock.calls[0]![0]).toEqual({
      where: { id: { in: ["ann", "kir", "loa", "nul"] } },
      select: { id: true, clerkUserId: true, handle: true, forumUsername: true },
    });
    // Only a player with no stored handle needs a wiki name.
    expect(db.wikiAccountLink.findMany).toHaveBeenCalledTimes(1);
    expect(jest.mocked(db.wikiAccountLink.findMany).mock.calls[0]![0]).toEqual({
      where: { userId: { in: ["kir", "loa", "nul"] }, source: "ixwiki", verifiedAt: { not: null } },
      select: { userId: true, username: true },
    });
  });

  it("reads nothing for no players, and no wiki names when every player has a handle", async () => {
    await expect(loadPassportHandlesById([])).resolves.toEqual(new Map());
    expect(db.user.findMany).not.toHaveBeenCalled();

    jest.mocked(db.user.findMany).mockResolvedValue([user("ann", "ann")] as never);
    await expect(loadPassportHandlesById(["ann"])).resolves.toEqual(new Map([["ann", "ann"]]));
    expect(db.wikiAccountLink.findMany).not.toHaveBeenCalled();
  });

  it("falls back down the chain when the wiki names cannot be read", async () => {
    jest.mocked(db.user.findMany).mockResolvedValue([user("kir", null, "Helvianir")] as never);
    jest.mocked(db.wikiAccountLink.findMany).mockRejectedValue(new Error("connection reset"));
    jest.mocked(resolveHandleUser).mockResolvedValue({ id: "kir" } as never);
    await expect(loadPassportHandlesById(["kir"])).resolves.toEqual(
      new Map([["kir", "Helvianir"]])
    );
  });

  it("leaves out an id that names no player", async () => {
    jest.mocked(db.user.findMany).mockResolvedValue([] as never);
    await expect(loadPassportHandlesById(["gone"])).resolves.toEqual(new Map());
  });
});
