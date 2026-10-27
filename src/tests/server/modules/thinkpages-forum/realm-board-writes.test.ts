/** @jest-environment node */
import { AsyncLocalStorage } from "node:async_hooks";
jest.mock("~/server/modules/thinkpages-forum/mention-links", () => ({
  withMentionLinks: jest.fn(async (_db: object, body: object) => body),
}));
import { withMentionLinks } from "~/server/modules/thinkpages-forum/mention-links";
import { continueInThread } from "~/server/modules/thinkpages-forum/board-continue";
import {
  editBoardMessage,
  postBoardMessage,
  updateBoardSettings,
} from "~/server/modules/thinkpages-forum/board-writes";
import {
  admin,
  boardPost,
  boardStore,
  claimsOfficer,
  founder,
  member,
  member2,
  officer,
  personas,
  plain,
  postIn,
  seed,
  visitor,
} from "~/tests/helpers/forum-board-fake";
import type { Value } from "~/tests/helpers/forum-store-fake";
import { BOARD_THREAD, threadIn } from "~/tests/helpers/forum-board-fake";
import { type Row, type StoreState } from "~/tests/helpers/forum-store-fake";

const post = (store: ReturnType<typeof boardStore>, who: object, input: object) =>
  postBoardMessage(store.db as never, who as never, {
    realm: "eurth",
    html: "<p>Hello board</p>",
    ...input,
  });
const posts = (store: ReturnType<typeof boardStore>) => store.state.posts.length;
describe("postBoardMessage", () => {
  it("refuses an over-long message before looking any name up", async () => {
    jest.mocked(withMentionLinks).mockClear();
    const store = boardStore();
    await expect(
      post(store, member, { html: `<p>${"@kir ".repeat(300)}</p>` })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(withMentionLinks).not.toHaveBeenCalled();
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

    it("looks back only one interval, so a user who never posted does not scan the thread", async () => {
      const store = slow(30);
      const findMany = jest.spyOn(store.db.forumPost, "findMany");
      const before = Date.now();
      await post(store, member, {});
      const where = findMany.mock.calls.map(([args]) => args?.where).find((w) => w?.authorUserId);
      const since = (where?.createdAt as { gte: Date }).gte.getTime();
      expect(since).toBeGreaterThanOrEqual(before - 30_000);
      expect(since).toBeLessThanOrEqual(Date.now() - 30_000);
    });

    /** Gives the fake database PostgreSQL's transaction-scoped advisory lock: one holder per key until the transaction ends. */
    const withAdvisoryLocks = (store: ReturnType<typeof boardStore>) => {
      const held = new AsyncLocalStorage<Array<() => void>>();
      const queues = new Map<string, Promise<void>>();
      const { db, tx } = store;
      tx.$executeRaw = jest.fn(async (strings: TemplateStringsArray, ...values: Value[]) => {
        if (!strings.join("?").includes("pg_advisory_xact_lock")) return 1;
        const key = String(values[0]);
        const before = queues.get(key) ?? Promise.resolve();
        let release!: () => void;
        const mine = new Promise<void>((resolve) => (release = resolve));
        queues.set(
          key,
          before.then(() => mine)
        );
        held.getStore()?.push(release);
        await before;
        return 1;
      });
      // No snapshot rollback here: the fake's would undo another transaction's committed post (a refused one wrote nothing).
      db.$transaction = jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
        const releases: Array<() => void> = [];
        try {
          return await held.run(releases, () => fn(tx));
        } finally {
          for (const release of releases) release();
        }
      }) as never;
    };

    it("lets only one of several parallel posts through", async () => {
      const store = slow(60);
      withAdvisoryLocks(store);
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => post(store, member, {}))
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const refused = results.filter((r) => r.status === "rejected");
      expect(refused).toHaveLength(4);
      for (const r of refused) {
        expect((r as PromiseRejectedResult).reason).toMatchObject({ code: "TOO_MANY_REQUESTS" });
      }
      expect(posts(store)).toBe(1);
    });
  });

  describe("length", () => {
    it("allows exactly 1,000 characters of text and counts text, not markup", async () => {
      const store = boardStore();
      await expect(
        post(store, member, { html: `<p><strong>${"a".repeat(1000)}</strong></p>` })
      ).resolves.toBeDefined();
    });
  });

  describe("action links", () => {
    it("refuses a token outside plain text", async () => {
      await expect(
        post(boardStore(), member, { html: '<p><a title="[ixaction=a1]">x</a></p>' })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("personas", () => {
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

    it("refuses the member's own personal account, which is the player and not a persona", async () => {
      const store = boardStore(seed(), {
        personas: [
          ...personas,
          {
            id: "pa_me",
            clerkUserId: "clerk_u_member",
            isActive: true,
            accountType: "personal",
            displayName: "Me",
            username: "me",
            profileImageUrl: null,
          },
        ],
      });
      await expect(post(store, member, { personaId: "pa_me" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(posts(store)).toBe(0);
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
    it.each(["hid", "other"])("refuses %s", async (target) => {
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
  it.each([301])("refuses %p seconds", async (seconds) => {
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
});

describe("continuing a message in a thread", () => {
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
  const cont = (
    s: ReturnType<typeof boardStore>,
    who: object,
    postId: string,
    extra: object = {}
  ) => continueInThread(s.db as never, who as never, { postId, title: "A long thought", ...extra });
  describe("continueInThread", () => {
    it("points replies to the moved message at its placeholder and open reports at the Hub", async () => {
      const s = store();
      const out = await cont(s, member, "p1");
      expect(postIn(s, "p2").replyToPostId).toBe(out.placeholder.id);
      expect(s.state.reports[0]).toMatchObject({ categoryId: HUB });
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
  });
});
