/** @jest-environment node */
/**
 * An evening on Eurth's live board, through the real `thinkpagesForum` board, reaction and moderator procedures on the
 * in-memory database, with the room's broadcaster captured. The founder Fay sets slow mode; Mel posts, and is held
 * back by it to the second; Vic visits from Aurora and replies to Mel; Fay closes the board to visitors; Mel posts as
 * her persona and edits it; Nia reacts and takes it back; the officer Otto hides Vic's message; Mel continues her first
 * message in a Hub thread; Nia's sidebar count follows all of it until she reads the board.
 *
 * Every broadcast is checked against the live schema (it carries nothing viewer-specific or moderator-only) and for
 * what a persona must not reveal. Folds nav-counts (no realm, own and hidden and continued messages left out, the 100
 * clamp, zero after a read) and board-thread (found through the board category; a realm without a board gives null
 * and creates nothing), and the session's happy paths of realm-board-writes, realm-board, realm-board-continue,
 * realm-board-live, reaction-reads, read-marks, thinkpagesForumBoard, thinkpagesForumReactions and after-write (a
 * board message notifies without watching).
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
const mockBroadcaster = { broadcastBoard: jest.fn(), broadcastMessage: jest.fn() };
jest.mock("~/server/websocket-server", () => ({ getThinkPagesBroadcaster: () => mockBroadcaster }));

import { boardLiveEventSchema, type BoardLiveEvent } from "~/lib/thinkpages-forum/board-live";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { thinkpagesForumModRouter } from "~/server/api/routers/thinkpagesForum/mod";
import { boardThreadOf } from "~/server/modules/thinkpages-forum";
import { canTypeOnBoard } from "~/server/modules/thinkpages-forum/board-socket";
import {
  addMember,
  addNation,
  addPersona,
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
const mod = createCallerFactory(thinkpagesForumModRouter);
const notices = jest.mocked(notificationAPI.createMany);

const NOW = Date.UTC(2026, 9, 21, 19);
const SECOND = 1000;
const at = (ms: number) => jest.setSystemTime(new Date(NOW + ms));

/** What the room received since the last call, each event checked against the live schema. */
function room(): BoardLiveEvent[] {
  const events = mockBroadcaster.broadcastBoard.mock.calls.map(([e]) => e as BoardLiveEvent);
  mockBroadcaster.broadcastBoard.mockClear();
  for (const event of events) {
    // The schema has no place for a viewer's flags or a moderator's verdicts: a parse that changes it would strip them
    expect(boardLiveEventSchema.parse(JSON.parse(JSON.stringify(event)))).toEqual(
      JSON.parse(JSON.stringify(event))
    );
  }
  return events;
}

let db: MemoryPrisma;
let fay: Member, mel: Member, nia: Member, vic: Member, otto: Member, pat: Member;
let herald: { id: string };

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
  mockBroadcaster.broadcastBoard.mockClear();
  notices.mockClear();
  db = forumDb();
  mockDb = db;
  await addSiteBoards(db as never);
  [fay, mel, nia, vic, otto, pat] = await Promise.all(
    ["fay", "mel", "nia", "vic", "otto", "pat"].map((id) => addMember(db as never, id))
  );
  await addRealm(db as never, { id: "eurth", name: "Eurth", ownerClerkId: fay.clerkUserId });
  await addRealm(db as never, { id: "aurora", name: "Aurora", ownerClerkId: "aurora-founder" });
  await addNation(db as never, "aurelia", "eurth", mel.id);
  await addNation(db as never, "borealis", "eurth", nia.id);
  await addNation(db as never, "corvia", "eurth", otto.id);
  await addNation(db as never, "dunmore", "aurora", vic.id);
  herald = await addPersona(db as never, "herald", mel, "aurelia", "Aurelian Herald");
  await db.realmOfficer.create({
    data: {
      realmId: "eurth",
      userId: otto.clerkUserId,
      title: "Moderator",
      powers: ["board"],
      appointedBy: fay.clerkUserId,
    },
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("a board session: slow mode, a visitor, a persona, reactions, a hide and a continue, with the sidebar count", async () => {
  const board = await boardThreadOf(db as never, "eurth");
  expect(board).toEqual({ categoryId: expect.any(String), threadId: expect.any(String) });
  const count = async (who: Member) =>
    (await forum(as(db as never, who)).navCounts()).realmBoardNew;
  expect(await count(pat)).toBe(0);
  expect(await count(nia)).toBe(0);

  // Fay sets slow mode to 30 seconds; Nia may not
  await expect(
    forum(as(db as never, nia)).updateBoardSettings({ realmId: "eurth", slowModeSeconds: 10 })
  ).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  await forum(as(db as never, fay)).updateBoardSettings({ realmId: "eurth", slowModeSeconds: 30 });
  expect(room()).toEqual([
    {
      type: "board:settings",
      realmId: "eurth",
      settings: { visitorsAllowed: true, slowModeSeconds: 30 },
    },
  ]);

  // Mel posts, sanitized, and the room gets it in the public shape
  const asMel = forum(as(db as never, mel));
  const { message: first } = await asMel.postBoardMessage({
    realm: "eurth",
    html: '<p>Morning, Eurth <img src=x onerror="alert(1)"></p>',
  });
  expect(first.contentHtml).not.toMatch(/onerror/);
  expect(first).toMatchObject({
    authorUserId: mel.id,
    isVisitor: false,
    visitorRealm: null,
    byViewer: true,
  });
  await settle();
  expect(room()).toEqual([
    {
      type: "board:message",
      realmId: "eurth",
      message: expect.objectContaining({ id: first.id, authorUserId: mel.id }),
    },
  ]);

  // Ten seconds later slow mode holds her back for exactly the twenty left, as structured data, writing nothing
  at(10 * SECOND);
  const held = await asMel
    .postBoardMessage({ realm: "eurth", html: "<p>Again</p>" })
    .catch((e: unknown) => e);
  expect(held).toMatchObject({
    code: "TOO_MANY_REQUESTS",
    cause: { context: { retryAfterSeconds: 20 } },
  });
  expect(await db.forumPost.count({ where: { threadId: board!.threadId } })).toBe(1);
  await settle();
  expect(room()).toEqual([]);

  // Vic visits from Aurora and replies to Mel: labelled with Aurora; Mel is told, and nobody starts watching
  const { message: visit } = await forum(as(db as never, vic)).postBoardMessage({
    realm: "eurth",
    html: "<p>Greetings from Aurora</p>",
    replyToPostId: first.id,
  });
  expect(visit).toMatchObject({
    isVisitor: true,
    visitorRealm: { slug: "aurora", name: "Aurora" },
  });
  await settle();
  expect(
    notices.mock.calls.flatMap(
      ([batch]) => batch as Array<{ userId: string; metadata: { kind: string } }>
    )
  ).toEqual([
    expect.objectContaining({
      userId: mel.clerkUserId,
      metadata: expect.objectContaining({ kind: "reply" }),
    }),
  ]);
  expect(await db.forumThreadWatch.count()).toBe(0);
  room();

  // Fay closes the board to visitors (slow mode kept): Vic is refused and can no longer type there; Mel still can
  await forum(as(db as never, fay)).updateBoardSettings({
    realmId: "eurth",
    visitorsAllowed: false,
  });
  expect(room()).toEqual([
    {
      type: "board:settings",
      realmId: "eurth",
      settings: { visitorsAllowed: false, slowModeSeconds: 30 },
    },
  ]);
  at(60 * SECOND);
  await expect(
    forum(as(db as never, vic)).postBoardMessage({ realm: "eurth", html: "<p>Still here?</p>" })
  ).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  expect(await canTypeOnBoard(db as never, vic.clerkUserId, "eurth")).toBe(false);
  expect(await canTypeOnBoard(db as never, mel.clerkUserId, "eurth")).toBe(true);

  // Mel posts as her persona and edits it: the room, a member and an anonymous reader see the persona only;
  // the moderator sees the player behind it
  const { message: herald1 } = await asMel.postBoardMessage({
    realm: "eurth",
    html: "<p>Hear ye</p>",
    personaId: herald.id,
  });
  expect(herald1).toMatchObject({ authorPersonaId: herald.id, authorUserId: null });
  await asMel.editBoardMessage({ postId: herald1.id, html: "<p>Hear ye, hear ye</p>" });
  await settle();
  const [posted, edited] = room();
  for (const event of [posted, edited]) expect(JSON.stringify(event)).not.toContain(mel.id);
  expect(edited).toMatchObject({
    type: "board:updated",
    change: { type: "updated", message: { id: herald1.id } },
  });
  const messageOf = (page: { messages: Array<{ id: string }> }, id: string) =>
    page.messages.find((m) => m.id === id);
  for (const reader of [as(db as never, nia), anonymous(db as never)]) {
    expect(messageOf(await forum(reader).getBoard({ realm: "eurth" }), herald1.id)).toMatchObject({
      authorUserId: null,
      author: expect.objectContaining({ name: "Aurelian Herald" }),
    });
  }
  const modView = await forum(as(db as never, otto)).getBoard({ realm: "eurth" });
  expect(messageOf(modView, herald1.id)).toMatchObject({
    authorUserId: mel.id,
    authorPersonaId: herald.id,
  });
  expect(modView.messages.map((m: { id: string }) => m.id)).toEqual([
    herald1.id,
    visit.id,
    first.id,
  ]);

  // Nia reacts to Mel's first message and takes it back: the room gets the counts, never Nia's own reaction
  const asNia = forum(as(db as never, nia));
  await asNia.react({ postId: first.id, type: "like" });
  await asNia.unreact({ postId: first.id });
  await settle();
  const [reacted, unreacted] = room();
  expect(reacted).toMatchObject({ change: { message: { id: first.id, reactions: { like: 1 } } } });
  expect(unreacted).toMatchObject({ change: { message: { id: first.id, reactions: {} } } });
  expect(JSON.stringify([reacted, unreacted])).not.toContain("myReaction");

  // Otto hides Vic's message: the room is told only which post went
  await mod(as(db as never, otto)).setPostHidden({
    postId: visit.id,
    hidden: true,
    note: "off-topic",
  });
  await settle();
  expect(room()).toEqual([
    { type: "board:updated", realmId: "eurth", change: { type: "removed", postId: visit.id } },
  ]);

  // Mel continues her first message in the Hub: it becomes the thread's first post, a placeholder stays behind
  const moved = await asMel.continueInThread({ postId: first.id, title: "Mornings in Eurth" });
  await settle();
  const hubThread = await db.forumThread.findUnique({
    where: { id: moved.threadId },
    include: { category: true, posts: true },
  });
  expect(hubThread).toMatchObject({
    title: "Mornings in Eurth",
    category: { key: "hub", realmId: "eurth" },
  });
  expect(hubThread.posts.map((p: { id: string }) => p.id)).toEqual([first.id]);
  expect(room()).toEqual([
    { type: "board:updated", realmId: "eurth", change: { type: "removed", postId: first.id } },
    {
      type: "board:updated",
      realmId: "eurth",
      change: {
        type: "updated",
        message: expect.objectContaining({
          id: moved.placeholder.id,
          continued: expect.anything(),
        }),
      },
    },
  ]);

  // Nia's count: Mel's persona message only (the hidden one and the placeholder are not shown on Home);
  // her own message does not count; reading the board clears it
  at(120 * SECOND);
  await asNia.postBoardMessage({ realm: "eurth", html: "<p>Evening all</p>" });
  expect(await count(nia)).toBe(1);
  await asNia.markRealmBoardRead({ realm: "eurth" });
  expect(await count(nia)).toBe(0);
  // A busy evening: the badge stops at 100
  at(180 * SECOND);
  await db.forumPost.createMany({
    data: Array.from({ length: 101 }, (_, i) => ({
      threadId: board!.threadId,
      authorUserId: mel.id,
      contentHtml: `<p>${i}</p>`,
      plainText: String(i),
      createdAt: new Date(NOW + 180 * SECOND + i),
    })),
  });
  expect(await count(nia)).toBe(100);

  // A realm without a board has none, and looking creates nothing
  await db.realm.create({
    data: { id: "bare", slug: "bare", name: "Bare", ownerId: "x", status: "active" },
  });
  const threads = await db.forumThread.count();
  expect(await boardThreadOf(db as never, "bare")).toBeNull();
  expect(await db.forumThread.count()).toBe(threads);
});
