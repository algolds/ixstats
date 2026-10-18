/** @jest-environment node */
/**
 * How the card surfaces name players, many at once (`loadPlayerNames`), by one rule (`playerDisplayName`): the
 * passport handle (the chain every surface uses: stored handle, verified wiki name, forum name, Clerk id) while it is a
 * real name, else the nation the player holds, else nobody ("a player"). One read of the players, then one of the
 * verified wiki names and one of the nations of those with no stored handle, however many rows name them.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findMany: jest.fn() },
    wikiAccountLink: { findMany: jest.fn() },
    country: { findMany: jest.fn() },
  },
}));
jest.mock("~/server/modules/identity/identity.resolve", () => ({ resolveHandleUser: jest.fn() }));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";
import {
  loadPlayerNames,
  playerDisplayName,
} from "~/server/modules/identity/identity.player-names";
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
  jest.mocked(db.country.findMany).mockResolvedValue([]);
  jest.mocked(resolveHandleUser).mockResolvedValue(null);
});

describe("playerDisplayName", () => {
  it("names a player by their passport handle while it is a real name", () => {
    expect(playerDisplayName({ handle: "ann", clerkUserId: "user_ann", nation: "Caphiria" })).toBe(
      "@ann"
    );
    expect(
      playerDisplayName({ handle: "Takatta Loa", clerkUserId: "user_loa", nation: null })
    ).toBe("@Takatta Loa");
  });

  it("names a player whose handle is only their Clerk id by their nation, else nobody", () => {
    expect(
      playerDisplayName({ handle: "user_kir", clerkUserId: "user_kir", nation: "Urcea" })
    ).toBe("Urcea");
    expect(
      playerDisplayName({ handle: "user_kir", clerkUserId: "user_kir", nation: null })
    ).toBeNull();
    expect(
      playerDisplayName({ handle: "user_kir", clerkUserId: "user_kir", nation: "" })
    ).toBeNull();
  });
});

describe("loadPlayerNames", () => {
  it("names each player once, by the chain, with one read each of players, wiki names and nations", async () => {
    jest
      .mocked(db.user.findMany)
      .mockResolvedValue([
        user("ann", "ann"),
        user("kir", null, "Helvianir"),
        user("loa", null),
        user("nat", null),
        user("nul", null),
      ] as never);
    jest.mocked(db.wikiAccountLink.findMany).mockResolvedValue([
      { userId: "loa", username: "Takatta Loa" },
      { userId: "loa", username: "Older Name" },
    ] as never);
    // Largest economy first, as the read asks; a nation nobody holds names nobody.
    jest.mocked(db.country.findMany).mockResolvedValue([
      { ownerUserId: "nat", name: "Caphiria" },
      { ownerUserId: null, name: "Unheld" },
      { ownerUserId: "nat", name: "Smaller" },
      { ownerUserId: "loa", name: "Loa's nation" },
    ] as never);
    jest
      .mocked(resolveHandleUser)
      .mockImplementation(
        (async (name: string) =>
          ({ Helvianir: { id: "kir" }, "Takatta Loa": { id: "loa" } })[name] ?? null) as never
      );

    const names = await loadPlayerNames(["ann", "kir", "ann", "loa", "nat", "nul", "kir"]);

    expect(Object.fromEntries(names)).toEqual({
      ann: { handle: "ann", displayName: "@ann" },
      kir: { handle: "Helvianir", displayName: "@Helvianir" },
      loa: { handle: "Takatta Loa", displayName: "@Takatta Loa" },
      // A Passport link may still carry the Clerk id, which resolves.
      nat: { handle: "user_nat", displayName: "Caphiria" },
      nul: { handle: "user_nul", displayName: null },
    });
    expect(db.user.findMany).toHaveBeenCalledTimes(1);
    expect(jest.mocked(db.user.findMany).mock.calls[0]![0]).toEqual({
      where: { id: { in: ["ann", "kir", "loa", "nat", "nul"] } },
      select: { id: true, clerkUserId: true, handle: true, forumUsername: true },
    });
    // Only a player with no stored handle needs a wiki name or a nation.
    expect(db.wikiAccountLink.findMany).toHaveBeenCalledTimes(1);
    expect(jest.mocked(db.wikiAccountLink.findMany).mock.calls[0]![0]).toEqual({
      where: {
        userId: { in: ["kir", "loa", "nat", "nul"] },
        source: "ixwiki",
        verifiedAt: { not: null },
      },
      select: { userId: true, username: true },
    });
    expect(db.country.findMany).toHaveBeenCalledTimes(1);
    // The nations a passport lists, in its order (`resolveIdentityNations`).
    expect(jest.mocked(db.country.findMany).mock.calls[0]![0]).toEqual({
      where: {
        ownerUserId: { in: ["kir", "loa", "nat", "nul"] },
        OR: [{ realmId: DEFAULT_REALM_ID }, { realm: DIRECTORY_REALM_WHERE }],
      },
      select: { ownerUserId: true, name: true },
      orderBy: { currentTotalGdp: "desc" },
    });
  });

  it("reads nothing for no players, and no wiki names or nations when every player has a handle", async () => {
    await expect(loadPlayerNames([])).resolves.toEqual(new Map());
    expect(db.user.findMany).not.toHaveBeenCalled();

    jest.mocked(db.user.findMany).mockResolvedValue([user("ann", "ann")] as never);
    await expect(loadPlayerNames(["ann"])).resolves.toEqual(
      new Map([["ann", { handle: "ann", displayName: "@ann" }]])
    );
    expect(db.wikiAccountLink.findMany).not.toHaveBeenCalled();
    expect(db.country.findMany).not.toHaveBeenCalled();
  });

  it("falls back down the chain when the wiki names cannot be read, and to nobody when the nations cannot", async () => {
    jest
      .mocked(db.user.findMany)
      .mockResolvedValue([user("kir", null, "Helvianir"), user("nat", null)] as never);
    jest.mocked(db.wikiAccountLink.findMany).mockRejectedValue(new Error("connection reset"));
    jest.mocked(db.country.findMany).mockRejectedValue(new Error("connection reset"));
    jest.mocked(resolveHandleUser).mockResolvedValue({ id: "kir" } as never);
    await expect(loadPlayerNames(["kir", "nat"])).resolves.toEqual(
      new Map([
        ["kir", { handle: "Helvianir", displayName: "@Helvianir" }],
        ["nat", { handle: "user_nat", displayName: null }],
      ])
    );
  });

  it("leaves out an id that names no player", async () => {
    jest.mocked(db.user.findMany).mockResolvedValue([] as never);
    await expect(loadPlayerNames(["gone"])).resolves.toEqual(new Map());
  });
});
