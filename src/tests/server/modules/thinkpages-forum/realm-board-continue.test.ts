/** @jest-environment node */
import { continueInThread } from "~/server/modules/thinkpages-forum/board-continue";
import {
  admin,
  ban,
  at,
  BOARD_THREAD,
  boardPost,
  boardStore,
  founder,
  member,
  member2,
  officer,
  postIn,
  seed,
  threadIn,
  visitor,
} from "~/tests/helpers/forum-board-fake";
import { detailOf, type Row, type StoreState } from "~/tests/helpers/forum-store-fake";

const HUB = "cat_r_eurth_hub";
const store = (extraPosts: Row[] = [], extra: Partial<StoreState> = {}) =>
  boardStore(
    seed({
      posts: [
        boardPost("p1", 1, { plainText: "A long thought", contentHtml: "<p>A long thought</p>" }),
        boardPost("p2", 2, { replyToPostId: "p1", authorUserId: "u_visitor" }),
        boardPost("persona", 3, { authorPersonaId: "pa_news" }),
        boardPost("hid", 4, { hidden: true }),
        boardPost("done", 5, { continuedThreadId: "t_x" }),
        boardPost("admins", 6, { authorUserId: "u_admin" }),
        ...extraPosts,
      ],
      reports: [
        {
          id: "rep1",
          targetType: "post",
          targetId: "p1",
          categoryId: "cat_r_eurth_board",
          status: "open",
          reporterId: "u_x",
        },
      ],
      ...extra,
    })
  );
const cont = (s: ReturnType<typeof boardStore>, who: object, postId: string, extra: object = {}) =>
  continueInThread(s.db as never, who as never, { postId, title: "A long thought", ...extra });

describe("continueInThread", () => {
  it("moves the author's message into a new Hub thread as its first post and leaves a placeholder", async () => {
    const s = store();
    const out = await cont(s, member, "p1");
    const thread = threadIn(s, out.threadId);
    expect(thread).toMatchObject({
      categoryId: HUB,
      title: "A long thought",
      authorUserId: "u_member",
      authorPersonaId: null,
      postCount: 1,
    });
    // The very post moves (its id, text and time stay), so reports and permalinks follow it.
    expect(postIn(s, "p1")).toMatchObject({
      threadId: out.threadId,
      plainText: "A long thought",
      replyToPostId: null,
      createdAt: at(1),
    });
    const placeholder = s.state.posts.find((p) => p.continuedThreadId === out.threadId)!;
    expect(placeholder).toMatchObject({
      threadId: BOARD_THREAD,
      authorUserId: "u_member",
      createdAt: at(1),
      continuedThreadId: out.threadId,
    });
    expect(out.placeholder).toMatchObject({
      id: placeholder.id,
      continued: { threadId: out.threadId, title: "A long thought", replies: 0 },
      byViewer: true,
    });
  });

  it("dates the new thread by the moved message and takes the board thread's lock", async () => {
    const s = store();
    const out = await cont(s, member, "p1");
    expect(threadIn(s, out.threadId).lastPostAt).toEqual(at(1));
    expect(s.tx.$executeRaw).toHaveBeenCalled();
  });

  it("points replies to the moved message at its placeholder and open reports at the Hub", async () => {
    const s = store();
    const out = await cont(s, member, "p1");
    expect(postIn(s, "p2").replyToPostId).toBe(out.placeholder.id);
    expect(s.state.reports[0]).toMatchObject({ categoryId: HUB });
  });

  it("logs a moderator continuing someone else's message, and nobody for an author's own", async () => {
    const s = store();
    await cont(s, member, "p1");
    expect(s.logs).toHaveLength(0);
    const out = await cont(s, officer, "p2");
    expect(s.logs).toHaveLength(1);
    expect(s.logs[0]).toMatchObject({
      actorId: "u_officer",
      action: "post.continue",
      targetType: "post",
      targetId: "p2",
      scope: "realm",
      scopeId: "r_eurth",
    });
    expect(detailOf(s.logs[0])).toMatchObject({ threadId: out.threadId });
    expect(threadIn(s, out.threadId)).toMatchObject({ authorUserId: "u_visitor" });
  });

  it("lets the founder and a site admin continue anyone's message", async () => {
    for (const who of [founder, admin]) {
      const s = store();
      await expect(cont(s, who, "p2")).resolves.toBeDefined();
    }
  });

  it("refuses other members and visitors for a message that is not theirs", async () => {
    for (const who of [member2, visitor]) {
      const s = store();
      const before = s.state.threads.length;
      await expect(cont(s, who, "p1")).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(s.state.threads).toHaveLength(before);
      expect(postIn(s, "p1").threadId).toBe(BOARD_THREAD);
    }
  });

  it("does not let a realm moderator act on a site admin's message", async () => {
    await expect(cont(store(), officer, "admins")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(cont(store(), admin, "admins")).resolves.toBeDefined();
  });

  it("needs the author to be able to post in the Hub: a visitor's own message cannot move there", async () => {
    await expect(cont(store(), visitor, "p2")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a banned author", async () => {
    const s = store([boardPost("b1", 7, { authorUserId: "u_banned" })]);
    s.state.bans.push(ban({ userId: "u_banned", scope: "realm", scopeId: "r_eurth" }));
    await expect(
      cont(s, { ...member, id: "u_banned", clerkUserId: "clerk_u_banned" }, "b1")
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refuses hidden, already continued, unknown and non-board posts", async () => {
    await expect(cont(store(), member, "hid")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(cont(store(), officer, "hid")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(cont(store(), member, "done")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(cont(store(), member, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const other = store([boardPost("hubpost", 8, { threadId: "t_hub" })], {
      threads: [
        ...(seed().threads ?? []),
        {
          id: "t_hub",
          categoryId: HUB,
          title: "Hub",
          authorUserId: "u_member",
          postCount: 1,
          hidden: false,
        },
      ],
    });
    await expect(cont(other, member, "hubpost")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("validates the title", async () => {
    await expect(cont(store(), member, "p1", { title: "ab" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(cont(store(), member, "p1", { title: "x".repeat(201) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  describe("personas", () => {
    it("moves an in-character message to an in-character category, never the Hub", async () => {
      const s = store();
      await expect(cont(s, member, "persona")).rejects.toMatchObject({ code: "CONFLICT" });
      const out = await cont(s, member, "persona", { categoryKey: "character-threads" });
      expect(threadIn(s, out.threadId)).toMatchObject({
        categoryId: "cat_r_eurth_character-threads",
        authorPersonaId: "pa_news",
      });
      expect(out.placeholder).toMatchObject({ authorUserId: null, authorPersonaId: "pa_news" });
    });
  });

  it("keeps the move atomic: a lost race leaves no thread behind", async () => {
    const s = store();
    s.tx.forumPost.updateMany = jest.fn(async () => ({ count: 0 })) as never;
    const before = s.state.threads.length;
    await expect(cont(s, member, "p1")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(s.state.threads).toHaveLength(before);
  });

  it("refuses a destination that is not a realm category", async () => {
    await expect(cont(store(), member, "p1", { categoryKey: "board" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(cont(store(), member, "p1", { categoryKey: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
