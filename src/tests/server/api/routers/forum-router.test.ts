/** @jest-environment node */
/**
 * Forum router (XenForo proxy): reads are public and validated; every write needs a signed-in
 * user with a linked forum account and acts as that forum user; stash procedures only touch the
 * caller's own stashes.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/server/db", () => {
  const { createMockPrisma } = jest.requireActual("~/tests/helpers/mock-db");
  return { __esModule: true, db: createMockPrisma(), isDatabaseReadOnly: false };
});

jest.mock("~/server/modules/forum/services/xenforo-service", () => ({
  __esModule: true,
  ...jest.requireActual("~/server/modules/forum/services/xenforo-service"),
  xfFetch: jest.fn(),
  xfPostAsUser: jest.fn(),
  xfDelete: jest.fn(),
}));

jest.mock("~/server/modules/forum/services/xenforo-user-sync", () => ({
  __esModule: true,
  ...jest.requireActual("~/server/modules/forum/services/xenforo-user-sync"),
  lookupForumUser: jest.fn().mockResolvedValue(null),
}));

jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { forumRouter } from "~/server/api/routers/forum";
import { db } from "~/server/db";
import { cacheInvalidate } from "~/server/modules/forum";
import { xfFetch, xfPostAsUser, xfDelete } from "~/server/modules/forum/services/xenforo-service";
import { lookupForumUser } from "~/server/modules/forum/services/xenforo-user-sync";
import { notificationAPI } from "~/lib/notifications/api";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import type { MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(forumRouter);
const mockDb = db as unknown as MockPrismaProxy;
const fetchMock = xfFetch as jest.Mock;
const postMock = xfPostAsUser as jest.Mock;
const deleteMock = xfDelete as jest.Mock;

function callerAs(userId: string | null) {
  return createCaller(
    createMockRouterContext({
      db: mockDb,
      auth: userId ? { userId: `clerk_${userId}` } : null,
      user: userId ? { id: userId, clerkUserId: `clerk_${userId}` } : null,
      rateLimitIdentifier: `${userId}_${Math.random()}`,
    }) as never
  );
}

/** The forum link the signed-in user has (`null` = not linked). */
function linkForum(forumUserId: number | null, forumUsername: string | null = null) {
  mockDb.user.findUnique.mockResolvedValue(
    forumUserId || forumUsername ? { forumUserId, forumUsername, lastForumSync: null } : null
  );
}

const xfThread = {
  thread_id: 10,
  node_id: 3,
  title: "Hello",
  user_id: 77,
  username: "Alice",
  post_date: 1,
  reply_count: 0,
  view_count: 0,
  last_post_date: 1,
  last_post_username: "Alice",
  sticky: false,
  discussion_open: true,
};

const xfPost = {
  post_id: 501,
  thread_id: 10,
  user_id: 77,
  username: "Alice",
  post_date: 1,
  message: "[b]hi[/b]",
  is_first_post: false,
  reaction_score: 0,
  position: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  cacheInvalidate("forum:");
  mockDb.user.findUnique.mockResolvedValue(null);
  mockDb.user.update.mockResolvedValue({});
  mockDb.stash.findFirst.mockResolvedValue(null);
  mockDb.stash.findMany.mockResolvedValue([]);
  mockDb.stash.create.mockResolvedValue({ id: "stash_new" });
  mockDb.stashItem.findMany.mockResolvedValue([]);
});

describe("forum reads", () => {
  it("are public and normalise XenForo threads", async () => {
    fetchMock.mockResolvedValue({ threads: [xfThread], pagination: { total: 1 } });

    const result = await callerAs(null).getRecentThreads({ order: "post_date", limit: 5 });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/threads/?order=post_date"));
    expect(result.threads).toEqual([
      expect.objectContaining({ threadId: 10, title: "Hello", authorName: "Alice" }),
    ]);
  });

  it("keeps only forums and categories, in display order", async () => {
    fetchMock.mockResolvedValue({
      nodes: [
        { node_id: 2, title: "B", node_type_id: "Forum", display_order: 20 },
        { node_id: 1, title: "A", node_type_id: "Category", display_order: 10 },
        { node_id: 9, title: "Link", node_type_id: "LinkForum", display_order: 1 },
      ],
    });

    const { forums } = await callerAs(null).getForums();

    expect(forums.map((f) => f.nodeId)).toEqual([1, 2]);
  });

  it("returns a thread with its posts rendered from BBCode", async () => {
    fetchMock.mockImplementation(async (path: string) =>
      path.includes("/posts") ? { posts: [xfPost] } : { thread: xfThread }
    );

    const result = await callerAs(null).getThread({ threadId: 10 });

    expect(result.thread?.threadId).toBe(10);
    expect(result.posts[0]).toMatchObject({ postId: 501 });
    expect(result.posts[0]!.contentHtml).toContain("hi");
  });

  it("returns null for an unknown member", async () => {
    fetchMock.mockResolvedValue(null);
    await expect(callerAs(null).getMember({ userId: 404 })).resolves.toBeNull();
  });

  it("rejects one-character searches and bad pagination before calling XenForo", async () => {
    await expect(callerAs(null).searchForum({ query: "a" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(callerAs(null).getRecentThreads({ limit: 500 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(callerAs(null).getForum({ forumId: 1, page: 0 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("forum writes", () => {
  it("need a signed-in user", async () => {
    await expect(
      callerAs(null).createThread({ forumId: 1, title: "T", message: "M" })
    ).rejects.toThrow(/Authentication required/);
    expect(postMock).not.toHaveBeenCalled();
  });

  it("need a linked forum account", async () => {
    linkForum(null);
    await expect(callerAs("u1").createPost({ threadId: 10, message: "Hi" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await expect(callerAs("u1").deletePost({ postId: 501 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(postMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("post as the caller's own forum user", async () => {
    linkForum(42, "Alice");
    postMock.mockResolvedValue({ thread: xfThread });

    const result = await callerAs("u1").createThread({
      forumId: 3,
      title: "Hello",
      message: "World",
    });

    expect(postMock).toHaveBeenCalledWith(
      "/threads/",
      { node_id: "3", title: "Hello", message: "World" },
      42
    );
    expect(result.thread.threadId).toBe(10);
    expect(notificationAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({ href: "/forum/thread/10", source: "forum" })
    );
  });

  it("backfills a missing forum user id from the linked username", async () => {
    linkForum(null, "Alice");
    (lookupForumUser as jest.Mock).mockResolvedValue({ userId: 42, username: "Alice" });
    postMock.mockResolvedValue({ post: xfPost });

    await callerAs("u1").createPost({ threadId: 10, message: "Reply" });

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { forumUserId: 42 },
    });
    expect(postMock).toHaveBeenCalledWith("/posts/", { thread_id: "10", message: "Reply" }, 42);
  });

  it("edits and deletes through the caller's forum user, so XenForo enforces ownership", async () => {
    linkForum(42);
    postMock.mockResolvedValue({ post: xfPost });
    deleteMock.mockResolvedValue({ success: true });

    await callerAs("u1").editPost({ postId: 501, message: "Edited" });
    await callerAs("u1").deletePost({ postId: 501, reason: "spam & junk" });

    expect(postMock).toHaveBeenCalledWith("/posts/501/", { message: "Edited" }, 42);
    expect(deleteMock).toHaveBeenCalledWith("/posts/501/?reason=spam%20%26%20junk", 42);
  });

  it("reports a XenForo refusal as an error instead of success", async () => {
    linkForum(42);
    postMock.mockResolvedValue(null);
    deleteMock.mockResolvedValue(null);

    await expect(callerAs("u1").editPost({ postId: 501, message: "x" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    await expect(callerAs("u1").deletePost({ postId: 501 })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    await expect(callerAs("u1").reactToPost({ postId: 501 })).resolves.toEqual({
      success: false,
    });
  });

  it("validates titles and message length", async () => {
    linkForum(42);
    await expect(
      callerAs("u1").createThread({ forumId: 1, title: "", message: "M" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      callerAs("u1").createPost({ threadId: 1, message: "x".repeat(50001) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(postMock).not.toHaveBeenCalled();
  });

  it("marks a thread read in preference to its forum", async () => {
    linkForum(42);
    postMock.mockResolvedValue({});

    await callerAs("u1").markForumRead({ forumId: 3, threadId: 10 });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith("/threads/10/mark-read", {}, 42);
  });
});

describe("forum stash", () => {
  it("creates a default stash on first use", async () => {
    const result = await callerAs("u1").stashThread({ threadId: 10, title: "Hello" });

    expect(mockDb.stash.create).toHaveBeenCalledWith({
      data: { userId: "u1", name: "My Stash", isDefault: true },
    });
    expect(result).toEqual({ success: true, stashId: "stash_new" });
    expect(mockDb.stashItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stashId_pageTitle: { stashId: "stash_new", pageTitle: "forum:thread:10" } },
      })
    );
  });

  it("refuses to write into someone else's stash", async () => {
    // The ownership lookup finds nothing: stash_other belongs to another user.
    mockDb.stash.findFirst.mockResolvedValue(null);

    await expect(
      callerAs("u1").stashThread({ threadId: 10, title: "Hello", stashId: "stash_other" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mockDb.stash.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stash_other", userId: { in: ["u1", "clerk_u1"] } },
      })
    );
    expect(mockDb.stashItem.upsert).not.toHaveBeenCalled();
  });

  it("writes into a named stash the caller owns", async () => {
    mockDb.stash.findFirst.mockResolvedValue({ id: "stash_mine" });

    await callerAs("u1").stashThread({ threadId: 10, title: "Hello", stashId: "stash_mine" });

    expect(mockDb.stashItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stashId_pageTitle: { stashId: "stash_mine", pageTitle: "forum:thread:10" } },
      })
    );
  });

  it("only unstashes from the caller's own stashes", async () => {
    await callerAs("u1").unstashThread({ threadId: 10, stashId: "stash_other" });

    expect(mockDb.stashItem.deleteMany).toHaveBeenCalledWith({
      where: {
        stashId: "stash_other",
        pageTitle: "forum:thread:10",
        stash: { userId: { in: ["u1", "clerk_u1"] } },
      },
    });
  });

  it("lists stashed threads from the caller's stashes only", async () => {
    mockDb.stash.findMany.mockResolvedValue([{ id: "s1" }]);
    mockDb.stashItem.findMany.mockResolvedValue([
      {
        id: "i1",
        contentId: 10,
        note: null,
        pageTitle: "forum:thread:10",
        pageSlug: "/forum/thread/10",
        savedAt: new Date(0),
      },
    ]);

    const items = await callerAs("u1").getStashedThreads();

    expect(mockDb.stash.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { in: ["u1", "clerk_u1"] } } })
    );
    expect(items).toEqual([expect.objectContaining({ threadId: 10, title: "Thread #10" })]);
  });
});

describe("forum account", () => {
  it("needs a signed-in user", async () => {
    await expect(callerAs(null).getLinkStatus()).rejects.toThrow(/Authentication required/);
  });

  it("reports an unlinked account", async () => {
    await expect(callerAs("u1").getLinkStatus()).resolves.toEqual({
      linked: false,
      forumUserId: null,
      forumUsername: null,
      lastSynced: null,
    });
  });

  it("backfills the forum user id when only the username is stored", async () => {
    linkForum(null, "Alice");
    (lookupForumUser as jest.Mock).mockResolvedValue({ userId: 42, username: "Alice" });

    const status = await callerAs("u1").getLinkStatus();

    expect(status).toMatchObject({ linked: true, forumUserId: 42, forumUsername: "Alice" });
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { forumUserId: 42 },
    });
  });
});
