/** @jest-environment node */
/**
 * How the card surfaces name players, many at once (`loadPlayerNames`), by one rule (`playerDisplayName`): the
 * passport handle (the chain every surface uses: stored handle, first approved wiki name claim the player shows, forum
 * name, Clerk id) while it is a real name, else the nation the player holds, else nobody ("a player"). A hidden claim
 * never names anyone, and no privacy switch is read. One read of the players, then one of the shown claimed names and
 * one of the nations of those with no stored handle, however many rows name them.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findMany: jest.fn() },
    wikiNameClaim: { findMany: jest.fn() },
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
  staffName,
  staffNames,
} from "~/server/modules/identity/identity.player-names";
import { resolveHandleUser } from "~/server/modules/identity/identity.resolve";

const user = (id: string, handle: string | null, forumUsername: string | null = null) => ({
  id,
  clerkUserId: `user_${id}`,
  handle,
  forumUsername,
});

/** Approved claims, oldest approval first, as the claims read returns them; a `shown` read keeps the visible ones. */
function claims(rows: Array<{ userId: string; name: string; visible?: boolean }>) {
  jest
    .mocked(db.wikiNameClaim.findMany)
    .mockImplementation((async ({ where }: { where: { visible?: boolean } }) =>
      rows
        .map((row) => ({ visible: true, ...row }))
        .filter((row) => !where.visible || row.visible)) as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  claims([]);
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
  it("names each player once, by the chain, with one read each of players, claimed names and nations", async () => {
    jest
      .mocked(db.user.findMany)
      .mockResolvedValue([
        user("ann", "ann"),
        user("kir", null, "Helvianir"),
        user("loa", null),
        user("nat", null),
        user("nul", null),
      ] as never);
    claims([
      { userId: "loa", name: "Takatta Loa" },
      { userId: "loa", name: "Older Name" },
    ]);
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
    // Only a player with no stored handle needs a wiki name or a nation; only an approved, shown claim names one.
    expect(db.wikiNameClaim.findMany).toHaveBeenCalledTimes(1);
    expect(jest.mocked(db.wikiNameClaim.findMany).mock.calls[0]![0]).toMatchObject({
      where: {
        source: "ixwiki",
        userId: { in: ["kir", "loa", "nat", "nul"] },
        status: "APPROVED",
        visible: true,
      },
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
  it("falls back down the chain when the wiki names cannot be read, and to nobody when the nations cannot", async () => {
    jest
      .mocked(db.user.findMany)
      .mockResolvedValue([user("kir", null, "Helvianir"), user("nat", null)] as never);
    jest.mocked(db.wikiNameClaim.findMany).mockRejectedValue(new Error("connection reset"));
    jest.mocked(db.country.findMany).mockRejectedValue(new Error("connection reset"));
    jest.mocked(resolveHandleUser).mockResolvedValue({ id: "kir" } as never);
    await expect(loadPlayerNames(["kir", "nat"])).resolves.toEqual(
      new Map([
        ["kir", { handle: "Helvianir", displayName: "@Helvianir" }],
        ["nat", { handle: "user_nat", displayName: null }],
      ])
    );
  });

  describe("a claimed name in the handle", () => {
    beforeEach(() => {
      jest
        .mocked(db.user.findMany)
        .mockResolvedValue([
          user("loa", null),
          user("kir", null, "Helvianir"),
          user("ann", "ann"),
        ] as never);
      claims([
        { userId: "loa", name: "Takatta Loa" },
        { userId: "kir", name: "Kir of the Wiki" },
      ]);
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

    it("uses a shown claimed name, with one claims read for the batch", async () => {
      const names = await loadPlayerNames(["loa", "kir", "ann"]);

      expect(Object.fromEntries(names)).toEqual({
        loa: { handle: "Takatta Loa", displayName: "@Takatta Loa" },
        kir: { handle: "Kir of the Wiki", displayName: "@Kir of the Wiki" },
        ann: { handle: "ann", displayName: "@ann" },
      });
      // One read, for the players a wiki name could name (no stored handle).
      expect(db.wikiNameClaim.findMany).toHaveBeenCalledTimes(1);
      expect(jest.mocked(db.wikiNameClaim.findMany).mock.calls[0]![0]).toMatchObject({
        where: { userId: { in: ["loa", "kir"] } },
      });
    });

    it("never names a player by a hidden claim", async () => {
      claims([
        { userId: "loa", name: "Takatta Loa", visible: false },
        { userId: "kir", name: "Kir Secret", visible: false },
        { userId: "kir", name: "Kir of the Wiki" },
      ]);

      const names = await loadPlayerNames(["loa", "kir", "ann"]);

      expect(Object.fromEntries(names)).toEqual({
        loa: { handle: "user_loa", displayName: "Loa's nation" },
        kir: { handle: "Kir of the Wiki", displayName: "@Kir of the Wiki" },
        ann: { handle: "ann", displayName: "@ann" },
      });
      expect(JSON.stringify(Object.fromEntries(names))).not.toMatch(/Takatta Loa|Kir Secret/);
      expect(resolveHandleUser).not.toHaveBeenCalledWith("Takatta Loa");
    });
  });
});

describe("staffNames", () => {
  it("names a player for staff by the name players read, else by their passport handle", async () => {
    jest
      .mocked(db.user.findMany)
      .mockResolvedValue([user("ann", "ann"), user("nul", null)] as never);
    const names = await staffNames(["ann", "nul"]);
    expect(Object.fromEntries(names)).toEqual({ ann: "@ann", nul: "user_nul" });
    expect(staffName({ handle: "user_x", displayName: "Caphiria" })).toBe("Caphiria");
  });
});
