/**
 * Phase 4b (Q11): forum account linking is retired. `ixnayid.getStatus` reports the old forum account straight from
 * the kept columns (it no longer refreshes the name from XenForo, and writes nothing), and the self-service
 * forum linking procedures are gone (linking is now a staff action plus an importer rerun).
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

import { beforeEach, describe, expect, it } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { ixnayidCoreRouter } from "~/server/api/routers/ixnayid/core";
import { ixnayidLinkingRouter } from "~/server/api/routers/ixnayid/linking";
import { db } from "~/server/db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const mocked = db as never as {
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
});

describe("ixnayid.getStatus old forum account", () => {
  it("reports the imported forum name from the stored columns and writes nothing", async () => {
    storedUser(9, "Kir");
    const status = await caller().getStatus();
    await settle();
    expect(status.forum).toMatchObject({ linked: true, username: "Kir" });
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("reports no old forum account when none is stored", async () => {
    storedUser(null, null);
    const status = await caller().getStatus();
    expect(status.forum).toMatchObject({ linked: false, username: null });
  });
});

describe("forum linking procedures", () => {
  it("are gone from IxnayID", () => {
    const procedures = [
      ...Object.keys(ixnayidCoreRouter._def.procedures),
      ...Object.keys(ixnayidLinkingRouter._def.procedures),
    ];
    for (const name of [
      "lookupForumUser",
      "startForumVerification",
      "confirmForumVerification",
      "unlinkForum",
    ]) {
      expect(procedures).not.toContain(name);
    }
  });
});
