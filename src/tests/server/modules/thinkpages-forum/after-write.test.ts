/** @jest-environment node */
jest.mock("~/server/modules/thinkpages-forum/post-notify", () => ({
  notifyForumPost: jest.fn(async () => undefined),
}));

jest.mock("~/server/modules/thinkpages-forum/reaction-notify", () => ({
  notifyReaction: jest.fn(async () => undefined),
}));

import {
  afterBoardMessage,
  afterEdit,
  afterReaction,
  afterReply,
  afterThreadStarted,
} from "~/server/modules/thinkpages-forum/after-write";
import { notifyForumPost } from "~/server/modules/thinkpages-forum/post-notify";
import { notifyReaction } from "~/server/modules/thinkpages-forum/reaction-notify";

const notify = jest.mocked(notifyForumPost);
const actor = { id: "u1", clerkUserId: "clerk_1" };
const fakeDb = () => ({
  forumThreadWatch: { createMany: jest.fn(async (_args: object) => ({ count: 1 })) },
});

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  notify.mockClear();
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe("after-write hooks", () => {
  it("notifies about a reaction without watching anything", async () => {
    const db = fakeDb();
    await afterReaction(db as never, actor, "p1");
    expect(db.forumThreadWatch.createMany).not.toHaveBeenCalled();
    expect(jest.mocked(notifyReaction)).toHaveBeenCalledWith(db, actor, { postId: "p1" });
  });

  it("watches a new thread and then notifies about its first post", async () => {
    const db = fakeDb();
    await afterThreadStarted(db as never, actor, { threadId: "t1", postId: "p1" });
    expect(db.forumThreadWatch.createMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", threadId: "t1" }],
      skipDuplicates: true,
    });
    expect(notify).toHaveBeenCalledWith(db, actor, { postId: "p1", edited: false });
    expect(db.forumThreadWatch.createMany.mock.invocationCallOrder[0]).toBeLessThan(
      notify.mock.invocationCallOrder[0]!
    );
  });

  it("watches the thread a member replies in", async () => {
    const db = fakeDb();
    await afterReply(db as never, actor, { threadId: "t9", postId: "p2" });
    expect(db.forumThreadWatch.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ userId: "u1", threadId: "t9" }] })
    );
    expect(notify).toHaveBeenCalledWith(db, actor, { postId: "p2", edited: false });
  });

  it("notifies about a board message without watching anything", async () => {
    const db = fakeDb();
    await afterBoardMessage(db as never, actor, "m1");
    expect(db.forumThreadWatch.createMany).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(db, actor, { postId: "m1", edited: false });
  });

  it("notifies only about an edit's new mentions and never watches", async () => {
    const db = fakeDb();
    await afterEdit(db as never, actor, "p1");
    expect(db.forumThreadWatch.createMany).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(db, actor, { postId: "p1", edited: true });
  });

  it("still notifies, and does not throw, when the auto-watch fails", async () => {
    const db = fakeDb();
    db.forumThreadWatch.createMany.mockRejectedValue(new Error("db down"));
    await expect(
      afterReply(db as never, actor, { threadId: "t1", postId: "p1" })
    ).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
  });
});
