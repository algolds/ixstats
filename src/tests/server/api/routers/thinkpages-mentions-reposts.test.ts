/**
 * ThinkPages social loop: mention / repost / quote notifications go to the owning Clerk user
 * with the actor persona's name and a working post link, and the engagement counters
 * (replyCount, repostCount, likeCount) are maintained by create / delete / react.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesPostsPostsCreateRouter } from "~/server/api/routers/thinkpages/posts/posts/create";
import { thinkpagesPostsPostsModifyRouter } from "~/server/api/routers/thinkpages/posts/posts/modify";
import { thinkpagesPostsReactionsMutationsRouter } from "~/server/api/routers/thinkpages/posts/reactions/mutations";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const mockOnSocialActivity = jest.fn();
const mockOnThinkPageActivity = jest.fn();
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: {
    onSocialActivity: (...args: any[]) => mockOnSocialActivity(...args),
    onThinkPageActivity: (...args: any[]) => mockOnThinkPageActivity(...args),
  },
}));
jest.mock("~/lib/vault/vault-service", () => ({
  vaultService: { earnCredits: jest.fn().mockResolvedValue({ success: false }) },
}));
jest.mock("~/lib/discord/thinkpages-feed", () => ({
  mirrorThinkPagesPostToDiscordFeed: jest.fn().mockResolvedValue(undefined),
}));

const CLERK_ID = "test_user_clerk_id";

const createCaller = createCallerFactory(thinkpagesPostsPostsCreateRouter);
const modifyCaller = createCallerFactory(thinkpagesPostsPostsModifyRouter);
const reactionsCaller = createCallerFactory(thinkpagesPostsReactionsMutationsRouter);

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

  it("notify the mentioned persona's owning user once, named after the actor persona", async () => {
    const db = setupCreate();
    db.thinkpagesAccount.findMany.mockResolvedValue([
      { id: "persona_a", username: "alice", clerkUserId: "clerk_alice" },
      { id: "persona_a2", username: "alice_media", clerkUserId: "clerk_alice" },
      { id: "persona_self", username: "my_other", clerkUserId: CLERK_ID },
    ]);
    const caller = createCaller(createMockRouterContext({ db }) as never);
    await caller.createPost({
      accountId: "persona_me",
      content: "hi @alice @alice_media @my_other",
      mentions: ["@alice", "@alice_media", "@my_other"],
      postToDiscord: false,
    });

    expect(db.postMention.createMany).toHaveBeenCalledTimes(1);
    expect(mockOnSocialActivity).toHaveBeenCalledTimes(1);
    expect(mockOnSocialActivity.mock.calls[0]![0]).toMatchObject({
      activityType: "mention",
      toUserId: "clerk_alice",
      fromUserId: CLERK_ID,
      fromUserName: "The Chancellor",
      contentId: "new_post",
    });
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

describe("repost and quote notifications", () => {
  const original = {
    id: "orig",
    content: "original words",
    account: { clerkUserId: "clerk_bob" },
  };

  it("a plain repost notifies the original author and links to the original post", async () => {
    const db = setupCreate({ repostOf: original });
    const caller = createCaller(createMockRouterContext({ db }) as never);
    await caller.createPost({ accountId: "persona_me", repostOfId: "orig", postToDiscord: false });

    expect(mockOnSocialActivity).toHaveBeenCalledTimes(1);
    expect(mockOnSocialActivity.mock.calls[0]![0]).toMatchObject({
      activityType: "repost",
      toUserId: "clerk_bob",
      fromUserName: "The Chancellor",
      contentId: "orig",
    });
  });

  it("a quote notifies the original author and links to the quoting post", async () => {
    const db = setupCreate({ repostOf: original });
    const caller = createCaller(createMockRouterContext({ db }) as never);
    await caller.createPost({
      accountId: "persona_me",
      repostOfId: "orig",
      content: "my take",
      postToDiscord: false,
    });
    expect(mockOnSocialActivity.mock.calls[0]![0]).toMatchObject({
      activityType: "quote",
      toUserId: "clerk_bob",
      contentId: "new_post",
    });
  });

  it("reposting one of your own posts notifies nobody", async () => {
    const db = setupCreate({ repostOf: { ...original, account: { clerkUserId: CLERK_ID } } });
    const caller = createCaller(createMockRouterContext({ db }) as never);
    await caller.createPost({ accountId: "persona_me", repostOfId: "orig", postToDiscord: false });
    expect(mockOnSocialActivity).not.toHaveBeenCalled();
  });
});

describe("reply notifications", () => {
  it("carry the actor persona's name and skip the caller's own personas", async () => {
    const db = setupCreate({ parentPost: { id: "parent" } });
    db.thinkpagesPost.findUnique.mockResolvedValue({
      id: "parent",
      accountId: "persona_other_of_mine",
      account: { clerkUserId: CLERK_ID },
    });
    const caller = createCaller(createMockRouterContext({ db }) as never);
    await caller.createPost({
      accountId: "persona_me",
      parentPostId: "parent",
      content: "self reply",
      postToDiscord: false,
    });
    expect(mockOnThinkPageActivity).not.toHaveBeenCalled();

    db.thinkpagesPost.findUnique.mockResolvedValue({
      id: "parent",
      accountId: "persona_bob",
      account: { clerkUserId: "clerk_bob" },
    });
    await caller.createPost({
      accountId: "persona_me",
      parentPostId: "parent",
      content: "reply",
      postToDiscord: false,
    });
    expect(mockOnThinkPageActivity).toHaveBeenCalledTimes(1);
    expect(mockOnThinkPageActivity.mock.calls[0]![0]).toMatchObject({
      action: "commented",
      targetUserId: "clerk_bob",
      authorName: "The Chancellor",
    });
  });
});

describe("engagement counters", () => {
  it("createPost increments the parent's replyCount and the original's repostCount", async () => {
    const db = setupCreate();
    const caller = createCaller(createMockRouterContext({ db }) as never);
    await caller.createPost({
      accountId: "persona_me",
      parentPostId: "parent",
      content: "r",
      postToDiscord: false,
    });
    await caller.createPost({ accountId: "persona_me", repostOfId: "orig", postToDiscord: false });

    expect(db.thinkpagesPost.updateMany).toHaveBeenCalledWith({
      where: { id: "parent" },
      data: { replyCount: { increment: 1 } },
    });
    expect(db.thinkpagesPost.updateMany).toHaveBeenCalledWith({
      where: { id: "orig" },
      data: { repostCount: { increment: 1 } },
    });
  });

  it("deletePost decrements the parent / original counters without going below zero", async () => {
    const db: any = createMockPrisma();
    db.thinkpagesPost.findUnique.mockResolvedValue({
      id: "p1",
      accountId: "persona_me",
      content: "x",
      parentPostId: "parent",
      repostOfId: "orig",
      account: { clerkUserId: CLERK_ID },
    });
    db.thinkpagesPost.count.mockResolvedValue(0);
    db.thinkpagesPost.delete.mockResolvedValue({ id: "p1" });
    const caller = modifyCaller(createMockRouterContext({ db }) as never);
    await caller.deletePost({ postId: "p1" });

    expect(db.thinkpagesPost.updateMany).toHaveBeenCalledWith({
      where: { id: "parent", replyCount: { gt: 0 } },
      data: { replyCount: { decrement: 1 } },
    });
    expect(db.thinkpagesPost.updateMany).toHaveBeenCalledWith({
      where: { id: "orig", repostCount: { gt: 0 } },
      data: { repostCount: { decrement: 1 } },
    });
  });

  const reactionSetup = (stored: Record<string, number> | null, existing: any) => {
    const db: any = createMockPrisma();
    db.$transaction = jest.fn((cb: any) => cb(db));
    db.thinkpagesAccount.findUnique.mockResolvedValue({
      id: "persona_me",
      clerkUserId: CLERK_ID,
      displayName: "The Chancellor",
    });
    db.thinkpagesPost.findUnique.mockResolvedValue({
      reactionCounts: stored ? JSON.stringify(stored) : null,
      content: "hello",
      accountId: "persona_me",
      account: { clerkUserId: CLERK_ID },
    });
    db.postReaction.findUnique.mockResolvedValue(existing);
    db.postReaction.create.mockResolvedValue({ id: "r1" });
    return { db, caller: reactionsCaller(createMockRouterContext({ db }) as never) };
  };

  const lastPostUpdate = (db: any) =>
    db.thinkpagesPost.update.mock.calls[db.thinkpagesPost.update.mock.calls.length - 1][0].data;

  it("a new like writes likeCount alongside the JSON tally", async () => {
    const { db, caller } = reactionSetup({ like: 2 }, null);
    await caller.addReaction({ postId: "p1", accountId: "persona_me", reactionType: "like" });
    expect(lastPostUpdate(db)).toEqual({
      reactionCounts: JSON.stringify({ like: 3 }),
      likeCount: 3,
    });
  });

  it("switching a like to another reaction lowers likeCount", async () => {
    const { db, caller } = reactionSetup({ like: 2 }, { reactionType: "like" });
    await caller.addReaction({ postId: "p1", accountId: "persona_me", reactionType: "fire" });
    expect(lastPostUpdate(db).likeCount).toBe(1);
  });

  it("removing a like lowers likeCount", async () => {
    const { db, caller } = reactionSetup({ like: 1 }, { reactionType: "like" });
    await caller.removeReaction({ postId: "p1", accountId: "persona_me" });
    expect(lastPostUpdate(db).likeCount).toBe(0);
  });
});
