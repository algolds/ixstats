/** @jest-environment node */
import { modEditPost } from "~/server/modules/thinkpages-forum";
import {
  admin,
  at,
  eurthMod,
  expectOneLog,
  member,
  oldMod,
  postIn,
  seed,
} from "~/tests/helpers/forum-mod-fixtures";
import { forumStore } from "~/tests/helpers/forum-store-fake";

const mockSendNotices = jest.fn();
jest.mock("~/server/modules/thinkpages-forum/forum-notices", () => ({
  sendForumNotices: (...args: object[]) => mockSendNotices(...args),
}));

interface MentionRow {
  postId: string;
  userId: string;
}
/** A store whose members can be mentioned, with a mention table both the client and the transaction share. */
function mentionStore(known: MentionRow[] = []) {
  const store = forumStore({
    ...seed(),
    users: [
      ...seed().users,
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
    ].filter((u, i, all) => all.findLastIndex((o) => o.id === u.id) === i),
  });
  const rows = [...known];
  const forumPostMention = {
    findMany: jest.fn(async (args: { where: { postId: string; userId: { in: string[] } } }) =>
      rows.filter((r) => r.postId === args.where.postId && args.where.userId.in.includes(r.userId))
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

    it("becomes an HTML-only post: wikitext, render metadata and templates are cleared", async () => {
      const store = canvasStore();
      await modEditPost(store.db as never, eurthMod, {
        postId: "p_e2",
        html: "<p>Cleaned up</p>",
        note: "removed slur",
      });
      expect(postIn(store, "p_e2")).toMatchObject({
        contentHtml: "<p>Cleaned up</p>",
        contentWikitext: null,
        rendererVersion: null,
        renderedAt: null,
      });
      // Only this post's templates go; the stale selection needs contentWikitext, so it never picks the post again.
      expect(store.state.postTemplates).toEqual([
        { id: "pt2", postId: "p_e1", title: "Template:Flag" },
      ]);
    });

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

  it("an already edited post is written only while its editedAt is unchanged", async () => {
    const store = forumStore(seed());
    postIn(store, "p_e2").editedAt = at(7);
    await modEditPost(store.db as never, eurthMod, {
      postId: "p_e2",
      html: "<p>Tidied</p>",
      note: "x",
    });
    expect(store.tx.forumPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p_e2", editedAt: at(7) } })
    );
    expect(postIn(store, "p_e2").plainText).toBe("Tidied");
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

    it("records a member the post already mentioned only once", async () => {
      const { store, rows, forumPostMention } = mentionStore([{ postId: "p_e2", userId: "u_k" }]);
      await modEditPost(store.db as never, eurthMod, {
        postId: "p_e2",
        html: "<p>cc @kirsten</p>",
        note: "x",
      });
      expect(forumPostMention.createMany).not.toHaveBeenCalled();
      expect(rows).toHaveLength(1);
    });

    it("writes the rows with the edit: a lost race records none", async () => {
      const { store, rows } = mentionStore();
      const run = store.db.$transaction.getMockImplementation()!;
      store.db.$transaction.mockImplementationOnce(async (fn) => {
        Object.assign(postIn(store, "p_e2"), { editedAt: at(9) });
        return run(fn);
      });
      await expect(
        modEditPost(store.db as never, eurthMod, {
          postId: "p_e2",
          html: "<p>cc @kirsten</p>",
          note: "x",
        })
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(rows).toEqual([]);
    });
  });
});
