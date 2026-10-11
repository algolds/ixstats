/** @jest-environment node */
import {
  loadReactablePost,
  loadReadablePost,
  threadReactable,
} from "~/server/modules/thinkpages-forum/reaction-target";
import type { ForumRealm } from "~/server/modules/thinkpages-forum";
import {
  admin,
  ban,
  banned,
  boardPost,
  founder,
  member,
  plain,
  visitor,
} from "~/tests/helpers/forum-board-fake";
import { reactionStore, SITE_CATEGORY } from "~/tests/helpers/forum-reaction-fixtures";

const threadRow = (id: string, categoryId: string, authorUserId: string) => ({
  id,
  categoryId,
  title: `Thread ${id}`,
  authorUserId,
  authorPersonaId: null,
  pinned: false,
  locked: false,
  hidden: false,
  archived: false,
});
const readable = (viewer: object | null, postId: string, store = reactionStore()) =>
  loadReadablePost(store.db as never, viewer as never, postId);
const reactable = (viewer: object, postId: string, store = reactionStore()) =>
  loadReactablePost(store.db as never, viewer as never, postId);

describe("loadReadablePost", () => {
  it("reads a thread post and a board message signed out, and says which is which", async () => {
    const thread = await readable(null, "p_hub");
    expect(thread).toMatchObject({
      board: false,
      post: { id: "p_hub", threadId: "t_hub" },
      category: { key: "hub" },
      realm: { slug: "eurth" },
    });
    expect(await readable(null, "b1")).toMatchObject({ board: true, realm: { slug: "eurth" } });
    expect(await readable(null, "p_site")).toMatchObject({ board: false, realm: null });
  });

  it("does not find an unknown post, a hidden post, a post in a hidden thread or a hidden realm", async () => {
    for (const id of ["nope", "p_hidden", "p_hiddenthread", "p_draft", "b_hidden", "b_draft"]) {
      await expect(readable(member, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("lets a moderator read a hidden post and a hidden board message", async () => {
    expect(await readable(admin, "p_hidden")).toMatchObject({ post: { hidden: true } });
    expect(await readable(founder, "b_hidden")).toMatchObject({ board: true });
  });

  // The rules it mirrors from resolvePostLocation and loadVisibleThread, one test each.
  it("follows canSeeThread: a post in a hidden thread is for the category's moderators only", async () => {
    await expect(readable(null, "p_hiddenthread")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(readable(member, "p_hiddenthread")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await readable(founder, "p_hiddenthread")).toMatchObject({
      post: { id: "p_hiddenthread" },
    });
    expect(await readable(admin, "p_hiddenthread")).toMatchObject({
      post: { id: "p_hiddenthread" },
    });
  });

  it("follows canSeeThread: a staff category is the site admins' only", async () => {
    const store = reactionStore();
    store.state.categories.push({
      ...SITE_CATEGORY,
      id: "cat_staff",
      key: "staff",
      visibility: "staff",
    });
    store.state.threads.push(threadRow("t_staff", "cat_staff", "u_member2"));
    store.state.posts.push(
      boardPost("p_staff", 1, { threadId: "t_staff", authorUserId: "u_member2" })
    );
    await expect(readable(null, "p_staff", store)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(readable(member, "p_staff", store)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await readable(admin, "p_staff", store)).toMatchObject({ post: { id: "p_staff" } });
  });

  it("follows canSeeThread: a Reports thread is its author's and the moderators' only", async () => {
    const store = reactionStore();
    store.state.categories.push({
      ...SITE_CATEGORY,
      id: "cat_reports",
      key: "reports",
      visibility: "reporter_staff",
    });
    store.state.threads.push(threadRow("t_report", "cat_reports", "u_member"));
    store.state.posts.push(
      boardPost("p_report", 1, { threadId: "t_report", authorUserId: "u_member" })
    );
    await expect(readable(null, "p_report", store)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(readable(visitor, "p_report", store)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await readable(member, "p_report", store)).toMatchObject({ post: { id: "p_report" } });
    expect(await readable(admin, "p_report", store)).toMatchObject({ post: { id: "p_report" } });
  });

  it("follows the realm rule: a post of a realm hidden from the viewer is theirs to see only as staff", async () => {
    await expect(readable(null, "p_draft")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await readable(admin, "p_draft")).toMatchObject({ realm: { slug: "draft" } });
  });
});

describe("loadReactablePost", () => {
  it("lets members, visitors, members without a nation, moderators and admins react to a thread post", async () => {
    for (const viewer of [member, visitor, plain, founder, admin]) {
      expect(await reactable(viewer, "p_hub")).toMatchObject({ board: false });
    }
    expect(await reactable(member, "p_site")).toMatchObject({ board: false, realm: null });
    expect(await reactable(member, "p_import")).toMatchObject({ post: { authorUserId: null } });
  });

  it("lets anyone who may post on the board react to a message", async () => {
    for (const viewer of [member, visitor, plain, founder, admin]) {
      expect(await reactable(viewer, "b1")).toMatchObject({ board: true });
    }
  });

  it("refuses your own post, your own persona post and your own board message", async () => {
    await expect(reactable(member, "p_mine")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/own post/i),
    });
    await expect(reactable(visitor, "p_persona")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reactable(member, "b_mine")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a hidden post or thread to the moderators who can read them, and finds nothing for a member", async () => {
    await expect(reactable(admin, "p_hidden")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reactable(admin, "p_hiddenthread")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reactable(founder, "b_hidden")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reactable(member, "p_hidden")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reactable(member, "b_hidden")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a message that continued in a thread", async () => {
    await expect(reactable(member, "b_continued")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses a locked or archived thread and an archived realm", async () => {
    await expect(reactable(member, "p_locked")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reactable(member, "p_archived")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reactable(member, "p_old")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reactable(member, "b_old")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses an archived realm to a site admin too, on a thread and on the board", async () => {
    await expect(reactable(admin, "p_old")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/archived/i),
    });
    await expect(reactable(admin, "b_old")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/archived/i),
    });
  });

  it("finds nothing in a realm hidden from the viewer, and for an unknown post", async () => {
    await expect(reactable(member, "p_draft")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reactable(member, "b_draft")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reactable(member, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a member banned from the realm, from the category or from the site, on a thread and on the board", async () => {
    const realmBan = reactionStore();
    realmBan.state.bans.push(ban({ userId: "u_banned", scope: "realm", scopeId: "r_eurth" }));
    await expect(reactable(banned, "p_hub", realmBan)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reactable(banned, "b1", realmBan)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const categoryBan = reactionStore();
    categoryBan.state.bans.push(
      ban({ userId: "u_member", scope: "category", scopeId: "cat_r_eurth_hub" })
    );
    await expect(reactable(member, "p_hub", categoryBan)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await reactable(member, "p_site", categoryBan)).toMatchObject({ board: false });

    const siteBan = reactionStore();
    siteBan.state.bans.push(ban({ userId: "u_plain", scope: "site" }));
    await expect(reactable(plain, "p_site", siteBan)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("never binds a site admin with a ban", async () => {
    const store = reactionStore();
    store.state.bans.push(ban({ userId: "u_admin", scope: "site" }));
    expect(await reactable(admin, "p_hub", store)).toMatchObject({ board: false });
  });

  it("refuses a visitor while the realm's board is closed to visitors, and still lets a member react", async () => {
    const store = reactionStore();
    Object.assign(
      store.state.realms.find((r) => r.id === "r_eurth")!,
      {
        boardVisitorsAllowed: false,
      }
    );
    await expect(reactable(visitor, "b1", store)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await reactable(member, "b1", store)).toMatchObject({ board: true });
    // The visitor setting is the board's: a visitor still reacts to a thread post.
    expect(await reactable(visitor, "p_hub", store)).toMatchObject({ board: false });
  });
});

describe("threadReactable", () => {
  const open = { locked: false, archived: false, hidden: false };
  const realm = (status: string): ForumRealm => ({
    id: "r1",
    slug: "r",
    name: "R",
    status,
    ownerId: "o",
  });

  it("is on for a signed-in viewer on an open, visible thread of an open realm", () => {
    expect(threadReactable(member as never, open, false, null)).toBe(true);
    expect(threadReactable(member as never, open, false, realm("active"))).toBe(true);
  });

  it("is off for a signed-out viewer, a ban, a closed or hidden thread and an archived realm", () => {
    expect(threadReactable(null, open, false, null)).toBe(false);
    expect(threadReactable(member as never, open, true, null)).toBe(false);
    expect(threadReactable(member as never, { ...open, locked: true }, false, null)).toBe(false);
    expect(threadReactable(member as never, { ...open, archived: true }, false, null)).toBe(false);
    expect(threadReactable(member as never, { ...open, hidden: true }, false, null)).toBe(false);
    expect(threadReactable(member as never, open, false, realm("archived"))).toBe(false);
  });
});
