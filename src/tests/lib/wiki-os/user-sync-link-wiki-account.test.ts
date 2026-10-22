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
  it("refuses an account neither WikiOS nor the wiki knows", async () => {
    mockGetUserInfo.mockResolvedValueOnce(UNKNOWN as never);

    await expect(findLinkableWikiAccount("u1", "Nobody")).resolves.toEqual({
      success: false,
      error: 'Wiki user "Nobody" not found',
    });
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
