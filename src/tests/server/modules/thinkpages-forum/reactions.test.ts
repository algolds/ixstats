/** @jest-environment node */
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

  it("counts several members, and says a board message is a board message", async () => {
    const store = reactionStore();
    await react(store, member, "b1", "like");
    await react(store, visitor, "b1", "like");
    const out = await react(store, plain, "b1", "discord:pog");
    expect(out).toMatchObject({ counts: { like: 2, "discord:pog": 1 }, board: true });
    expect(countsOf(store, "b1")).toEqual({ like: 2, "discord:pog": 1 });
  });

  it("is a no-op for the same type again: no second row, no change, not a first reaction", async () => {
    const store = reactionStore();
    await react(store, member, "p_hub", "like");
    const again = await react(store, member, "p_hub", "like");
    expect(again).toEqual({ counts: { like: 1 }, mine: "like", created: false, board: false });
    expect(store.reactions).toHaveLength(1);
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

  it("heals a drifted count from the rows", async () => {
    const store = reactionStore();
    store.state.posts.find((p) => p.id === "p_hub")!.reactionCounts = { like: 40, sad: 2 };
    const out = await react(store, member, "p_hub", "fire");
    expect(out.counts).toEqual({ fire: 1 });
    expect(countsOf(store, "p_hub")).toEqual({ fire: 1 });
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
    for (const [viewer, id] of [
      [member, "p_mine"],
      [member, "p_hidden"],
      [member, "p_locked"],
      [member, "b_continued"],
      [member, "p_draft"],
      [member, "p_old"],
      [admin, "b_old"],
      [banned, "p_hub"],
    ] as const) {
      await expect(react(store, viewer, id, "like")).rejects.toBeDefined();
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

  it("does not turn another database failure into a CONFLICT", async () => {
    const store = reactionStore();
    store.reactionDb.create.mockRejectedValueOnce(new Error("connection lost"));
    await expect(react(store, member, "p_hub", "like")).rejects.toThrow("connection lost");
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

  it("empties the counts when the last reaction goes", async () => {
    const store = reactionStore();
    await react(store, member, "b1", "like");
    expect(await unreact(store, member, "b1")).toMatchObject({ counts: {}, board: true });
    expect(countsOf(store, "b1")).toEqual({});
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

  it("groups reactors by type, most reacted first, with the player's handle and flag", async () => {
    const out = await list(await reacted(), null, { postId: "p_hub" });
    expect(out.groups.map((g) => [g.type, g.count, g.reactors.length])).toEqual([
      ["fire", 2, 2],
      ["like", 1, 1],
    ]);
    expect(out.groups[1]!.reactors[0]).toEqual({
      id: expect.any(String),
      name: "member",
      handle: "member",
      avatarUrl: null,
      flagUrl: "https://flags.example/u_member.png",
    });
  });

  it("lists newest first and one type on request", async () => {
    const out = await list(await reacted(), member, { postId: "p_hub", type: "fire" });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0]!.reactors.map((r) => r.handle)).toEqual(["plain", "visitor"]);
  });

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

  it("reads corrupt counts as no reactors and a post with none as an empty list", async () => {
    const store = reactionStore();
    store.state.posts.find((p) => p.id === "p_hub")!.reactionCounts = "garbage";
    expect(await list(store, null, { postId: "p_hub" })).toEqual({ groups: [] });
    expect(await list(store, null, { postId: "p_site" })).toEqual({ groups: [] });
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

  it("rejects a type that is not a reaction", async () => {
    await expect(
      list(reactionStore(), null, { postId: "p_hub", type: "sad" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
