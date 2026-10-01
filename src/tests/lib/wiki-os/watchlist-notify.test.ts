/** @jest-environment node */
/**
 * Plan 416 item 3 (WK-19): a head change notifies the page's watchers, once each until they visit
 * (MediaWiki's semantics, kept in `WikiWatchlist.notificationTime`), and never the person who made
 * the change.
 */
type Watch = {
  id: string;
  userId: string;
  articleId: string;
  notificationTime: Date | null;
  lastViewedTime: Date;
};

const watches: Watch[] = [];
const links: Array<{ userId: string; username: string; verifiedAt: Date | null }> = [];
const articles: Array<{ id: string; title: string }> = [];

type WatchWhere = {
  id?: string;
  userId?: string | { notIn: string[] };
  articleId?: string;
  notificationTime?: null;
};

function matchesWatch(watch: Watch, where: WatchWhere): boolean {
  if (where.id !== undefined && watch.id !== where.id) return false;
  if (where.articleId !== undefined && watch.articleId !== where.articleId) return false;
  if (where.notificationTime === null && watch.notificationTime !== null) return false;
  if (typeof where.userId === "string" && watch.userId !== where.userId) return false;
  if (typeof where.userId === "object" && where.userId.notIn.includes(watch.userId)) return false;
  return true;
}

const mockCreate = jest.fn();

jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiWatchlist: {
      findMany: jest.fn(async ({ where, take }: { where: WatchWhere; take?: number }) =>
        watches
          .filter((w) => matchesWatch(w, where))
          .slice(0, take)
          .map((w) => ({ id: w.id, userId: w.userId }))
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: WatchWhere; data: Partial<Watch> }) => {
          const found = watches.filter((w) => matchesWatch(w, where));
          for (const watch of found) Object.assign(watch, data);
          return { count: found.length };
        }
      ),
    },
    wikiAccountLink: {
      findFirst: jest.fn(async ({ where }: { where: { username: string } }) =>
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
  notificationAPI: { create: (...args: unknown[]) => mockCreate(...args) },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { notifyWatchers, markWatchedVisited } from "~/lib/wiki-os/services/watchlist-notify";
import { db } from "~/server/db";

const watch = (userId: string, articleId = "art1", notificationTime: Date | null = null): Watch => ({
  id: `w_${userId}_${articleId}`,
  userId,
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

beforeEach(() => {
  jest.clearAllMocks();
  watches.length = 0;
  links.length = 0;
  articles.length = 0;
  mockCreate.mockResolvedValue("notification_id");
});

describe("notifyWatchers", () => {
  it("notifies each watcher of the page, leaving out the editor and other pages' watchers", async () => {
    watches.push(watch("u_a"), watch("u_b"), watch("u_editor"), watch("u_c", "other_article"));

    const notified = await edit();

    expect(notified).toBe(2);
    expect(mockCreate.mock.calls.map(([n]) => n.userId).sort()).toEqual(["u_a", "u_b"]);
  });

  it("writes the notification the watchlist page and the bell show", async () => {
    watches.push(watch("u_a"));

    await edit();

    expect(mockCreate).toHaveBeenCalledWith({
      userId: "u_a",
      title: "Caphiria was edited",
      message: "Kir: Fixed the borders",
      href: "/util/diff?oldid=r_old&diff=r_new",
      category: "wiki",
      priority: "low",
      source: "wikiWatchlist",
      metadata: { articleId: "art1", kind: "edited" },
    });
  });

  it("falls back to the page when there is no earlier revision to diff against", async () => {
    watches.push(watch("u_a"));

    await edit({ previousRef: null, summary: "" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ href: "/wiki/Caphiria", message: "Kir edited this page" })
    );
  });

  it("notifies once per watcher until they visit the page", async () => {
    watches.push(watch("u_a"), watch("u_b"));

    expect(await edit()).toBe(2);
    expect(await edit({ summary: "Another change" })).toBe(0);
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // u_a visits the page; u_b does not.
    articles.push({ id: "art1", title: "Caphiria" });
    await markWatchedVisited("u_a", "Caphiria");

    expect(await edit({ summary: "A third change" })).toBe(1);
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockCreate.mock.calls[2]![0]).toMatchObject({
      userId: "u_a",
      message: "Kir: A third change",
    });
  });

  it("notifies once when two changes race", async () => {
    watches.push(watch("u_a"), watch("u_b"), watch("u_c"));

    const counts = await Promise.all([edit(), edit({ summary: "Same moment" })]);

    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("leaves out a MediaWiki editor whose account is linked to a WikiOS watcher", async () => {
    watches.push(watch("u_linked"), watch("u_other"));
    links.push({ userId: "u_linked", username: "Kir", verifiedAt: new Date() });

    await edit({ editorUserId: null, editorWikiUsername: "Kir" });

    expect(mockCreate.mock.calls.map(([n]) => n.userId)).toEqual(["u_other"]);
  });

  it("does not trust an unverified wiki link to leave someone out", async () => {
    watches.push(watch("u_linked"));
    links.push({ userId: "u_linked", username: "Kir", verifiedAt: null });

    await edit({ editorUserId: null, editorWikiUsername: "Kir" });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("hands the claim back when the notification cannot be written, so the next change retries", async () => {
    watches.push(watch("u_a"));
    mockCreate.mockRejectedValueOnce(new Error("Notification suppressed: wikiWatchlistNotification is disabled"));

    expect(await edit()).toBe(0);
    expect(watches[0]!.notificationTime).toBeNull();

    expect(await edit({ summary: "Later" })).toBe(1);
    expect(watches[0]!.notificationTime).not.toBeNull();
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
    expect(mockCreate).not.toHaveBeenCalled();
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

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New name was moved",
        message: 'Admin moved it from "Old name": Naming policy',
        href: "/wiki/New_name",
        metadata: { articleId: "art1", kind: "moved" },
      })
    );
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

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Gone was deleted", message: "Admin: Duplicate" })
    );
  });

  it("clips a very long edit summary", async () => {
    watches.push(watch("u_a"));

    await edit({ summary: "x".repeat(500) });

    const message = mockCreate.mock.calls[0]![0].message as string;
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
