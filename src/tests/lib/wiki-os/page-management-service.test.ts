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
    wikiRevision: {
      create: (...a: unknown[]) => mockRevisionCreate(...a),
      // a restore points the page at its live head: these pages have no revision rows
      findFirst: async () => null,
    },
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
  it("refuses a destination that already exists", async () => {
    pages({ old_name: original, new_name: { id: "other", title: "New name" } });
    await expect(
      PageManagementService.movePage("old_name", "New name", "x", actor)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mockUpdate).not.toHaveBeenCalled();
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
describe("PageManagementService tells the watchers (plan 416, WK-19)", () => {
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
  beforeEach(() => {
    mockLogCreate.mockImplementation(async ({ data }: { data: { title: string } }) => ({
      id: `log:${data.title}`,
    }));
  });
  it("writes no job for a deleted page that is moved: MediaWiki has nothing at that title", async () => {
    pages({ old_name: { ...original, status: "ARCHIVED" } });

    await PageManagementService.movePage("old_name", "new_name", "tidy", actor, "ixwiki", {
      includeArchived: true,
    });

    expect(mockJobCreate).not.toHaveBeenCalled();
  });

  it("writes no job for a realm that has no MediaWiki to mirror to", async () => {
    mockFindFirst.mockResolvedValue({ id: "a1", title: "Old name", status: "PUBLISHED" });

    await PageManagementService.archiveArticle("Old name", "spam", actor, "iiwiki");
    expect(mockJobCreate).not.toHaveBeenCalled();

    // the same delete on ixwiki, which classic mirrors, writes its job
    await PageManagementService.archiveArticle("Old name", "spam", actor, "ixwiki");
    expect(mockJobCreate).toHaveBeenCalledTimes(1);
  });
});
