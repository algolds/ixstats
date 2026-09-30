/** @jest-environment node */
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), getHistory: jest.fn() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { detectEditConflict, getHeadRevisionRef } from "~/lib/wiki-os/core/edit-conflict";

const history = jest.mocked(ArticleRepository.getHistory);
const findBySlug = jest.mocked(ArticleRepository.findBySlug);

describe("getHeadRevisionRef", () => {
  beforeEach(() => jest.clearAllMocks());

  it("is the row id of a native edit and the rev_id of a synced one", async () => {
    history.mockResolvedValueOnce([{ id: "cuid-1", mwRevId: null }] as never);
    expect(await getHeadRevisionRef("Page")).toBe("cuid-1");
    history.mockResolvedValueOnce([{ id: "cuid-2", mwRevId: 99 }] as never);
    expect(await getHeadRevisionRef("Page")).toBe("99");
  });

  it("asks for the single newest revision and is null for a page with none", async () => {
    history.mockResolvedValueOnce([]);
    expect(await getHeadRevisionRef("Page")).toBeNull();
    expect(history).toHaveBeenCalledWith("Page", "ixwiki", 1);
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
});
