/**
 * Regression for fix-round-1 Critical 1 and ruling F-2: the admin link check (findLinkableWikiAccount, used by
 * the admin `linkUserWiki` mutation; the former ixnayid self-service mutation of the same shape was removed in
 * favor of token-on-user-page verification) writes nothing — no WikiAccountLink row (it has no proof of account
 * control) and no legacy column (adminVerify writes those, after its TAKEN check).
 * Only start()/confirm() (token-on-user-page) and adminVerify() (admin authority) may verify a link.
 * Heavy real deps (~/server/db, the MediaWiki bridge barrel) are mocked out per the task brief's own
 * guidance, since they pull in Prisma/DB wiring that isn't relevant to this unit.
 */
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getUserInfo: jest.fn().mockResolvedValue({
    exists: true,
    userId: 7,
    username: "Kir",
    editCount: 12,
    groups: ["user"],
  }),
}));

jest.mock("~/lib/wiki-os/adapters/mediawiki/account-proof", () => ({
  fetchWikiUser: jest.fn(),
}));

jest.mock("~/server/db", () => ({
  db: {
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    wikiAccountLink: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import { findLinkableWikiAccount } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { getUserInfo } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { fetchWikiUser } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { db } from "~/server/db";

const mockGetUserInfo = jest.mocked(getUserInfo);
const mockFetchWikiUser = jest.mocked(fetchWikiUser);

/** What WikiOS answers for an account it has no trace of. */
const UNKNOWN = { exists: false, userId: 0, username: "NewAcct", editCount: 0, groups: [] };
/** What WikiOS answers for an account it knows (edits, a group) but whose MediaWiki id it cannot know. */
const KNOWN_WITHOUT_ID = { exists: true, userId: 0, username: "Quiet", editCount: 4, groups: ["user"] };

describe("findLinkableWikiAccount (admin link check — writes nothing)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves the wiki account without touching the User columns or WikiAccountLink", async () => {
    const res = await findLinkableWikiAccount("u1", "kir");
    expect(res).toEqual({ success: true, wikiUsername: "Kir", wikiUserId: 7 });
    expect((db as any).user.update).not.toHaveBeenCalled();
    expect((db as any).wikiAccountLink.upsert).not.toHaveBeenCalled();
    expect((db as any).wikiAccountLink.deleteMany).not.toHaveBeenCalled();
    expect((db as any).wikiAccountLink.findUnique).not.toHaveBeenCalled();
  });

  it("refuses an account another IxStats user already holds", async () => {
    (db as any).user.findFirst.mockResolvedValueOnce({ id: "u2" });
    await expect(findLinkableWikiAccount("u1", "Kir")).resolves.toMatchObject({ success: false });
    expect((db as any).user.update).not.toHaveBeenCalled();
  });
});

describe("findLinkableWikiAccount asks the wiki for what WikiOS cannot know (an admin-triggered account-proof read)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchWikiUser.mockResolvedValue(null);
  });

  it("does not ask the wiki when WikiOS knows the account and its MediaWiki id", async () => {
    await expect(findLinkableWikiAccount("u1", "kir")).resolves.toEqual({
      success: true,
      wikiUsername: "Kir",
      wikiUserId: 7,
    });
    expect(mockFetchWikiUser).not.toHaveBeenCalled();
  });

  it("links an account with no edit, no link and no group (WikiOS has no trace), keeping its MediaWiki id", async () => {
    mockGetUserInfo.mockResolvedValueOnce(UNKNOWN as never);
    mockFetchWikiUser.mockResolvedValue({
      username: "NewAcct",
      userId: 55,
      registration: new Date("2026-09-01T00:00:00Z"),
      editCount: 0,
    });

    await expect(findLinkableWikiAccount("u1", "newacct")).resolves.toEqual({
      success: true,
      wikiUsername: "NewAcct",
      wikiUserId: 55,
    });
    expect(mockFetchWikiUser).toHaveBeenCalledWith("ixwiki", "newacct");
  });

  it("completes the MediaWiki id of an account WikiOS knows only by its edits", async () => {
    mockGetUserInfo.mockResolvedValueOnce(KNOWN_WITHOUT_ID as never);
    mockFetchWikiUser.mockResolvedValue({
      username: "Quiet",
      userId: 91,
      registration: null,
      editCount: 4,
    });

    await expect(findLinkableWikiAccount("u1", "Quiet")).resolves.toEqual({
      success: true,
      wikiUsername: "Quiet",
      wikiUserId: 91,
    });
  });

  it("links an account WikiOS knows when the wiki cannot be asked, id unknown", async () => {
    mockGetUserInfo.mockResolvedValueOnce(KNOWN_WITHOUT_ID as never);
    mockFetchWikiUser.mockRejectedValue(new Error("ixwiki did not answer (HTTP 503); try again later"));

    await expect(findLinkableWikiAccount("u1", "Quiet")).resolves.toEqual({
      success: true,
      wikiUsername: "Quiet",
      wikiUserId: 0,
    });
  });

  it("refuses an account neither WikiOS nor the wiki knows", async () => {
    mockGetUserInfo.mockResolvedValueOnce(UNKNOWN as never);

    await expect(findLinkableWikiAccount("u1", "Nobody")).resolves.toEqual({
      success: false,
      error: 'Wiki user "Nobody" not found',
    });
  });

  it("says so when WikiOS knows nothing and the wiki cannot be asked", async () => {
    mockGetUserInfo.mockResolvedValueOnce(UNKNOWN as never);
    mockFetchWikiUser.mockRejectedValue(new Error("ixwiki did not answer (HTTP 503); try again later"));

    const res = await findLinkableWikiAccount("u1", "NewAcct");

    expect(res.success).toBe(false);
    expect(res.error).toContain("could not be asked");
    expect(res.error).toContain("HTTP 503");
  });

  it("still refuses an account another IxStats user holds, whichever side knew it", async () => {
    mockGetUserInfo.mockResolvedValueOnce(UNKNOWN as never);
    mockFetchWikiUser.mockResolvedValue({ username: "NewAcct", userId: 55, registration: null, editCount: 0 });
    (db as any).user.findFirst.mockResolvedValueOnce({ id: "u2" });

    await expect(findLinkableWikiAccount("u1", "NewAcct")).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("already claimed"),
    });
  });
});
