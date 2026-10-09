/** @jest-environment node */
import {
  modEditPost,
  moveThread,
  setPostHidden,
  setThreadFlag,
  type ThreadFlag,
} from "~/server/modules/thinkpages-forum";
import { detailOf, forumStore, type Row } from "~/tests/helpers/forum-store-fake";

const USER_ROLE = { name: "user", level: 100 };
const admin = {
  id: "u_a",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};
const member = { id: "u_m", clerkUserId: "member", countryId: "c1", role: USER_ROLE };
const moderatorOf = (id: string, realmIds: string[], categoryIds: string[] = []) => ({
  id,
  clerkUserId: id,
  countryId: null,
  role: USER_ROLE,
  mod: { siteAdmin: false, realmIds, categoryIds },
});
const eurthMod = moderatorOf("u_eurth", ["r_eurth"]);
const oldMod = moderatorOf("u_old", ["r_old"]);
const generalMod = moderatorOf("u_gen", [], ["cat_general"]);

const at = (minute: number) => new Date(Date.UTC(2026, 9, 9, 12, minute));

const site = (id: string, key: string, extra: Row = {}): Row => ({
  id,
  key,
  name: key,
  scope: "site",
  realmId: null,
  visibility: "public",
  postRole: "any",
  icAllowed: false,
  ...extra,
});
const realmCat = (realmId: string, key: string, icAllowed = false): Row => ({
  id: `${realmId}_${key}`,
  key,
  name: key,
  scope: "realm",
  realmId,
  visibility: "public",
  postRole: "any",
  icAllowed,
});
const categories: Row[] = [
  site("cat_general", "general"),
  site("cat_find", "find-a-realm"),
  site("cat_side", "side-games", { icAllowed: true }),
  site("cat_reports", "reports", { visibility: "reporter_staff" }),
  realmCat("r_eurth", "hub"),
  realmCat("r_eurth", "character-threads", true),
  realmCat("r_eurth", "current-events", true),
  realmCat("r_aurora", "hub"),
  realmCat("r_old", "hub"),
];
const realms: Row[] = [
  { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" },
  { id: "r_aurora", slug: "aurora", name: "Aurora", status: "active", ownerId: "aurora_founder" },
  { id: "r_old", slug: "old", name: "Old", status: "archived", ownerId: "old_founder" },
];

const thread = (id: string, categoryId: string, extra: Row = {}): Row => ({
  id,
  categoryId,
  title: `Thread ${id}`,
  authorUserId: "u_m",
  authorPersonaId: null,
  pinned: false,
  locked: false,
  hidden: false,
  archived: false,
  postCount: 3,
  lastPostAt: at(2),
  createdAt: at(0),
  ...extra,
});
const post = (id: string, threadId: string, minute: number, extra: Row = {}): Row => ({
  id,
  threadId,
  authorUserId: "u_m",
  authorPersonaId: null,
  contentHtml: `<p>Post ${id}</p>`,
  plainText: `Post ${id}`,
  hidden: false,
  editedAt: null,
  createdAt: at(minute),
  ...extra,
});
const report = (id: string, targetType: string, targetId: string, extra: Row = {}): Row => ({
  id,
  targetType,
  targetId,
  categoryId: "r_eurth_hub",
  reporterId: "u_r",
  reason: "Spam",
  status: "open",
  createdAt: at(5),
  ...extra,
});

const seed = () => ({
  categories,
  realms,
  threads: [
    thread("t_general", "cat_general"),
    thread("t_eurth", "r_eurth_hub", { postCount: 2, lastPostAt: at(1) }),
    thread("t_persona", "r_eurth_character-threads", { authorPersonaId: "persona1", postCount: 1 }),
    thread("t_mixed", "r_eurth_character-threads", { postCount: 2 }),
    thread("t_old", "r_old_hub", { postCount: 2, lastPostAt: at(1) }),
  ],
  posts: [
    post("p_g1", "t_general", 0),
    post("p_g2", "t_general", 1),
    post("p_g3", "t_general", 2),
    post("p_e1", "t_eurth", 0),
    post("p_e2", "t_eurth", 1),
    post("p_pc1", "t_persona", 0, { authorPersonaId: "persona1" }),
    post("p_m1", "t_mixed", 0),
    post("p_m2", "t_mixed", 1, { authorPersonaId: "persona2" }),
    post("p_o1", "t_old", 0),
    post("p_o2", "t_old", 1),
  ],
  reports: [
    report("rep_thread", "thread", "t_eurth"),
    report("rep_post", "post", "p_e2"),
    report("rep_done", "post", "p_e2", { status: "resolved" }),
    report("rep_other", "thread", "t_general", { categoryId: "cat_general" }),
  ],
  links: [{ id: "l1", postSource: "native", postRef: "p_e1", activityId: "act1", storyline: null }],
});

type Store = ReturnType<typeof forumStore>;
const threadIn = (store: Store, id: string) => store.state.threads.find((t) => t.id === id)!;
const postIn = (store: Store, id: string) => store.state.posts.find((p) => p.id === id)!;

/** Every action writes its log row through the transaction client, never through the outer client. */
function expectOneLog(store: Store, row: Row): Row {
  expect(store.logs).toHaveLength(1);
  expect(store.logs[0]).toMatchObject(row);
  expect(store.db.forumModLog.create).not.toHaveBeenCalled();
  return detailOf(store.logs[0]);
}

describe("setThreadFlag", () => {
  it("locks a thread and logs thread.lock through the transaction", async () => {
    const store = forumStore(seed());
    await setThreadFlag(store.db as never, admin, {
      threadId: "t_general",
      flag: "locked",
      value: true,
      note: " flame war ",
    });
    expect(threadIn(store, "t_general").locked).toBe(true);
    const detail = expectOneLog(store, {
      actorId: "u_a",
      action: "thread.lock",
      targetType: "thread",
      targetId: "t_general",
      scope: "category",
      scopeId: "cat_general",
    });
    expect(detail).toEqual({ note: "flame war", from: false, to: true });
  });

  it.each<[ThreadFlag, string]>([
    ["locked", "lock"],
    ["pinned", "pin"],
    ["hidden", "hide"],
    ["archived", "archive"],
  ])("sets and clears %s, logging thread.%s and its undo", async (flag, verb) => {
    const store = forumStore(seed());
    await setThreadFlag(store.db as never, admin, { threadId: "t_general", flag, value: true });
    expect(threadIn(store, "t_general")[flag]).toBe(true);
    await setThreadFlag(store.db as never, admin, { threadId: "t_general", flag, value: false });
    expect(threadIn(store, "t_general")[flag]).toBe(false);
    expect(store.logs.map((l) => l.action)).toEqual([`thread.${verb}`, `thread.un${verb}`]);
  });

  it("refuses a no-op as CONFLICT and logs nothing", async () => {
    const store = forumStore(seed());
    await expect(
      setThreadFlag(store.db as never, admin, {
        threadId: "t_general",
        flag: "pinned",
        value: false,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.logs).toHaveLength(0);
  });

  it("archiving makes a thread read-only and never hides it (T0-8)", async () => {
    const store = forumStore(seed());
    await setThreadFlag(store.db as never, admin, {
      threadId: "t_general",
      flag: "archived",
      value: true,
    });
    expect(threadIn(store, "t_general")).toMatchObject({ archived: true, hidden: false });
  });

  it("a realm moderator locking a sitewide thread is FORBIDDEN", async () => {
    const store = forumStore(seed());
    await expect(
      setThreadFlag(store.db as never, eurthMod, {
        threadId: "t_general",
        flag: "locked",
        value: true,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(threadIn(store, "t_general").locked).toBe(false);
    expect(store.db.$transaction).not.toHaveBeenCalled();
  });

  it("a realm moderator acts in their realm and logs at the realm's scope", async () => {
    const store = forumStore(seed());
    await setThreadFlag(store.db as never, eurthMod, {
      threadId: "t_eurth",
      flag: "locked",
      value: true,
    });
    expectOneLog(store, { actorId: "u_eurth", scope: "realm", scopeId: "r_eurth" });
  });

  it("a category moderator acts in their category only", async () => {
    const store = forumStore(seed());
    await setThreadFlag(store.db as never, generalMod, {
      threadId: "t_general",
      flag: "pinned",
      value: true,
    });
    expect(threadIn(store, "t_general").pinned).toBe(true);
    await expect(
      setThreadFlag(store.db as never, generalMod, {
        threadId: "t_eurth",
        flag: "pinned",
        value: true,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([
    ["a member", member],
    ["anonymous", null],
  ])("%s is FORBIDDEN", async (_label, viewer) => {
    const store = forumStore(seed());
    await expect(
      setThreadFlag(store.db as never, viewer, {
        threadId: "t_general",
        flag: "locked",
        value: true,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("an archived realm's moderator still acts in its section (T0-6)", async () => {
    const store = forumStore(seed());
    await setThreadFlag(store.db as never, oldMod, {
      threadId: "t_old",
      flag: "hidden",
      value: true,
    });
    expect(threadIn(store, "t_old").hidden).toBe(true);
    expectOneLog(store, { action: "thread.hide", scope: "realm", scopeId: "r_old" });
  });

  it("a missing thread is NOT_FOUND; an overlong note is BAD_REQUEST", async () => {
    const store = forumStore(seed());
    await expect(
      setThreadFlag(store.db as never, admin, { threadId: "nope", flag: "locked", value: true })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      setThreadFlag(store.db as never, admin, {
        threadId: "t_general",
        flag: "locked",
        value: true,
        note: "x".repeat(1001),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(store.logs).toHaveLength(0);
  });
});

describe("moveThread", () => {
  it("moves within the realm, re-points open reports on the thread and its posts, and logs the move", async () => {
    const store = forumStore(seed());
    await moveThread(store.db as never, eurthMod, {
      threadId: "t_eurth",
      to: { key: "current-events", realm: "eurth" },
      note: "in character",
    });
    expect(threadIn(store, "t_eurth").categoryId).toBe("r_eurth_current-events");
    const categoryOf = (id: string) => store.state.reports.find((r) => r.id === id)!.categoryId;
    expect(categoryOf("rep_thread")).toBe("r_eurth_current-events");
    expect(categoryOf("rep_post")).toBe("r_eurth_current-events");
    expect(categoryOf("rep_done")).toBe("r_eurth_hub");
    expect(categoryOf("rep_other")).toBe("cat_general");
    const detail = expectOneLog(store, {
      action: "thread.move",
      targetType: "thread",
      targetId: "t_eurth",
      scope: "realm",
      scopeId: "r_eurth",
    });
    expect(detail).toEqual({
      note: "in character",
      from: "r_eurth_hub",
      to: "r_eurth_current-events",
    });
  });

  it("never touches categories or action links (T0-7)", async () => {
    const store = forumStore(seed());
    await moveThread(store.db as never, admin, {
      threadId: "t_general",
      to: { key: "find-a-realm" },
    });
    expect(threadIn(store, "t_general").categoryId).toBe("cat_find");
    expect(store.state.categories).toEqual(seed().categories);
    expect(store.state.links).toEqual(seed().links);
  });

  it("moving Eurth's thread into Aurora's Hub by Eurth's moderator is FORBIDDEN", async () => {
    const store = forumStore(seed());
    await expect(
      moveThread(store.db as never, eurthMod, {
        threadId: "t_eurth",
        to: { key: "hub", realm: "aurora" },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(threadIn(store, "t_eurth").categoryId).toBe("r_eurth_hub");
    expect(store.logs).toHaveLength(0);
  });

  it("needs the moderator's scope on the destination as well as the source", async () => {
    const store = forumStore(seed());
    await expect(
      moveThread(store.db as never, generalMod, {
        threadId: "t_general",
        to: { key: "find-a-realm" },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      moveThread(store.db as never, eurthMod, {
        threadId: "t_general",
        to: { key: "hub", realm: "eurth" },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps a thread in its own section, even for a site admin", async () => {
    const store = forumStore(seed());
    await expect(
      moveThread(store.db as never, admin, {
        threadId: "t_eurth",
        to: { key: "hub", realm: "aurora" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      moveThread(store.db as never, admin, {
        threadId: "t_general",
        to: { key: "hub", realm: "eurth" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(threadIn(store, "t_general").categoryId).toBe("cat_general");
  });

  it("never moves a thread into a category with a different audience (a Reports thread stays private)", async () => {
    const store = forumStore(seed());
    await expect(
      moveThread(store.db as never, admin, { threadId: "t_general", to: { key: "reports" } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(threadIn(store, "t_general").categoryId).toBe("cat_general");
  });

  it("a persona thread cannot move to an out-of-character category", async () => {
    const store = forumStore(seed());
    await expect(
      moveThread(store.db as never, eurthMod, {
        threadId: "t_persona",
        to: { key: "hub", realm: "eurth" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await moveThread(store.db as never, eurthMod, {
      threadId: "t_persona",
      to: { key: "current-events", realm: "eurth" },
    });
    expect(threadIn(store, "t_persona").categoryId).toBe("r_eurth_current-events");
  });

  it("an in-character reply also keeps the thread out of out-of-character categories", async () => {
    const store = forumStore(seed());
    await expect(
      moveThread(store.db as never, eurthMod, {
        threadId: "t_mixed",
        to: { key: "hub", realm: "eurth" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("moving into the category it is already in is CONFLICT; an unknown destination NOT_FOUND", async () => {
    const store = forumStore(seed());
    await expect(
      moveThread(store.db as never, admin, { threadId: "t_general", to: { key: "general" } })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      moveThread(store.db as never, admin, { threadId: "t_general", to: { key: "nowhere" } })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.logs).toHaveLength(0);
  });

  it("a move that lost a race with another move is CONFLICT and changes nothing", async () => {
    const store = forumStore(seed());
    const run = store.db.$transaction.getMockImplementation()!;
    store.db.$transaction.mockImplementationOnce(async (fn) => {
      threadIn(store, "t_general").categoryId = "cat_side";
      return run(fn);
    });
    await expect(
      moveThread(store.db as never, admin, { threadId: "t_general", to: { key: "find-a-realm" } })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(threadIn(store, "t_general").categoryId).toBe("cat_side");
    expect(store.logs).toHaveLength(0);
  });

  it("an archived realm's moderator moves within its section (T0-6)", async () => {
    const store = forumStore({
      ...seed(),
      categories: [...categories, realmCat("r_old", "character-threads", true)],
    });
    await moveThread(store.db as never, oldMod, {
      threadId: "t_old",
      to: { key: "character-threads", realm: "old" },
    });
    expect(threadIn(store, "t_old").categoryId).toBe("r_old_character-threads");
  });
});

describe("setPostHidden", () => {
  it("hiding the last post drops postCount and moves lastPostAt back; unhiding restores both", async () => {
    const store = forumStore(seed());
    await setPostHidden(store.db as never, admin, { postId: "p_g3", hidden: true, note: "spam" });
    expect(postIn(store, "p_g3").hidden).toBe(true);
    expect(threadIn(store, "t_general")).toMatchObject({ postCount: 2, lastPostAt: at(1) });
    const detail = expectOneLog(store, {
      action: "post.hide",
      targetType: "post",
      targetId: "p_g3",
      scope: "category",
      scopeId: "cat_general",
    });
    expect(detail).toMatchObject({ note: "spam", threadId: "t_general" });

    await setPostHidden(store.db as never, admin, { postId: "p_g3", hidden: false });
    expect(threadIn(store, "t_general")).toMatchObject({ postCount: 3, lastPostAt: at(2) });
    expect(store.logs.map((l) => l.action)).toEqual(["post.hide", "post.unhide"]);
  });

  it("hiding a middle post drops postCount and keeps lastPostAt", async () => {
    const store = forumStore(seed());
    await setPostHidden(store.db as never, admin, { postId: "p_g2", hidden: true });
    expect(threadIn(store, "t_general")).toMatchObject({ postCount: 2, lastPostAt: at(2) });
  });

  it("counts follow the visible posts even when the stored count had drifted", async () => {
    const store = forumStore(seed());
    threadIn(store, "t_general").postCount = 7;
    await setPostHidden(store.db as never, admin, { postId: "p_g2", hidden: true });
    expect(threadIn(store, "t_general").postCount).toBe(2);
  });

  it("locks the thread row before changing the post, so a concurrent reply's count is never lost", async () => {
    const store = forumStore(seed());
    await setPostHidden(store.db as never, admin, { postId: "p_g2", hidden: true });
    const [strings, threadId] = store.tx.$executeRaw.mock.calls[0] as never as [
      TemplateStringsArray,
      string,
    ];
    expect(strings.join("?")).toBe(
      'SELECT 1 FROM "forum_threads" WHERE "id" = ? FOR NO KEY UPDATE'
    );
    expect(threadId).toBe("t_general");
    expect(store.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      store.tx.forumPost.updateMany.mock.invocationCallOrder[0]!
    );
  });

  it("hiding the first post is refused: hide the thread instead", async () => {
    const store = forumStore(seed());
    await expect(
      setPostHidden(store.db as never, admin, { postId: "p_g1", hidden: true })
    ).rejects.toMatchObject({ code: "CONFLICT", message: "Hide the thread instead." });
    expect(postIn(store, "p_g1").hidden).toBe(false);
  });

  it("hiding a hidden post is CONFLICT and changes nothing", async () => {
    const store = forumStore(seed());
    postIn(store, "p_g3").hidden = true;
    await expect(
      setPostHidden(store.db as never, admin, { postId: "p_g3", hidden: true })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(threadIn(store, "t_general")).toMatchObject({ postCount: 3, lastPostAt: at(2) });
    expect(store.logs).toHaveLength(0);
  });

  it("is scoped: Eurth's moderator cannot hide a sitewide post, a missing post is NOT_FOUND", async () => {
    const store = forumStore(seed());
    await expect(
      setPostHidden(store.db as never, eurthMod, { postId: "p_g2", hidden: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      setPostHidden(store.db as never, admin, { postId: "nope", hidden: true })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("an archived realm's moderator hides a post there (T0-6)", async () => {
    const store = forumStore(seed());
    await setPostHidden(store.db as never, oldMod, { postId: "p_o2", hidden: true });
    expect(threadIn(store, "t_old")).toMatchObject({ postCount: 1, lastPostAt: at(0) });
    expectOneLog(store, { action: "post.hide", scope: "realm", scopeId: "r_old" });
  });
});

describe("modEditPost", () => {
  it("replaces the body, marks it edited and logs the previous text", async () => {
    const store = forumStore(seed());
    await modEditPost(store.db as never, eurthMod, {
      postId: "p_e2",
      html: "<p>Cleaned up <script>x</script></p>",
      note: "removed slur",
    });
    const edited = postIn(store, "p_e2");
    expect(edited).toMatchObject({ contentHtml: "<p>Cleaned up </p>", plainText: "Cleaned up" });
    expect(edited.editedAt).toBeInstanceOf(Date);
    const detail = expectOneLog(store, {
      action: "post.edit",
      targetType: "post",
      targetId: "p_e2",
      scope: "realm",
      scopeId: "r_eurth",
    });
    expect(detail).toEqual({ note: "removed slur", previous: "Post p_e2" });
  });

  it.each(["submitted", "approved"])(
    "refuses a post in a %s story chain (P6, M17)",
    async (status) => {
      const store = forumStore({
        ...seed(),
        links: [
          {
            id: "l1",
            postSource: "native",
            postRef: "p_e1",
            activityId: "act1",
            storyline: { status },
          },
        ],
      });
      store.state.posts.find((p) => p.id === "p_e1")!.plainText = "See [ixaction=act1]";
      await expect(
        modEditPost(store.db as never, eurthMod, {
          postId: "p_e1",
          html: "<p>See [ixaction=act1]</p>",
          note: "fix",
        })
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringContaining("Hide it instead"),
      });
      expect(postIn(store, "p_e1").editedAt).toBeNull();
      expect(store.logs).toHaveLength(0);
    }
  );

  it("a draft chain does not block the edit", async () => {
    const store = forumStore({
      ...seed(),
      links: [
        {
          id: "l1",
          postSource: "native",
          postRef: "p_e1",
          activityId: "act1",
          storyline: { status: "draft" },
        },
      ],
    });
    postIn(store, "p_e1").plainText = "See [ixaction=act1]";
    await modEditPost(store.db as never, admin, {
      postId: "p_e1",
      html: "<p>See [ixaction=act1] again</p>",
      note: "typo",
    });
    expect(store.state.links).toHaveLength(1);
  });

  it("removing a token drops its link in the same transaction; adding one is refused", async () => {
    const store = forumStore(seed());
    postIn(store, "p_e1").plainText = "See [ixaction=act1]";
    await expect(
      modEditPost(store.db as never, admin, {
        postId: "p_e1",
        html: "<p>See [ixaction=act1] and [ixaction=act2]</p>",
        note: "x",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await modEditPost(store.db as never, admin, {
      postId: "p_e1",
      html: "<p>See nothing</p>",
      note: "x",
    });
    expect(store.state.links).toHaveLength(0);
    expect(store.tx.postActionLink.deleteMany).toHaveBeenCalledWith({
      where: { postSource: "native", postRef: "p_e1", activityId: { notIn: [] } },
    });
  });

  it("needs a note, a valid body and the moderator's scope", async () => {
    const store = forumStore(seed());
    await expect(
      modEditPost(store.db as never, admin, { postId: "p_e2", html: "<p>ok</p>", note: "  " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      modEditPost(store.db as never, admin, { postId: "p_e2", html: "<p></p>", note: "x" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      modEditPost(store.db as never, eurthMod, { postId: "p_g2", html: "<p>ok</p>", note: "x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      modEditPost(store.db as never, member, { postId: "p_e2", html: "<p>ok</p>", note: "x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(postIn(store, "p_e2").plainText).toBe("Post p_e2");
  });

  it("an archived realm's moderator edits there (T0-6)", async () => {
    const store = forumStore(seed());
    await modEditPost(store.db as never, oldMod, {
      postId: "p_o2",
      html: "<p>tidied</p>",
      note: "x",
    });
    expect(postIn(store, "p_o2").plainText).toBe("tidied");
  });
});
