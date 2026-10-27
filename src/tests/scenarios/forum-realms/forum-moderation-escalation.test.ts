/** @jest-environment node */
/**
 * Moderation from a report to an overturned ban, through the real `thinkpagesForum` and `thinkpagesForumMod`
 * procedures on the in-memory database. In Eurth's Hub, Rae reports Max's reply; Eurth's moderator Otto resolves it
 * with a 2-point warning (3 is over his cap and changes nothing); the site admin Ada adds 3 more, which crosses the
 * 5-point tier and bans Max sitewide for 7 days as Ada; Max is refused everywhere with the ban's notice; he appeals the
 * ban and Ada's warning; Ada cannot review either; Abe overturns the warning, which revokes it, lifts the automatic
 * ban and closes the ban's appeal as moot; Max posts again; ninety days later his last warning has expired.
 *
 * Folds the escalation cases of mod-warnings (90-day warning, the 5-point tier issued as the crossing warning's
 * issuer, a realm moderator's 2 points counting sitewide), mod-appeals (the warning issuer refused, an overturn that
 * revokes and lifts, the moot ban appeal), mod-reports (filing and resolving), mod-standing (active points),
 * board-list-can-start (a site ban closes every board), thinkpagesForumMod (the warning, automatic ban, appeal and
 * lift notices), writes (posting again once the ban is lifted) and moderation-policy (points, tier, expiry, the
 * notice text).
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

import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { thinkpagesForumModRouter } from "~/server/api/routers/thinkpagesForum/mod";
import {
  addMember,
  addNation,
  addRealm,
  addSiteBoards,
  as,
  forumDb,
  settle,
  type Member,
} from "~/tests/helpers/forum-world";
import type { MemoryPrisma } from "~/tests/helpers/memory-prisma";

const forum = createCallerFactory(thinkpagesForumRouter);
const mod = createCallerFactory(thinkpagesForumModRouter);
const notices = jest.mocked(notificationAPI.create);

const NOW = Date.UTC(2026, 9, 21, 12);
const DAY = 86_400_000;
const at = (ms: number) => jest.setSystemTime(new Date(NOW + ms));
const titlesTo = (member: Member) =>
  notices.mock.calls
    .map(([n]) => n as { userId: string; title: string })
    .filter((n) => n.userId === member.clerkUserId)
    .map((n) => n.title);

let db: MemoryPrisma;
let max: Member, rae: Member, otto: Member, ada: Member, abe: Member;

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
  [max, rae, otto, ada, abe] = await Promise.all([
    addMember(db as never, "max"),
    addMember(db as never, "rae"),
    addMember(db as never, "otto"),
    addMember(db as never, "ada", { admin: true }),
    addMember(db as never, "abe", { admin: true }),
  ]);
  await addRealm(db as never, { id: "eurth", name: "Eurth", ownerClerkId: "fay-clerk" });
  for (const [nation, owner] of [
    ["aurelia", max],
    ["borealis", rae],
    ["corvia", otto],
  ] as const) {
    await addNation(db as never, nation, "eurth", owner.id);
  }
  // Otto moderates Eurth's forum (the board power).
  await db.realmOfficer.create({
    data: {
      realmId: "eurth",
      userId: otto.clerkUserId,
      title: "Moderator",
      powers: ["board"],
      appointedBy: "fay-clerk",
    },
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("a report becomes warnings, an automatic sitewide ban, an appeal and an overturn, and the member posts again", async () => {
  const thread = await forum(as(db as never, rae)).createThread({
    categoryKey: "hub",
    realm: "eurth",
    title: "Trade routes",
    html: "<p>Where do the caravans go?</p>",
  });
  const spam = await forum(as(db as never, max)).reply({
    threadId: thread.threadId,
    html: "<p>Cheap gold at example.com</p>",
  });
  await settle();
  const log = async () =>
    (
      await db.forumModLog.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { actorId: true, action: true, scope: true, scopeId: true },
      })
    ).map((r: { actorId: string; action: string; scope: string; scopeId: string | null }) =>
      [r.actorId, r.action, r.scope, r.scopeId].join(" ")
    );

  // Rae reports the reply; only its id comes back
  const report = await forum(as(db as never, rae)).report({
    targetType: "post",
    targetId: spam.postId,
    reason: "  Spam link  ",
  });
  expect(Object.keys(report)).toEqual(["reportId"]);
  const hub = await db.forumCategory.findFirstOrThrow({ where: { realmId: "eurth", key: "hub" } });
  expect(await db.forumReport.findUnique({ where: { id: report.reportId } })).toMatchObject({
    status: "open",
    categoryId: hub.id,
    reporterId: rae.id,
    targetAuthorId: max.id,
    reason: "Spam link",
  });

  // Otto may give 2 points, not 3: the refusal writes nothing; the 2 points last 90 days and bring no ban
  const asOtto = mod(as(db as never, otto));
  const target = { type: "post" as const, id: spam.postId };
  await expect(
    asOtto.warn({ userId: max.id, points: 3, reason: "Spam", target })
  ).rejects.toThrow();
  expect(await log()).toEqual([]);
  expect(await asOtto.warn({ userId: max.id, points: 2, reason: "Spam", target })).toMatchObject({
    activePoints: 2,
    autoBan: null,
  });
  await asOtto.resolveReport({ reportId: report.reportId, outcome: "resolved" });
  const [otto2] = await db.forumWarning.findMany({ where: { issuedBy: otto.id } });
  expect(otto2.expiresAt).toEqual(new Date(NOW + 90 * DAY));
  expect(await db.forumBan.count()).toBe(0);
  expect(await db.forumReport.findUnique({ where: { id: report.reportId } })).toMatchObject({
    status: "resolved",
    handledBy: otto.id,
  });

  // Ada's 3 sitewide points make 5: a 7-day sitewide ban, issued as Ada, and Max hears of both
  at(DAY);
  const crossed = await mod(as(db as never, ada)).warn({
    userId: max.id,
    points: 3,
    reason: "Repeated spam",
  });
  expect(crossed).toMatchObject({ activePoints: 5 });
  const [ban] = await db.forumBan.findMany();
  expect(ban).toMatchObject({
    userId: max.id,
    scope: "site",
    auto: true,
    autoTier: 5,
    issuedBy: ada.id,
    expiresAt: new Date(NOW + 8 * DAY),
    liftedAt: null,
  });
  expect(titlesTo(max)).toEqual([
    "You received a forum warning",
    "You received a forum warning",
    expect.stringMatching(/ban/i),
  ]);

  // Max is refused everywhere, with the ban's notice
  const asMax = forum(as(db as never, max));
  await expect(asMax.reply({ threadId: thread.threadId, html: "<p>Sorry</p>" })).rejects.toThrow(
    /You are banned from .* until .*: /
  );
  const boards = await asMax.categories();
  expect(boards.length).toBeGreaterThan(0);
  expect(boards.filter((b: { canStart: boolean }) => b.canStart)).toEqual([]);

  // He appeals the ban and Ada's warning; Ada issued both, so she may review neither
  const adaWarning = await db.forumWarning.findFirstOrThrow({ where: { issuedBy: ada.id } });
  const banAppeal = await asMax.appeal({
    subjectType: "ban",
    subjectId: ban.id,
    body: "I have stopped posting links.",
  });
  const warningAppeal = await asMax.appeal({
    subjectType: "warning",
    subjectId: adaWarning.id,
    body: "This was the same post as before.",
  });
  const asAda = mod(as(db as never, ada));
  for (const appeal of [banAppeal, warningAppeal]) {
    await expect(
      asAda.reviewAppeal({ appealId: appeal.appealId, outcome: "overturned", response: "Fine" })
    ).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  }

  // Abe overturns the warning: it is revoked, 2 points remain, the automatic ban is lifted, its appeal is moot
  at(2 * DAY);
  notices.mockClear();
  await mod(as(db as never, abe)).reviewAppeal({
    appealId: warningAppeal.appealId,
    outcome: "overturned",
    response: "Counted twice.",
  });
  expect(await db.forumWarning.findUnique({ where: { id: adaWarning.id } })).toMatchObject({
    revokedBy: abe.id,
    revokedAt: new Date(NOW + 2 * DAY),
  });
  expect(await db.forumBan.findUnique({ where: { id: ban.id } })).toMatchObject({
    liftedAt: new Date(NOW + 2 * DAY),
  });
  const appeals = await db.forumAppeal.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true },
  });
  expect(appeals).toEqual([
    { id: banAppeal.appealId, status: "moot" },
    { id: warningAppeal.appealId, status: "overturned" },
  ]);
  expect(titlesTo(max)).toHaveLength(2);

  // Max posts again, and his standing shows what happened without naming anyone who acted
  await asMax.reply({ threadId: thread.threadId, html: "<p>Back, without links.</p>" });
  const standing = await asMax.myStanding();
  expect(standing.activePoints).toBe(2);
  expect(JSON.stringify(standing)).not.toMatch(
    new RegExp(
      [otto.id, ada.id, abe.id, "issuedBy", "reviewedBy", "liftedBy", "revokedBy"].join("|")
    )
  );

  // One log row per committed action, each at its scope
  expect(await log()).toEqual([
    `${otto.id} warning.issue category ${hub.id}`,
    `${otto.id} report.resolve realm eurth`,
    `${ada.id} warning.issue site `,
    `${ada.id} ban.auto site `,
    `${abe.id} appeal.review site `,
    `${abe.id} warning.revoke site `,
    `${abe.id} ban.lift site `,
    expect.stringMatching(/appeal\.moot/),
  ]);

  // Ninety days after Otto's warning it has expired: no active points are left
  at(91 * DAY);
  expect((await asMax.myStanding()).activePoints).toBe(0);
});
