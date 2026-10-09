/** @jest-environment node */
import {
  moveThread,
  setPostHidden,
  setThreadFlag,
  type ThreadFlag,
} from "~/server/modules/thinkpages-forum";
import {
  admin,
  at,
  categories,
  eurthMod,
  expectOneLog,
  generalMod,
  member,
  oldMod,
  postIn,
  realmCat,
  seed,
  threadIn,
} from "~/tests/helpers/forum-mod-fixtures";
import { forumStore } from "~/tests/helpers/forum-store-fake";

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

  it("finds the first post oldest first, ties by id", async () => {
    const store = forumStore(seed());
    await setPostHidden(store.db as never, admin, { postId: "p_g2", hidden: true });
    expect(store.db.forumPost.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { threadId: "t_general" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
    );
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

describe("content a site admin wrote", () => {
  const flags = ["locked", "pinned", "hidden", "archived"] as const;

  it.each(flags)(
    "a realm moderator setting %s on a site admin's thread is FORBIDDEN",
    async (flag) => {
      const store = forumStore(seed());
      await expect(
        setThreadFlag(store.db as never, eurthMod, { threadId: "t_admin", flag, value: true })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(threadIn(store, "t_admin")[flag]).toBe(false);
      expect(store.logs).toHaveLength(0);
    }
  );

  it("a realm moderator can't move or hide in a site admin's content", async () => {
    const store = forumStore(seed());
    await expect(
      moveThread(store.db as never, eurthMod, {
        threadId: "t_admin",
        to: { key: "current-events", realm: "eurth" },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      setPostHidden(store.db as never, eurthMod, { postId: "p_a2", hidden: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(threadIn(store, "t_admin").categoryId).toBe("r_eurth_hub");
    expect(postIn(store, "p_a2").hidden).toBe(false);
  });

  it("a member's reply in a site admin's thread stays the realm moderator's to hide", async () => {
    const store = forumStore(seed());
    await setPostHidden(store.db as never, eurthMod, { postId: "p_a3", hidden: true });
    expect(postIn(store, "p_a3").hidden).toBe(true);
  });

  it("another site admin may act on it, with no author lookup", async () => {
    const store = forumStore(seed());
    await setThreadFlag(store.db as never, admin, {
      threadId: "t_admin",
      flag: "locked",
      value: true,
    });
    await setPostHidden(store.db as never, admin, { postId: "p_a2", hidden: true });
    await moveThread(store.db as never, admin, {
      threadId: "t_admin",
      to: { key: "current-events", realm: "eurth" },
    });
    expect(store.logs.map((l) => l.action)).toEqual(["thread.lock", "post.hide", "thread.move"]);
    expect(store.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("looks the author up by User.id", async () => {
    const store = forumStore(seed());
    await setThreadFlag(store.db as never, eurthMod, {
      threadId: "t_eurth",
      flag: "locked",
      value: true,
    });
    expect(store.db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u_m" } })
    );
  });

  it("an author whose user row is gone does not block the moderator", async () => {
    const store = forumStore({ ...seed(), users: [] });
    await setThreadFlag(store.db as never, eurthMod, {
      threadId: "t_eurth",
      flag: "locked",
      value: true,
    });
    expect(threadIn(store, "t_eurth").locked).toBe(true);
  });
});
