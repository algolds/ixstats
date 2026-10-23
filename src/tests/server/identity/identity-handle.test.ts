/** @jest-environment node */
/**
 * IxStates Passport handles. A handle is 3 to 24 of `a-z 0-9 _`, normalised, never a reserved word; the backfill
 * makes only valid handles and never a Clerk or row id. `ixnayid.setHandle`: the signed-in user claims one; a taken
 * handle is refused (a unique-constraint race too), and the self-service change is allowed once (admins may always
 * change it). `getStatus` reports the change as used, the old forum account from the kept columns, writing nothing, and
 * the owner's own first approved wiki name (hidden or not), while the passport handle takes only a shown one.
 * `suggestHandle` prefills the first-save handle picker: from a shown claim, the forum name or the nation, made free of
 * the stored handles, never from a hidden claim.
 *
 * Folds ixnayid-set-handle and ixnayid-forum-readonly.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    country: { findUnique: jest.fn().mockResolvedValue(null) },
    thinkpagesAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    wikiNameClaim: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    userConnection: { findMany: jest.fn().mockResolvedValue([]) },
    $executeRaw: jest.fn().mockResolvedValue(0),
    // The transaction client is the same fake
    $transaction: jest.fn((work: (tx: object) => Promise<object>) => work(db)),
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { Prisma } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { ixnayidCoreRouter } from "~/server/api/routers/ixnayid/core";
import { db } from "~/server/db";
import {
  RESERVED_HANDLES,
  chooseBackfillHandle,
  needsCanonicalRedirect,
  slugifyHandle,
  validateHandle,
} from "~/server/modules/identity/identity.handle";
import { createMockRouterContext } from "~/tests/helpers/router-context";

describe("a handle", () => {
  it.each(["@Picard_1", "a_b", "123", "a".repeat(24)])("%s is valid, normalised", (raw) => {
    expect(validateHandle(raw)).toEqual({ ok: true, handle: raw.replace(/^@/, "").toLowerCase() });
  });

  it.each(["ab", "a".repeat(25), "a-b", "has space", "a.b", "", "ünï"])(
    "%j is refused as a format",
    (raw) => {
      expect(validateHandle(raw)).toEqual({ ok: false, reason: "format" });
    }
  );

  it.each([...RESERVED_HANDLES])("refuses the reserved word %s, however it is written", (word) => {
    expect(validateHandle(word)).toEqual({ ok: false, reason: "reserved" });
    expect(validateHandle(`@${word.toUpperCase()}`)).toEqual({ ok: false, reason: "reserved" });
  });

  it("is always made valid by the backfill, and never from a Clerk or row id", () => {
    for (const s of ["Admin", "x", "!!!", "Jean-Luc Picard", "a".repeat(30), "settings"]) {
      expect([s, validateHandle(slugifyHandle(s)).ok]).toEqual([s, true]);
    }
    expect(
      chooseBackfillHandle({ wiki: null, forum: null, persona: null, nation: null })
    ).toBeNull();
    expect(
      chooseBackfillHandle({ wiki: "Kir Wiki", forum: "KirForum", persona: null, nation: null })
    ).toEqual({
      source: "wiki",
      handle: "kir_wiki",
    });
  });

  it("redirects a legacy segment to the stored handle, but never me", () => {
    expect(needsCanonicalRedirect("Kir Forum", "kir")).toBe(true);
    expect(needsCanonicalRedirect("@Me", "kir")).toBe(false);
  });
});

const mocked = db as unknown as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  wikiNameClaim: { findMany: jest.Mock; findFirst: jest.Mock };
  $executeRaw: jest.Mock;
};
const createCaller = createCallerFactory(ixnayidCoreRouter);

function caller(role: { name: string; level?: number } = { name: "user", level: 100 }) {
  return createCaller(
    createMockRouterContext({
      auth: { userId: "clerk_1" },
      user: { id: "db_1", clerkUserId: "clerk_1", role },
      db,
    }) as never
  );
}

function storedUser(
  handle: string | null,
  handleChangedAt: Date | null,
  forum: { forumUserId: number | null; forumUsername: string | null } = {
    forumUserId: null,
    forumUsername: "Kir Forum",
  }
) {
  mocked.user.findUnique.mockResolvedValue({
    id: "db_1",
    clerkUserId: "clerk_1",
    handle,
    handleChangedAt,
    countryId: null,
    ...forum,
    lastForumSync: null,
    discordUserId: null,
    discordUsername: null,
    lastDiscordSync: null,
    country: null,
  });
}

const CHANGED = new Date("2026-09-01T00:00:00Z");

beforeEach(() => {
  mocked.user.findUnique.mockReset();
  mocked.user.findFirst.mockReset().mockResolvedValue(null);
  mocked.user.findMany.mockReset().mockResolvedValue([]);
  mocked.user.update
    .mockReset()
    .mockImplementation(({ data }: { data: { handle: string } }) =>
      Promise.resolve({ handle: data.handle })
    );
  storedUser("kir_old", null);
});

describe("ixnayid.setHandle", () => {
  it("saves a valid handle, normalised, and records the change", async () => {
    await expect(caller().setHandle({ handle: "@Kir_New" })).resolves.toEqual({
      handle: "kir_new",
    });
    expect(mocked.user.update).toHaveBeenCalledWith({
      where: { id: "db_1" },
      data: { handle: "kir_new", handleChangedAt: expect.any(Date) },
      select: { handle: true },
    });
  });
  it("rejects a handle another user holds", async () => {
    mocked.user.findFirst.mockResolvedValue({ id: "db_2" });
    await expect(caller().setHandle({ handle: "taken" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mocked.user.findFirst).toHaveBeenCalledWith({
      where: { handle: "taken", NOT: { id: "db_1" } },
      select: { id: true },
    });
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  describe("against old wiki names other players hold", () => {
    beforeEach(() => {
      mocked.$executeRaw.mockClear();
      mocked.wikiNameClaim.findFirst.mockClear();
    });
    afterEach(() => {
      mocked.wikiNameClaim.findFirst.mockReset().mockResolvedValue(null);
    });

    it("refuses a handle MediaWiki normalises to another account's approved claim, under the name's lock", async () => {
      mocked.wikiNameClaim.findFirst.mockResolvedValue({ userId: "db_2" });
      await expect(caller().setHandle({ handle: "Old_Sysop" })).rejects.toMatchObject({
        code: "CONFLICT",
        message: "That handle belongs to an old wiki name another player holds.",
      });
      expect(mocked.wikiNameClaim.findFirst).toHaveBeenCalledWith({
        where: { source: "ixwiki", name: "Old sysop", status: "APPROVED" },
        select: { userId: true },
      });
      // The lock is the claim path's: one key for the name however it is spelled
      expect(mocked.$executeRaw.mock.calls[0]).toContain("ixwiki:Old sysop");
      expect(mocked.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mocked.wikiNameClaim.findFirst.mock.invocationCallOrder[0]!
      );
      expect(mocked.user.update).not.toHaveBeenCalled();
    });

    it("lets a player take a handle spelling their own claim", async () => {
      mocked.wikiNameClaim.findFirst.mockResolvedValue({ userId: "db_1" });
      await expect(caller().setHandle({ handle: "old_sysop" })).resolves.toEqual({
        handle: "old_sysop",
      });
    });
  });

  it("reports a unique-constraint race as taken", async () => {
    mocked.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    await expect(caller().setHandle({ handle: "raced" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rejects a second self-service change", async () => {
    storedUser("kir_new", CHANGED);
    await expect(caller().setHandle({ handle: "kir_again" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("lets a user without a handle claim one without using up the change", async () => {
    storedUser(null, null);
    await expect(caller().setHandle({ handle: "kir_first" })).resolves.toEqual({
      handle: "kir_first",
    });
    expect(mocked.user.update).toHaveBeenCalledWith({
      where: { id: "db_1" },
      data: { handle: "kir_first" },
      select: { handle: true },
    });
  });

  it("allows one change after a first claim, then refuses the next", async () => {
    storedUser("kir_first", null);
    await expect(caller().setHandle({ handle: "kir_second" })).resolves.toEqual({
      handle: "kir_second",
    });
    expect(mocked.user.update).toHaveBeenCalledWith({
      where: { id: "db_1" },
      data: { handle: "kir_second", handleChangedAt: expect.any(Date) },
      select: { handle: true },
    });

    mocked.user.update.mockClear();
    storedUser("kir_second", CHANGED);
    await expect(caller().setHandle({ handle: "kir_third" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("lets an admin change their handle again", async () => {
    storedUser("kir_new", CHANGED);
    await expect(
      caller({ name: "admin", level: 10 }).setHandle({ handle: "kir_again" })
    ).resolves.toEqual({ handle: "kir_again" });
  });

  it("treats saving the current handle as a no-op that keeps the change available", async () => {
    await expect(caller().setHandle({ handle: "KIR_OLD" })).resolves.toEqual({ handle: "kir_old" });
    expect(mocked.user.update).not.toHaveBeenCalled();
  });
});

describe("ixnayid.getStatus handle", () => {
  it("reports the change as used, except for admins", async () => {
    storedUser("kir", CHANGED);
    expect((await caller().getStatus()).canChangeHandle).toBe(false);
    expect((await caller({ name: "admin", level: 10 }).getStatus()).canChangeHandle).toBe(true);
  });
});

describe("ixnayid.getStatus old forum account", () => {
  it("reports the imported forum name from the stored columns and writes nothing", async () => {
    storedUser("kir", null, { forumUserId: 9, forumUsername: "Kir" });
    const status = await caller().getStatus();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(status.forum).toMatchObject({ linked: true, username: "Kir" });
    expect(mocked.user.update).not.toHaveBeenCalled();
  });
});

describe("ixnayid.getStatus wiki name", () => {
  /** The owner's approved claims, oldest first; a `shown` read keeps the visible ones. */
  const claims = (rows: Array<{ name: string; visible: boolean }>) =>
    mocked.wikiNameClaim.findMany.mockImplementation(
      async ({ where }: { where: { visible?: boolean; status?: string } }) =>
        rows
          .filter((row) => !where.visible || row.visible)
          .map((row) => ({ userId: "db_1", status: "APPROVED", ...row }))
    );

  afterEach(() => {
    mocked.wikiNameClaim.findMany.mockReset().mockResolvedValue([]);
  });

  it("is the owner's own first approved name even when hidden, and the handle takes only a shown one", async () => {
    storedUser(null, null);
    claims([
      { name: "Hidden Old", visible: false },
      { name: "Shown Later", visible: true },
    ]);
    // Every computed name resolves back to the owner, so the first one the chain may use wins.
    mocked.user.findFirst.mockResolvedValue({ id: "db_1" });
    const status = await caller().getStatus();
    expect(status.wiki).toEqual({
      linked: true,
      username: "Hidden Old",
      isCustomClaimed: true,
      lastSync: null,
    });
    expect(status.passportHandle).toBe("Shown Later");
    expect(mocked.wikiNameClaim.findMany.mock.calls[0]![0].where).toMatchObject({
      userId: { in: ["db_1"] },
      status: "APPROVED",
    });
  });

  it("is not linked with no approved claim", async () => {
    storedUser("kir", null);
    const status = await caller().getStatus();
    expect(status.wiki).toEqual({
      linked: false,
      username: null,
      isCustomClaimed: false,
      lastSync: null,
    });
  });
});

describe("ixnayid.suggestHandle", () => {
  /** The owner's approved claims; a `shown` read keeps the visible ones. */
  const claims = (rows: Array<{ name: string; visible: boolean }>) =>
    mocked.wikiNameClaim.findMany.mockImplementation(
      async ({ where }: { where: { visible?: boolean } }) =>
        rows
          .filter((row) => !where.visible || row.visible)
          .map((row, i) => ({
            id: `c${i}`,
            userId: "db_1",
            rightsPass: false,
            decidedAt: null,
            mwUserId: null,
            ...row,
          }))
    );

  afterEach(() => {
    mocked.wikiNameClaim.findMany.mockReset().mockResolvedValue([]);
  });

  it("takes the shown claim, made free of the stored handles", async () => {
    storedUser(null, null);
    claims([{ name: "Old name", visible: true }]);
    mocked.user.findMany.mockResolvedValue([{ handle: "old_name" }, { handle: "old_name_3" }]);
    await expect(caller().suggestHandle()).resolves.toEqual({ handle: "old_name_2" });
    expect(mocked.user.findMany).toHaveBeenCalledTimes(1);
    expect(mocked.user.findMany.mock.calls[0]![0]).toMatchObject({
      where: { handle: { startsWith: "old_name" } },
    });
  });

  it("counts stored handles the numbering shortened, for a 24-character name", async () => {
    storedUser(null, null);
    claims([{ name: "A very long old wiki name", visible: true }]);
    const stored = ["a_very_long_old_wiki_nam", "a_very_long_old_wiki_n_2", "someone_else"];
    mocked.user.findMany.mockImplementation(
      async ({ where }: { where: { handle: { startsWith: string } } }) =>
        stored.filter((h) => h.startsWith(where.handle.startsWith)).map((handle) => ({ handle }))
    );
    await expect(caller().suggestHandle()).resolves.toEqual({
      handle: "a_very_long_old_wiki_n_3",
    });
  });

  it("never offers a hidden claim's name: the forum name comes next", async () => {
    storedUser(null, null);
    claims([{ name: "Secret Name", visible: false }]);
    await expect(caller().suggestHandle()).resolves.toEqual({ handle: "kir_forum" });
  });

  it("falls back to the nation's name", async () => {
    mocked.user.findUnique.mockResolvedValue({
      forumUsername: null,
      country: { name: "Caphiria" },
    });
    await expect(caller().suggestHandle()).resolves.toEqual({ handle: "caphiria" });
  });

  it("suggests nothing when the user has no name to make one from", async () => {
    mocked.user.findUnique.mockResolvedValue({ forumUsername: null, country: null });
    await expect(caller().suggestHandle()).resolves.toEqual({ handle: null });
    expect(mocked.user.findMany).not.toHaveBeenCalled();
  });
});
