/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418 (A8): a wiki account's info comes from Postgres alone and never invents what it does not hold.
// The edit count is its revisions, the registration its link's recorded date, else its first revision,
// the groups the rights engine's, the user id its verified link's. MediaWiki is never asked.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiRevision: { count: jest.fn(), findFirst: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn() },
    lorewardUserStats: { findFirst: jest.fn() },
  },
}));
jest.mock("~/lib/wiki-os/rights", () => ({
  __esModule: true,
  loadTargetPermissions: jest.fn(),
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { db } from "~/server/db";
import { loadTargetPermissions } from "~/lib/wiki-os/rights";
import { ixwikiGetUserInfo } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-activity";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const mocked = db as unknown as {
  wikiRevision: { count: jest.Mock; findFirst: jest.Mock };
  wikiAccountLink: { findFirst: jest.Mock };
  lorewardUserStats: { findFirst: jest.Mock };
};
const permissions = jest.mocked(loadTargetPermissions);

const firstEdit = new Date("2024-03-01T10:00:00Z");

let guard: FetchGuard;
beforeEach(() => {
  jest.clearAllMocks();
  guard = installFetchGuard();
  mocked.wikiRevision.count.mockResolvedValue(3);
  mocked.wikiRevision.findFirst.mockResolvedValue({ author: "Kir", createdAt: firstEdit });
  mocked.wikiAccountLink.findFirst.mockResolvedValue(null);
  mocked.lorewardUserStats.findFirst.mockResolvedValue(null);
  permissions.mockResolvedValue({
    groups: ["*"],
    rights: new Set(),
    block: null,
    verifiedWikiUsername: null,
  });
});
afterEach(() => guard.restore());

describe("ixwikiGetUserInfo", () => {
  it("counts the account's revisions and dates it from its first one, never asking MediaWiki", async () => {
    const info = await ixwikiGetUserInfo("kir");

    expect(info).toMatchObject({
      exists: true,
      username: "Kir",
      user_name: "Kir",
      editCount: 3,
      user_editcount: 3,
      registration: firstEdit.toISOString(),
      user_registration: firstEdit.toISOString(),
      // The id is MediaWiki's: unknown without a verified link, never made up.
      userId: 0,
      user_id: 0,
    });
    expect(guard.calls()).toEqual([]);
    expect(mocked.wikiRevision.count.mock.calls[0]?.[0].where).toEqual({
      author: { equals: "Kir", mode: "insensitive" },
    });
  });

  it("reports the groups of the rights engine, with the implicit user group of an account that exists", async () => {
    permissions.mockResolvedValue({
      groups: ["*", "sysop"],
      rights: new Set(),
      block: null,
      verifiedWikiUsername: null,
    });

    const info = await ixwikiGetUserInfo("Kir");

    expect(info?.groups).toEqual(["*", "sysop", "user"]);
    expect(permissions).toHaveBeenCalledWith({ userId: null, wikiUsername: "Kir" });
  });

  it("takes the user id and registration of a verified link, and counts edits saved under its owner's id", async () => {
    const registered = new Date("2023-01-05T00:00:00Z");
    mocked.wikiAccountLink.findFirst.mockResolvedValue({
      userId: "u1",
      username: "Kir",
      wikiUserId: 42,
      mwRegisteredAt: registered,
      user: { createdAt: new Date("2025-01-01T00:00:00Z") },
    });
    permissions.mockResolvedValue({
      groups: ["*", "user", "autoconfirmed"],
      rights: new Set(),
      block: null,
      verifiedWikiUsername: "Kir",
    });

    const info = await ixwikiGetUserInfo("Kir");

    expect(info).toMatchObject({
      userId: 42,
      registration: registered.toISOString(),
      groups: ["*", "user", "autoconfirmed"],
    });
    expect(mocked.wikiRevision.count.mock.calls[0]?.[0].where).toEqual({
      OR: [{ author: { equals: "Kir", mode: "insensitive" } }, { authorId: "u1" }],
    });
    expect(permissions).toHaveBeenCalledWith({ userId: "u1", wikiUsername: "Kir" });
  });

  it("dates a linked account that never edited from the WikiOS account", async () => {
    const created = new Date("2025-01-01T00:00:00Z");
    mocked.wikiRevision.count.mockResolvedValue(0);
    mocked.wikiRevision.findFirst.mockResolvedValue(null);
    mocked.wikiAccountLink.findFirst.mockResolvedValue({
      userId: "u1",
      username: "Kir",
      wikiUserId: null,
      mwRegisteredAt: null,
      user: { createdAt: created },
    });

    const info = await ixwikiGetUserInfo("Kir");

    expect(info).toMatchObject({ exists: true, userId: 0, registration: created.toISOString() });
  });

  it("knows an account from its Lorewards activity alone, with no made-up edit count or id", async () => {
    mocked.wikiRevision.count.mockResolvedValue(0);
    mocked.wikiRevision.findFirst.mockResolvedValue(null);
    mocked.lorewardUserStats.findFirst.mockResolvedValue({ username: "Kir" });

    expect(await ixwikiGetUserInfo("Kir")).toMatchObject({
      exists: true,
      username: "Kir",
      userId: 0,
      editCount: 0,
      registration: null,
      user_registration: "",
    });
  });

  it("knows an account that only holds a group (an imported, not yet linked membership)", async () => {
    mocked.wikiRevision.count.mockResolvedValue(0);
    mocked.wikiRevision.findFirst.mockResolvedValue(null);
    permissions.mockResolvedValue({
      groups: ["*", "bot"],
      rights: new Set(),
      block: null,
      verifiedWikiUsername: null,
    });

    expect(await ixwikiGetUserInfo("Botty")).toMatchObject({
      exists: true,
      groups: ["*", "bot", "user"],
    });
  });

  it("reports an unknown name as not existing, without asking MediaWiki", async () => {
    mocked.wikiRevision.count.mockResolvedValue(0);
    mocked.wikiRevision.findFirst.mockResolvedValue(null);

    expect(await ixwikiGetUserInfo("Nobody")).toMatchObject({
      exists: false,
      userId: 0,
      editCount: 0,
      groups: [],
      username: "Nobody",
    });
    expect(guard.ixwikiCalls()).toEqual([]);
  });

  it("takes a name as typed: an @, underscores, a percent-escape, and one that is not valid escaping", async () => {
    await ixwikiGetUserInfo("@mr_x");
    await ixwikiGetUserInfo("Mr%20Y");
    await ixwikiGetUserInfo("100%");

    const names = mocked.wikiRevision.count.mock.calls.map(
      ([args]) => args.where.author.equals as string
    );
    expect(names).toEqual(["Mr x", "Mr Y", "100%"]);
    expect(await ixwikiGetUserInfo("   ")).toBeNull();
  });
});
