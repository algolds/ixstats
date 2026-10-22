/** @jest-environment node */
/**
 * A thread's life in General, through the real `thinkpagesForum` and `thinkpagesForumMod` procedures on the in-memory
 * database: Ana starts it (forty days ago) mentioning Cai; Dee watches it; Ben replies quoting Ana and mentioning Ana
 * and Cai, with hostile markup in the body; Ben edits the reply to mention Eli; Cai reacts; Ana and the moderator Mia
 * read it; Ben replies again while his auto-watch write fails; Mia hides that reply. The stored body goes through the
 * real sanitizer at save and through PostBody on the way out.
 *
 * Folds after-write (watch before the first-post notice, a reply watches, an edit and a reaction never watch, a
 * failing auto-watch still notifies), first-unread (the thirty-day floor, everything read falls back to the last
 * post, a hidden reply leaves a member's jump but not the moderator's), PostBody (the quote author links to its post,
 * a forged quote id stays unlinked, a token inside an attribute stays inert), and the router echoes of
 * thinkpagesForumHooks, thinkpagesForumEngagement (the unread target), post-notify (one notice per recipient, the
 * mention outranking the quote; an edit tells only who it adds), quote-render and writes (one transaction, counts,
 * scripts and handlers stripped).
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
// PostBody's wiki content renderer asks tRPC for missing pages; a server render asks nothing.
jest.mock("~/trpc/react", () => {
  const query = new Proxy({}, { get: () => ({ useQuery: () => ({ data: undefined }) }) });
  return { api: new Proxy({}, { get: () => query }) };
});

import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { PostBody } from "~/components/thinkpages-forum/thread/PostBody";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { thinkpagesForumModRouter } from "~/server/api/routers/thinkpagesForum/mod";
import { unreadTargetFor } from "~/server/api/routers/thinkpagesForum/unread-target";
import {
  addMember,
  addSiteBoards,
  anonymous,
  as,
  forumDb,
  settle,
  type Member,
} from "~/tests/helpers/forum-world";
import type { MemoryPrisma } from "~/tests/helpers/memory-prisma";

const forum = createCallerFactory(thinkpagesForumRouter);
const mod = createCallerFactory(thinkpagesForumModRouter);
const notices = jest.mocked(notificationAPI.createMany);

const NOW = Date.UTC(2026, 9, 21, 12);
const MINUTE = 60_000;
const DAY = 86_400_000;
const at = (ms: number) => jest.setSystemTime(new Date(NOW + ms));

/** Who was told what about one post: `clerk id -> kinds`. */
function toldAbout(postId: string): Record<string, string[]> {
  const told: Record<string, string[]> = {};
  for (const [batch] of notices.mock.calls) {
    for (const n of batch) {
      if (n.metadata!.postId === postId) (told[n.userId!] ??= []).push(n.metadata!.kind);
    }
  }
  return told;
}

/** A stored body as PostBody renders it, parsed as a browser would. */
function rendered(post: { contentHtml: string }) {
  const markup = renderToStaticMarkup(<PostBody html={post.contentHtml} style="ooc" />);
  const doc = new JSDOM(markup).window.document;
  const live = [...doc.querySelectorAll("*")].flatMap((el) => [
    ...(["SCRIPT", "IMG"].includes(el.tagName) && el.hasAttribute("onerror") ? [el.tagName] : []),
    ...el.getAttributeNames().filter((name) => name.startsWith("on") || name === "style"),
  ]);
  const links = [...doc.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
  return { doc, live, links, scripts: doc.querySelectorAll("script, img[onerror]").length };
}

let db: MemoryPrisma;
let ana: Member, ben: Member, cai: Member, dee: Member, eli: Member, mia: Member;

beforeEach(async () => {
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "nextTick",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
      "queueMicrotask",
      "hrtime",
      "performance",
    ],
  });
  notices.mockClear();
  db = forumDb();
  mockDb = db;
  await addSiteBoards(db as never);
  [ana, ben, cai, dee, eli, mia] = await Promise.all(
    ["ana", "ben", "cai", "dee", "eli", "mia"].map((id) => addMember(db as never, id))
  );
  // Mia moderates General.
  await db.forumCategoryModerator.create({
    data: { categoryId: "cat-general", userId: mia.id, grantedBy: "system" },
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("a thread is started, quoted, mentioned, edited, read and moderated, and everyone hears what they should", async () => {
  // Forty days ago Ana starts the thread and mentions Cai: she watches it before the first-post notice goes out
  at(-40 * DAY);
  const watches = jest.spyOn(db.forumThreadWatch, "createMany");
  const started = await forum(as(db as never, ana)).createThread({
    categoryKey: "general",
    title: "Harbour rights",
    html: "<p>Who owns the harbour? cc @cai</p>",
  });
  await settle();
  const { threadId, postId: opening } = started;
  expect(toldAbout(opening)).toEqual({ [cai.clerkUserId]: ["mention"] });
  expect(watches.mock.invocationCallOrder[0]).toBeLessThan(notices.mock.invocationCallOrder[0]!);
  expect(await db.forumThread.findUnique({ where: { id: threadId } })).toMatchObject({
    postCount: 1,
    categoryId: "cat-general",
  });

  // Dee watches it
  at(-60 * MINUTE);
  await forum(as(db as never, dee)).watchThread({ threadId });

  // Ben replies: a quote of Ana's post, a forged quote, two mentions and markup that must not survive
  at(-50 * MINUTE);
  const reply = await forum(as(db as never, ben)).reply({
    threadId,
    html:
      `<blockquote class="forum-quote" data-post="${opening}"><div class="forum-quote-author">ana wrote:</div>` +
      `<div class="forum-quote-body">Who owns the harbour?</div></blockquote>` +
      `<blockquote class="forum-quote" data-post="a&quot; onmouseover=&quot;x"><div class="forum-quote-author">Eve wrote:</div>` +
      `<div class="forum-quote-body">trust me</div></blockquote>` +
      `<p>The crown, @ana and @cai. (@ben) <img src=x onerror="alert(1)"><script>alert(2)</script>` +
      `<span style="position:fixed;inset:0" onclick="steal()">click</span></p>`,
  });
  await settle();
  // One notice each: Ana's mention outranks her quote; Dee is told as a watcher; Ben, though he named himself, nothing
  expect(toldAbout(reply.postId)).toEqual({
    [ana.clerkUserId]: ["mention"],
    [cai.clerkUserId]: ["mention"],
    [dee.clerkUserId]: ["watch"],
  });
  const watchers = () =>
    db.forumThreadWatch
      .findMany({ where: { threadId }, select: { userId: true }, orderBy: { userId: "asc" } })
      .then((rows: Array<{ userId: string }>) => rows.map((r) => r.userId));
  expect(await watchers()).toEqual([ana.id, ben.id, dee.id]);
  const mentioned = () =>
    db.forumPostMention
      .findMany({
        where: { postId: reply.postId },
        select: { userId: true },
        orderBy: { userId: "asc" },
      })
      .then((rows: Array<{ userId: string }>) => rows.map((r) => r.userId));
  expect(await mentioned()).toEqual([ana.id, cai.id]);
  // The real sanitizer stored no script, handler or overlay; PostBody links the real quote only
  const stored = await db.forumPost.findUniqueOrThrow({ where: { id: reply.postId } });
  expect(stored.contentHtml).not.toMatch(
    /<script|onerror|onclick|onmouseover="x"|position:\s*fixed/i
  );
  const shown = rendered(stored);
  expect(shown.links).toEqual([
    ["ana wrote:", `/thinkpages/post/${opening}`],
    ["@ana", "/id/ana"],
    ["@cai", "/id/cai"],
    ["@ben", "/id/ben"],
  ]);
  expect(shown.live).toEqual([]);
  expect(shown.scripts).toBe(0);
  expect(await db.forumThread.findUnique({ where: { id: threadId } })).toMatchObject({
    postCount: 2,
    lastPostAt: new Date(NOW - 50 * MINUTE),
  });

  // Ben's edit adds Eli: only Eli is told, and nobody new watches
  at(-45 * MINUTE);
  notices.mockClear();
  await forum(as(db as never, ben)).editPost({
    postId: reply.postId,
    html: stored.contentHtml.replace("@cai</a>.", "@cai</a> and @eli."),
    editedAt: null,
  });
  await settle();
  expect(toldAbout(reply.postId)).toEqual({ [eli.clerkUserId]: ["mention"] });
  expect(await mentioned()).toEqual([ana.id, cai.id, eli.id]);
  expect(await db.forumPost.findUnique({ where: { id: reply.postId } })).toMatchObject({
    editedAt: new Date(NOW - 45 * MINUTE),
  });
  // Cai reacts: Ben is told, and a reaction watches nothing
  await forum(as(db as never, cai)).react({ postId: reply.postId, type: "like" });
  await settle();
  expect(toldAbout(reply.postId)[ben.clerkUserId]).toEqual(["reaction"]);
  expect(await watchers()).toEqual([ana.id, ben.id, dee.id]);

  // Cai never opened it: the jump skips Ana's post, older than the thirty-day floor
  const jump = (who: Member | null) =>
    unreadTargetFor(db as never, who?.clerkUserId ?? null, threadId);
  expect(await jump(null)).toBe(`/thinkpages/t/${threadId}`);
  expect(await jump(cai)).toMatch(new RegExp(`#post-${reply.postId}$`));
  // Ana and Mia read the page: everything is read, so the jump is the last post
  at(-30 * MINUTE);
  expect(await forum(as(db as never, ana)).thread({ threadId, page: 1 })).toMatchObject({
    watching: true,
  });
  await forum(as(db as never, ana)).markThreadRead({ threadId, page: 1 });
  await forum(as(db as never, mia)).markThreadRead({ threadId, page: 1 });
  expect(await jump(ana)).toMatch(new RegExp(`#post-${reply.postId}$`));

  // Ben replies again, quoting himself, while his auto-watch write fails: the reply stands and the watchers are still
  // told, Ana again (she read the thread since), Dee not (she has not visited since her last notice), Ben not at all
  at(-20 * MINUTE);
  notices.mockClear();
  const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
  watches.mockRejectedValueOnce(new Error("db down"));
  const second = await forum(as(db as never, ben)).reply({
    threadId,
    html:
      `<blockquote class="forum-quote" data-post="${reply.postId}"><div class="forum-quote-author">ben wrote:</div>` +
      `<div class="forum-quote-body">The crown</div></blockquote><p>Also the lighthouse.</p>`,
  });
  await settle();
  expect(toldAbout(second.postId)).toEqual({ [ana.clerkUserId]: ["watch"] });
  expect(logged).toHaveBeenCalled();
  logged.mockRestore();
  expect(await jump(ana)).toMatch(new RegExp(`#post-${second.postId}$`));

  // Mia hides it: the counts follow the visible posts, a member's jump and page lose it, the moderator's keep it
  at(-10 * MINUTE);
  await mod(as(db as never, mia)).setPostHidden({
    postId: second.postId,
    hidden: true,
    note: "spam",
  });
  expect(await db.forumThread.findUnique({ where: { id: threadId } })).toMatchObject({
    postCount: 2,
    lastPostAt: new Date(NOW - 50 * MINUTE),
  });
  expect(await jump(ana)).toMatch(new RegExp(`#post-${reply.postId}$`));
  expect(await jump(mia)).toMatch(new RegExp(`#post-${second.postId}$`));
  const ids = (page: { posts: Array<{ id: string }> }) => page.posts.map((p) => p.id);
  expect(ids(await forum(as(db as never, ana)).thread({ threadId, page: 1 }))).toEqual([
    opening,
    reply.postId,
  ]);
  const modPage = await forum(as(db as never, mia)).thread({ threadId, page: 1 });
  expect(ids(modPage)).toEqual([opening, reply.postId, second.postId]);
  expect(modPage.posts.at(-1)).toMatchObject({ hidden: true });
  expect(ids(await forum(anonymous(db as never)).thread({ threadId, page: 1 }))).toEqual([
    opening,
    reply.postId,
  ]);
});

it("PostBody leaves a token inside an attribute inert, as stored by older posts", () => {
  for (const contentHtml of [
    '<p>hi <span title="[ixaction=abc] ><img src=x onerror=alert(1)>">x</span></p>',
    '<p><a href="https://e.com/?q=[ixaction=abc] <img src=x onerror=alert(1)>">l</a></p>',
  ]) {
    const shown = rendered({ contentHtml });
    expect(shown.doc.querySelectorAll("img")).toHaveLength(0);
    expect(shown.live).toEqual([]);
    expect(shown.doc.body.textContent).not.toContain("Unverified action");
  }
});
