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
import { db } from "~/server/db";

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
