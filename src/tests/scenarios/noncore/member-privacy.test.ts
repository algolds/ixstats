/** @jest-environment node */
/**
 * A member's privacy settings decide what other members see. Hana writes on IxWiki as "Hana Wiki" (a verified link,
 * Lorewards medals and a featured-article award) and has no nation. She turns wiki attribution off in Settings →
 * Privacy: every surface that names players stops using her wiki name (display names, messaging, a ThinkTank's
 * roster, feed and join notices, her achievements as others see them, her passport handle), she still sees her own,
 * and turning it back on restores it. A switch that cannot be read hides every wiki name.
 *
 * Her direct messages are open to followers only, with read receipts and online status off. Sam, outside her
 * audience, starts a conversation: it waits in her Requests folder and she is not told. She accepts, and Sam's next
 * message reaches her. "Seen" shows only once both allow receipts, and her online dot only once she allows it. Omar's
 * request she declines, and he cannot write again; Ivy accepts nobody, or no requests, and refuses outright.
 *
 * Folds display-names, account-resolver-wiki-attribution, thinktanks-wiki-attribution, achievements-wiki-attribution,
 * the attribution case of ixnayid-status-verified-wiki, and message-requests.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
const mockThinktankActivity = jest.fn().mockResolvedValue(undefined);
jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: { onThinktankActivity: (...a: unknown[]) => mockThinktankActivity(...a) },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { achievementsProgressRouter } from "~/server/api/routers/achievements/progress";
import { ixnayidCoreRouter } from "~/server/api/routers/ixnayid/core";
import { thinkpagesThinktanksRouter } from "~/server/api/routers/thinkpages/thinktanks";
import { usersPreferencesRouter } from "~/server/api/routers/users/preferences";
import { createMessagingService } from "~/server/modules/messaging";
import { batchResolveMessagingAccounts } from "~/server/modules/messaging/account-resolver";
import { resolveDisplayNames, UNKNOWN_DISPLAY_NAME } from "~/server/shared/display-names";
import { recordHeartbeat, resetPresenceForTests } from "~/server/shared/presence";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const settings = createCallerFactory(usersPreferencesRouter);
const thinktanks = createCallerFactory(thinkpagesThinktanksRouter);
const achievements = createCallerFactory(achievementsProgressRouter);
const ixnayid = createCallerFactory(ixnayidCoreRouter);

const SECRET_PAGE = "Hana's Secret Article";
const HANA = "hana-clerk";
const SAM = "sam-clerk";
const OMAR = "omar-clerk";
const IVY = "ivy-clerk";

let db: MemoryPrisma;

const as = (id: string | null) =>
  createMockCallerContext({
    db,
    auth: id ? { userId: `${id}-clerk` } : null,
    user: id ? { id, clerkUserId: `${id}-clerk`, countryId: id === "omar" ? "omaria" : null } : null,
    rateLimitIdentifier: `${id}-${Math.random()}`,
  });

const privacy = (id: string, config: Record<string, string | boolean>) =>
  settings(as(id)).updatePrivacyConfig(config);

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  mockThinktankActivity.mockClear();
  resetPresenceForTests();
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, { id: "omaria", name: "Omaria", baselineDate: new Date() });
  const people = [
    { id: "hana", wikiUsername: "Hana Wiki" },
    { id: "sam", wikiUsername: "Sam Wiki" },
    { id: "omar", wikiUsername: null, countryId: "omaria" },
    { id: "ivy", wikiUsername: null },
  ];
  for (const p of people) {
    await db.user.create({
      data: { id: p.id, clerkUserId: `${p.id}-clerk`, wikiUsername: p.wikiUsername, countryId: p.countryId ?? null, lastSeenAt: new Date() },
    });
  }
  await db.country.update({ where: { id: "omaria" }, data: { ownerUserId: "omar" } });
  await db.wikiAccountLink.create({
    data: { userId: "hana", source: "ixwiki", username: "Hana Wiki", verifiedAt: new Date() },
  });
  await db.lorewardUserStats.create({
    data: { username: "Hana Wiki", dailyWins: 3, weeklyWins: 0, monthlyWins: 0, totalScore: 30 } as never,
  });
  await db.wikiArticleAward.create({
    data: {
      name: "Featured Article",
      pageTitle: SECRET_PAGE,
      pageSlug: "Hanas_Secret_Article",
      category: "FEATURED",
      recipientUsers: ["Hana Wiki"],
      awardedAt: new Date(0),
    } as never,
  });
});
afterEach(() => jest.restoreAllMocks());

/** Omar's public ThinkTank, which Hana and Sam join. */
async function economists() {
  const group = await thinktanks(as("omar")).createThinktank({ name: "Economists", type: "public" });
  for (const id of ["hana", "sam"]) await thinktanks(as(id)).joinThinktank({ groupId: group.id });
  return group.id;
}

/** Hana and Sam post in the group; a first post creates each one's personal persona. */
async function post(groupId: string) {
  for (const id of ["hana", "sam"]) {
    await thinktanks(as(id)).createGroupPost({ groupId, content: `${id} on tariffs` });
  }
}

/** How each surface names Hana and Sam, as `viewer` sees them. */
async function namesSeenBy(viewer: string | null, groupId: string) {
  const display = await resolveDisplayNames(db as never, [HANA, SAM, OMAR, "ghost-clerk"]);
  const messaging = await batchResolveMessagingAccounts([HANA, SAM], db as never);
  const group = await thinktanks(as(viewer)).getThinktankById({ groupId });
  const roster = new Map(group!.members.map((m) => [m.userId, (m.user as { wikiUsername?: string | null }).wikiUsername]));
  const { posts } = await thinktanks(as(viewer)).getGroupFeed({ groupId });
  const feed = new Map(posts.map((p) => [p.account!.clerkUserId, p.realUser?.wikiUsername ?? null]));
  return {
    display: [display.get(HANA), display.get(SAM), display.get(OMAR), display.get("ghost-clerk")],
    messaging: [messaging.get(HANA)?.displayName, messaging.get(SAM)?.displayName],
    roster: [roster.get(HANA), roster.get(SAM)],
    feed: [feed.get(HANA), feed.get(SAM)],
  };
}

/** Hana's Lorewards medal and wiki award as `viewer` sees her achievements. */
async function hanasLorewardsSeenBy(viewer: string) {
  const list = await achievements(as(viewer)).getAllWithStatus({ userId: HANA });
  return {
    bronze: list.find((r) => r.key === "ool-bronze")?.isUnlocked ?? false,
    awards: list.filter((r) => r.key.startsWith("wiki-award-")).length,
    namesPage: JSON.stringify(list).includes(SECRET_PAGE),
  };
}

it("hides Hana's wiki name everywhere others see her while attribution is off, and shows it again once on", async () => {
  await privacy("hana", { showWikiAttribution: false });
  const groupId = await economists();
  await post(groupId);

  // With her wiki name hidden, she is named by her personal persona (made by her first post)
  const persona = await db.thinkpagesAccount.findFirstOrThrow({ where: { clerkUserId: HANA } });
  expect(persona.displayName).not.toContain("Hana Wiki");
  for (const viewer of [null, "omar", "hana"]) {
    const seen = await namesSeenBy(viewer, groupId);
    expect(seen.display[0]).toBe(persona.displayName);
    expect(seen.display.slice(1)).toEqual(["Sam Wiki", "Omaria", UNKNOWN_DISPLAY_NAME]);
    expect(seen.messaging[0]).not.toBe("Hana Wiki");
    expect(seen.messaging[1]).toBe("Sam Wiki");
    expect(seen.roster).toEqual([null, "Sam Wiki"]);
    expect(seen.feed).toEqual([null, "Sam Wiki"]);
  }
  // The join notice did not name her by her wiki name either
  const hanaJoined = mockThinktankActivity.mock.calls
    .map(([n]) => n as { actorUserId: string; actorUserName: string })
    .filter((n) => n.actorUserId === HANA);
  expect(hanaJoined.length).toBeGreaterThan(0);
  for (const notice of hanaJoined) expect(notice.actorUserName).not.toContain("Hana Wiki");

  expect(await hanasLorewardsSeenBy("omar")).toEqual({ bronze: false, awards: 0, namesPage: false });
  expect(await hanasLorewardsSeenBy("hana")).toEqual({ bronze: true, awards: 1, namesPage: true });

  // Her passport handle (on every share link) skips the wiki name; her own settings still show the link
  const status = await ixnayid(as("hana")).getStatus();
  expect(status.passportHandle).not.toMatch(/hana[ _]wiki/i);
  expect(status.wiki).toMatchObject({ linked: true, username: "Hana Wiki" });

  await privacy("hana", { showWikiAttribution: true });
  const seen = await namesSeenBy("omar", groupId);
  expect(seen.display[0]).toBe("Hana Wiki");
  expect(seen.messaging[0]).toBe("Hana Wiki");
  expect(seen.roster[0]).toBe("Hana Wiki");
  expect(seen.feed[0]).toBe("Hana Wiki");
  expect(await hanasLorewardsSeenBy("omar")).toEqual({ bronze: true, awards: 1, namesPage: true });
});

it("hides every wiki name when the privacy switches cannot be read", async () => {
  const groupId = await economists();
  const unreadable = () => jest.spyOn(db.userConnection, "findMany").mockRejectedValue(new Error("db down"));

  unreadable();
  const display = await resolveDisplayNames(db as never, [HANA, SAM, OMAR]);
  expect([HANA, SAM, OMAR].map((id) => display.get(id))).toEqual([
    UNKNOWN_DISPLAY_NAME,
    UNKNOWN_DISPLAY_NAME,
    "Omaria",
  ]);
  const messaging = await batchResolveMessagingAccounts([HANA, SAM], db as never);
  expect([messaging.get(HANA)?.displayName, messaging.get(SAM)?.displayName]).toEqual([
    UNKNOWN_DISPLAY_NAME,
    UNKNOWN_DISPLAY_NAME,
  ]);
  const group = await thinktanks(as(null)).getThinktankById({ groupId });
  expect(group!.members.map((m) => (m.user as { wikiUsername?: string | null }).wikiUsername ?? null)).toEqual([
    null,
    null,
    null,
  ]);
  expect(await hanasLorewardsSeenBy("omar")).toEqual({ bronze: false, awards: 0, namesPage: false });

  jest.restoreAllMocks();
  await post(groupId);
  unreadable();
  const { posts } = await thinktanks(as(null)).getGroupFeed({ groupId });
  expect(posts.map((p) => p.realUser?.wikiUsername ?? null)).toEqual([null, null]);
});

// A first post names the personal persona after what was shown then, here the wiki name. Once Hana turns attribution
// off, nothing falls back to that persona (owner 2026-10-21: stop the fallback; the persona keeps its name).
it("stops naming Hana by her wiki name through a persona made while it was shown", async () => {
  const groupId = await economists();
  await post(groupId);
  const persona = await db.thinkpagesAccount.findFirstOrThrow({ where: { clerkUserId: HANA } });
  expect(persona.displayName).toBe("Hana Wiki");
  await privacy("hana", { showWikiAttribution: false });

  expect((await resolveDisplayNames(db as never, [HANA, SAM])).get(HANA)).toBe(UNKNOWN_DISPLAY_NAME);
  const messaging = await batchResolveMessagingAccounts([HANA], db as never);
  expect(messaging.get(HANA)?.displayName).toBe(UNKNOWN_DISPLAY_NAME);
  const group = await thinktanks(as("omar")).getThinktankById({ groupId });
  const rosterName = (id: string) =>
    (group!.members.find((m) => m.userId === id)?.user as { displayName?: string } | undefined)?.displayName;
  expect([rosterName(HANA), rosterName(SAM)]).toEqual([UNKNOWN_DISPLAY_NAME, "Sam Wiki"]);
  const after = await db.thinkpagesAccount.findFirstOrThrow({ where: { clerkUserId: HANA } });
  expect(after.displayName).toBe("Hana Wiki");
});

it("keeps a message from outside Hana's audience as a request, and honours both sides' receipts and online status", async () => {
  const notifications = { create: jest.fn().mockResolvedValue("n") };
  const svc = createMessagingService({
    db: db as never,
    notifications: notifications as never,
    websocket: { broadcastToUsers: jest.fn() } as never,
  });
  const told = (who: string) => notifications.create.mock.calls.filter(([n]) => n.userId === who).length;
  // Omar wrote to Hana while she took messages from everyone
  const omars = await svc.createConversation(OMAR, { participantIds: [HANA] } as never);
  await svc.sendMessage(OMAR, { conversationId: omars.id, content: "Hello neighbour" } as never);
  expect(told(HANA)).toBe(1);

  await privacy("hana", { directMessages: "followers", dmReadReceipts: false, showOnlineStatus: false });
  await privacy("ivy", { directMessages: "nobody" });
  // Now outside her audience, his next message moves the conversation to her requests, untold
  await svc.sendMessage(OMAR, { conversationId: omars.id, content: "Hello again" } as never);
  expect(told(HANA)).toBe(1);

  // Ivy takes messages from nobody, and refusing requests outright does the same
  await expect(svc.createConversation(SAM, { participantIds: [IVY] } as never)).rejects.toMatchObject({
    name: "MessagingBlockedError",
  });
  await privacy("ivy", { directMessages: "followers", messageRequestFiltering: false });
  await expect(svc.createConversation(SAM, { participantIds: [IVY] } as never)).rejects.toMatchObject({
    name: "MessagingBlockedError",
  });

  // Inside the audience (Sam takes messages from everyone) a conversation is a plain one
  const plain = await svc.createConversation(HANA, { participantIds: [SAM] } as never);
  const samInPlain = plain.participants.find((p: { userId: string }) => p.userId === SAM);
  expect(samInPlain?.requestStatus).not.toBe("pending");

  // Outside Hana's: a request she is not told of, in her Requests folder and not her inbox
  const request = await svc.createConversation(SAM, { participantIds: [HANA] } as never);
  await svc.sendMessage(SAM, { conversationId: request.id, content: "Trade talks?" } as never);
  await svc.sendMessage(SAM, { conversationId: request.id, content: "Anyone there?" } as never);
  expect(told(HANA)).toBe(1);
  const folder = async (who: string, name: "requests" | "conversations") =>
    (await svc.getConversationsByFolder(who, { folder: name } as never)).conversations.map((c: { id: string }) => c.id);
  expect((await folder(HANA, "requests")).sort()).toEqual([omars.id, request.id].sort());
  expect(await folder(HANA, "conversations")).not.toContain(request.id);
  const listed = async (who: string, name: "requests" | "conversations") =>
    (await svc.getConversationsByFolder(who, { folder: name } as never)).conversations.find(
      (c: { id: string }) => c.id === request.id
    );
  expect(await listed(HANA, "requests")).toMatchObject({ isRequest: true, awaitingAcceptance: false });
  expect(await listed(SAM, "conversations")).toMatchObject({ isRequest: false, awaitingAcceptance: true });
  await expect(svc.getSeenState(SAM, request.id)).resolves.toEqual({ seenAt: null });

  await expect(svc.respondToRequest(HANA, { conversationId: request.id, accept: true })).resolves.toEqual({
    success: true,
    accepted: true,
  });
  await expect(svc.respondToRequest(HANA, { conversationId: request.id, accept: true })).rejects.toMatchObject({
    name: "MessagingNotFoundError",
  });
  await svc.sendMessage(SAM, { conversationId: request.id, content: "Thanks for accepting" } as never);
  expect(told(HANA)).toBe(2);

  // Seen: hidden while Hana's receipts are off, shown once both allow them; never to a stranger
  await svc.markMessagesAsRead(HANA, { conversationId: request.id });
  await expect(svc.getSeenState(SAM, request.id)).resolves.toEqual({ seenAt: null });
  await privacy("hana", { dmReadReceipts: true });
  const { seenAt } = await svc.getSeenState(SAM, request.id);
  expect(seenAt).toBeInstanceOf(Date);
  await expect(svc.getSeenState(OMAR, request.id)).rejects.toMatchObject({ name: "MessagingForbiddenError" });

  // Online: a recent heartbeat shows only once Hana allows it
  await recordHeartbeat(HANA);
  const hanaOnline = async () => {
    const { conversations } = await svc.getConversationsByFolder(SAM, { folder: "conversations" } as never);
    const conv = conversations.find((c: { id: string }) => c.id === request.id);
    return conv.otherParticipants[0].isOnline;
  };
  expect(await hanaOnline()).toBe(false);
  await privacy("hana", { showOnlineStatus: true });
  expect(await hanaOnline()).toBe(true);

  // Omar's request she declines: she leaves it, and he cannot write again
  await svc.respondToRequest(HANA, { conversationId: omars.id, accept: false });
  await expect(
    svc.sendMessage(OMAR, { conversationId: omars.id, content: "Reconsider?" } as never)
  ).rejects.toMatchObject({ name: "MessagingBlockedError" });
  expect(told(HANA)).toBe(2);
});
