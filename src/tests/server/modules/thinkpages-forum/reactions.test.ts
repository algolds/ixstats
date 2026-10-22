/** @jest-environment node */
jest.mock("~/server/modules/thinkpages-forum/forum-notices", () => ({
  FORUM_NOTICE_SOURCE: "thinkpages-forum",
  sendForumNotices: jest.fn(async () => true),
}));
jest.mock("~/server/shared/user-blocks", () => ({
  recipientsBlockingSender: jest.fn(async (): Promise<string[]> => []),
}));

import { Prisma } from "@prisma/client";
import {
  listReactors,
  reactToPost,
  unreactToPost,
} from "~/server/modules/thinkpages-forum/reactions";
import type { BoardStore } from "~/tests/helpers/forum-board-fake";
import {
  admin,
  ban,
  banned,
  founder,
  member,
  officer,
  plain,
  visitor,
} from "~/tests/helpers/forum-board-fake";
import { reactionStore } from "~/tests/helpers/forum-reaction-fixtures";
import {
  loadReactablePost,
  loadReadablePost,
} from "~/server/modules/thinkpages-forum/reaction-target";
import { boardPost } from "~/tests/helpers/forum-board-fake";
import { SITE_CATEGORY } from "~/tests/helpers/forum-reaction-fixtures";
import {
  sendForumNotices,
  type ForumNotice,
} from "~/server/modules/thinkpages-forum/forum-notices";
import { notifyReaction } from "~/server/modules/thinkpages-forum/reaction-notify";
import { recipientsBlockingSender } from "~/server/shared/user-blocks";
import { postIn } from "~/tests/helpers/forum-board-fake";
import {
  applyReactionChange,
  isReactionType,
  readReactionCounts,
} from "~/lib/thinkpages-forum/reactions";

const react = (store: BoardStore, viewer: object, postId: string, type: string) =>
  reactToPost(store.db as never, viewer as never, { postId, type });
const unreact = (store: BoardStore, viewer: object, postId: string) =>
  unreactToPost(store.db as never, viewer as never, { postId });
const countsOf = (store: BoardStore, id: string) =>
  store.state.posts.find((p) => p.id === id)!.reactionCounts;

describe("reactToPost", () => {
  it("adds a reaction and keeps the post's counts in step with its rows", async () => {
    const store = reactionStore();
    const out = await react(store, member, "p_hub", "like");
    expect(out).toEqual({ counts: { like: 1 }, mine: "like", created: true, board: false });
    expect(store.reactions).toHaveLength(1);
    expect(store.reactions[0]).toMatchObject({ postId: "p_hub", userId: "u_member", type: "like" });
    expect(countsOf(store, "p_hub")).toEqual({ like: 1 });
  });
  it("switches the member's one reaction to another type in place", async () => {
    const store = reactionStore();
    await react(store, member, "p_hub", "like");
    await react(store, visitor, "p_hub", "like");
    const out = await react(store, member, "p_hub", "fire");
    expect(out).toEqual({
      counts: { like: 1, fire: 1 },
      mine: "fire",
      created: false,
      board: false,
    });
    expect(store.reactions).toHaveLength(2);
    expect(countsOf(store, "p_hub")).toEqual({ like: 1, fire: 1 });
  });

  it("recounts under a per-post lock taken before any row changes", async () => {
    const store = reactionStore();
    await react(store, member, "p_hub", "like");
    const lock = store.tx.$executeRaw.mock.calls[0]!;
    expect(lock[0].join("?")).toContain("pg_advisory_xact_lock");
    expect(lock.slice(1)).toEqual(["forum-reaction:p_hub"]);
    expect(store.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      store.reactionDb.create.mock.invocationCallOrder[0]!
    );
  });

  it("recounts from the rows, so the counts equal them after several members react in the same tick", async () => {
    const store = reactionStore();
    const who = [member, visitor, plain, officer, founder];
    await Promise.all(who.map((v, i) => react(store, v, "p_hub", i % 2 === 0 ? "like" : "fire")));
    expect(store.reactions).toHaveLength(5);
    expect(countsOf(store, "p_hub")).toEqual({ like: 3, fire: 2 });
  });
  it("rejects a type that is not a reaction before it reads anything", async () => {
    const store = reactionStore();
    for (const type of ["sad", "discord:", "like\n", "__proto__", "x".repeat(200)]) {
      await expect(react(store, member, "p_hub", type)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    expect(store.db.forumPost.findUnique).not.toHaveBeenCalled();
    expect(store.reactions).toHaveLength(0);
  });

  it("writes nothing when the post cannot take a reaction", async () => {
    const store = reactionStore();
    store.state.bans.push(ban({ userId: "u_banned", scope: "realm", scopeId: "r_eurth" }));
    for (const [viewer, id, code] of [
      [member, "p_mine", "FORBIDDEN"],
      [member, "p_hidden", "NOT_FOUND"],
      [member, "p_locked", "CONFLICT"],
      [member, "b_continued", "CONFLICT"],
      [member, "p_draft", "NOT_FOUND"],
      [member, "p_old", "CONFLICT"],
      [admin, "b_old", "CONFLICT"],
      [banned, "p_hub", "FORBIDDEN"],
    ] as const) {
      await expect(react(store, viewer, id, "like")).rejects.toMatchObject({ code });
    }
    expect(store.reactions).toHaveLength(0);
    expect(store.db.$transaction).not.toHaveBeenCalled();
  });

  it("answers CONFLICT when the unique key catches a duplicate, and leaves the rows and counts alone", async () => {
    const store = reactionStore();
    store.reactions.push({
      id: "rx_pre",
      postId: "p_hub",
      userId: "u_member",
      type: "like",
      createdAt: new Date(Date.UTC(2026, 9, 10, 12, 30)),
    });
    store.state.posts.find((p) => p.id === "p_hub")!.reactionCounts = { like: 1 };
    // The lock should make this unreachable; if the read still misses the row, the insert hits the unique key.
    store.reactionDb.findUnique.mockResolvedValueOnce(null);
    await expect(react(store, member, "p_hub", "fire")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(store.reactions).toHaveLength(1);
    expect(store.reactions[0]).toMatchObject({ type: "like" });
    expect(countsOf(store, "p_hub")).toEqual({ like: 1 });
  });
  it("answers CONFLICT when the transaction runs past its timeout, and says to try again", async () => {
    const store = reactionStore();
    store.db.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Transaction API error: timed out", {
        code: "P2028",
        clientVersion: "test",
      })
    );
    await expect(react(store, member, "p_hub", "like")).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Your reaction changed at the same moment. Try again.",
    });
    expect(store.reactions).toHaveLength(0);
  });
  it("does not turn another database failure into a CONFLICT", async () => {
    const store = reactionStore();
    store.reactionDb.create.mockRejectedValueOnce(new Error("connection lost"));
    await expect(react(store, member, "p_hub", "like")).rejects.toThrow("connection lost");
  });
  it("answers NOT_FOUND when the post is deleted between the checks and the write", async () => {
    const lostUpdate = reactionStore();
    lostUpdate.tx.forumPost.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record to update not found.", {
        code: "P2025",
        clientVersion: "test",
      })
    );
    await expect(react(lostUpdate, member, "p_hub", "like")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(countsOf(lostUpdate, "p_hub")).toEqual({});

    const lostParent = reactionStore();
    lostParent.reactionDb.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed.", {
        code: "P2003",
        clientVersion: "test",
      })
    );
    await expect(react(lostParent, member, "p_hub", "like")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets an admin react to a persona post without learning or leaking the player", async () => {
    const store = reactionStore();
    const out = await react(store, admin, "p_persona", "like");
    expect(out.counts).toEqual({ like: 1 });
    expect(JSON.stringify(out)).not.toMatch(/u_visitor|pa_visitor/);
  });
});

describe("unreactToPost", () => {
  it("removes the reaction and the count, and removing again changes nothing", async () => {
    const store = reactionStore();
    await react(store, member, "p_hub", "fire");
    await react(store, visitor, "p_hub", "fire");
    expect(await unreact(store, member, "p_hub")).toEqual({
      counts: { fire: 1 },
      mine: null,
      created: false,
      board: false,
    });
    expect(await unreact(store, member, "p_hub")).toMatchObject({
      counts: { fire: 1 },
      mine: null,
    });
    expect(store.reactions).toHaveLength(1);
    expect(countsOf(store, "p_hub")).toEqual({ fire: 1 });
  });
  it("still works after the thread locks, the member is banned or the realm archives", async () => {
    const store = reactionStore();
    await react(store, member, "p_hub", "like");
    Object.assign(
      store.state.threads.find((t) => t.id === "t_hub")!,
      { locked: true }
    );
    store.state.bans.push(ban({ userId: "u_member", scope: "site" }));
    expect(await unreact(store, member, "p_hub")).toMatchObject({ counts: {}, mine: null });
  });
  it("finds nothing for a post the member cannot read", async () => {
    const store = reactionStore();
    await expect(unreact(store, member, "p_hidden")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(unreact(store, member, "p_draft")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(unreact(store, member, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("listReactors", () => {
  async function reacted() {
    const store = reactionStore();
    await react(store, member, "p_hub", "like");
    await react(store, visitor, "p_hub", "fire");
    await react(store, plain, "p_hub", "fire");
    return store;
  }
  const list = (
    store: BoardStore,
    viewer: object | null,
    input: { postId: string; type?: string }
  ) => listReactors(store.db as never, viewer as never, input);
  it("carries only the reactor's display data: no user id, no post author", async () => {
    const out = await list(await reacted(), null, { postId: "p_hub" });
    const reactor = out.groups[0]!.reactors[0]!;
    expect(Object.keys(reactor).sort()).toEqual(["avatarUrl", "flagUrl", "handle", "id", "name"]);
    expect(JSON.stringify(out)).not.toMatch(/"u_\w+"/);
  });

  it("lists a persona post's reactors without naming its player", async () => {
    const store = reactionStore();
    await react(store, member, "p_persona", "like");
    const out = await list(store, null, { postId: "p_persona" });
    expect(out.groups[0]!.reactors.map((r) => r.handle)).toEqual(["member"]);
    expect(JSON.stringify(out)).not.toMatch(/visitor|pa_visitor|Aurora Wire/);
  });

  it("caps a type at 50 reactors, newest first, and a list at 12 types", async () => {
    const store = reactionStore();
    const post = store.state.posts.find((p) => p.id === "p_hub")!;
    store.reactions.push(
      ...Array.from({ length: 60 }, (_, i) => ({
        id: `r${i}`,
        postId: "p_hub",
        userId: `ux${i}`,
        type: "like",
        createdAt: new Date(Date.UTC(2026, 9, 10, 14, 0, i)),
      }))
    );
    post.reactionCounts = { like: 60 };
    const like = (await list(store, null, { postId: "p_hub" })).groups[0]!;
    expect(like.count).toBe(60);
    expect(like.reactors).toHaveLength(50);
    expect(like.reactors[0]!.id).toBe("r59");

    post.reactionCounts = Object.fromEntries(
      ["like", "laugh", "angry", "fire", "thumbsup", "thumbsdown"]
        .concat(Array.from({ length: 10 }, (_, i) => `discord:emoji${i}`))
        .map((type, i) => [type, 100 - i])
    );
    expect((await list(store, null, { postId: "p_hub" })).groups).toHaveLength(12);
  });
  it("is readable to whoever can read the post, and no one else", async () => {
    const store = await reacted();
    await expect(list(store, null, { postId: "p_hidden" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(list(store, member, { postId: "p_draft" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(list(store, founder, { postId: "b_hidden" })).resolves.toEqual({ groups: [] });
  });
});

describe("who may read and react to a post", () => {
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
    it("does not find an unknown post, a hidden post, a post in a hidden thread or a hidden realm", async () => {
      for (const id of ["nope", "p_hidden", "p_hiddenthread", "p_draft", "b_hidden", "b_draft"]) {
        await expect(readable(member, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      }
    });
    // The rules it mirrors from resolvePostLocation and loadVisibleThread, one test each.
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
    it("follows the realm rule: a post of a realm hidden from the viewer is theirs to see only as staff", async () => {
      await expect(readable(null, "p_draft")).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await readable(admin, "p_draft")).toMatchObject({ realm: { slug: "draft" } });
    });
  });
  describe("loadReactablePost", () => {
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
    it("refuses a locked or archived thread and an archived realm", async () => {
      await expect(reactable(member, "p_locked")).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(reactable(member, "p_archived")).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(reactable(member, "p_old")).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(reactable(member, "b_old")).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("refuses a member banned from the realm, from the category or from the site, on a thread and on the board", async () => {
      const realmBan = reactionStore();
      realmBan.state.bans.push(ban({ userId: "u_banned", scope: "realm", scopeId: "r_eurth" }));
      await expect(reactable(banned, "p_hub", realmBan)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
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
      await expect(reactable(plain, "p_site", siteBan)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
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
});

describe("the reaction notice", () => {
  const sent = jest.mocked(sendForumNotices);
  const blocking = jest.mocked(recipientsBlockingSender);
  /** u_member reacts; u_member2 owns p_hub, p_site and b1. */
  const reactor = { id: "u_member", clerkUserId: "clerk_u_member" };
  interface StoredNotice {
    id: string;
    userId: string;
    source: string;
    metadata: string;
  }
  /**
   * A notification table that remembers what was sent: `sendForumNotices` stores each notice the way the bell does
   * (metadata as JSON text) and `findFirst` answers from those rows, so a second call sees the first one's notice.
   */
  function setup() {
    const store = reactionStore();
    // Each reactor the suite uses has reacted to every post, as when the hook runs right after the reaction commits.
    for (const row of store.state.posts) {
      for (const userId of [reactor.id, "u_plain"]) {
        store.reactions.push({
          id: `rx_${row.id}_${userId}`,
          postId: row.id,
          userId,
          type: "like",
        });
      }
    }
    const stored: StoredNotice[] = [];
    sent.mockImplementation(async (notices: readonly ForumNotice[]) => {
      for (const notice of notices) {
        stored.push({
          id: `n${stored.length + 1}`,
          userId: notice.clerkUserId,
          source: "thinkpages-forum",
          metadata: JSON.stringify(notice.metadata),
        });
      }
      return true;
    });
    const notification = {
      findFirst: jest.fn(
        async (args: {
          where: { userId: string; source: string; metadata: { contains: string } };
        }): Promise<{ id: string } | null> => {
          const { userId, source, metadata } = args.where;
          const hit = stored.find(
            (row) =>
              row.userId === userId &&
              row.source === source &&
              row.metadata.includes(metadata.contains)
          );
          return hit ? { id: hit.id } : null;
        }
      ),
    };
    return { store, stored, db: { ...store.db, notification } as never, notification };
  }
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    sent.mockReset();
    blocking.mockReset();
    blocking.mockResolvedValue([]);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());
  describe("notifyReaction", () => {
    it("tells a persona post's owner, naming the reactor only, never the persona or its player", async () => {
      const { db } = setup();
      await notifyReaction(db, reactor, { postId: "p_persona" });
      const [[[notice]]] = sent.mock.calls as never as [[[ForumNotice]]];
      expect(notice).toMatchObject({
        clerkUserId: "clerk_u_visitor",
        title: "member reacted to your post in Thread t_hub",
      });
      expect(JSON.stringify(notice)).not.toMatch(/pa_visitor|Aurora Wire|aurorawire/);
    });
    it("tells nobody about an archive-imported post, even one that still has an author", async () => {
      const { db, store } = setup();
      postIn(store, "p_hub").sourceRef = "xf:post:1";
      await notifyReaction(db, reactor, { postId: "p_hub" });
      expect(sent).not.toHaveBeenCalled();
    });

    it("tells nobody about a hidden post, a hidden thread or an unknown post", async () => {
      const { db } = setup();
      for (const postId of ["p_hidden", "p_hiddenthread", "b_hidden", "nope"]) {
        await notifyReaction(db, reactor, { postId });
      }
      expect(sent).not.toHaveBeenCalled();
    });
    it("tells nobody who cannot read the post", async () => {
      const { db } = setup();
      await notifyReaction(db, reactor, { postId: "p_draft" });
      expect(sent).not.toHaveBeenCalled();
    });
    it("tells nobody who blocked the reactor", async () => {
      const { db } = setup();
      blocking.mockResolvedValue(["clerk_u_member2"]);
      await notifyReaction(db, reactor, { postId: "p_hub" });
      expect(blocking).toHaveBeenCalledWith(db, "clerk_u_member", ["clerk_u_member2"]);
      expect(sent).not.toHaveBeenCalled();
    });

    it("tells the owner once per reactor and post: a toggle off and on sends no second notice", async () => {
      const { db, stored } = setup();
      await notifyReaction(db, reactor, { postId: "p_hub" });
      // The reactor took the reaction back and added it again: the hook runs for the new row, the key ends it.
      await notifyReaction(db, reactor, { postId: "p_hub" });
      expect(sent).toHaveBeenCalledTimes(1);
      expect(stored).toHaveLength(1);
    });
  });
});

describe("reaction types and counts", () => {
  describe("isReactionType", () => {
    it.each([
      ["sad, which has no icon", "sad"],
      ["a built-in in capitals", "LIKE"],
      ["a 33-letter Discord name", `discord:${"a".repeat(33)}`],
      ["a non-digit Discord id", "discord:name:abc"],
      ["the prototype key", "__proto__"],
      ["the constructor key", "constructor"],
    ])("rejects %s", (_label, type) => {
      expect(isReactionType(type)).toBe(false);
    });
  });
  describe("readReactionCounts", () => {
    it("drops zero, negative, fractional and non-number counts and unknown types", () => {
      expect(
        readReactionCounts({
          like: 0,
          fire: -1,
          laugh: 1.5,
          angry: "2",
          sad: 4,
          thumbsup: null,
          thumbsdown: 5,
        })
      ).toEqual({ thumbsdown: 5 });
    });
    it("never lets a prototype key through", () => {
      const parsed = readReactionCounts('{"__proto__":{"like":1},"constructor":2,"like":1}');
      expect(parsed).toEqual({ like: 1 });
      expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
      expect(({} as Record<string, number>).like).toBeUndefined();
    });
  });
  describe("applyReactionChange", () => {
    it("changes nothing when the type is the same, and never goes below zero", () => {
      expect(applyReactionChange({ like: 2 }, "like", "like")).toEqual({ like: 2 });
      expect(applyReactionChange({}, "like", null)).toEqual({});
    });

    it("never reads or writes a prototype key, as either side of the change", () => {
      for (const key of ["constructor", "__proto__"]) {
        expect(applyReactionChange({ like: 1 }, key, "fire")).toEqual({ like: 1, fire: 1 });
        expect(applyReactionChange({ like: 1 }, "like", key)).toEqual({});
        expect(applyReactionChange({}, key, key)).toEqual({});
        expect(Object.getPrototypeOf(applyReactionChange({}, null, key))).toBe(Object.prototype);
      }
    });
  });
});
