/** @jest-environment node */
/**
 * Phase 4 (XenForo import): a thread or post whose XenForo author has no IxStats account has a null `authorUserId`
 * and keeps `importedAuthorName`. A null author is never queried, never the viewer, never sanctionable, and its
 * content is moderable by any moderator of the category (it is not a site admin's).
 */
import {
  authorsOf,
  canSeeThread,
  editPost,
  getCategoryThreads,
  getThreadPosts,
  modEditPost,
  setPostHidden,
  setThreadFlag,
} from "~/server/modules/thinkpages-forum";
import {
  admin,
  eurthMod,
  generalMod,
  member,
  post,
  postIn,
  seed,
  thread,
  threadIn,
} from "~/tests/helpers/forum-mod-fixtures";
import { forumStore } from "~/tests/helpers/forum-store-fake";

const IMPORTED = { authorUserId: null, importedAuthorName: "OldName" };

/** The moderator fixtures plus an imported thread in Eurth's Hub and an imported reply in General. */
function importedStore() {
  const base = seed();
  return forumStore({
    ...base,
    threads: [...base.threads, thread("t_imported", "r_eurth_hub", IMPORTED)],
    posts: [
      ...base.posts,
      post("p_i1", "t_imported", 0, IMPORTED),
      post("p_i2", "t_imported", 1, IMPORTED),
      post("p_g_imported", "t_general", 3, IMPORTED),
    ],
  });
}

interface SelectArgs {
  select: Record<string, boolean>;
}
const selectOf = (mock: jest.Mock): Record<string, boolean> =>
  (mock.mock.calls[0] as [SelectArgs])[0].select;

describe("authorsOf with imported authors", () => {
  it("queries only real user ids, skipping null and undefined", async () => {
    const store = importedStore();
    await authorsOf(store.db as never, [null, "u_m", undefined, null, "u_m"], []);
    expect(store.db.user.findMany).toHaveBeenCalledTimes(1);
    expect(store.db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["u_m"] } } })
    );
  });

  it("spends no user query on a page of imported authors only", async () => {
    const store = importedStore();
    const out = await authorsOf(store.db as never, [null, null], [null]);
    expect(store.db.user.findMany).not.toHaveBeenCalled();
    expect(out.users.size).toBe(0);
  });
});

describe("reads carry the imported author name", () => {
  it("selects importedAuthorName for a thread's posts and returns a null-author thread as such", async () => {
    const store = importedStore();
    const out = await getThreadPosts(store.db as never, member, "t_imported", 1);
    expect(selectOf(store.db.forumPost.findMany)).toMatchObject({
      authorUserId: true,
      importedAuthorName: true,
    });
    expect(out.thread).toMatchObject({ authorUserId: null, importedAuthorName: "OldName" });
    expect(out.posts[0]).toMatchObject({ authorUserId: null, importedAuthorName: "OldName" });
  });

  it("selects importedAuthorName for a category's threads", async () => {
    const store = importedStore();
    const out = await getCategoryThreads(
      store.db as never,
      member,
      { key: "hub", realm: "eurth" },
      1
    );
    expect(selectOf(store.db.forumThread.findMany)).toMatchObject({
      authorUserId: true,
      importedAuthorName: true,
    });
    expect(out.threads.find((t) => t.id === "t_imported")).toMatchObject(IMPORTED);
  });
});

describe("canSeeThread with a null author", () => {
  const reports = {
    id: "cat_reports",
    scope: "site",
    realmId: null,
    visibility: "reporter_staff",
  };
  const imported = { authorUserId: null, hidden: false };

  it("keeps a Reports thread without an author to the category's moderators", () => {
    expect(canSeeThread(member, imported, reports)).toBe(false);
    expect(canSeeThread(null, imported, reports)).toBe(false);
    expect(canSeeThread(admin, imported, reports)).toBe(true);
  });

  it("shows a public thread without an author to everyone", () => {
    const general = { ...reports, id: "cat_general", visibility: "public" };
    expect(canSeeThread(null, imported, general)).toBe(true);
    expect(canSeeThread(member, imported, general)).toBe(true);
  });
});

describe("moderating content without an IxStats author", () => {
  it("lets a realm moderator hide and unhide an imported post without looking up its author", async () => {
    const store = importedStore();
    await setPostHidden(store.db as never, eurthMod, { postId: "p_i2", hidden: true });
    expect(postIn(store, "p_i2").hidden).toBe(true);
    await setPostHidden(store.db as never, eurthMod, { postId: "p_i2", hidden: false });
    expect(postIn(store, "p_i2").hidden).toBe(false);
    expect(store.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("lets a category moderator lock an imported thread", async () => {
    const store = importedStore();
    await setThreadFlag(store.db as never, eurthMod, {
      threadId: "t_imported",
      flag: "locked",
      value: true,
    });
    expect(threadIn(store, "t_imported").locked).toBe(true);
    expect(store.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("lets a category moderator edit an imported post", async () => {
    const store = importedStore();
    await modEditPost(store.db as never, generalMod, {
      postId: "p_g_imported",
      html: "<p>Tidied</p>",
      note: "Formatting",
    });
    expect(postIn(store, "p_g_imported").plainText).toBe("Tidied");
    expect(store.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("still keeps the actor to the categories they moderate", async () => {
    const store = importedStore();
    await expect(
      setPostHidden(store.db as never, generalMod, { postId: "p_i2", hidden: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(postIn(store, "p_i2").hidden).toBe(false);
  });
});

describe("editPost on an imported post", () => {
  it("is the author's only, and an imported post has none", async () => {
    const store = importedStore();
    await expect(
      editPost(store.db as never, member, { postId: "p_g_imported", html: "<p>Mine now</p>" })
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Only the author can edit this post." });
    expect(postIn(store, "p_g_imported").plainText).toBe("Post p_g_imported");
  });
});
