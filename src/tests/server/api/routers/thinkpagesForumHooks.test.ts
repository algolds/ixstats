/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/websocket-server", () => ({
  getThinkPagesBroadcaster: () => ({ broadcastBoard: jest.fn(), broadcastMessage: jest.fn() }),
}));
jest.mock("~/server/modules/thinkpages-forum", () => {
  const actual = jest.requireActual("~/server/modules/thinkpages-forum");
  return {
    ...actual,
    createThread: jest.fn(async () => ({ threadId: "t_new", postId: "p_new", formatting: "done" })),
    replyToThread: jest.fn(async () => ({ postId: "p_reply", formatting: "done" })),
    editPost: jest.fn(async () => ({ formatting: "done" })),
    postBoardMessage: jest.fn(async () => ({ message: { id: "m1" }, reward: null })),
    editBoardMessage: jest.fn(async () => ({ id: "m1" })),
    publishBoardPost: jest.fn(async () => undefined),
    afterThreadStarted: jest.fn(async () => undefined),
    afterReply: jest.fn(async () => undefined),
    afterEdit: jest.fn(async () => undefined),
    afterBoardMessage: jest.fn(async () => undefined),
    afterReaction: jest.fn(async () => undefined),
  };
});

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import {
  afterBoardMessage,
  afterEdit,
  afterReply,
  afterThreadStarted,
  createThread,
  ForumError,
  postBoardMessage,
} from "~/server/modules/thinkpages-forum";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: null,
  email: "x@y.z",
  role: { name: "user", level: 100 },
};
const db = {
  realm: { findMany: jest.fn(async () => []) },
  realmOfficer: { findMany: jest.fn(async () => []) },
  forumCategoryModerator: { findMany: jest.fn(async () => []) },
};
const caller = () =>
  createCallerFactory(thinkpagesForumRouter)(
    createMockRouterContext({ auth: { userId: "clerk_1" }, user: member as never, db }) as never
  );
const actor = expect.objectContaining({ id: "u1", clerkUserId: "clerk_1" });

describe("the write hooks", () => {
  beforeEach(() => {
    for (const level of ["log", "info", "warn"] as const)
      jest.spyOn(console, level).mockImplementation(() => undefined);
    jest.mocked(afterThreadStarted).mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it("runs the hook after starting a thread, with the new ids", async () => {
    const out = await caller().createThread({
      categoryKey: "general",
      title: "Hello there",
      html: "<p>Hi</p>",
    });
    expect(out).toEqual({ threadId: "t_new", postId: "p_new", formatting: "done" });
    expect(afterThreadStarted).toHaveBeenCalledWith(db, actor, out);
  });

  it("runs the hook after a reply and after an edit", async () => {
    await caller().reply({ threadId: "t1", html: "<p>Hi</p>" });
    expect(afterReply).toHaveBeenCalledWith(db, actor, { threadId: "t1", postId: "p_reply" });
    await caller().editPost({ postId: "p1", html: "<p>Hi</p>", editedAt: null });
    expect(afterEdit).toHaveBeenCalledWith(db, actor, "p1");
  });

  it("runs the hooks after a board message and its edit", async () => {
    await caller().postBoardMessage({ realm: "eurth", html: "<p>Hi</p>" });
    expect(afterBoardMessage).toHaveBeenCalledWith(db, actor, "m1");
    await caller().editBoardMessage({ postId: "m1", html: "<p>Hi</p>" });
    expect(afterEdit).toHaveBeenCalledWith(db, actor, "m1");
  });

  it("returns the board message with the reward its post earned", async () => {
    await expect(caller().postBoardMessage({ realm: "eurth", html: "<p>Hi</p>" })).resolves.toEqual(
      { message: { id: "m1" }, reward: null }
    );
    jest
      .mocked(postBoardMessage)
      .mockResolvedValueOnce({ message: { id: "m2" } as never, reward: { amount: 5 } });
    await expect(caller().postBoardMessage({ realm: "eurth", html: "<p>Hi</p>" })).resolves.toEqual(
      { message: { id: "m2" }, reward: { amount: 5 } }
    );
    expect(afterBoardMessage).toHaveBeenLastCalledWith(db, actor, "m2");
  });

  it("does not wait for the hook: a hook that never settles does not hold the response", async () => {
    jest.mocked(afterReply).mockReturnValueOnce(new Promise<void>(() => undefined));
    await expect(caller().reply({ threadId: "t1", html: "<p>Hi</p>" })).resolves.toEqual({
      postId: "p_reply",
      formatting: "done",
    });
  });

  it("logs a hook that rejects and still returns the write", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.mocked(afterThreadStarted).mockRejectedValueOnce(new Error("hook down"));
    await expect(
      caller().createThread({ categoryKey: "general", title: "Hello there", html: "<p>Hi</p>" })
    ).resolves.toMatchObject({ threadId: "t_new" });
    await new Promise((resolve) => setImmediate(resolve));
    expect(errorSpy).toHaveBeenCalledWith(
      "[thinkpages-forum] Write hook failed:",
      expect.any(Error)
    );
  });

  it("runs no hook when the write is refused", async () => {
    jest.mocked(createThread).mockRejectedValueOnce(new ForumError("FORBIDDEN", "Nope"));
    await expect(
      caller().createThread({ categoryKey: "general", title: "Hello there", html: "<p>Hi</p>" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(afterThreadStarted).not.toHaveBeenCalled();
  });
});
