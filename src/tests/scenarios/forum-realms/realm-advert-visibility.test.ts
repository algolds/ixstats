/** @jest-environment node */
/**
 * A draft realm's Find a Realm advert, walked by every viewer on every surface that can show a thread, through the
 * real `thinkpagesForum` procedures and the forum module's readers on the in-memory database. Fay founds Draft Land,
 * still a draft, and writes its advert (mentioning Mo and Ada); Eve's Eurth is published and has an ordinary thread
 * beside it. While Draft Land is a draft, Mo (a member) and an anonymous reader find the advert nowhere, while Fay and
 * the site admin Ada see it everywhere; once published, everyone does and Mo replies; taken back to draft, Mo cannot
 * even edit his own reply; archived, the advert is closed to replies, edits and reactions and reads as locked.
 *
 * Folds advert-exclusions (the board list and count, the home counts and latest post, the public feed and footprint,
 * Trending, the thread read, the permalink, stash titles, replies and edits, unread counts) and advert-mirror-readers
 * (Discussed in, the reaction target, notice recipients, reports, and reacting to an archived realm's advert), plus
 * the draft and archived reads of thinkpagesForumAdvertReads and the founder's draft advert of adverts.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: {
    create: jest.fn(async () => undefined),
    createMany: jest.fn(async () => undefined),
  },
}));
jest.mock("~/lib/notifications/guard", () => ({ isNotificationEventEnabled: async () => true }));
jest.mock("~/server/websocket-server", () => ({
  getThinkPagesBroadcaster: () => ({ broadcastBoard: jest.fn(), broadcastMessage: jest.fn() }),
}));
// The advert's Canvas wikitext is rendered as plain paragraphs: MediaWiki is not part of this flow.
jest.mock("~/server/modules/thinkpages-forum/render", () => ({
  ...jest.requireActual("~/server/modules/thinkpages-forum/render"),
  renderPostWikitext: jest.fn(async (wikitext: string) => ({
    contentHtml: `<p>${wikitext}</p>`,
    plainText: wikitext,
    rendererVersion: "test",
    renderedAt: new Date(),
    templates: [],
  })),
}));

import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import {
  discussionCountsOf,
  discussionsOf,
  forumActivityOf,
  forumActorOf,
} from "~/server/modules/thinkpages-forum";
import { latestPublicThreads } from "~/server/modules/thinkpages-forum/public-threads";
import { readableThreadTitles } from "~/server/modules/thinkpages-forum/stash";
import {
  addMember,
  addNation,
  addRealm,
  addSiteBoards,
  anonymous,
  as,
  forumDb,
  settle,
  type Member,
} from "~/tests/helpers/forum-world";
import type { MemoryPrisma } from "~/tests/helpers/memory-prisma";

const forum = createCallerFactory(thinkpagesForumRouter);
const notices = jest.mocked(notificationAPI.createMany);
const NOT_FOUND = { code: "NOT_FOUND" };
/** The refusal a reporter reaches only once they can read the post. */
const OWN_CONTENT = { code: "BAD_REQUEST", message: expect.stringMatching(/your own/i) };

let db: MemoryPrisma;
let fay: Member, eve: Member, mo: Member, ada: Member;
let advert: { threadId: string; postId: string };
let plain: { threadId: string; postId: string };

/** Each caller as the router sees them; `null` is the anonymous reader. */
const caller = (who: Member | null) => forum(who ? as(db as never, who) : anonymous(db as never));
const viewerOf = (who: Member | null) =>
  who ? forumActorOf(db as never, who) : Promise.resolve(null);
const setStatus = (status: string) =>
  db.realm.update({ where: { id: "draft-land" }, data: { status } });

/** What a viewer finds of the advert on each list-like surface. */
async function surfaces(who: Member | null) {
  const forumOf = caller(who);
  const viewer = await viewerOf(who);
  const board = await forumOf.category({ key: "find-a-realm", page: 1 });
  const home = (await forumOf.categories()).find((b: { key: string }) => b.key === "find-a-realm")!;
  const trending = await forumOf.trending();
  const titles = await readableThreadTitles(db as never, viewer, [advert.threadId, plain.threadId]);
  const discussed = await discussionsOf(db as never, viewer, { activityId: "act" });
  const counted = await discussionCountsOf(db as never, viewer, ["act"]);
  return {
    board: board.threads.map((t: { id: string }) => t.id).sort(),
    total: board.total,
    homeThreads: home.threadCount,
    homePosts: home.postCount,
    homeLatest: home.latest?.threadId ?? null,
    unread: home.unreadThreads,
    trending: trending.map((t: { threadId: string }) => t.threadId).includes(advert.threadId),
    stashTitles: [...titles.keys()].sort(),
    discussed: discussed.items.map((i: { postId: string }) => i.postId).sort(),
    discussedCount: counted.act?.count ?? 0,
  };
}

const hidden = () => ({
  board: [plain.threadId],
  total: 1,
  homeThreads: 1,
  homePosts: 1,
  homeLatest: plain.threadId,
  trending: false,
  stashTitles: [plain.threadId],
  discussed: [plain.postId],
  discussedCount: 1,
});
const shown = () => ({
  board: [advert.threadId, plain.threadId].sort(),
  total: 2,
  homeThreads: 2,
  homePosts: 2,
  trending: true,
  stashTitles: [advert.threadId, plain.threadId].sort(),
  discussed: [advert.postId, plain.postId].sort(),
  discussedCount: 2,
});

beforeEach(async () => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  notices.mockClear();
  db = forumDb();
  mockDb = db;
  await addSiteBoards(db as never);
  [fay, eve, mo, ada] = await Promise.all([
    addMember(db as never, "fay"),
    addMember(db as never, "eve"),
    addMember(db as never, "mo"),
    addMember(db as never, "ada", { admin: true }),
  ]);
  await addRealm(db as never, {
    id: "draft-land",
    name: "Draft Land",
    ownerClerkId: fay.clerkUserId,
    status: "draft",
  });
  await addRealm(db as never, { id: "eurth", name: "Eurth", ownerClerkId: eve.clerkUserId });
  await addNation(db as never, "aurelia", "eurth", mo.id);
  // Eve's ordinary thread in Find a Realm (written before the board took adverts only)
  plain = await db.forumThread
    .create({
      data: {
        categoryId: "cat-find-a-realm",
        title: "Looking for a realm",
        authorUserId: eve.id,
        postCount: 1,
        posts: {
          create: { authorUserId: eve.id, contentHtml: "<p>Any tips?</p>", plainText: "Any tips?" },
        },
      },
      include: { posts: true },
    })
    .then((t: { id: string; posts: Array<{ id: string }> }) => ({
      threadId: t.id,
      postId: t.posts[0]!.id,
    }));

  // Fay advertises her draft realm: allowed, and mentioning Mo, who cannot read it, tells only Ada
  advert = await caller(fay).createAdvert({
    realm: "draft-land",
    title: "Join Draft Land",
    wikitext: "Come and settle the river valleys, @mo and @ada",
  });
  await settle();
  expect(
    notices.mock.calls.flatMap(([batch]) =>
      (batch as Array<{ userId: string }>).map((n) => n.userId)
    )
  ).toEqual([ada.clerkUserId]);
  // Both posts discuss one public action
  await db.activityFeed.create({
    data: { id: "act", type: "diplomatic", title: "Treaty", description: "A treaty" },
  });
  for (const postRef of [advert.postId, plain.postId]) {
    await db.postActionLink.create({
      data: { postSource: "native", postRef, activityId: "act", countryId: "aurelia" },
    });
  }
});

afterEach(() => jest.restoreAllMocks());

it("a draft realm's advert is nowhere for a member or a reader, everywhere for its founder and an admin", async () => {
  for (const who of [mo, null]) {
    expect(await surfaces(who)).toMatchObject(hidden());
    const forumOf = caller(who);
    await expect(forumOf.thread({ threadId: advert.threadId, page: 1 })).rejects.toMatchObject(
      NOT_FOUND
    );
    expect(await forumOf.resolvePost({ postId: advert.postId })).toBeNull();
    await expect(forumOf.reactors({ postId: advert.postId })).rejects.toMatchObject(NOT_FOUND);
  }
  expect((await surfaces(mo)).unread).toBe(1);
  const asMo = caller(mo);
  await expect(
    asMo.reply({ threadId: advert.threadId, html: "<p>Hello?</p>" })
  ).rejects.toMatchObject(NOT_FOUND);
  await expect(asMo.stashThread({ threadId: advert.threadId })).rejects.toMatchObject(NOT_FOUND);
  await expect(
    asMo.report({ targetType: "post", targetId: advert.postId, reason: "Not a real realm" })
  ).rejects.toMatchObject(NOT_FOUND);
  // The public feed and Fay's passport footprint leave it out
  expect(
    (await latestPublicThreads(db as never, 10)).threads.map((t: { id: string }) => t.id)
  ).toEqual([plain.threadId]);
  expect(await forumActivityOf(db as never, fay.id)).toEqual({ posts: 0, threads: 0 });

  // Fay and Ada see it on every surface but Trending, which reads as the public does; Fay manages it; her own report
  // is refused as her own content
  for (const who of [fay, ada]) {
    expect(await surfaces(who)).toMatchObject({ ...shown(), trending: false });
    expect(await caller(who).thread({ threadId: advert.threadId, page: 1 })).toMatchObject({
      advert: { realmSlug: "draft-land", canManage: true, closed: false },
    });
    expect(await caller(who).resolvePost({ postId: advert.postId })).toEqual({
      threadId: advert.threadId,
      page: 1,
    });
    expect(await caller(who).reactors({ postId: advert.postId })).toBeDefined();
  }
  await expect(
    caller(fay).report({ targetType: "post", targetId: advert.postId, reason: "Testing" })
  ).rejects.toMatchObject(OWN_CONTENT);
  expect(await caller(fay).advertFor({ realm: "draft-land" })).toMatchObject({
    threadId: advert.threadId,
  });
});

it("published, everyone sees the advert; taken back to draft, even its replier loses it; archived, it is closed", async () => {
  await setStatus("active");
  for (const who of [mo, null]) {
    expect(await surfaces(who)).toMatchObject(shown());
    expect(await caller(who).thread({ threadId: advert.threadId, page: 1 })).toMatchObject({
      advert: { realmSlug: "draft-land", canManage: false, closed: false },
    });
    expect(await caller(who).thread({ threadId: plain.threadId, page: 1 })).toMatchObject({
      advert: null,
    });
    expect(await caller(who).resolvePost({ postId: advert.postId })).toEqual({
      threadId: advert.threadId,
      page: 1,
    });
  }
  expect(
    (await latestPublicThreads(db as never, 10)).threads.map((t: { id: string }) => t.id).sort()
  ).toEqual([advert.threadId, plain.threadId].sort());
  expect(await forumActivityOf(db as never, fay.id)).toEqual({ posts: 1, threads: 1 });

  // Mo reacts and replies; reporting his own reply gets as far as the own-content refusal
  const asMo = caller(mo);
  await asMo.react({ postId: advert.postId, type: "like" });
  const reply = await asMo.reply({ threadId: advert.threadId, html: "<p>Count me in</p>" });
  await expect(
    asMo.report({ targetType: "post", targetId: reply.postId, reason: "Oops" })
  ).rejects.toMatchObject(OWN_CONTENT);

  // Back to draft: Mo's own reply can no longer be edited, it reads as not found
  await setStatus("draft");
  await expect(
    asMo.editPost({ postId: reply.postId, html: "<p>Count me out</p>", editedAt: null })
  ).rejects.toMatchObject(NOT_FOUND);

  // Archived: no replies, no edits even for the managing founder, no reactions even from an admin, read as locked
  await setStatus("archived");
  await expect(
    asMo.reply({ threadId: advert.threadId, html: "<p>Still?</p>" })
  ).rejects.toMatchObject({
    code: "CONFLICT",
    message: "This thread is closed to replies.",
  });
  await expect(
    caller(fay).editPost({ postId: advert.postId, wikitext: "Closed now", editedAt: null })
  ).rejects.toMatchObject({ code: "CONFLICT", message: "This thread is closed to edits." });
  for (const who of [mo, ada]) {
    await expect(caller(who).react({ postId: advert.postId, type: "like" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/archived/i),
    });
  }
  const read = await asMo.thread({ threadId: advert.threadId, page: 1 });
  expect(read).toMatchObject({
    canReact: false,
    canReply: false,
    thread: { locked: true },
    advert: { closed: true },
  });
  expect(await db.forumThread.findUnique({ where: { id: advert.threadId } })).toMatchObject({
    locked: false,
  });
  expect(await db.forumPostReaction.count()).toBe(1);
});
