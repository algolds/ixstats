/** @jest-environment node */
/**
 * Plan 403: a page move writes the canonical form of the new title. Plan 402: redirectTargetSlug
 * holds a canonical TITLE, so the move writes one and the broken-redirect report compares titles.
 * Plan 409: a move keeps the revisions attached, leaves a redirect with its own revision, moves the talk
 * page, and every operation logs the actor's name; delete/undelete refuse a page in the wrong state.
 */
import {
  PageManagementService,
  PageOperationError,
  talkTitleOf,
  type PageActor,
} from "~/lib/wiki-os/core/page-management-service";
import { enqueueRender } from "~/lib/wiki-os/services/render-service";
import { evictWikiTitleCaches } from "~/lib/wiki-os/services/title-cache-eviction";
import { notifyWatchers } from "~/lib/wiki-os/services/watchlist-notify";

const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockRevisionCreate = jest.fn();
const mockLinkUpdateMany = jest.fn();
const mockLogCreate = jest.fn();
const mockRestrictionDeleteMany = jest.fn();
const mockRestrictionUpdateMany = jest.fn();
const mockRestrictionFindUnique = jest.fn();

jest.mock("~/lib/wiki-os/services/render-service", () => ({ enqueueRender: jest.fn() }));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/wiki-os/services/title-cache-eviction", () => ({
  evictWikiTitleCaches: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/db", () => {
  const tx = {
    wikiArticle: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
      create: (...a: unknown[]) => mockCreate(...a),
    },
    wikiRevision: { create: (...a: unknown[]) => mockRevisionCreate(...a) },
    wikiLink: { updateMany: (...a: unknown[]) => mockLinkUpdateMany(...a) },
    wikiLog: { create: (...a: unknown[]) => mockLogCreate(...a) },
    wikiRestriction: {
      deleteMany: (...a: unknown[]) => mockRestrictionDeleteMany(...a),
      updateMany: (...a: unknown[]) => mockRestrictionUpdateMany(...a),
      findUnique: (...a: unknown[]) => mockRestrictionFindUnique(...a),
    },
  };
  return {
    db: {
      $transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
      wikiArticle: {
        findMany: (...a: unknown[]) => mockFindMany(...a),
      },
      wikiLog: { create: (...a: unknown[]) => mockLogCreate(...a) },
    },
  };
});

const actor: PageActor = { userId: "u1", name: "Tester" };
const original = { id: "orig", title: "Old name", namespace: 0, status: "PUBLISHED" };
const talkOriginal = { id: "talk-orig", title: "Talk:Old name", namespace: 1, status: "PUBLISHED" };

/** `findFirst` answers per query: the `where.OR` of a lookup tells which page it asks for. */
function pages(known: Record<string, unknown>) {
  mockFindFirst.mockImplementation(
    async ({ where }: { where: { OR: Array<{ slug?: string; title?: string }> } }) => {
      for (const clause of where.OR) {
        const hit = known[clause.slug ?? clause.title ?? ""];
        if (hit) return hit;
      }
      return null;
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  pages({ old_name: original });
  mockUpdate.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id }));
  mockCreate.mockResolvedValue({ id: "redirect" });
  mockRevisionCreate.mockResolvedValue({});
  mockLinkUpdateMany.mockResolvedValue({ count: 2 });
  mockLogCreate.mockResolvedValue({});
  mockRestrictionDeleteMany.mockResolvedValue({ count: 0 });
  mockRestrictionUpdateMany.mockResolvedValue({ count: 0 });
  mockRestrictionFindUnique.mockResolvedValue(null);
});

describe("PageManagementService.movePage", () => {
  it("moves to the canonical title, slug and namespace, whatever spelling was typed", async () => {
    const result = await PageManagementService.movePage("old_name", "talk:new_name", "tidy", actor);

    expect(result).toMatchObject({ success: true, newSlug: "talk:new_name", linksUpdated: 2 });
    expect(mockUpdate.mock.calls[0]?.[0].data).toMatchObject({
      title: "Talk:New name",
      slug: "talk:new_name",
      namespace: 1,
      namespacePrefix: "Talk",
    });
    expect(mockFindFirst.mock.calls[1]?.[0].where.OR).toEqual([
      { slug: "talk:new_name" },
      { title: "Talk:New name" },
    ]);
    expect(mockCreate.mock.calls[0]?.[0].data).toMatchObject({
      wikitext: "#REDIRECT [[Talk:New name]]",
      redirectTargetSlug: "Talk:New name",
      summary: null,
    });
    expect(mockLogCreate.mock.calls[0]?.[0].data).toMatchObject({ title: "Talk:New name" });
  });

  it("refuses a destination MediaWiki would refuse, before touching the database", async () => {
    await expect(PageManagementService.movePage("Old name", "a[b", "x", actor)).rejects.toThrow(
      "Invalid title"
    );
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("still refuses a move onto the same page", async () => {
    await expect(
      PageManagementService.movePage("Old name", "old_name", "x", actor)
    ).rejects.toThrow("identical");
  });

  it("keeps the page's own row, so its revisions stay attached", async () => {
    const result = await PageManagementService.movePage("old_name", "New name", "tidy", actor);

    expect(result.movedArticleId).toBe("orig");
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "orig" } }));
    // Nothing deletes or re-parents revisions: the only revision written belongs to the redirect.
    expect(mockRevisionCreate).toHaveBeenCalledTimes(1);
    expect(mockRevisionCreate.mock.calls[0]?.[0].data.articleId).toBe("redirect");
  });

  it("leaves a redirect page at the old title with its own #REDIRECT revision", async () => {
    const result = await PageManagementService.movePage("old_name", "New name", "tidy", actor);

    expect(result.redirectArticleId).toBe("redirect");
    expect(mockCreate.mock.calls[0]?.[0].data).toMatchObject({
      title: "Old name",
      slug: "old_name",
      wikitext: "#REDIRECT [[New name]]",
      redirectTargetSlug: "New name",
      summary: null,
      authorId: "u1",
    });
    expect(mockRevisionCreate.mock.calls[0]?.[0].data).toMatchObject({
      articleId: "redirect",
      wikitext: "#REDIRECT [[New name]]",
      author: "Tester",
      authorId: "u1",
    });
  });

  it("leaves no redirect when asked not to", async () => {
    const result = await PageManagementService.movePage(
      "old_name",
      "New name",
      "tidy",
      actor,
      "ixwiki",
      {
        leaveRedirect: false,
      }
    );

    expect(result.redirectArticleId).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRevisionCreate).not.toHaveBeenCalled();
  });

  it("refuses a destination that already exists", async () => {
    pages({ old_name: original, new_name: { id: "other", title: "New name" } });
    await expect(
      PageManagementService.movePage("old_name", "New name", "x", actor)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("reports a missing page as NOT_FOUND", async () => {
    pages({});
    await expect(
      PageManagementService.movePage("old_name", "New name", "x", actor)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("logs the move under the actor's name and user", async () => {
    await PageManagementService.movePage("old_name", "New name", "tidy", actor);

    expect(mockLogCreate.mock.calls[0]?.[0].data).toMatchObject({
      logType: "move",
      action: "move",
      actorName: "Tester",
      userId: "u1",
      comment: "tidy",
      title: "New name",
    });
  });

  it("moves the talk page along when it exists and the destination talk page is free", async () => {
    pages({ old_name: original, "talk:old_name": talkOriginal });

    const result = await PageManagementService.movePage("old_name", "New name", "tidy", actor);

    expect(result.talk).toMatchObject({ oldSlug: "talk:old_name", newSlug: "talk:new_name" });
    expect(mockUpdate.mock.calls.map((call) => call[0].where.id)).toEqual(["orig", "talk-orig"]);
    expect(mockUpdate.mock.calls[1]?.[0].data).toMatchObject({
      title: "Talk:New name",
      namespace: 1,
    });
    expect(mockCreate.mock.calls[1]?.[0].data).toMatchObject({
      title: "Talk:Old name",
      wikitext: "#REDIRECT [[Talk:New name]]",
    });
    expect(mockLogCreate).toHaveBeenCalledTimes(2);
  });

  it("does not move the talk page when it is missing, when the destination talk page exists, or when declined", async () => {
    expect(
      (await PageManagementService.movePage("old_name", "New name", "x", actor)).talk
    ).toBeNull();

    pages({
      old_name: original,
      "talk:old_name": talkOriginal,
      "talk:new_name": { id: "t2", title: "Talk:New name" },
    });
    expect(
      (await PageManagementService.movePage("old_name", "New name", "x", actor)).talk
    ).toBeNull();

    pages({ old_name: original, "talk:old_name": talkOriginal });
    mockUpdate.mockClear();
    const declined = await PageManagementService.movePage(
      "old_name",
      "New name",
      "x",
      actor,
      "ixwiki",
      {
        moveTalk: false,
      }
    );
    expect(declined.talk).toBeNull();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("never moves a talk page's talk page", async () => {
    pages({ "talk:old_name": talkOriginal });
    const result = await PageManagementService.movePage(
      "Talk:Old name",
      "Talk:New name",
      "x",
      actor
    );
    expect(result.talk).toBeNull();
  });
});

describe("PageManagementService.movePage: deleted pages and protections (plan 409 review)", () => {
  const archived = { ...original, status: "ARCHIVED" };

  it("a deleted page does not exist for a mover who may not see deleted pages", async () => {
    pages({ old_name: archived });
    await expect(
      PageManagementService.movePage("old_name", "New name", "x", actor)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockRestrictionUpdateMany).not.toHaveBeenCalled();
  });

  it("moves a deleted page for a caller allowed to, and leaves no redirect for it", async () => {
    pages({ old_name: archived });
    const result = await PageManagementService.movePage(
      "old_name",
      "New name",
      "x",
      actor,
      "ixwiki",
      {
        includeArchived: true,
      }
    );
    expect(result.redirectArticleId).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockLogCreate.mock.calls[0]?.[0].data.params).toMatchObject({ redirectCreated: false });
  });

  it("does not bring a deleted talk page along unless it may", async () => {
    pages({ old_name: original, "talk:old_name": { ...talkOriginal, status: "ARCHIVED" } });
    expect(
      (await PageManagementService.movePage("old_name", "New name", "x", actor)).talk
    ).toBeNull();

    pages({ old_name: original, "talk:old_name": { ...talkOriginal, status: "ARCHIVED" } });
    const result = await PageManagementService.movePage(
      "old_name",
      "New name",
      "x",
      actor,
      "ixwiki",
      {
        includeArchived: true,
      }
    );
    expect(result.talk).not.toBeNull();
  });

  it("moves the edit, move and upload protections with the page, replacing stale ones at the destination", async () => {
    mockRestrictionFindUnique.mockResolvedValue({ level: "sysop", expiresAt: null });

    await PageManagementService.movePage("old_name", "New name", "x", actor, "ixwiki", {
      moveTalk: false,
    });

    const action = { in: ["edit", "move", "upload"] };
    expect(mockRestrictionDeleteMany).toHaveBeenCalledWith({
      where: { source: "ixwiki", title: "New name", action },
    });
    expect(mockRestrictionUpdateMany).toHaveBeenCalledWith({
      where: { source: "ixwiki", title: "Old name", action },
      data: { title: "New name" },
    });
    // create-protection stays with the title: it is never in the moved set
    expect(JSON.stringify(mockRestrictionUpdateMany.mock.calls)).not.toContain("create");
  });

  it("keeps the article's mirrored protection level in step with the moved edit protection", async () => {
    const expires = new Date("2027-01-01T00:00:00Z");
    mockRestrictionFindUnique.mockResolvedValue({ level: "autoconfirmed", expiresAt: expires });
    await PageManagementService.movePage("old_name", "New name", "x", actor, "ixwiki", {
      moveTalk: false,
    });
    expect(mockUpdate.mock.calls[0]?.[0].data).toMatchObject({
      protectionLevel: "AUTOCONFIRMED",
      protectionExpiry: expires,
    });

    mockUpdate.mockClear();
    mockRestrictionFindUnique.mockResolvedValue({ level: "sysop", expiresAt: null });
    await PageManagementService.movePage("old_name", "Newer name", "x", actor, "ixwiki", {
      moveTalk: false,
    });
    expect(mockUpdate.mock.calls[0]?.[0].data).toMatchObject({ protectionLevel: "SYSOP" });

    mockUpdate.mockClear();
    mockRestrictionFindUnique.mockResolvedValue(null);
    await PageManagementService.movePage("old_name", "Newest name", "x", actor, "ixwiki", {
      moveTalk: false,
    });
    expect(mockUpdate.mock.calls[0]?.[0].data).toMatchObject({
      protectionLevel: "ALL",
      protectionExpiry: null,
    });
  });

  it("migrates the protections of the talk page too", async () => {
    pages({ old_name: original, "talk:old_name": talkOriginal });
    await PageManagementService.movePage("old_name", "New name", "x", actor);
    expect(mockRestrictionUpdateMany.mock.calls.map((c) => c[0].where.title)).toEqual([
      "Old name",
      "Talk:Old name",
    ]);
  });
});

describe("talkTitleOf", () => {
  it.each([
    ["Old name", "Talk:Old name"],
    ["user:Foo", "User talk:Foo"],
    ["template:Foo/doc", "Template talk:Foo/doc"],
    ["module:Foo", "Module talk:Foo"],
    ["ixwiki:Rules", "IxWiki talk:Rules"],
    ["campaign:Operation Dawn", "Campaign talk:Operation Dawn"],
  ])("%s has the talk page %s", (title, talk) => {
    expect(talkTitleOf(title)).toBe(talk);
  });

  it.each(["Talk:Foo", "User talk:Foo", "Special:Version", "a[b", "Topic:Foo"])(
    "%s has none",
    (title) => {
      expect(talkTitleOf(title)).toBeNull();
    }
  );

  it("has none for another wiki's pages", () => {
    expect(talkTitleOf("Foo", "iiwiki")).toBeNull();
  });
});

describe("PageManagementService.archiveArticle / restoreArticle", () => {
  it("archives a published page and logs the delete under the actor's name", async () => {
    pages({ old_name: original });
    const result = await PageManagementService.archiveArticle("Old name", "spam", actor);

    expect(result).toEqual({ success: true, articleId: "orig" });
    expect(mockUpdate.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "orig" },
      data: { status: "ARCHIVED", lastEditorId: "u1" },
    });
    expect(mockLogCreate.mock.calls[0]?.[0].data).toMatchObject({
      logType: "delete",
      action: "delete",
      actorName: "Tester",
      userId: "u1",
      comment: "spam",
    });
  });

  it("refuses to archive a missing or already archived page", async () => {
    pages({});
    await expect(
      PageManagementService.archiveArticle("Old name", "x", actor)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    pages({ old_name: { ...original, status: "ARCHIVED" } });
    await expect(
      PageManagementService.archiveArticle("Old name", "x", actor)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("restores an archived page with the reason and logs it", async () => {
    pages({ old_name: { ...original, status: "ARCHIVED" } });
    const result = await PageManagementService.restoreArticle(
      "Old name",
      actor,
      "ixwiki",
      "mistake"
    );

    expect(result).toEqual({ success: true, articleId: "orig" });
    expect(mockUpdate.mock.calls[0]?.[0].data).toMatchObject({ status: "PUBLISHED" });
    expect(mockLogCreate.mock.calls[0]?.[0].data).toMatchObject({
      logType: "delete",
      action: "restore",
      actorName: "Tester",
      comment: "mistake",
    });
  });

  it("refuses to restore a page that is not archived, or missing", async () => {
    await expect(PageManagementService.restoreArticle("Old name", actor)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    pages({});
    await expect(PageManagementService.restoreArticle("Old name", actor)).rejects.toBeInstanceOf(
      PageOperationError
    );
  });
});

/** Columns a page-management call must never read: the bundle, the raw HTML and the page text. */
const HEAVY = ["renderedView", "contentHtml", "htmlContent", "contentJson", "wikitext"];

function expectLeanSelect(call: unknown[] | undefined) {
  const select = (call?.[0] as { select?: Record<string, boolean> } | undefined)?.select;
  expect(select).toBeDefined();
  for (const column of HEAVY) expect(select).not.toHaveProperty(column);
}

describe("PageManagementService.movePage and the rendered view (plan 404)", () => {
  it("marks the moved page stale under its new name and queues its render after the commit", async () => {
    await PageManagementService.movePage("old_name", "new_name", "tidy", actor);

    expect(mockUpdate.mock.calls[0]?.[0].data).toMatchObject({
      title: "New name",
      htmlSyncedAt: null,
    });
    expect(mockUpdate.mock.calls[0]?.[0].data).not.toHaveProperty("contentHtml");
    expect(enqueueRender).toHaveBeenCalledTimes(1);
    expect(enqueueRender).toHaveBeenCalledWith("orig");
  });

  it("queues the moved talk page's render too", async () => {
    pages({ old_name: original, "talk:old_name": talkOriginal });
    mockUpdate.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
    }));

    await PageManagementService.movePage("old_name", "new_name", "tidy", actor);

    expect(
      jest
        .mocked(enqueueRender)
        .mock.calls.map((call) => call[0])
        .sort()
    ).toEqual(["orig", "talk-orig"]);
  });

  it("queues nothing for a move that failed", async () => {
    mockFindFirst.mockReset().mockResolvedValue(null);

    await expect(
      PageManagementService.movePage("old_name", "new_name", "x", actor)
    ).rejects.toThrow("not found");
    expect(enqueueRender).not.toHaveBeenCalled();
  });
});

describe("PageManagementService reads only the columns it uses (plan 404)", () => {
  it("movePage selects an explicit, lean column list on every wikiArticle call", async () => {
    await PageManagementService.movePage("old_name", "new_name", "tidy", actor);

    // The page and its destination, then the talk page and its destination.
    expect(mockFindFirst).toHaveBeenCalledTimes(4);
    for (const call of [...mockFindFirst.mock.calls, ...mockUpdate.mock.calls]) {
      expectLeanSelect(call);
    }
    expect(mockFindFirst.mock.calls[0]?.[0].select).toEqual({
      id: true,
      title: true,
      namespace: true,
      status: true,
    });
    // The stub's own data carries the banner HTML (a write); its answer stays small.
    expect(mockCreate.mock.calls[0]?.[0].select).toEqual({ id: true });
    expect(mockLogCreate.mock.calls[0]?.[0].data.params).toMatchObject({ oldTitle: "Old name" });
  });

  it("archiveArticle reads the id, title and status, writes the status, and logs the previous one", async () => {
    mockFindFirst.mockResolvedValue({ id: "a1", title: "Old name", status: "PUBLISHED" });
    mockUpdate.mockResolvedValue({ id: "a1" });

    await expect(PageManagementService.archiveArticle("Old name", "spam", actor)).resolves.toEqual({
      success: true,
      articleId: "a1",
    });

    expectLeanSelect(mockFindFirst.mock.calls[0]);
    expectLeanSelect(mockUpdate.mock.calls[0]);
    expect(mockUpdate.mock.calls[0]?.[0].data).toMatchObject({ status: "ARCHIVED" });
    expect(mockLogCreate.mock.calls[0]?.[0].data).toMatchObject({
      title: "Old name",
      params: { reason: "spam", previousStatus: "PUBLISHED" },
    });
  });

  it("restoreArticle reads the id and title and publishes the page again", async () => {
    mockFindFirst.mockResolvedValue({ id: "a1", title: "Old name", status: "ARCHIVED" });
    mockUpdate.mockResolvedValue({ id: "a1" });

    await expect(PageManagementService.restoreArticle("Old name", actor)).resolves.toEqual({
      success: true,
      articleId: "a1",
    });

    expectLeanSelect(mockFindFirst.mock.calls[0]);
    expectLeanSelect(mockUpdate.mock.calls[0]);
    expect(mockUpdate.mock.calls[0]?.[0].data).toMatchObject({ status: "PUBLISHED" });
    expect(mockLogCreate.mock.calls[0]?.[0].data).toMatchObject({ title: "Old name" });
  });
});

describe("PageManagementService.getBrokenRedirects", () => {
  const redirectRow = (id: string, title: string, redirectTargetSlug: string) => ({
    id,
    title,
    slug: title.toLowerCase().replace(/ /g, "_"),
    redirectTargetSlug,
  });

  it("compares the stored target title with published article titles, not slugs", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        redirectRow("r1", "Old name", "Foo bar"),
        redirectRow("r2", "Gone", "Missing page"),
      ])
      .mockResolvedValueOnce([{ title: "Foo bar" }]);

    const broken = await PageManagementService.getBrokenRedirects(10);

    expect(broken).toEqual([{ id: "r2", title: "Gone", slug: "gone", targetSlug: "Missing page" }]);
    expect(mockFindMany.mock.calls[1]?.[0]).toEqual({
      where: {
        source: "ixwiki",
        title: { in: ["Foo bar", "Missing page"] },
        status: "PUBLISHED",
      },
      select: { title: true },
    });
  });

  it("canonicalizes a stored target before comparing", async () => {
    mockFindMany
      .mockResolvedValueOnce([redirectRow("r1", "Old name", "talk:new_name")])
      .mockResolvedValueOnce([{ title: "Talk:New name" }]);

    await expect(PageManagementService.getBrokenRedirects(10)).resolves.toEqual([]);
    expect(mockFindMany.mock.calls[1]?.[0].where.title).toEqual({ in: ["Talk:New name"] });
  });

  it("scopes both queries to the realm and honours the limit", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        redirectRow("r1", "A", "X1"),
        redirectRow("r2", "B", "X2"),
        redirectRow("r3", "C", "X3"),
      ])
      .mockResolvedValueOnce([]);

    const broken = await PageManagementService.getBrokenRedirects(2, "iiwiki");

    expect(broken.map((b) => b.id)).toEqual(["r1", "r2"]);
    expect(mockFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { source: "iiwiki", redirectTargetSlug: { not: null } },
      take: 4,
    });
    expect(mockFindMany.mock.calls[1]?.[0].where.source).toBe("iiwiki");
  });

  it("reports nothing when there are no redirects", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await expect(PageManagementService.getBrokenRedirects(10)).resolves.toEqual([]);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });
});

describe("PageManagementService forgets what the caches hold about a page it changed", () => {
  it("evicts a deleted page by title and id, after the delete committed", async () => {
    mockFindFirst.mockResolvedValue({ id: "a1", title: "Old name", status: "PUBLISHED" });
    mockUpdate.mockResolvedValue({ id: "a1" });
    mockLogCreate.mockImplementation(async () => {
      expect(evictWikiTitleCaches).not.toHaveBeenCalled(); // still inside the transaction
    });

    await PageManagementService.archiveArticle("Old name", "spam", actor);

    expect(evictWikiTitleCaches).toHaveBeenCalledTimes(1);
    expect(evictWikiTitleCaches).toHaveBeenCalledWith("Old name", "ixwiki", "a1");
  });

  it("evicts a restored page, whose negative cache entries would still say it is missing", async () => {
    mockFindFirst.mockResolvedValue({ id: "a1", title: "Old name", status: "ARCHIVED" });
    mockUpdate.mockResolvedValue({ id: "a1" });

    await PageManagementService.restoreArticle("Old name", actor);

    expect(evictWikiTitleCaches).toHaveBeenCalledWith("Old name", "ixwiki", "a1");
  });

  it("evicts neither when the operation was refused", async () => {
    mockFindFirst.mockResolvedValue({ id: "a1", title: "Old name", status: "ARCHIVED" });
    await expect(PageManagementService.archiveArticle("Old name", "x", actor)).rejects.toThrow();
    mockFindFirst.mockResolvedValue({ id: "a1", title: "Old name", status: "PUBLISHED" });
    await expect(PageManagementService.restoreArticle("Old name", actor)).rejects.toThrow();

    expect(evictWikiTitleCaches).not.toHaveBeenCalled();
  });

  it("evicts both names of a moved page and of its talk page", async () => {
    pages({ old_name: original, "talk:old_name": talkOriginal });

    await PageManagementService.movePage("old_name", "new_name", "tidy", actor);

    const evicted = jest
      .mocked(evictWikiTitleCaches)
      .mock.calls.map(([title, , id]) => `${title}@${id}`);
    expect(evicted.sort()).toEqual(
      [
        "Old name@orig",
        "New name@orig",
        "Talk:Old name@talk-orig",
        "Talk:New name@talk-orig",
      ].sort()
    );
  });

  it("evicts nothing for a move that failed", async () => {
    mockFindFirst.mockReset().mockResolvedValue(null);
    await expect(
      PageManagementService.movePage("old_name", "new_name", "x", actor)
    ).rejects.toThrow();
    expect(evictWikiTitleCaches).not.toHaveBeenCalled();
  });
});

describe("PageManagementService tells the watchers (plan 416, WK-19)", () => {
  it("notifies the watchers of a moved page, under its new title, leaving the mover out", async () => {
    await PageManagementService.movePage("old_name", "new_name", "tidy", actor);

    expect(notifyWatchers).toHaveBeenCalledTimes(1);
    expect(notifyWatchers).toHaveBeenCalledWith({
      kind: "moved",
      articleId: "orig",
      title: "New name",
      fromTitle: "Old name",
      editor: "Tester",
      editorUserId: "u1",
      summary: "tidy",
    });
  });

  it("notifies the watchers of the talk page that moved with it", async () => {
    pages({ old_name: original, "talk:old_name": talkOriginal });

    await PageManagementService.movePage("old_name", "new_name", "tidy", actor);

    expect(jest.mocked(notifyWatchers).mock.calls.map(([change]) => change.articleId).sort()).toEqual([
      "orig",
      "talk-orig",
    ]);
  });

  it("notifies the watchers of a deleted page, leaving the deleter out", async () => {
    await PageManagementService.archiveArticle("Old name", "spam", actor);

    expect(notifyWatchers).toHaveBeenCalledWith({
      kind: "deleted",
      articleId: "orig",
      title: "Old name",
      editor: "Tester",
      editorUserId: "u1",
      summary: "spam",
    });
  });

  it("notifies nobody when the move or the delete was refused", async () => {
    mockFindFirst.mockReset().mockResolvedValue(null);

    await expect(PageManagementService.movePage("old_name", "new_name", "x", actor)).rejects.toThrow();
    await expect(PageManagementService.archiveArticle("Old name", "x", actor)).rejects.toThrow();

    expect(notifyWatchers).not.toHaveBeenCalled();
  });

  it("notifies the watchers of a restored page, leaving the restorer out", async () => {
    pages({ old_name: { ...original, status: "ARCHIVED" } });

    await PageManagementService.restoreArticle("Old name", actor, "ixwiki", "Wrongly deleted");

    expect(notifyWatchers).toHaveBeenCalledTimes(1);
    expect(notifyWatchers).toHaveBeenCalledWith({
      kind: "restored",
      articleId: "orig",
      title: "Old name",
      editor: "Tester",
      editorUserId: "u1",
      summary: "Wrongly deleted",
    });
  });

  it("notifies nobody when the restore was refused", async () => {
    mockFindFirst.mockReset().mockResolvedValue(null);

    await expect(PageManagementService.restoreArticle("Old name", actor)).rejects.toThrow();

    expect(notifyWatchers).not.toHaveBeenCalled();
  });

  it.each([
    ["move", () => PageManagementService.movePage("old_name", "new_name", "tidy", actor)],
    ["delete", () => PageManagementService.archiveArticle("Old name", "spam", actor)],
    [
      "restore",
      () => {
        pages({ old_name: { ...original, status: "ARCHIVED" } });
        return PageManagementService.restoreArticle("Old name", actor);
      },
    ],
  ])("a %s does not wait for the watchers to be told", async (_operation, run) => {
    jest.mocked(notifyWatchers).mockReturnValueOnce(new Promise<number>(() => undefined));

    await expect(run()).resolves.toMatchObject({ success: true });

    expect(notifyWatchers).toHaveBeenCalledTimes(1);
  });

  it("a watcher notification that fails costs the operation nothing", async () => {
    jest.mocked(notifyWatchers).mockRejectedValueOnce(new Error("notifications down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      PageManagementService.archiveArticle("Old name", "spam", actor)
    ).resolves.toMatchObject({ success: true });
    await new Promise((resolve) => setImmediate(resolve));

    expect(warn).toHaveBeenCalledWith(
      "[PageManagement] Could not notify watchers:",
      expect.any(Error)
    );
    warn.mockRestore();
  });
});
