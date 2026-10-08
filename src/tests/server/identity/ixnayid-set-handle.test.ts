/**
 * `ixnayid.setHandle`: the signed-in user claims an IxStates Passport handle. Format and reserved
 * words are checked, a taken handle is refused, and the self-service change is allowed once
 * (admins may always change it). `getStatus` reports the stored handle first.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    country: { findUnique: jest.fn().mockResolvedValue(null) },
    thinkpagesAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

import { beforeEach, describe, expect, it } from "@jest/globals";
import { Prisma } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { ixnayidCoreRouter } from "~/server/api/routers/ixnayid/core";
import { db } from "~/server/db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const mocked = db as unknown as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
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

function storedUser(handle: string | null, handleChangedAt: Date | null) {
  mocked.user.findUnique.mockResolvedValue({
    id: "db_1",
    clerkUserId: "clerk_1",
    handle,
    handleChangedAt,
    countryId: null,
    forumUserId: null,
    forumUsername: "Kir Forum",
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
  mocked.user.update.mockReset().mockImplementation(({ data }: { data: { handle: string } }) =>
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

  it("rejects a bad format", async () => {
    await expect(caller().setHandle({ handle: "has space" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("rejects a reserved word", async () => {
    await expect(caller().setHandle({ handle: "settings" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocked.user.update).not.toHaveBeenCalled();
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
  it("prefers the stored handle for the passport link", async () => {
    storedUser("kir", null);
    const status = await caller().getStatus();
    expect(status.passportHandle).toBe("kir");
    expect(status.handle).toBe("kir");
    expect(status.canChangeHandle).toBe(true);
  });

  it("reports the change as used, except for admins", async () => {
    storedUser("kir", CHANGED);
    expect((await caller().getStatus()).canChangeHandle).toBe(false);
    expect((await caller({ name: "admin", level: 10 }).getStatus()).canChangeHandle).toBe(true);
  });
});
