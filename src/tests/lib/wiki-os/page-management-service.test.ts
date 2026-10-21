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
import { notifyWatchers } from "~/lib/wiki-os/services/watchlist-notify";
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockRevisionCreate = jest.fn();
const mockLinkUpdateMany = jest.fn();
const mockLogCreate = jest.fn();
const mockJobCreate = jest.fn();
const mockRestrictionDeleteMany = jest.fn();
const mockRestrictionUpdateMany = jest.fn();
const mockRestrictionFindUnique = jest.fn();
const mockExecuteRaw = jest.fn();

const mockInvalidateTemplates = jest.fn();
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateTemplateDependents: (...a: unknown[]) => mockInvalidateTemplates(...a),
}));
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
    wikiMirrorJob: { create: (...a: unknown[]) => mockJobCreate(...a) },
    wikiRestriction: {
      deleteMany: (...a: unknown[]) => mockRestrictionDeleteMany(...a),
      updateMany: (...a: unknown[]) => mockRestrictionUpdateMany(...a),
      findUnique: (...a: unknown[]) => mockRestrictionFindUnique(...a),
    },
    // the destination's creation lock (set_config for the wait limit, then pg_advisory_xact_lock)
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
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
  mockLogCreate.mockResolvedValue({ id: "log-1" });
  mockJobCreate.mockResolvedValue({});
  mockRestrictionDeleteMany.mockResolvedValue({ count: 0 });
  mockRestrictionUpdateMany.mockResolvedValue({ count: 0 });
  mockRestrictionFindUnique.mockResolvedValue(null);
  mockExecuteRaw.mockResolvedValue(0);
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
  it("re-renders the pages that use a template or module when one is moved, archived or restored", async () => {
    const template = { id: "t1", title: "Template:Box", namespace: 10, status: "PUBLISHED" };
    pages({ "template:box": template });
    await PageManagementService.movePage("template:box", "Template:Panel", "rename", actor);
    expect(mockInvalidateTemplates).toHaveBeenCalledWith("Template:Box", "ixwiki");
    expect(mockInvalidateTemplates).toHaveBeenCalledWith("Template:Panel", "ixwiki");

    mockInvalidateTemplates.mockClear();
    await PageManagementService.archiveArticle("template:box", "unused", actor);
    expect(mockInvalidateTemplates).toHaveBeenCalledWith("Template:Box", "ixwiki");

    mockInvalidateTemplates.mockClear();
    pages({ "template:box": { ...template, status: "ARCHIVED" } });
    await PageManagementService.restoreArticle("template:box", actor, "ixwiki", "back");
    expect(mockInvalidateTemplates).toHaveBeenCalledWith("Template:Box", "ixwiki");
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
describe("PageManagementService.movePage refuses files (F37)", () => {
  const MESSAGE = "Files cannot be moved in WikiOS yet; move them on classic MediaWiki.";

  it.each([
    ["a File: page", "File:Flag.png", "File:Banner.png"],
    ["a File: page typed as a slug", "file:flag.png", "Banner"],
    ["a page into the File: namespace", "Old name", "File:Banner.png"],
    ["an Image: alias", "Image:Flag.png", "Banner"],
  ])("refuses %s with IMMOBILE, before it reads or writes anything", async (_name, from, to) => {
    const failure = await PageManagementService.movePage(from, to, "x", actor).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(PageOperationError);
    expect(failure).toMatchObject({ code: "IMMOBILE", message: MESSAGE });
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockJobCreate).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it("refuses a page whose stored namespace is File: whatever the move was asked with (the stored page decides too)", async () => {
    pages({ old_name: { ...original, namespace: 6 } });

    await expect(PageManagementService.movePage("old_name", "new_name", "x", actor)).rejects.toMatchObject({
      code: "IMMOBILE",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockJobCreate).not.toHaveBeenCalled();
  });

  it("does not refuse a File talk: page, a Category: page or an ordinary one", async () => {
    pages({ "file_talk:old": { id: "ft", title: "File talk:Old", namespace: 7, status: "PUBLISHED" } });

    await expect(
      PageManagementService.movePage("File talk:Old", "File talk:New", "x", actor, "ixwiki", { moveTalk: false })
    ).resolves.toMatchObject({ success: true });
  });
});

describe("PageManagementService.movePage and the destination's creation lock (m6)", () => {
  it("queues behind a save that is creating the destination, then checks that the destination is free", async () => {
    await PageManagementService.movePage("old_name", "new_name", "tidy", actor);

    const statements = mockExecuteRaw.mock.calls.map(([strings, ...values]) => [
      (strings as TemplateStringsArray).join("?"),
      ...values,
    ]);
    // the wait limit, then the advisory lock keyed by the same source:title a creating save takes (article-repository.ts)
    expect(statements[0]).toEqual(["SELECT set_config('lock_timeout', ?, true)", "10s"]);
    expect(statements[1]).toEqual(["SELECT pg_advisory_xact_lock(?::int, hashtext(?))", 41102, "ixwiki:New name"]);
    // taken before the destination is looked up
    const lockedAt = mockExecuteRaw.mock.invocationCallOrder[1]!;
    const destinationLookup = mockFindFirst.mock.calls.findIndex(([args]) =>
      JSON.stringify(args.where).includes("new_name")
    );
    expect(lockedAt).toBeLessThan(mockFindFirst.mock.invocationCallOrder[destinationLookup]!);
  });

  it("takes the creation lock of the talk page's destination too", async () => {
    pages({ old_name: original, "talk:old_name": talkOriginal });
    mockUpdate.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id }));

    await PageManagementService.movePage("old_name", "new_name", "tidy", actor);

    const keys = mockExecuteRaw.mock.calls
      .filter(([strings]) => (strings as TemplateStringsArray).join("?").includes("pg_advisory_xact_lock"))
      .map(([, , key]) => key);
    expect(keys).toEqual(["ixwiki:New name", "ixwiki:Talk:New name"]);
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
describe("PageManagementService tells the watchers (plan 416, WK-19)", () => {
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

describe("PageManagementService and the mirror outbox (plan 407)", () => {
  const jobs = () => mockJobCreate.mock.calls.map(([args]) => args.data);

  beforeEach(() => {
    mockLogCreate.mockImplementation(async ({ data }: { data: { title: string } }) => ({
      id: `log:${data.title}`,
    }));
  });
  it("records that no redirect was left when the mover asked for none", async () => {
    await PageManagementService.movePage("old_name", "new_name", "tidy", actor, "ixwiki", {
      leaveRedirect: false,
    });

    expect(jobs()[0]?.payload).toMatchObject({ leaveRedirect: false });
  });

  it("writes no job for a deleted page that is moved: MediaWiki has nothing at that title", async () => {
    pages({ old_name: { ...original, status: "ARCHIVED" } });

    await PageManagementService.movePage("old_name", "new_name", "tidy", actor, "ixwiki", {
      includeArchived: true,
    });

    expect(mockJobCreate).not.toHaveBeenCalled();
  });
});
