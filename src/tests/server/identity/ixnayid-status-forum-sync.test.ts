/**
 * The linked forum name is refreshed from the signed-in user's own `ixnayid.getStatus`, never from
 * the public passport read. The refresh is fire-and-forget: a forum or write failure never fails
 * the status call.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    country: { findUnique: jest.fn().mockResolvedValue(null) },
    thinkpagesAccount: { findFirst: jest.fn().mockResolvedValue(null) },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

const getMember = jest.fn();
jest.mock("~/server/modules/forum", () => ({
  cacheKey: (...parts: Array<string | number>) => parts.join(":"),
  cachedFetch: (_key: string, _kind: string, load: () => Promise<object | null>) => load(),
  xfFetch: (path: string) => getMember(path),
  lookupForumUser: jest.fn(),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { ixnayidCoreRouter } from "~/server/api/routers/ixnayid/core";
import { db } from "~/server/db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const mocked = db as unknown as {
  user: { findUnique: jest.Mock; update: jest.Mock };
};
const createCaller = createCallerFactory(ixnayidCoreRouter);

function caller() {
  return createCaller(
    createMockRouterContext({
      auth: { userId: "clerk_1" },
      user: { id: "db_1", clerkUserId: "clerk_1", role: { name: "user", level: 100 } },
      db,
    }) as never
  );
}

function storedUser(forumUserId: number | null, forumUsername: string | null) {
  mocked.user.findUnique.mockResolvedValue({
    id: "db_1",
    clerkUserId: "clerk_1",
    handle: "kir",
    handleChangedAt: null,
    countryId: null,
    forumUserId,
    forumUsername,
    lastForumSync: null,
    discordUserId: null,
    discordUsername: null,
    lastDiscordSync: null,
    country: null,
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  mocked.user.update.mockResolvedValue({});
});

describe("ixnayid.getStatus forum sync", () => {
  it("stores the forum's current username when it changed", async () => {
    storedUser(9, "OldName");
    getMember.mockResolvedValue({ user: { user_id: 9, username: "NewName" } });
    await caller().getStatus();
    await settle();
    expect(getMember).toHaveBeenCalledWith("/users/9/");
    expect(mocked.user.update).toHaveBeenCalledWith({
      where: { id: "db_1" },
      data: { forumUserId: 9, forumUsername: "NewName", lastForumSync: expect.any(Date) },
    });
  });

  it("writes nothing when the forum name is unchanged", async () => {
    storedUser(9, "Kir");
    getMember.mockResolvedValue({ user: { user_id: 9, username: "Kir" } });
    await caller().getStatus();
    await settle();
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("skips the forum entirely without a linked forum account", async () => {
    storedUser(null, null);
    await caller().getStatus();
    await settle();
    expect(getMember).not.toHaveBeenCalled();
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("still answers when the forum read fails", async () => {
    storedUser(9, "Kir");
    getMember.mockRejectedValue(new Error("forum down"));
    await expect(caller().getStatus()).resolves.toMatchObject({ handle: "kir" });
    await settle();
    expect(mocked.user.update).not.toHaveBeenCalled();
  });
});
