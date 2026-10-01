/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
// Plan 418 (A8): `existsInMediaWiki` says whether the wiki account exists. The bridge always answers with an
// object (`exists: false` for a name with no trace), so the flag must read that field, not the object.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { lorewardUserStats: { findUnique: jest.fn(), count: jest.fn() } },
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/storage", () => ({
  __esModule: true,
  findWikiProfileUser: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getUserContribs: jest.fn(),
  getUserInfo: jest.fn(),
  getBacklinks: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosUserTalkRouter } from "~/server/api/routers/wikios/user-talk";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { db } from "~/server/db";
import { findWikiProfileUser } from "~/lib/wiki-os/storage";
import { getUserInfo } from "~/lib/wiki-os/adapters/mediawiki/bridge";

const info = (over: Record<string, unknown>) => ({
  exists: true,
  userId: 0,
  username: "Kir",
  editCount: 12,
  registration: "2024-03-01T10:00:00.000Z",
  groups: [],
  user_id: 0,
  user_name: "Kir",
  user_editcount: 12,
  user_registration: "2024-03-01T10:00:00.000Z",
  ...over,
});

const profile = (username: string) =>
  createCallerFactory(wikiosUserTalkRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  ).getAuthorProfile({ username });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(findWikiProfileUser).mockResolvedValue(null as never);
  jest.mocked(db.lorewardUserStats.findUnique).mockResolvedValue(null);
});

describe("wikios.getAuthorProfile existsInMediaWiki", () => {
  it("is true for an account that exists", async () => {
    jest.mocked(getUserInfo).mockResolvedValue(info({}));

    expect(await profile("Kir")).toMatchObject({
      existsInMediaWiki: true,
      editCount: 12,
      registration: "2024-03-01T10:00:00.000Z",
    });
  });

  it("is false for a name with no trace, though the bridge answered with an object", async () => {
    jest
      .mocked(getUserInfo)
      .mockResolvedValue(info({ exists: false, editCount: 0, user_editcount: 0, user_registration: "" }));

    expect(await profile("Nobody")).toMatchObject({ existsInMediaWiki: false, editCount: 0 });
  });
});
