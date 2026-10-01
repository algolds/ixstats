/** @jest-environment node */
/**
 * Plan 416 item 3 (WK-19): a head change notifies the page's watchers, once each until they visit
 * (MediaWiki's semantics, kept in `WikiWatchlist.notificationTime`), and never the person who made
 * the change.
 */
type Watch = {
  id: string;
  userId: string;
  /** The Clerk id of the watcher's account: the id notifications are written under. */
  clerkUserId: string | null;
  articleId: string;
  notificationTime: Date | null;
  lastViewedTime: Date;
};

const watches: Watch[] = [];
const links: Array<{ userId: string; username: string; verifiedAt: Date | null }> = [];
const articles: Array<{ id: string; title: string }> = [];

type WatchWhere = {
  id?: string | { in?: string[]; gt?: string };
  userId?: string | { notIn: string[] };
  articleId?: string;
  notificationTime?: Date | null;
};

function matchesWatch(watch: Watch, where: WatchWhere): boolean {
  const { id } = where;
  if (typeof id === "string" && watch.id !== id) return false;
  if (typeof id === "object" && id.in && !id.in.includes(watch.id)) return false;
  if (typeof id === "object" && id.gt !== undefined && !(watch.id > id.gt)) return false;
  if (where.articleId !== undefined && watch.articleId !== where.articleId) return false;
  if (where.notificationTime === null && watch.notificationTime !== null) return false;
  if (where.notificationTime instanceof Date) {
    if (watch.notificationTime?.getTime() !== where.notificationTime.getTime()) return false;
  }
  if (typeof where.userId === "string" && watch.userId !== where.userId) return false;
  if (typeof where.userId === "object" && where.userId.notIn.includes(watch.userId)) return false;
  return true;
}

const mockCreateMany = jest.fn();
const mockEventEnabled = jest.fn();

jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiWatchlist: {
      findMany: jest.fn(
        async ({
          where,
          take,
          select,
        }: {
          where: WatchWhere;
          take?: number;
          select: { user?: unknown };
        }) =>
          watches
            .filter((w) => matchesWatch(w, where))
            .sort((a, b) => (a.id < b.id ? -1 : 1))
            .slice(0, take)
            .map((w) =>
              select.user ? { id: w.id, user: { clerkUserId: w.clerkUserId } } : { id: w.id }
            )
      ),
      updateMany: jest.fn(async ({ where, data }: { where: WatchWhere; data: Partial<Watch> }) => {
        const found = watches.filter((w) => matchesWatch(w, where));
        for (const watch of found) Object.assign(watch, data);
        return { count: found.length };
      }),
    },
    wikiAccountLink: {
      findFirst: jest.fn(
        async ({ where }: { where: { username: string } }) =>
          links.find((l) => l.username === where.username && l.verifiedAt) ?? null
      ),
    },
    wikiArticle: {
      findFirst: jest.fn(
        async ({ where }: { where: { OR: Array<{ title: string }> } }) =>
          articles.find((a) => where.OR.some((clause) => clause.title === a.title)) ?? null
      ),
    },
  },
}));
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { createMany: (...args: unknown[]) => mockCreateMany(...args) },
}));
jest.mock("~/lib/notifications/guard", () => ({
  __esModule: true,
  isNotificationEventEnabled: (...args: unknown[]) => mockEventEnabled(...args),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { notifyWatchers, markWatchedVisited } from "~/lib/wiki-os/services/watchlist-notify";
import { db } from "~/server/db";

const watch = (
  userId: string,
  articleId = "art1",
  notificationTime: Date | null = null,
  clerkUserId: string | null = `clerk_${userId}`
): Watch => ({
  id: `w_${userId}_${articleId}`,
  userId,
  clerkUserId,
  articleId,
  notificationTime,
  lastViewedTime: new Date("2026-09-01T00:00:00Z"),
});

const edit = (overrides: Partial<Parameters<typeof notifyWatchers>[0]> = {}) =>
  notifyWatchers({
    kind: "edited",
    articleId: "art1",
    title: "Caphiria",
    editor: "Kir",
    editorUserId: "u_editor",
    summary: "Fixed the borders",
    previousRef: "r_old",
    currentRef: "r_new",
    ...overrides,
  });

type Sent = {
  userId: string;
  title: string;
  message: string;
  href: string;
  category: string;
  priority: string;
  source: string;
  metadata: object;
};
/** Every notification written so far, across all `createMany` calls. */
const sent = (): Sent[] => mockCreateMany.mock.calls.flatMap(([batch]) => batch as Sent[]);

beforeEach(() => {
  jest.clearAllMocks();
  watches.length = 0;
  links.length = 0;
  articles.length = 0;
  mockCreateMany.mockResolvedValue([]);
  mockEventEnabled.mockResolvedValue(true);
});

describe("notifyWatchers", () => {
  it("notifies each watcher of the page, leaving out the editor and other pages' watchers", async () => {
    watches.push(watch("u_a"), watch("u_b"), watch("u_editor"), watch("u_c", "other_article"));

    const notified = await edit();

    expect(notified).toBe(2);
    expect(
      sent()
        .map((n) => n.userId)
        .sort()
    ).toEqual(["clerk_u_a", "clerk_u_b"]);
  });

  it("writes each notification under the watcher's Clerk id, the id the notification list reads", async () => {
    // WikiWatchlist.userId is the internal user id; notifications are listed by Clerk id.
    watches.push(watch("db_user_1", "art1", null, "user_2abcClerk"));

    await edit();

    const [notification] = sent();
    expect(notification!.userId).toBe("user_2abcClerk");
    expect(notification!.userId).not.toBe("db_user_1");
  });

  it("skips a watcher whose account has no Clerk id, and never claims their row", async () => {
    watches.push(watch("u_a"), watch("u_nobody", "art1", null, null));

    expect(await edit()).toBe(1);

    expect(sent().map((n) => n.userId)).toEqual(["clerk_u_a"]);
    expect(watches.find((w) => w.userId === "u_nobody")!.notificationTime).toBeNull();
  });

  it("writes the notification the watchlist page and the bell show", async () => {
    watches.push(watch("u_a"));

    await edit();

    expect(sent()).toEqual([
      {
        userId: "clerk_u_a",
        title: "Caphiria was edited",
        message: "Kir: Fixed the borders",
        href: "/util/diff?oldid=r_old&diff=r_new",
        category: "wiki",
        priority: "low",
        source: "wikiWatchlist",
        metadata: { articleId: "art1", kind: "edited" },
      },
    ]);
  });

  it("falls back to the page when there is no earlier revision to diff against", async () => {
    watches.push(watch("u_a"));

    await edit({ previousRef: null, summary: "" });

    expect(sent()[0]).toMatchObject({ href: "/wiki/Caphiria", message: "Kir edited this page" });
  });

  it("claims all of a chunk's rows with one updateMany and writes its notifications with one createMany", async () => {
    watches.push(watch("u_a"), watch("u_b"), watch("u_c"));

    await edit();

    expect(db.wikiWatchlist.updateMany).toHaveBeenCalledTimes(1);
    expect(mockCreateMany).toHaveBeenCalledTimes(1);
    expect(sent()).toHaveLength(3);
  });

  it("notifies once per watcher until they visit the page", async () => {
    watches.push(watch("u_a"), watch("u_b"));

    expect(await edit()).toBe(2);
    expect(await edit({ summary: "Another change" })).toBe(0);
    expect(sent()).toHaveLength(2);

    // u_a visits the page; u_b does not.
    articles.push({ id: "art1", title: "Caphiria" });
    await markWatchedVisited("u_a", "Caphiria");

    expect(await edit({ summary: "A third change" })).toBe(1);
    expect(sent()).toHaveLength(3);
    expect(sent()[2]).toMatchObject({ userId: "clerk_u_a", message: "Kir: A third change" });
  });

  it("notifies once when two changes race", async () => {
    watches.push(watch("u_a"), watch("u_b"), watch("u_c"));

    const counts = await Promise.all([edit(), edit({ summary: "Same moment" })]);

    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
    expect(sent()).toHaveLength(3);
  });

  it("when a concurrent change claims some rows first, writes notifications for only the rows it claimed", async () => {
    watches.push(watch("u_a"), watch("u_b"), watch("u_c"));
    const findMany = jest.mocked(db.wikiWatchlist.findMany);
    const listWatchers = findMany.getMockImplementation()!;
    // Between this change reading its watchers and claiming them, another change claims u_b.
    findMany.mockImplementationOnce((async (args: Parameters<typeof listWatchers>[0]) => {
      const rows = await listWatchers(args);
      watches.find((w) => w.userId === "u_b")!.notificationTime = new Date(0);
      return rows;
    }) as typeof listWatchers);

    expect(await edit()).toBe(2);

    expect(
      sent()
        .map((n) => n.userId)
        .sort()
    ).toEqual(["clerk_u_a", "clerk_u_c"]);
  });

  it("leaves out a MediaWiki editor whose account is linked to a WikiOS watcher", async () => {
    watches.push(watch("u_linked"), watch("u_other"));
    links.push({ userId: "u_linked", username: "Kir", verifiedAt: new Date() });

    await edit({ editorUserId: null, editorWikiUsername: "Kir" });

    expect(sent().map((n) => n.userId)).toEqual(["clerk_u_other"]);
  });

  it("does not trust an unverified wiki link to leave someone out", async () => {
    watches.push(watch("u_linked"));
    links.push({ userId: "u_linked", username: "Kir", verifiedAt: null });

    await edit({ editorUserId: null, editorWikiUsername: "Kir" });

    expect(sent()).toHaveLength(1);
  });

  it("hands the claims back when the notifications cannot be written, so the next change retries", async () => {
    watches.push(watch("u_a"), watch("u_b"));
    mockCreateMany.mockRejectedValueOnce(new Error("db hiccup"));

    expect(await edit()).toBe(0);
    expect(watches.map((w) => w.notificationTime)).toEqual([null, null]);

    expect(await edit({ summary: "Later" })).toBe(2);
    expect(watches.every((w) => w.notificationTime !== null)).toBe(true);
  });

  it("does nothing, and queries nothing, when the watchlist notification event is switched off", async () => {
    watches.push(watch("u_a"));
    mockEventEnabled.mockResolvedValue(false);

    await expect(edit()).resolves.toBe(0);

    expect(mockEventEnabled).toHaveBeenCalledWith("wikiWatchlistNotification");
    expect(mockEventEnabled).toHaveBeenCalledTimes(1);
    expect(db.wikiWatchlist.findMany).not.toHaveBeenCalled();
    expect(mockCreateMany).not.toHaveBeenCalled();
    expect(watches[0]!.notificationTime).toBeNull();
  });

  it("never throws: a failing database costs the notification, not the edit", async () => {
    jest.mocked(db.wikiWatchlist.findMany).mockRejectedValueOnce(new Error("db down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(edit()).resolves.toBe(0);

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does nothing for a page nobody watches", async () => {
    await expect(edit()).resolves.toBe(0);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it("notifies every watcher of a popular page, a chunk of 1000 at a time, not just the first 1000", async () => {
    for (let i = 0; i < 2300; i += 1) watches.push(watch(`u_${String(i).padStart(5, "0")}`));
    // A few with no Clerk id sit among them: skipped, and they must not stall the paging.
    watches.push(watch("u_00500x", "art1", null, null), watch("u_99999x", "art1", null, null));

    expect(await edit()).toBe(2300);

    // Chunks of 1000 watchers; the first holds the Clerk-less u_00500x (skipped), the last u_99999x.
    expect(mockCreateMany.mock.calls.map(([batch]) => (batch as Sent[]).length)).toEqual([
      999, 1000, 301,
    ]);
    expect(new Set(sent().map((n) => n.userId)).size).toBe(2300);
    expect(watches.filter((w) => w.notificationTime === null && w.clerkUserId)).toHaveLength(0);
  });

  it("says a page moved, from where, and links to the page", async () => {
    watches.push(watch("u_a"));

    await notifyWatchers({
      kind: "moved",
      articleId: "art1",
      title: "New name",
      fromTitle: "Old name",
      editor: "Admin",
      editorUserId: "u_admin",
      summary: "Naming policy",
    });

    expect(sent()[0]).toMatchObject({
      title: "New name was moved",
      message: 'Admin moved it from "Old name": Naming policy',
      href: "/wiki/New_name",
      metadata: { articleId: "art1", kind: "moved" },
    });
  });

  it("says a page was deleted, and why", async () => {
    watches.push(watch("u_a"));

    await notifyWatchers({
      kind: "deleted",
      articleId: "art1",
      title: "Gone",
      editor: "Admin",
      editorUserId: "u_admin",
      summary: "Duplicate",
    });

    expect(sent()[0]).toMatchObject({ title: "Gone was deleted", message: "Admin: Duplicate" });
  });

  it("says a page was restored, and links to it", async () => {
    watches.push(watch("u_a"));

    await notifyWatchers({
      kind: "restored",
      articleId: "art1",
      title: "Back again",
      editor: "Admin",
      editorUserId: "u_admin",
      summary: "",
    });

    expect(sent()[0]).toMatchObject({
      title: "Back again was restored",
      message: "Admin restored this page",
      href: "/wiki/Back_again",
      metadata: { articleId: "art1", kind: "restored" },
    });
  });

  it("clips a very long edit summary", async () => {
    watches.push(watch("u_a"));

    await edit({ summary: "x".repeat(500) });

    const message = sent()[0]!.message;
    expect(message.length).toBeLessThan(260);
    expect(message.endsWith("…")).toBe(true);
  });
});

describe("markWatchedVisited", () => {
  it("clears the watcher's mark and stamps the visit, for that watcher and page only", async () => {
    articles.push({ id: "art1", title: "Caphiria Major" });
    watches.push(
      watch("u_a", "art1", new Date()),
      watch("u_b", "art1", new Date()),
      watch("u_a", "art2", new Date())
    );

    await markWatchedVisited("u_a", "Caphiria_Major");

    expect(watches[0]!.notificationTime).toBeNull();
    expect(watches[0]!.lastViewedTime.getTime()).toBeGreaterThan(Date.UTC(2026, 8, 2));
    expect(watches[1]!.notificationTime).not.toBeNull();
    expect(watches[2]!.notificationTime).not.toBeNull();
  });

  it("does nothing for a page that does not exist", async () => {
    watches.push(watch("u_a", "art1", new Date()));

    await markWatchedVisited("u_a", "No such page");

    expect(watches[0]!.notificationTime).not.toBeNull();
    expect(db.wikiWatchlist.updateMany).not.toHaveBeenCalled();
  });
});
