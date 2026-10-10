/** @jest-environment node */
import { permalinkTarget } from "~/lib/thinkpages-forum/permalink";
import { locatePostFor } from "~/server/api/routers/thinkpagesForum/permalink";
import {
  editPost,
  getThreadPosts,
  modEditPost,
  setPostHidden,
  replyToThread,
  resolvePostLocation,
  stashThread,
} from "~/server/modules/thinkpages-forum";
import {
  BOARD_THREAD,
  boardPost,
  boardStore,
  founder,
  member,
  officer,
  postIn,
  seed,
} from "~/tests/helpers/forum-board-fake";

const store = () =>
  boardStore(seed({ posts: [boardPost("p1", 1), boardPost("hid", 2, { hidden: true })] }));

describe("the realm board thread on the generic thread paths", () => {
  it("is not readable as a thread", async () => {
    const s = store();
    for (const who of [member, founder, null]) {
      await expect(
        getThreadPosts(s.db as never, who as never, BOARD_THREAD, 1)
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  });

  it("takes no replies through the thread reply", async () => {
    const s = store();
    await expect(
      replyToThread(s.db as never, member as never, { threadId: BOARD_THREAD, html: "<p>hi</p>" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(s.state.posts).toHaveLength(2);
  });

  it("takes no author edits through the post edit", async () => {
    const s = store();
    await expect(
      editPost(s.db as never, member as never, {
        postId: "p1",
        html: "<p>edited</p>",
        editedAt: null,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(s.state.posts[0]).toMatchObject({ plainText: "Message p1" });
  });

  it("cannot be stashed", async () => {
    const s = store();
    await expect(
      stashThread(
        s.db as never,
        member as never,
        { primaryId: "u_member", ids: ["u_member"] },
        { threadId: BOARD_THREAD }
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("has no thread location for its posts", async () => {
    const s = store();
    expect(await resolvePostLocation(s.db as never, member as never, "p1")).toBeNull();
    expect(await resolvePostLocation(s.db as never, founder as never, "hid")).toBeNull();
  });
});

describe("moderating board messages", () => {
  it("lets a board moderator edit a message with the moderator edit, logging it", async () => {
    const s = store();
    await modEditPost(s.db as never, officer as never, {
      postId: "p1",
      html: "<p>Cleaned</p>",
      note: "tidy",
    });
    expect(postIn(s, "p1")).toMatchObject({ plainText: "Cleaned" });
    expect(s.logs).toHaveLength(1);
    expect(s.logs[0]).toMatchObject({ action: "post.edit", targetId: "p1", scopeId: "r_eurth" });
  });

  it("lets a board moderator hide and unhide a message, the first one included", async () => {
    const s = store();
    await setPostHidden(s.db as never, officer as never, { postId: "p1", hidden: true });
    expect(postIn(s, "p1")).toMatchObject({ hidden: true });
    await setPostHidden(s.db as never, officer as never, { postId: "p1", hidden: false });
    expect(postIn(s, "p1")).toMatchObject({ hidden: false });
  });
});

describe("the post permalink", () => {
  it("resolves a board post to the realm landing, for the viewer who may see it", async () => {
    const s = store();
    expect(await locatePostFor(s.db as never, "clerk_u_member", "p1")).toEqual({
      realmSlug: "eurth",
    });
    expect(await locatePostFor(s.db as never, null, "p1")).toEqual({ realmSlug: "eurth" });
    expect(await locatePostFor(s.db as never, "clerk_u_member", "hid")).toBeNull();
    expect(await locatePostFor(s.db as never, "founder", "hid")).toEqual({ realmSlug: "eurth" });
  });

  it("sends a board post to /thinkpages/r/<slug>#post-<id>", () => {
    expect(permalinkTarget("p1", { realmSlug: "eurth" })).toBe("/thinkpages/r/eurth#post-p1");
    expect(permalinkTarget("p 1", { realmSlug: "a b" })).toBe("/thinkpages/r/a%20b#post-p%201");
  });

  it("still sends thread posts to their thread and unknown ids to the feed", () => {
    expect(permalinkTarget("p1", { threadId: "t1", page: 2 })).toBe(
      "/thinkpages/t/t1?page=2#post-p1"
    );
    expect(permalinkTarget("p1", null)).toBe("/dashboard/post/p1");
  });
});
