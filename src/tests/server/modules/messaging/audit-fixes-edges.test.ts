/** @jest-environment node */
/**
 * The audit fixes that sit outside the messaging module: the sports desk and feedback threads are written under the
 * CLERK id (the one ThinkShare participants use), the wiki talk sync runs once per user per window, and the admin
 * inputs refuse unsafe links and unbounded attachments.
 */
jest.mock("~/lib/sports/notify-config", () => ({
  getSportsNotifyConfig: jest.fn().mockResolvedValue({ clubDms: true }),
}));
jest.mock("~/lib/notifications/recipient-preferences", () => ({
  recipientAccepts: jest.fn().mockResolvedValue(false),
}));
jest.mock("~/lib/notifications/delivery/deliver", () => ({ deliverNotification: jest.fn() }));
const getArticleWikitext = jest.fn();
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getArticleWikitext: (...args: unknown[]) => getArticleWikitext(...args),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n") },
}));
jest.mock("~/lib/identity/wiki-names", () => ({
  primaryNameOf: jest.fn().mockResolvedValue("Ana"),
}));

import type { PrismaClient } from "@prisma/client";
import { notifyClubMatchResult } from "~/lib/sports/club-notify";
import { resetWikiTalkSyncThrottle, wikiTalkBridge } from "~/server/bridges/wiki-talk-bridge";
import { AttachmentsSchema, isSafeUrl } from "~/server/api/routers/messages/_schemas";
import { messagesMessagingRouter } from "~/server/api/routers/messages/messaging";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  db = createMemoryPrisma();
  await db.user.create({ data: { id: "u1", clerkUserId: "user_clerk_1", lastSeenAt: new Date() } });
});
afterEach(() => jest.restoreAllMocks());

const result = {
  userId: "u1", // a club owner is held by the internal User id
  leagueName: "League",
  teamName: "Hawks",
  opponentName: "Owls",
  teamScore: 2,
  opponentScore: 1,
  matchDay: 3,
  teamId: "t1",
};

describe("the sports desk", () => {
  it("is kept under the owner's Clerk id, one conversation for every result", async () => {
    await notifyClubMatchResult(db as unknown as PrismaClient, result);
    await notifyClubMatchResult(db as unknown as PrismaClient, result);

    const convs = await db.thinkshareConversation.findMany({});
    expect(convs).toHaveLength(1);
    expect(convs[0]).toMatchObject({ source: "sports", sourceId: "user_clerk_1" });
    expect((await db.conversationParticipant.findMany({})).map((p) => p.userId)).toEqual([
      "user_clerk_1",
    ]);
    expect(await db.thinkshareMessage.count({})).toBe(2);
  });

  it("moves a desk made under the internal id to the Clerk id", async () => {
    const old = await db.thinkshareConversation.create({
      data: {
        type: "system",
        source: "sports",
        sourceId: "u1",
        participants: { create: { userId: "u1" } },
      },
    });
    await notifyClubMatchResult(db as unknown as PrismaClient, result);

    expect(await db.thinkshareConversation.count({})).toBe(1);
    expect(await db.thinkshareConversation.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({
      sourceId: "user_clerk_1",
    });
    expect((await db.conversationParticipant.findMany({})).map((p) => p.userId)).toEqual([
      "user_clerk_1",
    ]);
  });
});

describe("the wiki talk sync", () => {
  it("looks at a user's talk page once per window, not on every folder load", async () => {
    resetWikiTalkSyncThrottle();
    getArticleWikitext.mockResolvedValue({ wikitext: "== Hello ==" });

    const first = await wikiTalkBridge.syncInbound("user_clerk_1", db as unknown as PrismaClient);
    const second = await wikiTalkBridge.syncInbound("user_clerk_1", db as unknown as PrismaClient);
    expect(first.conversationsCreated).toBe(1);
    expect(second.conversationsCreated).toBe(0);
    expect(getArticleWikitext).toHaveBeenCalledTimes(1);

    await wikiTalkBridge.syncInbound("someone_else", db as unknown as PrismaClient);
    expect(getArticleWikitext).toHaveBeenCalledTimes(1); // no such user in the db: no wiki name, no fetch

    jest.useFakeTimers().setSystemTime(Date.now() + 6 * 60_000);
    await wikiTalkBridge.syncInbound("user_clerk_1", db as unknown as PrismaClient);
    jest.useRealTimers();
    expect(getArticleWikitext).toHaveBeenCalledTimes(2);
  });
});

describe("admin inputs", () => {
  it.each([
    ["/notifications", true],
    ["/messages?conversation=abc", true],
    ["https://ixwiki.com/wiki/Main_Page", true],
    ["http://ixwiki.com", false],
    ["javascript:alert(1)", false],
    ["//evil.example/path", false],
    ["/\\evil.example", false],
    ["data:text/html,<script>", false],
    ["relative/path", false],
  ])("treats %s as safe: %s", (url, safe) => {
    expect(isSafeUrl(url)).toBe(safe);
  });

  it("allows at most 10 attachments, each with a safe url", () => {
    const attachment = { type: "image", url: "https://cdn.example/a.png" };
    expect(AttachmentsSchema.safeParse(Array(10).fill(attachment)).success).toBe(true);
    expect(AttachmentsSchema.safeParse(Array(11).fill(attachment)).success).toBe(false);
    expect(
      AttachmentsSchema.safeParse([{ type: "image", url: "javascript:alert(1)" }]).success
    ).toBe(false);
  });
});

describe("the admin procedures", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "info").mockImplementation(() => undefined);
  });
  const admin = () =>
    messagesMessagingRouter.createCaller(
      createMockRouterContext({
        auth: { userId: "admin_1" },
        user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
        db: createMockDb(),
      }) as never
    );

  it("refuses an administrator's message carrying unsafe HTML", async () => {
    await expect(
      admin().sendAdminMessage({ targetUserId: "user_clerk_1", content: "<script>alert(1)</script>" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses a broadcast whose link is not a path on this site or an https URL", async () => {
    for (const href of ["javascript:alert(1)", "//evil.example", "http://plain.example"]) {
      await expect(admin().sendAdminBroadcast({ title: "Notice", href })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
  });
});
