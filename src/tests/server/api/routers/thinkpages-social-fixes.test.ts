/** @jest-environment node */
/**
 * ThinkPages fixes: persona country ownership (N2), admin-only verified (N3), getPost visibility
 * (N5), bookmark caller identity (N11), like-notification target + href (N6/N7) and reaction
 * double counting (N8).
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesAccountsRouter } from "~/server/api/routers/thinkpages/accounts";
import { thinkpagesPostsPostsQueriesRouter } from "~/server/api/routers/thinkpages/posts/posts/queries";
import { thinkpagesPostsBookmarksRouter } from "~/server/api/routers/thinkpages/posts/bookmarks";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { thinkpagesPostsFlagsRouter } from "~/server/api/routers/thinkpages/posts/flags";
import { thinkpagesPostsPostsCreateRouter } from "~/server/api/routers/thinkpages/posts/posts/create";
import { thinkpagesFeedRouter } from "~/server/api/routers/thinkpages/feed";
import { activitiesFeedGlobalRouter } from "~/server/api/routers/activities/feed/global";
import { latestPublicThreadPreviews } from "~/server/modules/thinkpages-forum";
import { adminUsersRouter } from "~/server/api/routers/admin/users";
import { linkOldForumAccount, unlinkOldForumAccount } from "~/server/modules/thinkpages-forum";
import { createIdorContext } from "~/tests/helpers/country-idor-context";

const mockOnThinkPageActivity = jest.fn();
const mockOnSocialActivity = jest.fn();
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: {
    onThinkPageActivity: (...args: unknown[]) => mockOnThinkPageActivity(...args),
    onSocialActivity: (...args: unknown[]) => mockOnSocialActivity(...args),
  },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    deleteByPattern: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/vault/vault-service", () => ({
  vaultService: { earnCredits: jest.fn().mockResolvedValue({ success: false }) },
}));
jest.mock("~/lib/discord/thinkpages-feed", () => ({
  mirrorThinkPagesPostToDiscordFeed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getRecentChanges: jest.fn().mockResolvedValue([]),
}));
jest.mock("~/server/modules/thinkpages-forum", () => ({
  ...jest.requireActual("~/server/modules/thinkpages-forum"),
  latestPublicThreadPreviews: jest.fn(),
  linkOldForumAccount: jest.fn(),
  unlinkOldForumAccount: jest.fn(),
}));

const CLERK_ID = "test_user_clerk_id";

const createAccountsCaller = createCallerFactory(thinkpagesAccountsRouter);
const createQueriesCaller = createCallerFactory(thinkpagesPostsPostsQueriesRouter);
const createBookmarksCaller = createCallerFactory(thinkpagesPostsBookmarksRouter);

const personaInput = {
  countryId: "test_country_1",
  accountType: "citizen" as const,
  username: "someone",
  firstName: "Some",
};

describe("N2: createAccount requires country ownership", () => {
  let db: any;
  beforeEach(() => {
    db = createMockPrisma();
    db.thinkpagesAccount.findMany.mockResolvedValue([]);
    db.thinkpagesAccount.findUnique.mockResolvedValue(null);
    db.thinkpagesAccount.create.mockImplementation(async ({ data }: any) => ({
      id: "a1",
      ...data,
    }));
    db.country.findUnique.mockResolvedValue({ id: "other_country" });
    db.user.findUnique.mockResolvedValue({
      clerkUserId: CLERK_ID,
      countryId: "test_country_1",
      role: { name: "member", level: 100 },
    });
  });

  it("rejects a persona for a country the caller does not own", async () => {
    const caller = createAccountsCaller(createMockRouterContext({ db }) as never);
    await expect(
      caller.createAccount({ ...personaInput, countryId: "other_country" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.thinkpagesAccount.create).not.toHaveBeenCalled();
  });
});

describe("N3: verified is admin-only", () => {
  let db: any;
  beforeEach(() => {
    db = createMockPrisma();
    db.thinkpagesAccount.findUnique.mockImplementation(async ({ where }: any) =>
      where.id ? { id: "a1", clerkUserId: CLERK_ID, verified: false } : null
    );
    db.thinkpagesAccount.update.mockImplementation(async ({ data }: any) => ({
      id: "a1",
      ...data,
    }));
    db.thinkpagesAccount.findMany.mockResolvedValue([]);
    db.thinkpagesAccount.create.mockImplementation(async ({ data }: any) => ({
      id: "a1",
      ...data,
    }));
    db.country.findUnique.mockResolvedValue({ id: "test_country_1" });
  });

  const memberUser = {
    clerkUserId: CLERK_ID,
    countryId: "test_country_1",
    role: { name: "member", level: 100 },
  };

  it("ignores a client-supplied verified flag on create", async () => {
    const caller = createAccountsCaller(createMockRouterContext({ db, user: memberUser }) as never);
    await caller.createAccount({ ...personaInput, verified: true } as never);
    expect(db.thinkpagesAccount.create.mock.calls[0][0].data.verified).toBe(false);
  });

  it("forbids a regular user from self-verifying on update", async () => {
    const caller = createAccountsCaller(createMockRouterContext({ db, user: memberUser }) as never);
    await expect(caller.updateAccount({ accountId: "a1", verified: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.thinkpagesAccount.update).not.toHaveBeenCalled();
  });
});

describe("N5: getPost honours visibility", () => {
  const basePost = (over: Record<string, unknown>) => ({
    id: "p1",
    content: "secret",
    visibility: "public",
    accountId: "a1",
    account: { id: "a1", clerkUserId: "owner_clerk" },
    reactionCounts: null,
    reactions: [],
    replies: [],
    hashtags: null,
    poll: null,
    isAutoGenerated: false,
    ixTimeTimestamp: new Date("2026-09-01T00:00:00Z"),
    createdAt: new Date("2026-09-01T00:00:00Z"),
    ...over,
  });

  const callerFor = (post: unknown, userId: string | null) => {
    const db = createMockPrisma();
    db.thinkpagesPost.findUnique.mockResolvedValue(post);
    return createQueriesCaller(
      createMockRouterContext({
        db,
        auth: userId ? { userId } : null,
        user: userId ? { clerkUserId: userId } : null,
      }) as never
    );
  };

  it.each(["private"])("hides %s posts from anonymous viewers", async (visibility) => {
    const caller = callerFor(basePost({ visibility }), null);
    await expect(caller.getPost({ postId: "p1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides private posts from other signed-in users", async () => {
    const caller = callerFor(basePost({ visibility: "private" }), "someone_else");
    await expect(caller.getPost({ postId: "p1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("drops private replies and embedded private parents the viewer cannot read", async () => {
    const caller = callerFor(
      basePost({
        parentPost: basePost({ id: "parent", visibility: "private" }),
        replies: [
          basePost({ id: "r1", visibility: "public" }),
          basePost({ id: "r2", visibility: "private" }),
        ],
      }),
      null
    );
    const result: any = await caller.getPost({ postId: "p1" });
    expect(result.parentPost).toBeNull();
    expect(result.replies.map((r: any) => r.id)).toEqual(["r1"]);
  });
});

describe("N11: bookmarkPost uses the authenticated caller", () => {
  it("writes the bookmark for ctx.auth.userId, not a client-supplied id", async () => {
    const db = createMockPrisma();
    const caller = createBookmarksCaller(createMockRouterContext({ db }) as never);
    await caller.bookmarkPost({ postId: "p1", bookmarked: true, userId: "victim" } as never);
    const arg = db.postBookmark.upsert.mock.calls[0][0];
    expect(arg.create.userId).toBe(CLERK_ID);
    expect(arg.where.userId_postId.userId).toBe(CLERK_ID);
  });
});

/**
 * SL-10: bookmarks have a "Saved posts" list, flags belong to the caller, and admins work the
 * flag queue (dismiss keeps the post, remove deletes it; both resolve every open flag on it).
 */
describe("saved posts and flags belong to the caller", () => {
  const bookmarks = createCallerFactory(thinkpagesPostsBookmarksRouter);
  const flags = createCallerFactory(thinkpagesPostsFlagsRouter);
  function userCtx(db: ReturnType<typeof createMockPrisma>, clerk = "viewer") {
    return createMockRouterContext({
      db,
      auth: { userId: clerk },
      user: { id: "db1", clerkUserId: clerk, role: { name: "user", level: 100 } },
    }) as never;
  }
  const post = (id: string, visibility = "public", owner = "author") => ({
    id,
    visibility,
    content: `post ${id}`,
    hashtags: null,
    reactions: [],
    reactionCounts: null,
    poll: null,
    isAutoGenerated: false,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ixTimeTimestamp: new Date("2026-10-01T00:00:00Z"),
    account: { clerkUserId: owner },
  });
  describe("thinkpages.getBookmarkedPosts", () => {
    it("lists the caller's saved posts newest first, skipping deleted and unreadable posts", async () => {
      const db = createMockPrisma();
      db.postBookmark.findMany.mockResolvedValue([
        { id: "b3", postId: "p3", createdAt: new Date("2026-10-04") },
        { id: "b2", postId: "gone", createdAt: new Date("2026-10-03") },
        { id: "b1", postId: "p1", createdAt: new Date("2026-10-02") },
        { id: "b0", postId: "secret", createdAt: new Date("2026-10-01") },
      ]);
      db.thinkpagesPost.findMany.mockResolvedValue([
        post("p1"),
        post("p3"),
        post("secret", "private", "someone_else"),
      ]);

      const result = await bookmarks(userCtx(db)).getBookmarkedPosts({ limit: 3 });

      expect(db.postBookmark.findMany.mock.calls[0]![0]).toMatchObject({
        where: { userId: "viewer" },
        take: 4,
      });
      expect(result.posts.map((p: { id: string }) => p.id)).toEqual(["p3", "p1"]);
      expect(result.nextCursor).toBe("b1");
    });
  });
  describe("thinkpages.flagPost", () => {
    it("records the flag for the caller, whatever userId the client sends", async () => {
      const db = createMockPrisma();
      db.thinkpagesPost.findUnique.mockResolvedValue({ id: "p1" });
      await flags(userCtx(db)).flagPost({ postId: "p1", userId: "someone_else", reason: "spam" });
      expect(db.postFlag.create).toHaveBeenCalledWith({
        data: { postId: "p1", userId: "viewer", reason: "spam" },
      });
    });
  });
});

/**
 * ThinkPages social loop: mention / repost / quote notifications go to the owning Clerk user
 * with the actor persona's name and a working post link, and the engagement counters
 * (replyCount, repostCount, likeCount) are maintained by create / delete / react.
 */
describe("mentions, private posts and engagement counters", () => {
  const CLERK_ID = "test_user_clerk_id";
  const createCaller = createCallerFactory(thinkpagesPostsPostsCreateRouter);
  const author = {
    id: "persona_me",
    clerkUserId: CLERK_ID,
    isActive: true,
    username: "chancellor",
    displayName: "The Chancellor",
    verified: false,
    profileImageUrl: null,
  };
  function setupCreate(post: Record<string, any> = {}) {
    const db: any = createMockPrisma();
    db.thinkpagesAccount.findUnique.mockResolvedValue(author);
    db.thinkpagesPost.create.mockImplementation(async ({ data }: any) => ({
      id: "new_post",
      visibility: data.visibility,
      postType: data.postType,
      content: data.content,
      ...post,
    }));
    db.thinkpagesPost.count.mockResolvedValue(10);
    return db;
  }
  beforeEach(() => {
    mockOnSocialActivity.mockReset().mockResolvedValue(undefined);
    mockOnThinkPageActivity.mockReset().mockResolvedValue(undefined);
  });
  describe("mention notifications", () => {
    it("skip users whose mention setting excludes the author, but still record the mention (SL-4)", async () => {
      const db = setupCreate();
      db.thinkpagesAccount.findMany.mockResolvedValue([
        { id: "persona_a", username: "alice", clerkUserId: "clerk_alice" },
        { id: "persona_b", username: "bob", clerkUserId: "clerk_bob" },
      ]);
      db.userConnection.findMany.mockImplementation(async (args: any) =>
        args.where.connectionType === "privacy_config"
          ? [{ userId: "clerk_alice", status: JSON.stringify({ mentions: "nobody" }) }]
          : []
      );
      const caller = createCaller(createMockRouterContext({ db }) as never);
      await caller.createPost({
        accountId: "persona_me",
        content: "hi @alice @bob",
        mentions: ["@alice", "@bob"],
        postToDiscord: false,
      });

      expect(db.postMention.createMany.mock.calls[0][0].data).toHaveLength(2);
      expect(mockOnSocialActivity).toHaveBeenCalledTimes(1);
      expect(mockOnSocialActivity.mock.calls[0]![0]).toMatchObject({ toUserId: "clerk_bob" });
    });
    it("does not notify from a private post nobody else can open", async () => {
      const db = setupCreate();
      db.thinkpagesAccount.findMany.mockResolvedValue([
        { id: "persona_a", username: "alice", clerkUserId: "clerk_alice" },
      ]);
      const caller = createCaller(createMockRouterContext({ db }) as never);
      await caller.createPost({
        accountId: "persona_me",
        content: "psst @alice",
        mentions: ["@alice"],
        visibility: "private",
        postToDiscord: false,
      });
      expect(db.postMention.createMany).toHaveBeenCalledTimes(1);
      expect(mockOnSocialActivity).not.toHaveBeenCalled();
    });
  });
});
/**
 * The ThinkPages feed's realm filter: public posts by personas of the realm's nations. The realm's board is read by
 * the feed's board block (native forum messages), not here. Without a realm the feed is unchanged (all realms).
 */
describe("the realm feed", () => {
  const createCaller = createCallerFactory(thinkpagesFeedRouter);
  function feedWhere(db: ReturnType<typeof createMockPrisma>) {
    return db.thinkpagesPost.findMany.mock.calls[0]![0].where;
  }
  function caller(db: ReturnType<typeof createMockPrisma>) {
    return createCaller(createMockRouterContext({ db, auth: null, user: null }) as never);
  }
  describe("thinkpages.getFeed realm filter", () => {
    it("shows the realm's nations' public posts and never reads the old board chat", async () => {
      const db = createMockPrisma();
      db.realmBoard.findUnique.mockResolvedValue({ groupId: "board1" });
      await caller(db).getFeed({ realmId: "eurth" });

      expect(db.realmBoard.findUnique).not.toHaveBeenCalled();
      expect(feedWhere(db)).toEqual({
        AND: [{ visibility: "public", account: { country: { realmId: "eurth" } } }],
      });
      expect(JSON.stringify(feedWhere(db))).not.toContain("thinktank");
      expect(JSON.stringify(feedWhere(db))).not.toContain("group:");
    });
  });
});

/**
 * Phase 4b (Q10) and sub-project 7: the global feed's forum slice comes from native ThinkPages forum threads (public
 * categories, site section or published realms; `latestPublicThreadPreviews`), not from XenForo, and each item
 * carries the preview of the post it refers to.
 */
describe("the activity feed's forum slice", () => {
  const AT = new Date("2026-10-09T10:00:00Z");
  function previewed(id: string, replyCount: number, over: object = {}, postedAt: Date = AT) {
    const href = `/thinkpages/t/${id}`;
    return {
      id,
      title: `Thread ${id}`,
      author: "jane",
      categoryName: "General",
      replyCount,
      createdAt: AT,
      lastPostAt: AT,
      postedAt,
      href,
      preview: {
        threadId: id,
        title: `Thread ${id}`,
        threadHref: href,
        postHref: `/thinkpages/post/p_${id}`,
        kind: replyCount === 0 ? "thread" : "reply",
        excerpt: `Excerpt of ${id}`,
        author: {
          name: replyCount === 0 ? "jane" : "herald",
          avatarUrl: null,
          flagUrl: "https://flags.example/e.png",
          persona: false,
        },
        board: { name: "General", href: "/thinkpages/c/general" },
        realm: null,
        style: "ooc",
        replyCount,
        reactionTotal: 4,
        ...over,
      },
    };
  }
  const callerFor = (db: ReturnType<typeof createMockPrisma>) =>
    createCallerFactory(activitiesFeedGlobalRouter)(createMockRouterContext({ db }) as never);
  describe("activities.getGlobalFeed forum slice", () => {
    it("shows a persona item by the persona's name and picture, with no flag", async () => {
      const persona = {
        name: "Herald",
        avatarUrl: "https://img.example/h.png",
        flagUrl: null,
        persona: true,
      };
      jest
        .mocked(latestPublicThreadPreviews)
        .mockResolvedValue([previewed("t5", 2, { author: persona })] as never);
      const { activities } = await callerFor(createMockPrisma()).getGlobalFeed({
        filter: "community",
        limit: 20,
      });
      const item = activities.find((a: { source: string }) => a.source === "forum");
      expect(item).toMatchObject({
        user: { name: "Herald", avatarUrl: "https://img.example/h.png", flagUrl: null },
        forum: { author: persona },
      });
    });
  });
});

/**
 * Phase 4b: linking an old forum account is a staff action in the admin users panel. Only admins may call it; it
 * links and attributes the imported posts at once (the module, faked here), writes an audit row, and maps the
 * module's refusals to tRPC errors.
 */
describe("linking an old forum account", () => {
  function caller(role: "member" | "admin") {
    const ctx = createIdorContext(
      { adminAuditLog: { create: jest.fn().mockResolvedValue({}) } },
      role
    );
    return { caller: adminUsersRouter.createCaller(ctx as never), db: ctx.db as never as AuditDb };
  }
  type AuditDb = { adminAuditLog: { create: jest.Mock } };
  const LINKED = {
    username: "OldTimer",
    previousXenforoUserId: 55,
    released: { threads: 0, posts: 3 },
    relinked: { threads: 1, posts: 2 },
  };
  beforeEach(() => {
    jest.mocked(linkOldForumAccount).mockReset().mockResolvedValue(LINKED);
    jest
      .mocked(unlinkOldForumAccount)
      .mockReset()
      .mockResolvedValue({ released: { threads: 1, posts: 2 } });
  });
  describe("admin.linkUserForum / unlinkUserForum", () => {
    it("links, attributes the imported posts at once and writes an audit row", async () => {
      const { caller: admin, db } = caller("admin");
      await expect(
        admin.linkUserForum({ userId: "u1", xenforoUserId: 77, forumUsername: "OldTimer" })
      ).resolves.toEqual(LINKED);
      expect(jest.mocked(linkOldForumAccount).mock.calls[0]![1]).toEqual({
        userId: "u1",
        xenforoUserId: 77,
        username: "OldTimer",
      });
      expect(db.adminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "FORUM_ACCOUNT_LINKED",
          targetId: "u1",
          adminId: "db_user_caller",
        }),
      });
      const changes = JSON.parse(db.adminAuditLog.create.mock.calls[0]![0].data.changes);
      expect(changes).toMatchObject({ xenforoUserId: 77, previousXenforoUserId: 55 });
    });
  });
});
