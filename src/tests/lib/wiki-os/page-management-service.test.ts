/** @jest-environment node */
/**
 * Plan 403: a page move writes the canonical form of the new title.
 * Plan 409: a move keeps the revisions attached, leaves a redirect with its own revision, moves the talk
 * page, and every operation logs the actor's name; delete/undelete refuse a page in the wrong state.
 */
import {
  PageManagementService,
  PageOperationError,
  talkTitleOf,
  type PageActor,
} from "~/lib/wiki-os/core/page-management-service";

const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockRevisionCreate = jest.fn();
const mockLinkUpdateMany = jest.fn();
const mockLogCreate = jest.fn();

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
  };
  return { db: { $transaction: (cb: (t: typeof tx) => unknown) => cb(tx) } };
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
      redirectTargetSlug: "talk:new_name",
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
      redirectTargetSlug: "new_name",
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

describe("talkTitleOf", () => {
  it.each([
    ["Old name", "Talk:Old name"],
    ["user:Foo", "User talk:Foo"],
    ["template:Foo/doc", "Template talk:Foo/doc"],
    ["module:Foo", "Module talk:Foo"],
    ["ixwiki:Rules", "IxWiki talk:Rules"],
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
