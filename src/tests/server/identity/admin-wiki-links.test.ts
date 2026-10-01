/**
 * Ruling F-2: admins revoke verified wiki links through the wiki-links service (any wiki), and an admin link
 * that loses to another player's verified row (TAKEN) writes nothing at all.
 */
jest.mock("~/lib/auth", () => ({ isSystemOwner: jest.fn(() => false) }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"), // the tRPC context needs the real Cache class
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getUserInfo: jest.fn().mockResolvedValue({ exists: true, userId: 7, username: "Kir" }),
}));
jest.mock("~/server/db", () => ({
  db: {
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  },
  isDatabaseReadOnly: true,
}));

import { adminUsersRouter } from "~/server/api/routers/admin/users";
import { isSystemOwner } from "~/lib/auth";
import { db as serverDb } from "~/server/db";
import { createIdorContext } from "~/tests/helpers/country-idor-context";

function adminCaller(holder: object | null = null) {
  const ctx = createIdorContext(
    {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      wikiAccountLink: {
        findUnique: jest.fn().mockResolvedValue(holder),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      wikiUserGroup: { count: jest.fn().mockResolvedValue(0) },
    },
    "admin"
  );
  const d = ctx.db as any;
  d.$transaction = jest.fn((cb: any) => cb(d));
  return { caller: adminUsersRouter.createCaller(ctx as any), d };
}

const legacyWrite = jest.mocked(serverDb.user.update);

beforeEach(() => {
  legacyWrite.mockClear();
  jest.mocked(isSystemOwner).mockReturnValue(false);
});

describe("admin.unlinkUserWiki", () => {
  it("revokes the verified ixwiki link and clears the legacy columns (ixwiki is the default source)", async () => {
    const { caller, d } = adminCaller();
    await expect(caller.unlinkUserWiki({ userId: "u1" })).resolves.toEqual({ success: true });
    expect(d.wikiAccountLink.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", source: "ixwiki" } });
    expect(d.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { wikiUsername: null, wikiUserId: null, lastWikiSync: null },
    });
  });

  it("revokes an iiwiki or althistory link without touching the ixwiki legacy columns", async () => {
    for (const source of ["iiwiki", "althistory"] as const) {
      const { caller, d } = adminCaller();
      await caller.unlinkUserWiki({ userId: "u1", source });
      expect(d.wikiAccountLink.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", source } });
      expect(d.user.update).not.toHaveBeenCalled();
    }
  });
});

describe("admin.linkUserWiki", () => {
  it("a TAKEN refusal (another player verified the account) is CONFLICT and writes nothing", async () => {
    const { caller, d } = adminCaller({ userId: "someone-else", verifiedAt: new Date() });
    await expect(caller.linkUserWiki({ userId: "u1", wikiUsername: "Kir" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(legacyWrite).not.toHaveBeenCalled();
    expect(d.user.update).not.toHaveBeenCalled();
    expect(d.user.updateMany).not.toHaveBeenCalled();
    expect(d.wikiAccountLink.deleteMany).not.toHaveBeenCalled();
    expect(d.wikiAccountLink.upsert).not.toHaveBeenCalled();
  });

  it("records the verified link and the legacy columns in the service's one transaction", async () => {
    const { caller, d } = adminCaller();
    await expect(caller.linkUserWiki({ userId: "u1", wikiUsername: "kir" })).resolves.toMatchObject({
      success: true,
      wikiUsername: "Kir",
    });
    expect(d.wikiAccountLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ userId: "u1", username: "Kir", wikiUserId: 7 }) })
    );
    expect(d.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ wikiUsername: "Kir", wikiUserId: 7 }),
    });
    expect(legacyWrite).not.toHaveBeenCalled();
  });

  it("records the confirming admin on the link", async () => {
    const { caller, d } = adminCaller();
    await caller.linkUserWiki({ userId: "u1", wikiUsername: "kir" });
    expect(d.wikiAccountLink.upsert.mock.calls[0]?.[0].create).toMatchObject({
      verifiedById: "db_user_caller",
    });
  });

  // The security review's exploit: a staff member links themselves to an unclaimed MediaWiki
  // bureaucrat's name, expecting to inherit the groups imported for that name.
  it("refuses staff linking their own account, FORBIDDEN, writing nothing", async () => {
    const { caller, d } = adminCaller();
    await expect(
      caller.linkUserWiki({ userId: "db_user_caller", wikiUsername: "Mwbureaucrat" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(d.wikiAccountLink.upsert).not.toHaveBeenCalled();
    expect(d.user.update).not.toHaveBeenCalled();
  });

  it("refuses staff linking anyone to a name that holds imported groups, FORBIDDEN, writing nothing", async () => {
    const { caller, d } = adminCaller();
    d.wikiUserGroup.count.mockResolvedValue(1);
    await expect(
      caller.linkUserWiki({ userId: "u1", wikiUsername: "Mwbureaucrat" })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("system owner") });
    expect(d.wikiAccountLink.upsert).not.toHaveBeenCalled();
    expect(d.user.update).not.toHaveBeenCalled();
  });

  it("lets a system owner do both", async () => {
    jest.mocked(isSystemOwner).mockReturnValue(true);
    const { caller, d } = adminCaller();
    d.wikiUserGroup.count.mockResolvedValue(1);
    await expect(
      caller.linkUserWiki({ userId: "db_user_caller", wikiUsername: "Mwbureaucrat" })
    ).resolves.toMatchObject({ success: true });
    expect(d.wikiAccountLink.upsert.mock.calls[0]?.[0].create).toMatchObject({
      verifiedById: "db_user_caller",
    });
  });

  it("an unknown wiki user is BAD_REQUEST and writes nothing", async () => {
    const { getUserInfo } = jest.requireMock("~/lib/wiki-os/adapters/mediawiki/bridge");
    getUserInfo.mockResolvedValueOnce({ exists: false });
    const { caller, d } = adminCaller();
    await expect(caller.linkUserWiki({ userId: "u1", wikiUsername: "Nobody" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(d.wikiAccountLink.upsert).not.toHaveBeenCalled();
    expect(legacyWrite).not.toHaveBeenCalled();
  });
});
