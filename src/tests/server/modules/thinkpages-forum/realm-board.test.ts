/** @jest-environment node */
import { boardPostRealm, getBoard } from "~/server/modules/thinkpages-forum/board";
import {
  admin,
  boardPost,
  boardStore,
  founder,
  member,
  officer,
  plain,
  seed,
  visitor,
} from "~/tests/helpers/forum-board-fake";

const messages = [
  boardPost("p1", 1),
  boardPost("p2", 2, { authorUserId: "u_visitor" }),
  boardPost("p3", 3, { replyToPostId: "p1", authorUserId: "u_officer" }),
  boardPost("p4", 4, { authorUserId: null, importedAuthorName: "OldHand" }),
  boardPost("p5", 5, { hidden: true }),
  boardPost("p6", 6, {
    authorPersonaId: "pa_news",
    plainText: "News flash",
    contentHtml: "<p>News flash</p>",
  }),
];

const storeWith = (posts = messages, threads: object[] = []) => {
  const base = seed();
  return boardStore(seed({ posts, threads: [...(base.threads ?? []), ...threads] as never }));
};
const board = (
  who: object | null,
  opts: { before?: string; limit?: number } = {},
  slug = "eurth",
  store = storeWith()
) => getBoard(store.db as never, who as never, slug, opts);

describe("getBoard", () => {
  it("returns the realm, its settings and member count, newest message first", async () => {
    const out = await board(member);
    expect(out.realm).toEqual({
      id: "r_eurth",
      slug: "eurth",
      name: "Eurth",
      emblemUrl: "https://img.example/eurth.png",
      memberCount: 4,
      settings: { visitorsAllowed: true, slowModeSeconds: 0 },
    });
    expect(out.messages.map((m) => m.id)).toEqual(["p6", "p4", "p3", "p2", "p1"]);
    expect(out.hasMore).toBe(false);
    expect(out.access).toMatchObject({ canRead: true, canPost: true, isMember: true });
  });

  it("falls back from the emblem to the thumbnail", async () => {
    const store = storeWith();
    Object.assign(
      store.state.realms.find((r) => r.id === "r_eurth")!,
      { emblemUrl: null }
    );
    const out = await board(member, {}, "eurth", store);
    expect(out.realm.emblemUrl).toBe("https://img.example/eurth-thumb.png");
  });

  it("pages back with a post id cursor, reporting whether more remain", async () => {
    const first = await board(member, { limit: 2 });
    expect(first.messages.map((m) => m.id)).toEqual(["p6", "p4"]);
    expect(first.hasMore).toBe(true);
    const second = await board(member, { limit: 2, before: "p4" });
    expect(second.messages.map((m) => m.id)).toEqual(["p3", "p2"]);
    expect(second.hasMore).toBe(true);
    const last = await board(member, { limit: 2, before: "p2" });
    expect(last.messages.map((m) => m.id)).toEqual(["p1"]);
    expect(last.hasMore).toBe(false);
  });

  it("clamps the page size", async () => {
    const store = storeWith();
    const out = await board(member, { limit: 10_000 }, "eurth", store);
    expect(out.messages).toHaveLength(5);
    expect((await board(member, { limit: 0 })).messages).toHaveLength(1);
  });

  it("refuses a cursor that is not a message of this board", async () => {
    await expect(board(member, { before: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides hidden messages from members and anonymous readers", async () => {
    for (const who of [member, null, visitor]) {
      const out = await board(who);
      expect(out.messages.map((m) => m.id)).not.toContain("p5");
      expect(out.messages.every((m) => !("hidden" in m))).toBe(true);
    }
  });

  it("shows moderators hidden messages with a flag", async () => {
    for (const who of [founder, officer, admin]) {
      const out = await board(who);
      expect(out.messages.map((m) => m.id)).toContain("p5");
      expect(out.messages.find((m) => m.id === "p5")).toMatchObject({ hidden: true });
      expect(out.messages.find((m) => m.id === "p1")).toMatchObject({ hidden: false });
    }
  });

  it("labels visitors with their own realm, and nobody else", async () => {
    const out = await board(member);
    const byId = Object.fromEntries(out.messages.map((m) => [m.id, m]));
    expect(byId.p2).toMatchObject({
      isVisitor: true,
      visitorRealm: { slug: "aurora", name: "Aurora" },
    });
    expect(byId.p1).toMatchObject({ isVisitor: false, visitorRealm: null });
    // A board officer and an imported message are not visitors.
    expect(byId.p3).toMatchObject({ isVisitor: false, role: "officer" });
    expect(byId.p4).toMatchObject({ isVisitor: false });
  });

  it("gives each message persona-safe author data", async () => {
    const out = await board(member);
    const byId = Object.fromEntries(out.messages.map((m) => [m.id, m]));
    expect(byId.p1!.author).toEqual({
      name: "member",
      handle: "member",
      avatarUrl: null,
      flagUrl: "https://flags.example/u_member.png",
      persona: false,
    });
    expect(byId.p4!.author).toMatchObject({ name: "OldHand", persona: false, flagUrl: null });
    // A persona's message names the persona only: no player id, flag, avatar of the player, role or visitor label.
    expect(byId.p6).toMatchObject({
      authorUserId: null,
      authorPersonaId: "pa_news",
      author: {
        name: "Eurth Daily",
        handle: "eurthdaily",
        avatarUrl: "https://img.example/daily.png",
        flagUrl: null,
        persona: true,
      },
      role: null,
      isVisitor: false,
      visitorRealm: null,
    });
    expect(JSON.stringify(byId.p6)).not.toContain("u_member");
  });

  it("gives a persona's player to moderators only", async () => {
    const out = await board(officer);
    expect(out.messages.find((m) => m.id === "p6")).toMatchObject({ authorUserId: "u_member" });
  });

  it("marks the viewer's own messages and which they may still edit", async () => {
    const store = storeWith(
      [
        boardPost("old", 0, { createdAt: new Date(Date.now() - 20 * 60_000) }),
        boardPost("fresh", 1, { createdAt: new Date() }),
        boardPost("theirs", 2, { authorUserId: "u_visitor", createdAt: new Date() }),
      ],
      []
    );
    const out = await board(member, {}, "eurth", store);
    const byId = Object.fromEntries(out.messages.map((m) => [m.id, m]));
    expect(byId.old).toMatchObject({ byViewer: true, canEdit: false });
    expect(byId.fresh).toMatchObject({ byViewer: true, canEdit: true });
    expect(byId.theirs).toMatchObject({ byViewer: false, canEdit: false });
  });

  it("summarizes the message a reply answers, not leaking hidden or persona players", async () => {
    const store = storeWith([
      boardPost("a", 1, { plainText: "x".repeat(300) }),
      boardPost("b", 2, { replyToPostId: "a" }),
      boardPost("h", 3, { hidden: true, plainText: "secret" }),
      boardPost("c", 4, { replyToPostId: "h" }),
      boardPost("d", 5, { authorPersonaId: "pa_news", plainText: "by persona" }),
      boardPost("e", 6, { replyToPostId: "d" }),
    ]);
    const out = await board(member, {}, "eurth", store);
    const byId = Object.fromEntries(out.messages.map((m) => [m.id, m]));
    expect(byId.b!.replyTo).toEqual({
      postId: "a",
      authorName: "member",
      excerpt: `${"x".repeat(139)}…`,
    });
    expect(byId.c!.replyTo).toBeNull();
    expect(byId.e!.replyTo).toEqual({
      postId: "d",
      authorName: "Eurth Daily",
      excerpt: "by persona",
    });
    const asMod = await board(officer, {}, "eurth", store);
    expect(asMod.messages.find((m) => m.id === "c")!.replyTo).toMatchObject({
      postId: "h",
      excerpt: "secret",
    });
  });

  it("shows where a message was continued, with the thread's title and replies", async () => {
    const store = storeWith(
      [
        boardPost("c1", 1, { continuedThreadId: "t_long" }),
        boardPost("c2", 2, { continuedThreadId: "t_gone" }),
      ],
      [
        {
          id: "t_long",
          categoryId: "cat_r_eurth_hub",
          title: "A long story",
          postCount: 4,
          hidden: false,
        },
        {
          id: "t_gone",
          categoryId: "cat_r_eurth_hub",
          title: "Hidden one",
          postCount: 2,
          hidden: true,
        },
      ]
    );
    const out = await board(member, {}, "eurth", store);
    const byId = Object.fromEntries(out.messages.map((m) => [m.id, m]));
    expect(byId.c1!.continued).toEqual({ threadId: "t_long", title: "A long story", replies: 3 });
    // A viewer who cannot see the thread gets no link, title or count.
    expect(byId.c2!.continued).toEqual({
      threadId: null,
      title: "Continued in a thread",
      replies: null,
    });
    const asMod = await board(founder, {}, "eurth", store);
    expect(asMod.messages.find((m) => m.id === "c2")!.continued).toMatchObject({
      title: "Hidden one",
    });
  });

  it("does not name a continued thread in a category the viewer cannot see", async () => {
    const store = storeWith(
      [boardPost("c1", 1, { continuedThreadId: "t_staff" })],
      [
        {
          id: "t_staff",
          categoryId: "cat_staff",
          title: "Secret plans",
          postCount: 9,
          hidden: false,
        },
      ]
    );
    store.state.categories.push({
      id: "cat_staff",
      key: "staff",
      scope: "site",
      realmId: null,
      visibility: "staff",
      postRole: "any",
      icAllowed: false,
    });
    const asMember = await board(member, {}, "eurth", store);
    expect(JSON.stringify(asMember.messages)).not.toContain("Secret plans");
    const asAdmin = await board(admin, {}, "eurth", store);
    expect(asAdmin.messages[0]!.continued).toMatchObject({ title: "Secret plans", replies: 8 });
  });

  it("reads as not found for an unknown realm and for a draft realm to a member", async () => {
    await expect(board(member, {}, "nowhere")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(board(member, {}, "draft")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(board(admin, {}, "draft")).resolves.toMatchObject({ realm: { slug: "draft" } });
  });

  it("is readable signed out, with the sign-in reason", async () => {
    const out = await board(null);
    expect(out.access).toMatchObject({ canRead: true, canPost: false, reason: "sign_in" });
    expect(out.messages.length).toBeGreaterThan(0);
  });

  it("gives a no-nation visitor the board and no visitor realm", async () => {
    expect((await board(plain)).access).toMatchObject({ isVisitor: true, visitorRealm: null });
  });

  it("heals a realm that has no board thread yet by seeding it", async () => {
    const store = boardStore(seed({ threads: [], categories: [] }));
    const createMany = jest.fn(async () => ({ count: 1 }));
    Object.assign(store.db.forumCategory, { createMany });
    await expect(board(member, {}, "eurth", store)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createMany).toHaveBeenCalled();
  });
});

describe("boardPostRealm", () => {
  const store = storeWith();
  const find = (who: object | null, id: string) =>
    boardPostRealm(store.db as never, who as never, id);

  it("names the realm whose board holds the post", async () => {
    expect(await find(member, "p1")).toEqual({ realmSlug: "eurth" });
    expect(await find(null, "p1")).toEqual({ realmSlug: "eurth" });
  });

  it("hides a hidden post from members and shows it to moderators", async () => {
    expect(await find(member, "p5")).toBeNull();
    expect(await find(founder, "p5")).toEqual({ realmSlug: "eurth" });
  });

  it("is null for unknown ids and for posts outside any board", async () => {
    expect(await find(member, "nope")).toBeNull();
    const other = boardStore(
      seed({
        posts: [boardPost("g1", 1, { threadId: "t_hub" })],
        threads: [
          ...(seed().threads ?? []),
          {
            id: "t_hub",
            categoryId: "cat_r_eurth_hub",
            title: "Hub",
            authorUserId: "u_member",
            postCount: 1,
            hidden: false,
          },
        ] as never,
      })
    );
    expect(await boardPostRealm(other.db as never, member as never, "g1")).toBeNull();
  });

  it("is null for a post in a realm hidden from the viewer", async () => {
    const draft = boardStore(
      seed({ posts: [boardPost("d1", 1, { threadId: "t_board_r_draft" })] })
    );
    expect(await boardPostRealm(draft.db as never, member as never, "d1")).toBeNull();
    expect(await boardPostRealm(draft.db as never, admin as never, "d1")).toEqual({
      realmSlug: "draft",
    });
  });
});
