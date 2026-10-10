/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory, t } from "~/server/api/trpc/init";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import {
  boardPost,
  boardStore,
  founder,
  member,
  officer,
  postIn,
  seed,
} from "~/tests/helpers/forum-board-fake";

const caller = (user: object | null, db: object) =>
  createCallerFactory(thinkpagesForumRouter)(
    createMockRouterContext({
      auth: user ? { userId: (user as { clerkUserId: string }).clerkUserId } : null,
      user: user as never,
      db,
    }) as never
  );

const withBoard = () =>
  boardStore(seed({ posts: [boardPost("p1", 1), boardPost("p2", 2, { createdAt: new Date() })] }));

describe("thinkpagesForum board procedures", () => {
  beforeEach(() => {
    // The audit middleware logs every mutation and the auth middleware warns on anonymous calls.
    for (const level of ["log", "info", "warn"] as const)
      jest.spyOn(console, level).mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("reads the board for anyone, newest first", async () => {
    const store = withBoard();
    const out = await caller(null, store.db).getBoard({ realm: "eurth" });
    expect(out.messages.map((m) => m.id)).toEqual(["p2", "p1"]);
    expect(out.access).toMatchObject({ canPost: false, reason: "sign_in" });
    const paged = await caller(member, store.db).getBoard({
      realm: "eurth",
      limit: 1,
      before: "p2",
    });
    expect(paged.messages.map((m) => m.id)).toEqual(["p1"]);
  });

  it("reads a hidden realm as not found and bounds its inputs", async () => {
    const store = withBoard();
    await expect(caller(member, store.db).getBoard({ realm: "draft" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      caller(null, store.db).getBoard({ realm: "eurth", limit: 101 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("posts, edits, continues and configures through the module", async () => {
    const store = withBoard();
    const c = caller(member, store.db);
    const posted = await c.postBoardMessage({
      realm: "eurth",
      html: "<p>Hello</p>",
      replyToPostId: "p1",
    });
    expect(posted).toMatchObject({ contentHtml: "<p>Hello</p>", replyTo: { postId: "p1" } });
    const edited = await c.editBoardMessage({ postId: posted.id, html: "<p>Hello again</p>" });
    expect(edited.contentHtml).toBe("<p>Hello again</p>");
    const continued = await c.continueInThread({ postId: posted.id, title: "A real thread" });
    expect(postIn(store, posted.id).threadId).toBe(continued.threadId);
    expect(continued.placeholder.continued).toMatchObject({ title: "A real thread" });
    await expect(
      caller(founder, store.db).updateBoardSettings({ realmId: "r_eurth", slowModeSeconds: 10 })
    ).resolves.toEqual({ visitorsAllowed: true, slowModeSeconds: 10 });
  });

  it("maps refusals to TRPC errors", async () => {
    const store = withBoard();
    await expect(
      caller(member, store.db).updateBoardSettings({ realmId: "r_eurth", slowModeSeconds: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(member, store.db).updateBoardSettings({ realmId: "r_eurth", slowModeSeconds: 45 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(member, store.db).postBoardMessage({
        realm: "eurth",
        html: `<p>${"a".repeat(1001)}</p>`,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses signed-out writes", async () => {
    const store = withBoard();
    await expect(
      caller(null, store.db).postBoardMessage({ realm: "eurth", html: "<p>hi</p>" })
    ).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
  });

  it("returns the slow-mode wait to the client as structured error data", async () => {
    const store = boardStore(
      seed({ posts: [boardPost("mine", 1, { createdAt: new Date(Date.now() - 7_500) })] })
    );
    Object.assign(
      store.state.realms.find((r) => r.id === "r_eurth")!,
      { boardSlowModeSeconds: 30 }
    );
    const error = await caller(officer, store.db)
      .postBoardMessage({ realm: "eurth", html: "<p>hi</p>" })
      .catch((e: unknown) => e);
    // Moderators are exempt: this one posts. A member is refused.
    expect(error).toMatchObject({ contentHtml: "<p>hi</p>" });
    const refused = await caller(member, store.db)
      .postBoardMessage({ realm: "eurth", html: "<p>hi</p>" })
      .catch((e: unknown) => e);
    expect(refused).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "You can post again in 23s",
    });
    expect(store.state.posts).toHaveLength(2);
    const shaped = t._config.errorFormatter({
      shape: { message: "x", code: -32029, data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 } },
      error: refused as never,
      path: "thinkpagesForum.postBoardMessage",
      type: "mutation",
      input: null,
      ctx: undefined,
    } as never);
    expect(shaped.data).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      httpStatus: 429,
      context: { retryAfterSeconds: 23 },
    });
  });
});
