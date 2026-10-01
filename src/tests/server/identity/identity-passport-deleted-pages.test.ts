/**
 * Plan 409: a deleted (archived) WikiOS page is not part of anyone's public work. The passport's work
 * tab and history stream (`getWork`, `getHistory`) read PUBLISHED pages only: the pages a user wrote,
 * the revisions they made, and the discussion comments on a page's threads.
 */
const mockPageOf = (status: string) => ({ status });
const mockRevisionRows = [
  {
    id: "r1",
    summary: "s",
    minor: false,
    authorId: "db_1",
    article: { title: "Hidden land", slug: "hidden_land", ...mockPageOf("ARCHIVED") },
  },
  {
    id: "r2",
    summary: "s",
    minor: false,
    authorId: "db_1",
    article: { title: "Shown land", slug: "shown_land", ...mockPageOf("PUBLISHED") },
  },
].map((row) => ({ ...row, createdAt: new Date("2026-09-01T00:00:00Z") }));
const mockCommentRows = [
  {
    id: "c1",
    content: "About the hidden one",
    thread: { title: "Borders", articleTitle: "Hidden_land" },
  },
  {
    id: "c2",
    content: "About the shown one",
    thread: { title: "Borders", articleTitle: "Shown_land" },
  },
].map((row) => ({ ...row, createdAt: new Date("2026-09-02T00:00:00Z") }));

jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db.wikiArticle,
    // Prisma's relation filter, for the one shape the loader uses: `where.article.status`.
    wikiRevision: {
      findMany: async ({ where }: { where: { article?: { status?: string } } }) =>
        mockRevisionRows.filter(
          (row) => !where.article?.status || row.article.status === where.article.status
        ),
    },
    wikiDiscussionComment: { findMany: async () => mockCommentRows },
    passportPreference: { findUnique: jest.fn().mockResolvedValue(null) },
    languagePack: { findMany: jest.fn().mockResolvedValue([]) },
  },
  isDatabaseReadOnly: true,
}));

jest.mock("~/server/modules/identity/identity.resolve", () => ({
  resolveIdentity: jest.fn(),
  resolveIdentityNations: jest.fn().mockResolvedValue([]),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { getHistory, getWork } from "~/server/modules/identity/identity.service";
import { resolveIdentity } from "~/server/modules/identity/identity.resolve";

const user = {
  id: "db_1",
  clerkUserId: "clerk_1",
  wikiUsername: null,
  createdAt: new Date("2024-01-01"),
  countryId: null,
};
const query = { handle: "amy", viewerClerkId: null };

beforeEach(() => {
  fakeWikiDb.reset();
  (resolveIdentity as jest.Mock).mockResolvedValue({
    handle: "amy",
    strippedHandle: "amy",
    user,
    country: null,
    wikiName: null,
    forumUserId: null,
    forumUsername: null,
    isOwner: false,
  });
  const when = new Date("2026-09-01T00:00:00Z");
  fakeWikiDb.tables.wikiArticle.seed(
    {
      source: "ixwiki",
      title: "Hidden land",
      slug: "hidden_land",
      status: "ARCHIVED",
      authorId: "db_1",
      lastEditorId: "db_1",
      summary: "gone",
      createdAt: when,
      updatedAt: when,
    },
    {
      source: "ixwiki",
      title: "Shown land",
      slug: "shown_land",
      status: "PUBLISHED",
      authorId: "db_1",
      lastEditorId: "db_1",
      summary: "here",
      createdAt: when,
      updatedAt: when,
    }
  );
});

describe("the passport never shows a deleted page", () => {
  it("getWork lists the published page the user wrote, and not the deleted one", async () => {
    const work = await getWork(query);
    const json = JSON.stringify(work);

    expect(work.authoredArticles.map((article) => article.title)).toEqual(["Shown land"]);
    expect(json).toContain("Shown land");
    expect(json).not.toMatch(/Hidden[ _]land|hidden_land|gone/i);
  });

  it("getHistory has the edits and comments on the published page only", async () => {
    const page = await getHistory({ ...query, limit: 50 });
    const json = JSON.stringify(page);

    expect(json).toContain("Shown land");
    expect(json).toContain("About the shown one");
    expect(json).not.toMatch(/Hidden[ _]land|hidden_land|About the hidden one/i);
  });
});
