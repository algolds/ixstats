/** @jest-environment node */
const mockSendNotices = jest.fn();
jest.mock("~/server/modules/thinkpages-forum/forum-notices", () => ({
  sendForumNotices: (...args: object[]) => mockSendNotices(...args),
}));

import {
  moveThread,
  setPostHidden,
  setThreadFlag,
  type ThreadFlag,
} from "~/server/modules/thinkpages-forum";
import {
  admin,
  at,
  eurthMod,
  expectOneLog,
  generalMod,
  member,
  moderatorOf,
  post,
  postIn,
  realmCat,
  seed,
  site,
  thread,
  threadIn,
} from "~/tests/helpers/forum-mod-fixtures";
import { forumStore } from "~/tests/helpers/forum-store-fake";
import { modEditPost } from "~/server/modules/thinkpages-forum";
import { locateBanScope } from "~/server/modules/thinkpages-forum";

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

  it.each([["a member", member]])("%s is FORBIDDEN", async (_label, viewer) => {
    const store = forumStore(seed());
    await expect(
      setThreadFlag(store.db as never, viewer, {
        threadId: "t_general",
        flag: "locked",
        value: true,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
  it("frees the realm's advert slot when an advert moves out of Find a Realm, and leaves other moves alone", async () => {
    const base = seed();
    const store = forumStore({
      ...base,
      threads: [
        ...base.threads,
        thread("t_ad", "cat_find", { advertRealmId: "r_eurth" }),
        thread("t_ad2", "cat_find", { advertRealmId: "r_aurora" }),
      ],
    });
    await moveThread(store.db as never, admin, { threadId: "t_ad", to: { key: "general" } });
    expect(threadIn(store, "t_ad").categoryId).toBe("cat_general");
    expect(threadIn(store, "t_ad").advertRealmId).toBeNull();
    expect(threadIn(store, "t_ad2").advertRealmId).toBe("r_aurora");
    await moveThread(store.db as never, admin, {
      threadId: "t_general",
      to: { key: "side-games" },
    });
    expect(threadIn(store, "t_general")).not.toHaveProperty("advertRealmId");
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
  it("is scoped: Eurth's moderator cannot hide a sitewide post, a missing post is NOT_FOUND", async () => {
    const store = forumStore(seed());
    await expect(
      setPostHidden(store.db as never, eurthMod, { postId: "p_g2", hidden: true })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      setPostHidden(store.db as never, admin, { postId: "nope", hidden: true })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("content in a category the moderator can't read (M8)", () => {
  // A non-admin an admin appointed on the staff-only category moderates it but can't read it.
  const staffMod = moderatorOf("u_staffmod", [], ["cat_staff"]);
  const staffStore = () => {
    const base = seed();
    return forumStore({
      ...base,
      categories: [...base.categories, site("cat_staff", "staff", { visibility: "staff" })],
      threads: [...base.threads, thread("t_staff", "cat_staff")],
      posts: [...base.posts, post("p_staff_first", "t_staff", 0), post("p_staff", "t_staff", 1)],
    });
  };

  it("is out of reach: hide, lock or unhide answer NOT_FOUND and write nothing", async () => {
    const store = staffStore();
    const refusals = [
      setPostHidden(store.db as never, staffMod, { postId: "p_staff", hidden: true }),
      setThreadFlag(store.db as never, staffMod, {
        threadId: "t_staff",
        flag: "hidden",
        value: true,
      }),
      setThreadFlag(store.db as never, staffMod, {
        threadId: "t_staff",
        flag: "locked",
        value: true,
      }),
    ];
    for (const refusal of refusals) {
      await expect(refusal).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(store.logs).toEqual([]);
  });
});

describe("the advert of a realm the moderator can't see", () => {
  // A non-admin appointed on Find a Realm moderates the category but not a draft realm's advert.
  const findMod = moderatorOf("u_findmod", [], ["cat_find"]);
  const advertStore = () => {
    const base = seed();
    return forumStore({
      ...base,
      realms: [
        ...base.realms,
        { id: "r_draft", slug: "draft", name: "Draft", status: "draft", ownerId: "draft_founder" },
      ],
      threads: [
        ...base.threads,
        thread("t_ad_draft", "cat_find", { advertRealmId: "r_draft" }),
        thread("t_ad_eurth", "cat_find", { advertRealmId: "r_eurth" }),
      ],
      posts: [
        ...base.posts,
        post("p_ad_draft_first", "t_ad_draft", 0),
        post("p_ad_draft", "t_ad_draft", 1),
        post("p_ad_eurth_first", "t_ad_eurth", 0),
        post("p_ad_eurth", "t_ad_eurth", 1),
      ],
    });
  };

  it("answers NOT_FOUND to hide, lock and post hide, and writes nothing", async () => {
    const store = advertStore();
    const refusals = [
      setThreadFlag(store.db as never, findMod, {
        threadId: "t_ad_draft",
        flag: "hidden",
        value: true,
      }),
      setThreadFlag(store.db as never, findMod, {
        threadId: "t_ad_draft",
        flag: "locked",
        value: true,
      }),
      setPostHidden(store.db as never, findMod, { postId: "p_ad_draft", hidden: true }),
    ];
    for (const refusal of refusals) {
      await expect(refusal).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(store.logs).toEqual([]);
  });
});

describe("content a site admin wrote", () => {
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
});
describe("the realm board thread", () => {
  function boardStore() {
    const state = seed();
    state.categories = [
      ...state.categories,
      { ...realmCat("r_eurth", "board", true), id: "r_eurth_board", style: "board" },
    ];
    state.threads = [...state.threads, thread("t_board", "r_eurth_board", { postCount: 2 })];
    state.posts = [...state.posts, post("p_b1", "t_board", 0), post("p_b2", "t_board", 1)];
    return forumStore(state);
  }

  it.each<ThreadFlag>(["hidden"])(
    "refuses to set %s, even for a site admin, and writes nothing",
    async (flag) => {
      const store = boardStore();
      await expect(
        setThreadFlag(store.db as never, admin, { threadId: "t_board", flag, value: true })
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "The realm board can't be moved, hidden, archived or locked.",
      });
      expect(threadIn(store, "t_board")[flag]).toBe(false);
      expect(store.logs).toHaveLength(0);
    }
  );

  it("refuses to move the board thread to another category", async () => {
    const store = boardStore();
    await expect(
      moveThread(store.db as never, admin, {
        threadId: "t_board",
        to: { key: "hub", realm: "eurth" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(threadIn(store, "t_board").categoryId).toBe("r_eurth_board");
  });

  it("still moderates its messages: hides and restores any post, the first included", async () => {
    const store = boardStore();
    await setPostHidden(store.db as never, eurthMod, { postId: "p_b1", hidden: true });
    expect(postIn(store, "p_b1").hidden).toBe(true);
    await setPostHidden(store.db as never, eurthMod, { postId: "p_b1", hidden: false });
    expect(postIn(store, "p_b1").hidden).toBe(false);
    expect(store.logs.map((l) => l.action)).toEqual(["post.hide", "post.unhide"]);
  });
});

describe("moderator edits", () => {
  interface MentionRow {
    postId: string;
    userId: string;
  }
  /** A store whose members can be mentioned, with a mention table both the client and the transaction share. */
  function mentionStore(known: MentionRow[] = []) {
    const store = forumStore({
      ...seed(),
      users: [
        ...seed().users.filter((u) => u.id !== "u_m"),
        {
          id: "u_k",
          clerkUserId: "clerk_k",
          handle: "kirsten",
          isActive: true,
          role: { name: "user", level: 100 },
        },
        {
          id: "u_m",
          clerkUserId: "member",
          handle: "member",
          isActive: true,
          role: { name: "user", level: 100 },
        },
      ],
    });
    const rows = [...known];
    const forumPostMention = {
      findMany: jest.fn(async (args: { where: { postId: string; userId: { in: string[] } } }) =>
        rows.filter(
          (r) => r.postId === args.where.postId && args.where.userId.in.includes(r.userId)
        )
      ),
      createMany: jest.fn(async (args: { data: MentionRow[] }) => {
        rows.push(...args.data);
        return { count: args.data.length };
      }),
    };
    Object.assign(store.db, { forumPostMention });
    Object.assign(store.tx, { forumPostMention });
    return { store, rows, forumPostMention };
  }
  describe("modEditPost", () => {
    beforeEach(() => mockSendNotices.mockClear());

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

    describe("a Canvas post", () => {
      const canvasStore = () => {
        const store = forumStore({
          ...seed(),
          postTemplates: [
            { id: "pt1", postId: "p_e2", title: "Template:Flag" },
            { id: "pt2", postId: "p_e1", title: "Template:Flag" },
          ],
        });
        Object.assign(postIn(store, "p_e2"), {
          contentWikitext: "{{Flag}} old",
          rendererVersion: "forum-1:v",
          renderedAt: at(5),
        });
        return store;
      };
      it("keeps the wikitext and templates when the edit loses a race", async () => {
        const store = canvasStore();
        const run = store.db.$transaction.getMockImplementation()!;
        store.db.$transaction.mockImplementationOnce(async (fn) => {
          Object.assign(postIn(store, "p_e2"), { editedAt: at(9) });
          return run(fn);
        });
        await expect(
          modEditPost(store.db as never, eurthMod, {
            postId: "p_e2",
            html: "<p>Cleaned up</p>",
            note: "x",
          })
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(postIn(store, "p_e2").contentWikitext).toBe("{{Flag}} old");
        expect(store.state.postTemplates).toHaveLength(2);
      });
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
    it("a concurrent edit by the author is CONFLICT, never overwritten", async () => {
      const store = forumStore(seed());
      const run = store.db.$transaction.getMockImplementation()!;
      store.db.$transaction.mockImplementationOnce(async (fn) => {
        Object.assign(postIn(store, "p_e2"), { plainText: "Author's fix", editedAt: at(9) });
        return run(fn);
      });
      await expect(
        modEditPost(store.db as never, eurthMod, {
          postId: "p_e2",
          html: "<p>Mod's fix</p>",
          note: "x",
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(postIn(store, "p_e2")).toMatchObject({ plainText: "Author's fix", editedAt: at(9) });
      expect(store.logs).toHaveLength(0);
    });
    it("a site admin's post is edited by site admins only", async () => {
      const store = forumStore(seed());
      await expect(
        modEditPost(store.db as never, eurthMod, { postId: "p_a2", html: "<p>x</p>", note: "x" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(postIn(store, "p_a2").plainText).toBe("Post p_a2");
      await modEditPost(store.db as never, admin, {
        postId: "p_a2",
        html: "<p>Tidied</p>",
        note: "x",
      });
      expect(postIn(store, "p_a2").plainText).toBe("Tidied");
    });

    describe("mentions", () => {
      it("records a silent mention row for each member the edit links, never the author, and tells nobody", async () => {
        const { store, rows } = mentionStore();
        await modEditPost(store.db as never, eurthMod, {
          postId: "p_e2",
          html: "<p>cc @kirsten and @member</p>",
          note: "x",
        });
        expect(postIn(store, "p_e2").contentHtml).toContain('href="/id/kirsten"');
        expect(rows).toEqual([{ postId: "p_e2", userId: "u_k" }]);
        expect(mockSendNotices).not.toHaveBeenCalled();
      });
    });
  });
});

describe("ban places", () => {
  const withDraft = () => {
    const base = seed();
    return {
      ...base,
      realms: [
        ...base.realms,
        { id: "r_draft", slug: "draft", name: "Draft", status: "draft", ownerId: "someone" },
      ],
    };
  };
  describe("locateBanScope", () => {
    it("resolves a realm's board category, which no read page reaches, so a board scoped ban still works", async () => {
      const base = seed();
      const store = forumStore({
        ...base,
        categories: [...base.categories, { ...realmCat("r_eurth", "board"), style: "board" }],
      });
      await expect(
        locateBanScope(store.db as never, eurthMod, {
          kind: "category",
          key: "board",
          realm: "eurth",
        })
      ).resolves.toEqual({
        scope: { kind: "category", categoryId: "r_eurth_board" },
        name: "board",
      });
      const hidden = forumStore({
        ...withDraft(),
        categories: [...base.categories, { ...realmCat("r_draft", "board"), style: "board" }],
      });
      await expect(
        locateBanScope(hidden.db as never, member, {
          kind: "category",
          key: "board",
          realm: "draft",
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
