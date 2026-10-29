/** @jest-environment node */
/**
 * ThinkPages post content warnings: createPost and updatePost take an optional `contentWarning`, trimmed, at most
 * CONTENT_WARNING_MAX_LENGTH characters, stored as null when empty. An edit that leaves it out keeps the stored one.
 *
 * `jest` is the ambient global because the hoisted jest.mock() factories call jest.fn() inline.
 */
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: {
    onThinkPageActivity: jest.fn().mockResolvedValue(undefined),
    onSocialActivity: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteByPattern: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("~/lib/discord/thinkpages-feed", () => ({
  mirrorThinkPagesPostToDiscordFeed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/discord/ixtwitter-sync", () => ({
  postThinkPagesToDiscord: jest.fn().mockResolvedValue(undefined),
  editDiscordMessage: jest.fn().mockResolvedValue(true),
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesPostsPostsCreateRouter } from "~/server/api/routers/thinkpages/posts/posts/create";
import { thinkpagesPostsPostsModifyRouter } from "~/server/api/routers/thinkpages/posts/posts/modify";
import { CONTENT_WARNING_MAX_LENGTH } from "~/lib/thinkpages/content-warning";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const ME = "clerk_me";
const account = {
  id: "acc_me",
  clerkUserId: ME,
  isActive: true,
  username: "me",
  displayName: "Me",
};

function ctxFor(db: MockPrismaProxy) {
  return createMockRouterContext({
    db,
    auth: { userId: ME },
    user: { id: "db_me", clerkUserId: ME, role: { name: "user", level: 100 } },
  }) as never;
}

function createDb() {
  const db = createMockPrisma();
  db.thinkpagesAccount.findUnique.mockResolvedValue(account);
  db.thinkpagesPost.create.mockImplementation(async ({ data }: any) => ({
    id: "new",
    ...data,
    account,
    parentPost: null,
    repostOf: null,
  }));
  return db;
}

const create = (db: MockPrismaProxy, input: Record<string, unknown>) =>
  createCallerFactory(thinkpagesPostsPostsCreateRouter)(ctxFor(db)).createPost({
    accountId: "acc_me",
    content: "hello",
    postToDiscord: false,
    ...input,
  } as never);

const storedWarning = (db: MockPrismaProxy) =>
  db.thinkpagesPost.create.mock.calls[0]![0].data.contentWarning;

describe("createPost contentWarning", () => {
  it("stores the trimmed warning and returns it with the post", async () => {
    const db = createDb();
    const result: any = await create(db, { contentWarning: "  war violence  " });
    expect(storedWarning(db)).toBe("war violence");
    expect(result.contentWarning).toBe("war violence");
  });

  it.each([[undefined], [""], ["   "], [null]])("stores %p as no warning", async (value) => {
    const db = createDb();
    await create(db, { contentWarning: value });
    expect(storedWarning(db)).toBeNull();
  });

  it("accepts the maximum length after trimming and refuses one character more", async () => {
    const db = createDb();
    await create(db, { contentWarning: ` ${"x".repeat(CONTENT_WARNING_MAX_LENGTH)} ` });
    expect(storedWarning(db)).toHaveLength(CONTENT_WARNING_MAX_LENGTH);

    const refused = createDb();
    await expect(
      create(refused, { contentWarning: "x".repeat(CONTENT_WARNING_MAX_LENGTH + 1) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(refused.thinkpagesPost.create).not.toHaveBeenCalled();
  });

  it("refuses a warning that is not text", async () => {
    const db = createDb();
    await expect(create(db, { contentWarning: 42 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("updatePost contentWarning", () => {
  function updateDb() {
    const db = createMockPrisma();
    db.thinkpagesPost.findUnique.mockResolvedValue({
      id: "p1",
      content: "old",
      hashtags: null,
      contentWarning: "spiders",
      account: { id: "acc_me", clerkUserId: ME },
    });
    db.thinkpagesPost.update.mockImplementation(async ({ data }: any) => ({
      id: "p1",
      ...data,
      account,
      mediaAttachments: [],
    }));
    return db;
  }
  const update = (db: MockPrismaProxy, input: Record<string, unknown>) =>
    createCallerFactory(thinkpagesPostsPostsModifyRouter)(ctxFor(db)).updatePost({
      postId: "p1",
      content: "new",
      ...input,
    } as never);
  const written = (db: MockPrismaProxy) => db.thinkpagesPost.update.mock.calls[0]![0].data;

  it("sets a new trimmed warning", async () => {
    const db = updateDb();
    await update(db, { contentWarning: " snakes " });
    expect(written(db).contentWarning).toBe("snakes");
  });

  it.each([[""], [null]])("clears the warning for %p", async (value) => {
    const db = updateDb();
    await update(db, { contentWarning: value });
    expect(written(db).contentWarning).toBeNull();
  });

  it("leaves the stored warning alone when the edit omits it", async () => {
    const db = updateDb();
    await update(db, {});
    expect(written(db)).not.toHaveProperty("contentWarning");
  });

  it("refuses a warning over the maximum length", async () => {
    const db = updateDb();
    await expect(
      update(db, { contentWarning: "x".repeat(CONTENT_WARNING_MAX_LENGTH + 1) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.thinkpagesPost.update).not.toHaveBeenCalled();
  });
});
