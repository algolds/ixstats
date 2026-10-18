/** @jest-environment node */
import type { NodeMapFile } from "~/lib/thinkpages-forum/import/node-map";
import { rewriteNotificationLinks } from "~/server/modules/thinkpages-forum/import-notification-links";
import { importStore } from "~/tests/helpers/forum-import-fake";

/**
 * Threads 100 (public), 101 (hidden) and 103 (staff archive) imported; 999 never was. Thread 100 holds posts 1001
 * (public) and 1002 (hidden). Member 7 is linked as jane.
 */
function notificationStore(notifications: object[]) {
  return importStore({
    users: [{ id: "u-jane", forumUserId: 7, handle: "jane" }],
    categories: [
      { id: "c-general", key: "general", visibility: "public" },
      { id: "c-xf12", key: "xf-12", visibility: "public" },
      { id: "c-xf13", key: "xf-13", visibility: "staff" },
    ],
    threads: [
      { id: "t-open", categoryId: "c-xf12", xenforoThreadId: 100 },
      { id: "t-hidden", categoryId: "c-xf12", xenforoThreadId: 101, hidden: true },
      { id: "t-staff", categoryId: "c-xf13", xenforoThreadId: 103 },
    ],
    posts: [
      { id: "p-1001", threadId: "t-open", xenforoPostId: 1001 },
      { id: "p-1002", threadId: "t-open", xenforoPostId: 1002, hidden: true },
    ],
    notifications: notifications as never,
  });
}

const NODE_MAP: NodeMapFile = { nodes: { "12": { scope: "site", key: "general" } } };
const note = (id: string, href: string | null) => ({ id, userId: "u-1", title: "x", href });
const hrefsOf = (store: ReturnType<typeof notificationStore>) =>
  Object.fromEntries(store.tables().notifications.map((n) => [n.id, n.href]));

describe("rewriteNotificationLinks", () => {
  it("points bridge-era notification links at the native thread, post, category or member", async () => {
    const store = notificationStore([
      note("n-1", "/forum/thread/100"),
      note("n-2", "/projects/ixstates/forum/thread/100#post-1001"),
      note("n-3", "/projects/ixstats/forum/thread/100"),
      note("n-4", "/projects/ixstates/forum/12"),
      note("n-5", "/forum/members/7"),
    ]);

    const totals = await rewriteNotificationLinks(store.db as never, {
      nodeMap: NODE_MAP,
      dropUnresolved: true,
    });

    expect(totals).toEqual({ mapped: 5, unresolved: 0 });
    expect(hrefsOf(store)).toEqual({
      "n-1": "/thinkpages/t/t-open",
      "n-2": "/projects/ixstates/thinkpages/post/p-1001",
      "n-3": "/thinkpages/t/t-open",
      "n-4": "/projects/ixstates/thinkpages/c/general",
      "n-5": "/@jane",
    });
  });

  it("falls back to the thread when the post is hidden", async () => {
    const store = notificationStore([note("n-1", "/projects/ixstates/forum/thread/100#post-1002")]);

    await rewriteNotificationLinks(store.db as never, { nodeMap: NODE_MAP, dropUnresolved: true });

    expect(hrefsOf(store)).toEqual({ "n-1": "/projects/ixstates/thinkpages/t/t-open" });
  });

  it("sends a link with nothing public to point at to the forum home on a clean run, and keeps it otherwise", async () => {
    const unresolved = {
      "n-hidden": "/forum/thread/101",
      "n-staff": "/projects/ixstates/forum/thread/103",
      "n-never": "/forum/thread/999#post-5",
      "n-dead": "/projects/ixstats/forum/whats-new/",
    };
    const store = notificationStore(Object.entries(unresolved).map(([id, href]) => note(id, href)));

    const kept = await rewriteNotificationLinks(store.db as never, {
      nodeMap: NODE_MAP,
      dropUnresolved: false,
    });

    expect(kept).toEqual({ mapped: 0, unresolved: 0 });
    expect(hrefsOf(store)).toEqual(unresolved);

    const clean = await rewriteNotificationLinks(store.db as never, {
      nodeMap: NODE_MAP,
      dropUnresolved: true,
    });

    expect(clean).toEqual({ mapped: 0, unresolved: 4 });
    expect(hrefsOf(store)).toEqual({
      "n-hidden": "/thinkpages",
      "n-staff": "/projects/ixstates/thinkpages",
      "n-never": "/thinkpages",
      "n-dead": "/thinkpages",
    });
  });

  it("leaves every other notification alone", async () => {
    const others = {
      "n-native": "/projects/ixstates/thinkpages/t/t-open",
      "n-home": "/thinkpages",
      "n-messages": "/messages",
      "n-none": null,
      "n-old-thinkpages": "/thinkpages/forum/x",
      "n-image": "/images/uploads/forum/55.png",
      "n-elsewhere": "https://evil.example/forum/thread/100",
    };
    const store = notificationStore(Object.entries(others).map(([id, href]) => note(id, href)));

    expect(
      await rewriteNotificationLinks(store.db as never, { nodeMap: NODE_MAP, dropUnresolved: true })
    ).toEqual({ mapped: 0, unresolved: 0 });
    expect(hrefsOf(store)).toEqual(others);
    expect(store.db.notification.updateMany).not.toHaveBeenCalled();
  });

  it("scans a forum.ixwiki.com link in any case", async () => {
    const store = notificationStore([note("n-1", "HTTPS://Forum.IxWiki.com/")]);

    expect(
      await rewriteNotificationLinks(store.db as never, { nodeMap: NODE_MAP, dropUnresolved: true })
    ).toEqual({ mapped: 1, unresolved: 0 });
    expect(hrefsOf(store)).toEqual({ "n-1": "/thinkpages" });
  });

  it("leaves a notification whose link changed between its read and the write to the next pass", async () => {
    const store = notificationStore([note("n-1", "/forum/thread/100")]);
    const read = store.db.notification.findMany.getMockImplementation()!;
    store.db.notification.findMany.mockImplementationOnce(async (args) => {
      const rows = await read(args);
      store.tables().notifications.find((n) => n.id === "n-1")!.href = "/forum/members/7";
      return rows;
    });
    const opts = { nodeMap: NODE_MAP, dropUnresolved: true };

    expect(await rewriteNotificationLinks(store.db as never, opts)).toEqual({
      mapped: 0,
      unresolved: 0,
    });
    expect(hrefsOf(store)).toEqual({ "n-1": "/forum/members/7" });
    expect(await rewriteNotificationLinks(store.db as never, opts)).toEqual({
      mapped: 1,
      unresolved: 0,
    });
    expect(hrefsOf(store)).toEqual({ "n-1": "/@jane" });
  });

  it("is idempotent", async () => {
    const store = notificationStore([
      note("n-1", "/forum/thread/100"),
      note("n-2", "/forum/thread/999"),
    ]);
    const opts = { nodeMap: NODE_MAP, dropUnresolved: true };
    await rewriteNotificationLinks(store.db as never, opts);
    const before = JSON.stringify(store.tables().notifications);
    store.db.notification.updateMany.mockClear();

    expect(await rewriteNotificationLinks(store.db as never, opts)).toEqual({
      mapped: 0,
      unresolved: 0,
    });
    expect(store.db.notification.updateMany).not.toHaveBeenCalled();
    expect(JSON.stringify(store.tables().notifications)).toBe(before);
  });

  it("pages through every notification and looks each distinct ref up once", async () => {
    const notes = Array.from({ length: 501 }, (_, i) =>
      note(`n-${String(i).padStart(3, "0")}`, "/projects/ixstates/forum/thread/100#post-1001")
    );
    const store = notificationStore(notes);

    expect(
      await rewriteNotificationLinks(store.db as never, { nodeMap: NODE_MAP, dropUnresolved: true })
    ).toEqual({ mapped: 501, unresolved: 0 });
    expect(store.db.notification.findMany).toHaveBeenCalledTimes(3);
    expect(store.db.forumPost.findFirst).toHaveBeenCalledTimes(1);
    // Every ref of the link is looked up (its thread fallback too), once for the whole pass.
    expect(store.db.forumThread.findFirst).toHaveBeenCalledTimes(1);
  });

  it("lets a failed lookup stop the pass, writing nothing for that notification", async () => {
    const store = notificationStore([note("n-1", "/forum/thread/100")]);
    store.db.forumThread.findFirst.mockRejectedValueOnce(new Error("db down"));

    await expect(
      rewriteNotificationLinks(store.db as never, { nodeMap: NODE_MAP, dropUnresolved: true })
    ).rejects.toThrow("db down");
    expect(hrefsOf(store)).toEqual({ "n-1": "/forum/thread/100" });
  });
});
