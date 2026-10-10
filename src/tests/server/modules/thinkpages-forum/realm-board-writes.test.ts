/** @jest-environment node */
import { BOARD_TOO_LONG } from "~/lib/thinkpages-forum/board";
import { MAX_POST_HTML } from "~/server/modules/thinkpages-forum";
import { continueInThread } from "~/server/modules/thinkpages-forum/board-continue";
import {
  editBoardMessage,
  postBoardMessage,
  updateBoardSettings,
} from "~/server/modules/thinkpages-forum/board-writes";
import {
  admin,
  ban,
  banned,
  BOARD_THREAD,
  boardPost,
  boardStore,
  claimsOfficer,
  founder,
  member,
  member2,
  officer,
  plain,
  postIn,
  seed,
  threadIn,
  visitor,
} from "~/tests/helpers/forum-board-fake";

const post = (store: ReturnType<typeof boardStore>, who: object, input: object) =>
  postBoardMessage(store.db as never, who as never, {
    realm: "eurth",
    html: "<p>Hello board</p>",
    ...input,
  });
const posts = (store: ReturnType<typeof boardStore>) => store.state.posts.length;
const refusal = (code: string, message?: RegExp) =>
  expect.objectContaining({
    code,
    ...(message ? { message: expect.stringMatching(message) } : {}),
  });

describe("postBoardMessage", () => {
  it("stores a sanitized message and returns it shaped like a board message", async () => {
    const store = boardStore();
    const message = await post(store, member, { html: "<p>Hello <script>x()</script>board</p>" });
    expect(message).toMatchObject({
      contentHtml: "<p>Hello board</p>",
      byViewer: true,
      canEdit: true,
      isVisitor: false,
      replyTo: null,
      continued: null,
      author: { name: "member", persona: false },
    });
    const row = postIn(store, message.id);
    expect(row).toMatchObject({
      threadId: BOARD_THREAD,
      authorUserId: "u_member",
      authorPersonaId: null,
      plainText: "Hello board",
      replyToPostId: null,
    });
    expect(threadIn(store, BOARD_THREAD)).toMatchObject({ postCount: 1 });
  });

  it("labels a visitor's message with their own realm", async () => {
    const store = boardStore();
    expect(await post(store, visitor, {})).toMatchObject({
      isVisitor: true,
      visitorRealm: { slug: "aurora", name: "Aurora" },
    });
  });

  it("lets moderators post, including a founder without a nation", async () => {
    const store = boardStore();
    await expect(post(store, founder, {})).resolves.toMatchObject({ isVisitor: false });
    await expect(post(store, admin, {})).resolves.toBeDefined();
  });

  describe("access", () => {
    it("refuses a visitor when visitors are off, writing nothing", async () => {
      const store = boardStore();
      Object.assign(
        store.state.realms.find((r) => r.id === "r_eurth")!,
        { boardVisitorsAllowed: false }
      );
      await expect(post(store, visitor, {})).rejects.toEqual(refusal("FORBIDDEN", /visitors/i));
      await expect(post(store, member, {})).resolves.toBeDefined();
      expect(posts(store)).toBe(1);
    });

    it("refuses a banned member with the ban notice", async () => {
      const store = boardStore();
      store.state.bans.push(
        ban({ userId: "u_banned", scope: "realm", scopeId: "r_eurth", reason: "Spam" })
      );
      await expect(post(store, banned, {})).rejects.toEqual(refusal("FORBIDDEN", /ban/i));
      expect(posts(store)).toBe(0);
    });

    it("refuses everyone but site admins in an archived realm", async () => {
      const store = boardStore(seed({ threads: [...(seed().threads ?? [])] }));
      const oldPost = (who: object) =>
        postBoardMessage(store.db as never, who as never, { realm: "old", html: "<p>hi</p>" });
      await expect(oldPost(member)).rejects.toEqual(refusal("FORBIDDEN", /archived/i));
      await expect(oldPost(admin)).resolves.toBeDefined();
    });

    it("reads a realm hidden from the actor as not found", async () => {
      const store = boardStore();
      await expect(
        postBoardMessage(store.db as never, member as never, { realm: "draft", html: "<p>hi</p>" })
      ).rejects.toEqual(refusal("NOT_FOUND"));
    });
  });

  describe("slow mode", () => {
    const slow = (seconds: number, posts: object[] = []) => {
      const store = boardStore(seed({ posts: posts as never }));
      Object.assign(
        store.state.realms.find((r) => r.id === "r_eurth")!,
        {
          boardSlowModeSeconds: seconds,
        }
      );
      return store;
    };
    const ago = (ms: number) => new Date(Date.now() - ms);

    it("lets the first message through and refuses the next one at once", async () => {
      const store = slow(30);
      await post(store, member, {});
      const error = await post(store, member, {}).catch((e: unknown) => e);
      expect(error).toMatchObject({ code: "TOO_MANY_REQUESTS", retryAfterSeconds: 30 });
      expect(posts(store)).toBe(1);
    });

    it("refuses with the exact remaining seconds, writing nothing", async () => {
      const store = slow(30, [boardPost("mine", 1, { createdAt: ago(7_500) })]);
      const error = await post(store, member, {}).catch((e: unknown) => e);
      expect(error).toMatchObject({
        code: "TOO_MANY_REQUESTS",
        message: "You can post again in 23s",
        retryAfterSeconds: 23,
      });
      expect(posts(store)).toBe(1);
    });

    it("does not extend the wait when the user keeps trying", async () => {
      const store = slow(30, [boardPost("mine", 1, { createdAt: ago(20_500) })]);
      for (let attempt = 0; attempt < 3; attempt++) {
        await expect(post(store, member, {})).rejects.toMatchObject({ retryAfterSeconds: 10 });
      }
      expect(posts(store)).toBe(1);
    });

    it("lets the user post once the interval has passed", async () => {
      const store = slow(30, [boardPost("mine", 1, { createdAt: ago(30_100) })]);
      await expect(post(store, member, {})).resolves.toBeDefined();
    });

    it("counts a persona message of the same player and a continued message, not other players", async () => {
      const recent = ago(1_000);
      const persona = slow(30, [
        boardPost("pm", 1, { createdAt: recent, authorPersonaId: "pa_news" }),
      ]);
      await expect(post(persona, member, {})).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
      const continued = slow(30, [
        boardPost("placeholder", 2, { createdAt: recent, continuedThreadId: "t_x" }),
      ]);
      await expect(post(continued, member, {})).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
      const others = slow(30, [
        boardPost("theirs", 1, { createdAt: recent, authorUserId: "u_member2" }),
      ]);
      await expect(post(others, member, {})).resolves.toBeDefined();
    });

    it("cannot be skipped by continuing the message in a thread", async () => {
      const store = slow(30);
      const first = await post(store, member, {});
      await continueInThread(store.db as never, member as never, {
        postId: first.id,
        title: "Moving on",
      });
      await expect(post(store, member, {})).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    });

    it("applies to visitors and exempts moderators", async () => {
      const recent = ago(1_000);
      const store = slow(60, [
        boardPost("v", 1, { createdAt: recent, authorUserId: "u_visitor" }),
        ...["u_founder", "u_officer", "u_admin"].map((id) =>
          boardPost(`m_${id}`, 2, { createdAt: recent, authorUserId: id })
        ),
      ]);
      await expect(post(store, visitor, {})).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
      for (const who of [founder, officer, admin]) {
        await expect(post(store, who, {})).resolves.toBeDefined();
      }
    });

    it("never refuses when slow mode is off", async () => {
      const store = slow(0, [boardPost("mine", 1, { createdAt: new Date() })]);
      await expect(post(store, member, {})).resolves.toBeDefined();
      await expect(post(store, member, {})).resolves.toBeDefined();
    });
  });

  describe("length", () => {
    it("allows exactly 1,000 characters of text and counts text, not markup", async () => {
      const store = boardStore();
      await expect(
        post(store, member, { html: `<p><strong>${"a".repeat(1000)}</strong></p>` })
      ).resolves.toBeDefined();
    });

    it("refuses 1,001 characters with the thread hint", async () => {
      const store = boardStore();
      await expect(
        post(store, member, { html: `<p>${"a".repeat(1001)}</p>` })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: BOARD_TOO_LONG,
      });
      expect(BOARD_TOO_LONG).toBe(
        "Board messages are at most 1,000 characters. Continue in a thread for longer posts."
      );
      expect(posts(store)).toBe(0);
    });

    it("gives a paste over the post limit the board's message too", async () => {
      const store = boardStore();
      await expect(
        post(store, member, { html: `<p>${"a".repeat(MAX_POST_HTML)}</p>` })
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: BOARD_TOO_LONG });
      expect(posts(store)).toBe(0);
    });

    it("refuses an empty message", async () => {
      await expect(post(boardStore(), member, { html: "<p>  </p>" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });

  describe("action links", () => {
    it("refuses a token outside plain text", async () => {
      await expect(
        post(boardStore(), member, { html: '<p><a title="[ixaction=a1]">x</a></p>' })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("validates a token against the poster's nation", async () => {
      const store = boardStore();
      Object.assign(store.db, { activityFeed: { findMany: jest.fn(async () => []) } });
      await expect(post(store, member, { html: "<p>see [ixaction=a1]</p>" })).rejects.toMatchObject(
        { code: "BAD_REQUEST" }
      );
      await expect(post(store, plain, { html: "<p>see [ixaction=a1]</p>" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(posts(store)).toBe(0);
    });
  });

  describe("personas", () => {
    it("posts as the actor's own persona, hiding the player in the returned message", async () => {
      const store = boardStore();
      const message = await post(store, member, { personaId: "pa_news" });
      expect(postIn(store, message.id)).toMatchObject({
        authorUserId: "u_member",
        authorPersonaId: "pa_news",
      });
      expect(message).toMatchObject({
        authorUserId: null,
        authorPersonaId: "pa_news",
        byViewer: true,
        author: { name: "Eurth Daily", persona: true },
      });
    });

    it("keeps a visitor's persona message free of the visitor label and the player", async () => {
      const store = boardStore();
      const message = await post(store, visitor, { personaId: "pa_visitor" });
      expect(message).toMatchObject({
        authorUserId: null,
        authorPersonaId: "pa_visitor",
        isVisitor: false,
        visitorRealm: null,
        role: null,
        author: { name: "Aurora Wire", persona: true, flagUrl: null },
      });
      expect(JSON.stringify(message)).not.toMatch(/u_visitor/);
    });

    it("refuses someone else's persona", async () => {
      await expect(post(boardStore(), member2, { personaId: "pa_news" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });

  describe("replyTo", () => {
    const withPosts = () =>
      boardStore(
        seed({
          posts: [
            boardPost("p1", 1),
            boardPost("hid", 2, { hidden: true }),
            boardPost("other", 3, { threadId: "t_board_r_aurora" }),
            boardPost("placeholder", 4, { continuedThreadId: "t_x" }),
          ],
        })
      );

    it("stores the reply link to a visible message of this board and returns its summary", async () => {
      const store = withPosts();
      const message = await post(store, member, { replyToPostId: "p1" });
      expect(postIn(store, message.id)).toMatchObject({ replyToPostId: "p1" });
      expect(message.replyTo).toEqual({
        postId: "p1",
        authorName: "member",
        excerpt: "Message p1",
      });
    });

    it.each(["hid", "other", "placeholder", "missing"])("refuses %s", async (target) => {
      const store = withPosts();
      const before = posts(store);
      await expect(post(store, member, { replyToPostId: target })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(posts(store)).toBe(before);
    });
  });
});

describe("editBoardMessage", () => {
  const edit = (
    store: ReturnType<typeof boardStore>,
    who: object,
    postId: string,
    html = "<p>Edited</p>"
  ) => editBoardMessage(store.db as never, who as never, { postId, html });
  const recent = (minutes: number) => new Date(Date.now() - minutes * 60_000);
  const withMine = () =>
    boardStore(
      seed({
        posts: [
          boardPost("fresh", 1, { createdAt: recent(14) }),
          boardPost("stale", 2, { createdAt: recent(16) }),
          boardPost("hid", 3, { createdAt: recent(1), hidden: true }),
          boardPost("cont", 4, { createdAt: recent(1), continuedThreadId: "t_x" }),
        ],
      })
    );

  it("lets the author edit within 15 minutes, marking and returning the message", async () => {
    const store = withMine();
    const message = await edit(
      store,
      member,
      "fresh",
      "<p>Edited <b>text</b><script>x</script></p>"
    );
    expect(message).toMatchObject({ id: "fresh", contentHtml: "<p>Edited <b>text</b></p>" });
    expect(message.editedAt).toBeInstanceOf(Date);
    expect(postIn(store, "fresh")).toMatchObject({ plainText: "Edited text" });
  });

  it("refuses after 15 minutes, changing nothing", async () => {
    const store = withMine();
    await expect(edit(store, member, "stale")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/15 minutes/),
    });
    expect(postIn(store, "stale")).toMatchObject({ plainText: "Message stale", editedAt: null });
  });

  it("is the author's only; moderators use the moderator edit", async () => {
    const store = withMine();
    await expect(edit(store, member2, "fresh")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(edit(store, founder, "fresh")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reads hidden, unknown and non-board posts as not found", async () => {
    const store = withMine();
    await expect(edit(store, member, "hid")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(edit(store, member, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a message that was continued in a thread", async () => {
    await expect(edit(withMine(), member, "cont")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses a banned author and an over-long edit", async () => {
    const store = boardStore(
      seed({ posts: [boardPost("b1", 1, { authorUserId: "u_banned", createdAt: recent(1) })] })
    );
    store.state.bans.push(ban({ userId: "u_banned", scope: "site" }));
    await expect(edit(store, banned, "b1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const store2 = withMine();
    await expect(edit(store2, member, "fresh", `<p>${"a".repeat(1001)}</p>`)).rejects.toMatchObject(
      {
        code: "BAD_REQUEST",
        message: BOARD_TOO_LONG,
      }
    );
  });

  it("refuses an edit that lost a race with a moderator's", async () => {
    const store = withMine();
    store.db.forumPost.updateMany = jest.fn(async () => ({ count: 0 })) as never;
    await expect(edit(store, member, "fresh")).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("updateBoardSettings", () => {
  const update = (who: object, input: object, realmId = "r_eurth", store = boardStore()) =>
    updateBoardSettings(store.db as never, who as never, realmId, input as never).then((out) => ({
      out,
      store,
    }));
  const realmRow = (store: ReturnType<typeof boardStore>) =>
    store.state.realms.find((r) => r.id === "r_eurth")!;

  it("lets the founder, a board officer and a site admin change both settings", async () => {
    for (const who of [founder, officer, admin]) {
      const { out, store } = await update(who, { visitorsAllowed: false, slowModeSeconds: 30 });
      expect(out).toEqual({ visitorsAllowed: false, slowModeSeconds: 30 });
      expect(realmRow(store)).toMatchObject({
        boardVisitorsAllowed: false,
        boardSlowModeSeconds: 30,
      });
    }
  });

  it("changes only what is sent", async () => {
    const { out, store } = await update(founder, { slowModeSeconds: 300 });
    expect(out).toEqual({ visitorsAllowed: true, slowModeSeconds: 300 });
    expect(realmRow(store).boardVisitorsAllowed).toBe(true);
  });

  it.each([0, 10, 30, 60, 300])("accepts %i seconds", async (seconds) => {
    await expect(update(founder, { slowModeSeconds: seconds })).resolves.toBeDefined();
  });

  it.each([-1, 5, 45, 301, 1.5])("refuses %p seconds", async (seconds) => {
    const store = boardStore();
    await expect(
      update(founder, { slowModeSeconds: seconds }, "r_eurth", store)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(realmRow(store).boardSlowModeSeconds).toBe(0);
  });

  it("refuses members, visitors, a claims-only officer and signed-in strangers", async () => {
    for (const who of [member, visitor, claimsOfficer, plain]) {
      const store = boardStore();
      await expect(update(who, { visitorsAllowed: false }, "r_eurth", store)).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
      expect(realmRow(store).boardVisitorsAllowed).toBe(true);
    }
  });

  it("reads an unknown or hidden realm as not found", async () => {
    await expect(update(admin, { visitorsAllowed: false }, "nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(update(member, { visitorsAllowed: false }, "r_draft")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
