/** @jest-environment node */
/**
 * The page a title leads to for this reader. A deleted page shows only to a reader who may see it, and never to a
 * caller that asks for live pages only (a country's lore pieces).
 */
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  resolveRedirect: jest.fn(async (title: string) => ({ title, fragment: null })),
}));
jest.mock("~/lib/wiki-os/permissions", () => ({ canSeeTitle: jest.fn(async () => true) }));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  getArticleWikitextShadow: jest.fn(
    async (_title: string, _source: string, options: { includeArchived?: boolean }) =>
      options.includeArchived ? { wikitext: "deleted text" } : null
  ),
}));

import { canSeeTitle } from "~/lib/wiki-os/permissions";
import { readVisiblePage } from "~/lib/wiki-os/services/visible-page";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";

const admin = {} as WikiAuthContext;

describe("readVisiblePage", () => {
  it("shows a deleted page to a reader who may see deleted pages", async () => {
    expect(await readVisiblePage(admin, "Gone")).toEqual({
      resolvedTitle: "Gone",
      wikitext: "deleted text",
    });
  });

  it("never shows a deleted page when asked for live pages only, whoever reads", async () => {
    expect(await readVisiblePage(admin, "Gone", { includeArchived: false })).toEqual({
      resolvedTitle: "Gone",
      wikitext: null,
    });
  });

  it("shows nothing to a reader who may not see the title", async () => {
    jest.mocked(canSeeTitle).mockResolvedValueOnce(false);
    expect(await readVisiblePage(admin, "Gone")).toEqual({ resolvedTitle: "Gone", wikitext: null });
  });
});
