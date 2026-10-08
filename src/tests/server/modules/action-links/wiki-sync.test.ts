/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/wiki-os/core", () => ({ ArticleRepository: { findBySlug: jest.fn() } }));
jest.mock("~/lib/wiki-os/core/edit-conflict", () => ({ getHeadRevisionRefs: jest.fn(async () => null) }));
jest.mock("~/lib/wiki-os/services/edit-service", () => ({ commitWikitextSave: jest.fn(async () => ({})) }));
jest.mock("~/lib/wiki-os/config", () => ({
  ...jest.requireActual("~/lib/wiki-os/config"),
  mediaWikiOrigin: () => "https://wiki.test",
}));

import { ArticleRepository } from "~/lib/wiki-os/core";
import { getHeadRevisionRefs } from "~/lib/wiki-os/core/edit-conflict";
import { commitWikitextSave } from "~/lib/wiki-os/services/edit-service";
import { db as serverDb } from "~/server/db";
import { appendChainToWiki, syncPendingChainWikis } from "~/server/modules/action-links";

function db(chain: object | null) {
  return {
    storyline: {
      findFirst: jest.fn(async () => chain),
      update: jest.fn(async () => ({})),
    },
  };
}

const CHAIN = {
  id: "s1",
  title: "Pact",
  wikiPageTitle: "Northern Pact",
  reviewedAt: new Date("2026-10-07T00:00:00Z"),
  country: { name: "Aurelia" },
  actionLinks: [
    { postSource: "native", postRef: "p1", activity: { title: "Signed", type: "diplomatic", createdAt: new Date(0) } },
  ],
};

const MARKER = "<!-- story-chain:s1 -->";
const HEAD = { revisionRef: "rev-9", revisionRefs: ["rev-9"] };

describe("appendChainToWiki", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getHeadRevisionRefs).mockResolvedValue(null);
  });

  it("appends the section to the existing page as the country and marks the chain synced", async () => {
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ wikitext: "Intro." } as never);
    const d = db(CHAIN);
    await expect(appendChainToWiki(d as never, "s1")).resolves.toBe(true);
    const [ctx, save] = jest.mocked(commitWikitextSave).mock.calls[0]!;
    expect(ctx).toEqual({ user: { country: { name: "Aurelia" } } });
    expect(save.title).toBe("Northern Pact");
    expect(save.wikitext.startsWith(`Intro.\n\n${MARKER}\n== Story chain: Pact ==`)).toBe(true);
    expect(save.wikitext).toContain("https://wiki.test");
    expect(save.wikitext).toContain("/thinkpages/post/p1 Signed]");
    expect(d.storyline.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { wikiSyncedAt: expect.any(Date) } });
  });

  it("creates the page when it does not exist", async () => {
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
    await appendChainToWiki(db(CHAIN) as never, "s1");
    expect(jest.mocked(commitWikitextSave).mock.calls[0]![1].wikitext.startsWith(`${MARKER}\n== Story chain`)).toBe(true);
  });

  it("does nothing for a chain that is not approved-and-pending", async () => {
    await expect(appendChainToWiki(db(null) as never, "s1")).resolves.toBe(false);
    expect(commitWikitextSave).not.toHaveBeenCalled();
  });

  it("leaves wikiSyncedAt null when the save throws", async () => {
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
    jest.mocked(commitWikitextSave).mockRejectedValueOnce(new Error("down"));
    const d = db(CHAIN);
    await expect(appendChainToWiki(d as never, "s1")).rejects.toThrow("down");
    expect(d.storyline.update).not.toHaveBeenCalled();
  });

  it("aborts without writing when the page exists but its text cannot be read", async () => {
    jest.mocked(getHeadRevisionRefs).mockResolvedValue(HEAD);
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
    const d = db(CHAIN);
    await expect(appendChainToWiki(d as never, "s1")).rejects.toThrow("could not read the current text of Northern Pact");
    expect(commitWikitextSave).not.toHaveBeenCalled();
    expect(d.storyline.update).not.toHaveBeenCalled();
  });

  it("skips the save but marks the chain synced when the section is already on the page", async () => {
    jest.mocked(getHeadRevisionRefs).mockResolvedValue(HEAD);
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ wikitext: `Intro.\n\n${MARKER}\n== x ==` } as never);
    const d = db(CHAIN);
    await expect(appendChainToWiki(d as never, "s1")).resolves.toBe(true);
    expect(commitWikitextSave).not.toHaveBeenCalled();
    expect(d.storyline.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { wikiSyncedAt: expect.any(Date) } });
  });

  it("saves against the head revision for an existing page and null for a new page", async () => {
    jest.mocked(getHeadRevisionRefs).mockResolvedValue(HEAD);
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue({ wikitext: "Intro." } as never);
    await appendChainToWiki(db(CHAIN) as never, "s1");
    expect(jest.mocked(commitWikitextSave).mock.calls[0]![1].expectedHeadRef).toBe("rev-9");

    jest.mocked(getHeadRevisionRefs).mockResolvedValue(null);
    jest.mocked(ArticleRepository.findBySlug).mockResolvedValue(null);
    await appendChainToWiki(db(CHAIN) as never, "s1");
    expect(jest.mocked(commitWikitextSave).mock.calls[1]![1].expectedHeadRef).toBeNull();
  });
});

describe("syncPendingChainWikis", () => {
  it("retries the longest-waiting chains first, so failing ones cannot starve the rest", async () => {
    const findMany = jest.fn(async () => []);
    Object.assign(serverDb, { storyline: { findMany } });
    await expect(syncPendingChainWikis()).resolves.toEqual({ synced: 0, failed: 0 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { reviewedAt: "asc" }, take: 50 }));
  });
});
