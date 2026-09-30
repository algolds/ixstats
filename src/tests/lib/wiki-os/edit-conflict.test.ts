/** @jest-environment node */
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), getHistory: jest.fn() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { detectEditConflict, getHeadRevisionRefs, revisionRefs } from "~/lib/wiki-os/core/edit-conflict";

const history = jest.mocked(ArticleRepository.getHistory);
const findBySlug = jest.mocked(ArticleRepository.findBySlug);

describe("getHeadRevisionRefs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("is the row id of a native edit and the rev_id of a synced one, and lists both once stamped", async () => {
    history.mockResolvedValueOnce([{ id: "cuid-1", mwRevId: null }] as never);
    expect(await getHeadRevisionRefs("Page")).toEqual({ revisionRef: "cuid-1", revisionRefs: ["cuid-1"] });
    history.mockResolvedValueOnce([{ id: "cuid-2", mwRevId: 99 }] as never);
    expect(await getHeadRevisionRefs("Page")).toEqual({ revisionRef: "99", revisionRefs: ["cuid-2", "99"] });
  });

  it("asks for the single newest revision and is null for a page with none", async () => {
    history.mockResolvedValueOnce([]);
    expect(await getHeadRevisionRefs("Page")).toBeNull();
    expect(history).toHaveBeenCalledWith("Page", "ixwiki", 1);
  });

  it("names a revision by its row id and, once stamped, its rev_id", () => {
    expect(revisionRefs({ id: "c", mwRevId: null })).toEqual(["c"]);
    expect(revisionRefs({ id: "c", mwRevId: 7 })).toEqual(["c", "7"]);
  });
});

describe("detectEditConflict", () => {
  beforeEach(() => jest.clearAllMocks());

  it("is null while the base is the head, and while neither exists", async () => {
    history.mockResolvedValue([{ id: "r1", mwRevId: null }] as never);
    expect(await detectEditConflict("Page", "r1")).toBeNull();
    history.mockResolvedValue([]);
    expect(await detectEditConflict("Page", undefined)).toBeNull();
    expect(findBySlug).not.toHaveBeenCalled();
  });

  it("reports the current text and ref when the page moved on", async () => {
    history.mockResolvedValue([{ id: "r2", mwRevId: null }] as never);
    findBySlug.mockResolvedValue({ wikitext: "now" } as never);
    expect(await detectEditConflict("Page", "r1")).toEqual({
      currentWikitext: "now",
      currentRevisionRef: "r2",
    });
  });

  it("does not conflict with its own revision after the export worker stamps the rev_id", async () => {
    // The editor loaded the page while the head was known by its row id ...
    history.mockResolvedValue([{ id: "cuid-1", mwRevId: null }] as never);
    const loadedRef = (await getHeadRevisionRefs("Page"))!.revisionRef;
    expect(loadedRef).toBe("cuid-1");
    // ... the worker stamps the same revision with its MediaWiki rev_id before the editor saves ...
    history.mockResolvedValue([{ id: "cuid-1", mwRevId: 4321 }] as never);
    // ... the save is still based on the head.
    expect(await detectEditConflict("Page", loadedRef)).toBeNull();
    expect(await detectEditConflict("Page", "4321")).toBeNull();
    // A different revision still conflicts, and the answer names the head by its current ref.
    findBySlug.mockResolvedValue({ wikitext: "now" } as never);
    expect(await detectEditConflict("Page", "cuid-0")).toEqual({
      currentWikitext: "now",
      currentRevisionRef: "4321",
    });
  });
});
