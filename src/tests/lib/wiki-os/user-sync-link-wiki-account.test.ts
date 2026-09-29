/**
 * Regression for fix-round-1 Critical 1: the self-service path (the admin `linkUserWiki` mutation
 * calling linkWikiAccount; the former ixnayid self-service mutation of the same shape was removed
 * in favor of token-on-user-page verification) must never write a WikiAccountLink row — it has no
 * proof of account control.
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

import { linkWikiAccount } from "~/lib/wiki-os/adapters/ixstates/user-sync";
import { db } from "~/server/db";

describe("linkWikiAccount (self-service — no proof of ownership)", () => {
  it("links the legacy User columns but never touches WikiAccountLink", async () => {
    const res = await linkWikiAccount("u1", "kir");
    expect(res).toEqual({ success: true, wikiUsername: "Kir", wikiUserId: 7 });
    expect((db as any).user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ wikiUsername: "Kir", wikiUserId: 7 }),
      })
    );
    expect((db as any).wikiAccountLink.upsert).not.toHaveBeenCalled();
    expect((db as any).wikiAccountLink.deleteMany).not.toHaveBeenCalled();
    expect((db as any).wikiAccountLink.findUnique).not.toHaveBeenCalled();
  });
});
