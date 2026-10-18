/** @jest-environment node */
/**
 * How the card surfaces name players, many at once (`loadPlayerNames`), by one rule (`playerDisplayName`): the
 * passport handle (the chain every surface uses: stored handle, verified wiki name while the player shows wiki
 * attribution, forum name, Clerk id) while it is a real name, else the nation the player holds, else nobody ("a
 * player"). One read of the players, then one of the verified wiki names and one of the nations of those with no
 * stored handle, and one of the wiki attribution switch for those with a wiki name, however many rows name them.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findMany: jest.fn() },
    wikiAccountLink: { findMany: jest.fn() },
    country: { findMany: jest.fn() },
    userConnection: { findMany: jest.fn() },
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
  jest.mocked(db.userConnection.findMany).mockResolvedValue([]);
  jest.mocked(resolveHandleUser).mockResolvedValue(null);
});

/** A stored privacy config row turning wiki attribution off for this Clerk id. */
const attributionOff = (clerkUserId: string) => ({
  userId: clerkUserId,
  status: JSON.stringify({ showWikiAttribution: false }),
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

  describe("the wiki attribution switch (showWikiAttribution)", () => {
    beforeEach(() => {
      jest
        .mocked(db.user.findMany)
        .mockResolvedValue([
          user("loa", null),
          user("kir", null, "Helvianir"),
          user("ann", "ann"),
        ] as never);
      jest.mocked(db.wikiAccountLink.findMany).mockResolvedValue([
        { userId: "loa", username: "Takatta Loa" },
        { userId: "kir", username: "Kir of the Wiki" },
      ] as never);
      jest
        .mocked(db.country.findMany)
        .mockResolvedValue([{ ownerUserId: "loa", name: "Loa's nation" }] as never);
      jest.mocked(resolveHandleUser).mockImplementation(
        (async (name: string) =>
          ({
            Helvianir: { id: "kir" },
            "Kir of the Wiki": { id: "kir" },
            "Takatta Loa": { id: "loa" },
          })[name] ?? null) as never
      );
    });

    it("uses a verified wiki name while the switch is on, reading it once for the batch", async () => {
      const names = await loadPlayerNames(["loa", "kir", "ann"]);

      expect(Object.fromEntries(names)).toEqual({
        loa: { handle: "Takatta Loa", displayName: "@Takatta Loa" },
        kir: { handle: "Kir of the Wiki", displayName: "@Kir of the Wiki" },
        ann: { handle: "ann", displayName: "@ann" },
      });
      // One read, for the players a wiki name could name (no stored handle, a verified link).
      expect(db.userConnection.findMany).toHaveBeenCalledTimes(1);
      expect(jest.mocked(db.userConnection.findMany).mock.calls[0]![0]).toMatchObject({
        where: { userId: { in: ["user_loa", "user_kir"] } },
      });
    });

    it("never names a player by their wiki name while their switch is off", async () => {
      jest
        .mocked(db.userConnection.findMany)
        .mockResolvedValue([attributionOff("user_loa")] as never);

      const names = await loadPlayerNames(["loa", "kir", "ann"]);

      expect(Object.fromEntries(names)).toEqual({
        // Past the hidden wiki name to the Clerk id, so others read the nation.
        loa: { handle: "user_loa", displayName: "Loa's nation" },
        kir: { handle: "Kir of the Wiki", displayName: "@Kir of the Wiki" },
        ann: { handle: "ann", displayName: "@ann" },
      });
      expect(JSON.stringify(Object.fromEntries(names))).not.toContain("Takatta Loa");
      expect(resolveHandleUser).not.toHaveBeenCalledWith("Takatta Loa");
    });

    it("fails closed: a switch that cannot be read hides every wiki name", async () => {
      jest.mocked(db.userConnection.findMany).mockRejectedValue(new Error("connection reset"));

      const names = await loadPlayerNames(["loa", "kir", "ann"]);

      expect(Object.fromEntries(names)).toEqual({
        loa: { handle: "user_loa", displayName: "Loa's nation" },
        // The forum name is not a wiki name, so it still names the player.
        kir: { handle: "Helvianir", displayName: "@Helvianir" },
        ann: { handle: "ann", displayName: "@ann" },
      });
      expect(resolveHandleUser).not.toHaveBeenCalledWith("Takatta Loa");
      expect(resolveHandleUser).not.toHaveBeenCalledWith("Kir of the Wiki");
    });

    it("reads no switch when no player has a wiki name", async () => {
      jest.mocked(db.wikiAccountLink.findMany).mockResolvedValue([]);
      await loadPlayerNames(["loa", "kir", "ann"]);
      expect(db.userConnection.findMany).not.toHaveBeenCalled();
    });
  });

  it("leaves out an id that names no player", async () => {
    jest.mocked(db.user.findMany).mockResolvedValue([] as never);
    await expect(loadPlayerNames(["gone"])).resolves.toEqual(new Map());
  });
});
