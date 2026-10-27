/** @jest-environment node */
/** The edit author is the passport handle (design decision 9); a system save names itself. */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));
jest.mock("~/lib/wiki-os/core", () => ({ ArticleRepository: { saveArticle: jest.fn() } }));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));
// the save limit is save-rate-limit.test.ts's
jest.mock("~/lib/wiki-os/services/save-rate-limit", () => ({
  assertWikiSaveRate: jest.fn().mockResolvedValue(undefined),
}));

import { ArticleRepository } from "~/lib/wiki-os/core";
import { commitWikitextSave } from "~/lib/wiki-os/services/edit-service";
import { HANDLE_REQUIRED_MESSAGE } from "~/lib/wiki-os/auth";
import { MEDIAWIKI_NAMESPACE_REASON } from "~/lib/wiki-os/namespace-policy";

const save = { title: "Page", wikitext: "x", summary: "", minor: false };
const saveArticle = jest.mocked(ArticleRepository.saveArticle);
beforeEach(() => {
  saveArticle.mockReset().mockResolvedValue({ revisionId: "r1" } as never);
});

it("signs a player's save with their handle", async () => {
  await commitWikitextSave(
    {
      auth: { userId: "user_a" },
      user: { id: "a", handle: "alpha", country: { name: "Caphiria" } },
    },
    save
  );
  expect(saveArticle.mock.calls[0]![2]).toBe("alpha");
});

it("refuses a player with no handle and writes nothing", async () => {
  await expect(
    commitWikitextSave(
      {
        auth: { userId: "user_a" },
        user: { id: "a", handle: null, country: { name: "Caphiria" } },
      },
      save
    )
  ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: HANDLE_REQUIRED_MESSAGE });
  expect(saveArticle).not.toHaveBeenCalled();
});

it("refuses a handle that is only whitespace", async () => {
  await expect(
    commitWikitextSave({ auth: { userId: "user_a" }, user: { id: "a", handle: "  " } }, save)
  ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  expect(saveArticle).not.toHaveBeenCalled();
});

it("lets a system save name its own author", async () => {
  await commitWikitextSave({}, { ...save, authorLabel: "Caphiria" });
  expect(saveArticle.mock.calls[0]![2]).toBe("Caphiria");
});

it("refuses any save into the MediaWiki: namespace, a system save too, and writes nothing (A8)", async () => {
  const refusal = {
    code: "FORBIDDEN",
    message: `namespaceprotected: ${MEDIAWIKI_NAMESPACE_REASON}`,
  };
  await expect(
    commitWikitextSave({}, { ...save, title: "MediaWiki:Sidebar", authorLabel: "Caphiria" })
  ).rejects.toMatchObject(refusal);
  await expect(
    commitWikitextSave(
      { auth: { userId: "user_a" }, user: { id: "a", handle: "alpha" } },
      { ...save, title: "mediawiki:common.js" }
    )
  ).rejects.toMatchObject(refusal);
  expect(saveArticle).not.toHaveBeenCalled();
  // the talk namespace beside it is not classic's
  await commitWikitextSave(
    {},
    { ...save, title: "MediaWiki talk:Sidebar", authorLabel: "Caphiria" }
  );
  expect(saveArticle).toHaveBeenCalledTimes(1);
});
