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
import { thinkpagesPostsReactionsMutationsRouter } from "~/server/api/routers/thinkpages/posts/reactions/mutations";
import { resolveReactionCounts } from "~/server/api/routers/thinkpages/post-utils";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const mockOnThinkPageActivity = jest.fn();
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: {
    onThinkPageActivity: (...args: any[]) => mockOnThinkPageActivity(...args),
  },
}));

const CLERK_ID = "test_user_clerk_id";

const createAccountsCaller = createCallerFactory(thinkpagesAccountsRouter);
const createQueriesCaller = createCallerFactory(thinkpagesPostsPostsQueriesRouter);
const createBookmarksCaller = createCallerFactory(thinkpagesPostsBookmarksRouter);
const createReactionsCaller = createCallerFactory(thinkpagesPostsReactionsMutationsRouter);

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

  it("allows a persona for the caller's own country", async () => {
    const caller = createAccountsCaller(createMockRouterContext({ db }) as never);
    await caller.createAccount(personaInput);
    expect(db.thinkpagesAccount.create).toHaveBeenCalledTimes(1);
  });

  it("allows an admin to create a persona for any country", async () => {
    const caller = createAccountsCaller(
      createMockRouterContext({
        db,
        user: {
          clerkUserId: CLERK_ID,
          countryId: "test_country_1",
          role: { name: "admin", level: 10 },
        },
      }) as never
    );
    await caller.createAccount({ ...personaInput, countryId: "other_country" });
    expect(db.thinkpagesAccount.create).toHaveBeenCalledTimes(1);
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

  it("still lets a regular user update other settings", async () => {
    const caller = createAccountsCaller(createMockRouterContext({ db, user: memberUser }) as never);
    await caller.updateAccount({ accountId: "a1", personality: "serious" });
    expect(db.thinkpagesAccount.update).toHaveBeenCalledTimes(1);
  });

  it("lets an admin set verified", async () => {
    const caller = createAccountsCaller(
      createMockRouterContext({
        db,
        user: {
          clerkUserId: CLERK_ID,
          countryId: "test_country_1",
          role: { name: "admin", level: 10 },
        },
      }) as never
    );
    const result = await caller.updateAccount({ accountId: "a1", verified: true });
    expect(result.verified).toBe(true);
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

  it.each(["private", "draft"])("hides %s posts from anonymous viewers", async (visibility) => {
    const caller = callerFor(basePost({ visibility }), null);
    await expect(caller.getPost({ postId: "p1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides private posts from other signed-in users", async () => {
    const caller = callerFor(basePost({ visibility: "private" }), "someone_else");
    await expect(caller.getPost({ postId: "p1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("shows private and draft posts to their owner", async () => {
    for (const visibility of ["private", "draft"]) {
      const caller = callerFor(basePost({ visibility }), "owner_clerk");
      await expect(caller.getPost({ postId: "p1" })).resolves.toMatchObject({ id: "p1" });
    }
  });

  it("shows public posts to anonymous viewers", async () => {
    const caller = callerFor(basePost({}), null);
    await expect(caller.getPost({ postId: "p1" })).resolves.toMatchObject({ id: "p1" });
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

  it("removes only the caller's bookmark", async () => {
    const db = createMockPrisma();
    const caller = createBookmarksCaller(createMockRouterContext({ db }) as never);
    await caller.bookmarkPost({ postId: "p1", bookmarked: false });
    expect(db.postBookmark.deleteMany).toHaveBeenCalledWith({
      where: { postId: "p1", userId: CLERK_ID },
    });
  });
});

describe("N6: like notifications target the author's owning user", () => {
  beforeEach(() => {
    mockOnThinkPageActivity.mockReset();
    mockOnThinkPageActivity.mockResolvedValue(undefined);
  });

  const setup = (authorClerkUserId: string) => {
    const db: any = createMockPrisma();
    db.$transaction = jest.fn((cb: any) => cb(db));
    db.thinkpagesAccount.findUnique.mockResolvedValue({
      id: "liker_persona",
      clerkUserId: CLERK_ID,
    });
    db.thinkpagesPost.findUnique
      .mockResolvedValueOnce({ reactionCounts: null, content: "hello" })
      .mockResolvedValueOnce({
        accountId: "author_persona",
        content: "hello",
        account: { clerkUserId: authorClerkUserId },
      });
    db.postReaction.findUnique.mockResolvedValue(null);
    db.postReaction.create.mockResolvedValue({ id: "r1" });
    return createReactionsCaller(createMockRouterContext({ db }) as never);
  };

  it("sends the notification to the author's Clerk user id, not the persona id", async () => {
    const caller = setup("author_clerk");
    await caller.addReaction({ postId: "p1", accountId: "liker_persona", reactionType: "like" });
    expect(mockOnThinkPageActivity).toHaveBeenCalledTimes(1);
    expect(mockOnThinkPageActivity.mock.calls[0]![0]).toMatchObject({
      action: "liked",
      targetUserId: "author_clerk",
    });
  });

  it("does not notify when liking a post owned by the same user", async () => {
    const caller = setup(CLERK_ID);
    await caller.addReaction({ postId: "p1", accountId: "liker_persona", reactionType: "like" });
    expect(mockOnThinkPageActivity).not.toHaveBeenCalled();
  });
});

describe("N7: ThinkPage notification href", () => {
  it("links to the real post route", async () => {
    const { notificationAPI } = await import("~/lib/notifications/api");
    const spy = jest.spyOn(notificationAPI, "create").mockResolvedValue("n1");
    await notificationAPI.trigger({
      thinkpage: { id: "post_9", title: "t", action: "liked", authorId: "a", targetUserId: "u" },
    } as never);
    expect(spy.mock.calls[0]![0].href).toMatch(/\/dashboard\/post\/post_9$/);
    spy.mockRestore();
  });
});

describe("N8: native reactions are not double counted", () => {
  it("uses the stored JSON tally as authoritative", () => {
    const counts = resolveReactionCounts(JSON.stringify({ like: 1 }), [{ reactionType: "like" }]);
    expect(counts).toEqual({ like: 1 });
  });

  it("falls back to reaction rows when no JSON tally exists", () => {
    expect(
      resolveReactionCounts(null, [{ reactionType: "like" }, { reactionType: "like" }])
    ).toEqual({ like: 2 });
  });

  it("tolerates malformed JSON", () => {
    expect(resolveReactionCounts("{not json", [{ reactionType: "fire" }])).toEqual({ fire: 1 });
  });

  it("getPost reports one like for one stored like plus one row", async () => {
    const db = createMockPrisma();
    db.thinkpagesPost.findUnique.mockResolvedValue({
      id: "p1",
      content: "x",
      visibility: "public",
      account: { clerkUserId: "o" },
      reactionCounts: JSON.stringify({ like: 1 }),
      reactions: [{ reactionType: "like" }],
      replies: [],
      ixTimeTimestamp: new Date(),
      createdAt: new Date(),
    });
    const caller = createQueriesCaller(
      createMockRouterContext({ db, auth: null, user: null }) as never
    );
    const result: any = await caller.getPost({ postId: "p1" });
    expect(result.reactionCounts).toEqual({ like: 1 });
  });
});
