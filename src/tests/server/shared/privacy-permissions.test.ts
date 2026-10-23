/** @jest-environment node */
/**
 * SL-4 privacy, enforced on the server. The direct-message, mention and trade-offer audiences ("followers": the sender
 * follows the recipient, by persona or country; "verified": the sender owns a verified persona) and muted words; the
 * privacy switches (fail closed), the online heartbeat, Clear history, a hidden wiki name on `users.resolveWikiAuthor`
 * and linked names in trading partner search; and blocks and mutes: a blocked or muted account's posts leave the
 * viewer's feed, a user who blocked someone cannot be messaged by them, and in a group conversation the blocker no
 * longer sees, or is notified of, the blocked account's messages.
 *
 * Folds privacy-sl4-controls and user-blocks.
 */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

import { createCallerFactory } from "~/server/api/trpc";
import { dropMutedItems } from "~/server/api/routers/activities/feed/shared";
import { thinkpagesFeedRouter } from "~/server/api/routers/thinkpages/feed";
import { usersPreferencesRouter } from "~/server/api/routers/users/preferences";
import { globalCache } from "~/lib/cache";
import { searchTradePartners } from "~/server/modules/cards/trading/partners";
import { createMessagingService } from "~/server/modules/messaging";
import { clearOwnHistory } from "~/server/shared/clear-history";
import {
  ONLINE_WINDOW_MS,
  recordHeartbeat,
  resetPresenceForTests,
  visibleOnlineUserIds,
} from "~/server/shared/presence";
import {
  containsMutedKeyword,
  hiddenLinkedNames,
  mutedKeywords,
  permissionAudiences,
  recipientsRefusing,
  refusesTradeOffer,
  splitDirectMessageRefusals,
  tradeOfferRefusers,
  usersWithSwitchOff,
} from "~/server/shared/privacy-permissions";
import {
  blockedUserClerkIds,
  hiddenThinkpagesAccountIds,
  recipientsBlockingSender,
} from "~/server/shared/user-blocks";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

function withConfigs(configs: Record<string, Record<string, unknown> | string>) {
  const db = createMockPrisma();
  db.userConnection.findMany.mockImplementation(async (args: any) =>
    args.where.connectionType === "privacy_config"
      ? Object.entries(configs).map(([userId, cfg]) => ({
          userId,
          status: typeof cfg === "string" ? cfg : JSON.stringify(cfg),
        }))
      : []
  );
  return db;
}

describe("recipientsRefusing", () => {
  it("allows everyone by default and when no config is stored", async () => {
    const db = withConfigs({ r2: { directMessages: "everyone" }, r3: "not json" });
    expect(
      await recipientsRefusing(db as never, "s", ["r1", "r2", "r3"], "directMessages")
    ).toEqual([]);
  });

  it("refuses for nobody, but never refuses the sender themself", async () => {
    const db = withConfigs({ r1: { mentions: "nobody" }, s: { mentions: "nobody" } });
    expect(await recipientsRefusing(db as never, "s", ["s", "r1"], "mentions")).toEqual(["r1"]);
  });

  it("followers: accepts a persona follow or a country follow, refuses otherwise", async () => {
    const db = withConfigs({
      viaPersona: { directMessages: "followers" },
      viaCountry: { directMessages: "followers" },
      stranger: { directMessages: "followers" },
    });
    db.thinkpagesAccount.findMany.mockResolvedValue([
      { id: "acc_p", clerkUserId: "viaPersona" },
      { id: "acc_s", clerkUserId: "stranger" },
    ]);
    db.thinkpagesFollow.findMany.mockResolvedValue([{ followedAccountId: "acc_p" }]);
    db.user.findMany.mockResolvedValue([
      { clerkUserId: "s", countryId: "c_s" },
      { clerkUserId: "viaCountry", countryId: "c_v" },
      { clerkUserId: "stranger", countryId: "c_x" },
    ]);
    db.countryFollow.findMany.mockResolvedValue([{ followedCountryId: "c_v" }]);

    expect(
      await recipientsRefusing(
        db as never,
        "s",
        ["viaPersona", "viaCountry", "stranger"],
        "directMessages"
      )
    ).toEqual(["stranger"]);
    expect(db.thinkpagesFollow.findMany.mock.calls[0]![0].where).toEqual({
      followerClerkUserId: "s",
      followedAccountId: { in: ["acc_p", "acc_s"] },
    });
  });

  it("verified: needs a verified persona", async () => {
    const db = withConfigs({ r1: { directMessages: "verified" } });
    expect(await recipientsRefusing(db as never, "s", ["r1"], "directMessages")).toEqual(["r1"]);
    db.thinkpagesAccount.findFirst.mockResolvedValue({ id: "acc" });
    expect(await recipientsRefusing(db as never, "s", ["r1"], "directMessages")).toEqual([]);
  });
});

describe("trade offer audiences", () => {
  it("reads each user's audience for a permission, missing configs reading as everyone", async () => {
    const db = withConfigs({
      user_a: { tradeOffers: "nobody" },
      user_c: { tradeOffers: "followers", directMessages: "nobody" },
      user_d: { tradeOffers: "friends" },
      user_e: "not json",
    });
    const ids = ["user_a", "user_b", "user_c", "user_d", "user_e"];
    expect([...(await permissionAudiences(db as never, ids, "tradeOffers"))]).toEqual([
      ["user_a", "nobody"],
      ["user_b", "everyone"],
      ["user_c", "followers"],
      ["user_d", "everyone"],
      ["user_e", "everyone"],
    ]);
  });

  it("refuses a sender outside the audience or on the block list, never the sender themself", async () => {
    const db = withConfigs({ closed: { tradeOffers: "nobody" }, s: { tradeOffers: "nobody" } });
    const configs = db.userConnection.findMany.getMockImplementation()!;
    // "blocker" blocks the sender: the block rows answer only for the recipients asked about
    const withBlock = async (args: {
      where: { connectionType: string; userId: { in: string[] } };
    }) =>
      args.where.connectionType === "blocked"
        ? args.where.userId.in.filter((id) => id === "blocker").map((userId) => ({ userId }))
        : configs(args);
    db.userConnection.findMany.mockImplementation(withBlock);
    const refusals = await tradeOfferRefusers(db as never, "s", ["s", "closed", "blocker", "open"]);
    expect([...refusals.refused].sort()).toEqual(["blocker", "closed"]);
    // Which of them block the sender, so a surface can hide a block behind "nobody"
    expect([...refusals.blocking]).toEqual(["blocker"]);
    expect(await refusesTradeOffer(db as never, "s", "closed")).toBe(true);
    expect(await refusesTradeOffer(db as never, "s", "blocker")).toBe(true);
    expect(await refusesTradeOffer(db as never, "s", "open")).toBe(false);
    expect(await tradeOfferRefusers(db as never, "s", [])).toEqual({
      refused: new Set(),
      blocking: new Set(),
    });
  });
});

describe("muted words", () => {
  it("reads the viewer's keyword rows lower-cased", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockResolvedValue([
      { targetUserId: "election", status: "Election" },
      { targetUserId: null, status: "Tariffs" },
    ]);
    expect(await mutedKeywords(db as never, "viewer")).toEqual(["election", "tariffs"]);
    expect(db.userConnection.findMany.mock.calls[0]![0].where).toEqual({
      userId: "viewer",
      connectionType: "keyword",
    });
    expect(await mutedKeywords(db as never, null)).toEqual([]);
  });

  it("matches case-insensitively", () => {
    expect(containsMutedKeyword("The ELECTION is near", ["election"])).toBe(true);
    expect(containsMutedKeyword("Nothing here", ["election"])).toBe(false);
    expect(containsMutedKeyword(null, ["election"])).toBe(false);
  });
});

describe("messaging honours the direct-message setting", () => {
  function service(db: ReturnType<typeof createMockPrisma>) {
    return createMessagingService({
      db: db as never,
      notifications: { create: jest.fn() } as never,
      websocket: { broadcastToUsers: jest.fn() } as never,
    });
  }

  it("createConversation refuses a recipient who accepts DMs from nobody", async () => {
    const db = withConfigs({ r1: { directMessages: "nobody" } });
    await expect(
      service(db).createConversation("sender", { participantIds: ["r1"] } as never)
    ).rejects.toMatchObject({
      name: "MessagingBlockedError",
      message: "This user is not accepting direct messages from you",
    });
    expect(db.thinkshareConversation.create).not.toHaveBeenCalled();
  });

  it("sendMessage in a direct conversation is refused the same way", async () => {
    const db = withConfigs({ r1: { directMessages: "nobody" } });
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type: "direct" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1", conversation: {} });
    db.conversationParticipant.findMany.mockResolvedValue([{ userId: "r1" }]);
    await expect(
      service(db).sendMessage("sender", { conversationId: "c1", content: "hi" } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    expect(db.thinkshareMessage.create).not.toHaveBeenCalled();
  });
});

describe("dropMutedItems (activity and Following feeds)", () => {
  it("leaves out items whose title or text contains a muted word", () => {
    const items = [
      { id: "a", content: { title: "Election results", description: "..." } },
      { id: "b", content: { title: "Trade news", description: "tariffs rise" } },
      { id: "c", content: { title: "Sports", description: "a match" } },
    ];
    expect(dropMutedItems(items, ["election", "tariffs"]).map((i) => i.id)).toEqual(["c"]);
    expect(dropMutedItems(items, [])).toBe(items);
  });
});

function dbWithConfigs(configs: Record<string, Record<string, unknown>>) {
  const db = createMockPrisma();
  db.userConnection.findMany.mockImplementation(async (args: any) =>
    args.where.connectionType === "privacy_config"
      ? Object.entries(configs).map(([userId, cfg]) => ({ userId, status: JSON.stringify(cfg) }))
      : []
  );
  return db;
}

describe("privacy switches", () => {
  it("usersWithSwitchOff lists only explicit false values", async () => {
    const db = dbWithConfigs({ a: { dmReadReceipts: false }, b: { dmReadReceipts: true }, c: {} });
    expect([
      ...(await usersWithSwitchOff(db as never, ["a", "b", "c", "d"], "dmReadReceipts")),
    ]).toEqual(["a"]);
  });

  it("splitDirectMessageRefusals sends filtering users to requests, others are refused", async () => {
    const db = dbWithConfigs({
      filtering: { directMessages: "followers" },
      off: { directMessages: "followers", messageRequestFiltering: false },
      nobody: { directMessages: "nobody" },
    });
    expect(await splitDirectMessageRefusals(db as never, ["filtering", "off", "nobody"])).toEqual({
      requests: ["filtering"],
      refused: ["off", "nobody"],
    });
  });

  it("hiddenLinkedNames fails closed", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockRejectedValue(new Error("down"));
    const hidden = await hiddenLinkedNames(db as never, ["a"]);
    expect(hidden).toEqual({ discord: new Set(["a"]) });
  });
});

describe("presence", () => {
  beforeEach(() => resetPresenceForTests());

  it("is online for two minutes after a heartbeat, unless hidden", async () => {
    const at = new Date("2026-10-06T12:00:00Z");
    await recordHeartbeat("a", at);
    await recordHeartbeat("b", at);
    const db = dbWithConfigs({ b: { showOnlineStatus: false } });
    expect([...(await visibleOnlineUserIds(db as never, ["a", "b", "c"], at))]).toEqual(["a"]);
    const later = new Date(at.getTime() + ONLINE_WINDOW_MS + 1);
    expect([...(await visibleOnlineUserIds(db as never, ["a"], later))]).toEqual([]);
  });

  it("shows nobody when the setting cannot be read", async () => {
    await recordHeartbeat("a");
    const db = createMockPrisma();
    db.userConnection.findMany.mockRejectedValue(new Error("down"));
    expect((await visibleOnlineUserIds(db as never, ["a"])).size).toBe(0);
  });
});

describe("clearOwnHistory", () => {
  beforeEach(() => resetPresenceForTests());

  it("deletes personal notifications, read receipts and the heartbeat, nothing shared", async () => {
    const db = createMockPrisma();
    db.notification.deleteMany.mockReturnValue(Promise.resolve({ count: 3 }));
    db.messageReadReceipt.deleteMany.mockReturnValue(Promise.resolve({ count: 5 }));
    db.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    await recordHeartbeat("clerk_1");

    expect(await clearOwnHistory(db as never, "clerk_1", "db_1")).toEqual({
      notifications: 3,
      readReceipts: 5,
    });
    expect(db.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: { in: ["clerk_1", "db_1"] } },
    });
    expect(db.messageReadReceipt.deleteMany).toHaveBeenCalledWith({
      where: { userId: "clerk_1" },
    });
    expect((await visibleOnlineUserIds(dbWithConfigs({}) as never, ["clerk_1"])).size).toBe(0);
  });
});

describe("users router", () => {
  function caller(db: ReturnType<typeof createMockPrisma>, userId = "clerk_1") {
    const ctx = createMockRouterContext({
      db,
      auth: { userId },
      user: { id: "db_1", clerkUserId: userId, lastSeenAt: new Date() },
    });
    return createCallerFactory(usersPreferencesRouter)(ctx as never);
  }

  it("clearHistory needs an explicit confirmation", async () => {
    const db = createMockPrisma();
    await expect(caller(db).clearHistory({ confirm: false } as never)).rejects.toThrow();
    expect(db.notification.deleteMany).not.toHaveBeenCalled();
  });
  it("resolveWikiAuthor answers null for a name whose claim its owner keeps hidden", async () => {
    const db = createMockPrisma();
    db.wikiNameClaim.findFirst.mockResolvedValue({
      userId: "db_9",
      visible: false,
      user: { handle: "alex" },
    });
    db.user.findUnique.mockResolvedValue({
      role: { name: "admin", displayName: "Admin" },
      country: { id: "c", name: "Caphiria", slug: "caphiria" },
    });
    expect(await caller(db).resolveWikiAuthor({ wikiUsername: "Alex" })).toBeNull();
    expect(db.wikiNameClaim.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: "ixwiki", name: "Alex", status: "APPROVED" } })
    );
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it("blockAccount and muteAccount find a player by handle, never by an old wiki name", async () => {
    const db = createMockPrisma();
    db.country.findFirst.mockResolvedValue(null);
    db.user.findFirst.mockResolvedValue({ id: "db_9", clerkUserId: "clerk_9" });
    db.userConnection.findFirst.mockResolvedValue(null);
    db.userConnection.create.mockImplementation(async (args: { data: object }) => args.data);
    await caller(db).blockAccount({ identifier: "@Alex" });
    await caller(db).muteAccount({ identifier: "@Alex" });
    for (const [args] of db.user.findFirst.mock.calls) {
      expect(JSON.stringify(args)).not.toContain("wikiUsername");
      expect(args.where.OR).toContainEqual({ handle: { equals: "alex", mode: "insensitive" } });
    }
  });
  it("exportUserData lists every old wiki name claim of the user, whatever its status", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "db_1", clerkUserId: "clerk_1", countryId: null });
    const claims = [
      {
        source: "ixwiki",
        name: "Alex",
        status: "APPROVED",
        visible: false,
        createdAt: new Date(0),
      },
      {
        source: "ixwiki",
        name: "Alex2",
        status: "REJECTED",
        visible: true,
        createdAt: new Date(1),
      },
    ];
    db.wikiNameClaim.findMany.mockResolvedValue(claims);
    const out = await caller(db).exportUserData();
    expect(out.user.wikiNames).toEqual(claims);
    expect(out.user).not.toHaveProperty("wikiUsername");
    expect(db.wikiNameClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "db_1" } })
    );
  });
});

describe("trading partner search", () => {
  it("neither shows nor matches a hidden Discord tag", async () => {
    const db = dbWithConfigs({ clerk_h: { showDiscordTag: false } });
    db.user.findMany.mockResolvedValue([
      {
        id: "u_h",
        clerkUserId: "clerk_h",
        discordUsername: "rosegarden",
        handle: null,
        forumUsername: null,
        country: { name: "Nowhere", leader: "Someone" },
      },
      {
        id: "u_v",
        clerkUserId: "clerk_v",
        discordUsername: "rosegarden2",
        handle: null,
        forumUsername: null,
        country: { name: "Elsewhere", leader: "Other" },
      },
    ]);
    const rules = {
      userOfHandle: async () => null,
      namesOf: async (ids: readonly string[]) =>
        new Map(ids.map((id) => [id, { handle: id, displayName: null }])),
      cardsShown: async () => new Set<string>(),
    };
    const viewer = { id: "db_me", clerkUserId: "me" };
    const results = await searchTradePartners(db as never, rules, viewer, "rosegarden");
    expect(results.map((r) => r.id)).toEqual(["u_v"]);
  });
});

describe("hiddenThinkpagesAccountIds", () => {
  it("is empty for anonymous viewers without touching the database", async () => {
    const db = createMockPrisma();
    expect(await hiddenThinkpagesAccountIds(db as never, null)).toEqual([]);
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });

  it("resolves blocked and muted users and blocked nations to their ThinkPages accounts", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockResolvedValue([
      { targetUserId: "db_muted", targetCountryId: null },
      { targetUserId: "db_blocked", targetCountryId: "country_x" },
    ]);
    db.user.findMany.mockResolvedValue([
      { clerkUserId: "clerk_muted" },
      { clerkUserId: "clerk_b" },
    ]);
    db.thinkpagesAccount.findMany.mockResolvedValue([{ id: "acc1" }, { id: "acc2" }]);

    expect(await hiddenThinkpagesAccountIds(db as never, "viewer")).toEqual(["acc1", "acc2"]);
    expect(db.userConnection.findMany.mock.calls[0]![0].where).toEqual({
      userId: "viewer",
      connectionType: { in: ["blocked", "muted"] },
    });
    expect(db.thinkpagesAccount.findMany.mock.calls[0]![0].where).toEqual({
      OR: [
        { clerkUserId: { in: ["clerk_muted", "clerk_b"] } },
        { countryId: { in: ["country_x"] } },
      ],
      NOT: { clerkUserId: "viewer" },
    });
  });
});

describe("thinkpages.getFeed honours the viewer's block and mute lists", () => {
  const createCaller = createCallerFactory(thinkpagesFeedRouter);

  it("excludes hidden accounts and caches per viewer", async () => {
    const db = createMockPrisma();
    // Block/mute rows only; the muted-word lookup (connectionType "keyword") finds none.
    db.userConnection.findMany.mockImplementation(async (args: any) =>
      args.where.connectionType === "keyword"
        ? []
        : [{ targetUserId: "db_x", targetCountryId: null }]
    );
    db.user.findMany.mockResolvedValue([{ clerkUserId: "clerk_x" }]);
    db.thinkpagesAccount.findMany.mockResolvedValue([{ id: "acc_x" }]);
    const ctx = createMockRouterContext({ db, auth: { userId: "viewer" }, user: null });

    await createCaller(ctx as never).getFeed({});
    expect(db.thinkpagesPost.findMany.mock.calls[0]![0].where).toEqual({
      visibility: "public",
      accountId: { notIn: ["acc_x"] },
    });
    const key = (globalCache.set as jest.Mock).mock.calls.at(-1)![0] as string;
    expect(key).toContain(":viewer:viewer");
  });

  it("leaves out posts with the viewer's muted words (SL-4)", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockImplementation(async (args: any) =>
      args.where.connectionType === "keyword"
        ? [{ targetUserId: "election", status: "Election" }]
        : []
    );
    const ctx = createMockRouterContext({ db, auth: { userId: "viewer" }, user: null });

    await createCaller(ctx as never).getFeed({});
    expect(db.thinkpagesPost.findMany.mock.calls[0]![0].where).toEqual({
      visibility: "public",
      AND: [{ NOT: { content: { contains: "election", mode: "insensitive" } } }],
    });
    const key = (globalCache.set as jest.Mock).mock.calls.at(-1)![0] as string;
    expect(key).toContain(":viewer:viewer");
  });

  it("leaves the shared feed alone for viewers with empty lists", async () => {
    const db = createMockPrisma();
    const ctx = createMockRouterContext({ db, auth: { userId: "viewer" }, user: null });
    await createCaller(ctx as never).getFeed({});
    expect(db.thinkpagesPost.findMany.mock.calls[0]![0].where).toEqual({ visibility: "public" });
  });
});

describe("recipientsBlockingSender", () => {
  it("matches blocks of the sender's ids or nation", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "db_sender", countryId: "c_sender" });
    db.userConnection.findMany.mockResolvedValue([{ userId: "r1" }]);

    expect(await recipientsBlockingSender(db as never, "sender", ["sender", "r1", "r2"])).toEqual([
      "r1",
    ]);
    expect(db.userConnection.findMany.mock.calls[0]![0].where).toEqual({
      userId: { in: ["r1", "r2"] },
      connectionType: "blocked",
      OR: [{ targetUserId: { in: ["sender", "db_sender"] } }, { targetCountryId: "c_sender" }],
    });
  });
});

describe("messaging refuses senders the recipient blocked", () => {
  function service(db: ReturnType<typeof createMockPrisma>) {
    return createMessagingService({
      db: db as never,
      notifications: { createNotification: jest.fn() } as never,
      websocket: { broadcastToUsers: jest.fn() } as never,
    });
  }

  it("createConversation throws MessagingBlockedError", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockResolvedValue([{ userId: "r1" }]);
    await expect(
      service(db).createConversation("sender", { participantIds: ["r1"] } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    expect(db.thinkshareConversation.create).not.toHaveBeenCalled();
  });

  it("sendMessage in a direct conversation throws MessagingBlockedError", async () => {
    const db = createMockPrisma();
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type: "direct" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1", conversation: {} });
    db.conversationParticipant.findMany.mockResolvedValue([{ userId: "r1" }]);
    db.userConnection.findMany.mockResolvedValue([{ userId: "r1" }]);
    await expect(
      service(db).sendMessage("sender", { conversationId: "c1", content: "hi" } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    expect(db.thinkshareMessage.create).not.toHaveBeenCalled();
  });

  it("sendMessage still goes through when nobody blocked the sender", async () => {
    const db = createMockPrisma();
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type: "direct" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1", conversation: {} });
    db.thinkshareMessage.create.mockResolvedValue({ id: "m1" });
    await service(db).sendMessage("sender", { conversationId: "c1", content: "hi" } as never);
    expect(db.thinkshareMessage.create).toHaveBeenCalled();
  });
});

describe("blockedUserClerkIds", () => {
  it("is empty for anonymous viewers without touching the database", async () => {
    const db = createMockPrisma();
    expect(await blockedUserClerkIds(db as never, null)).toEqual([]);
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });

  it("resolves blocked accounts and nations (not muted ones) to Clerk ids", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockResolvedValue([
      { targetUserId: "db_b", targetCountryId: null },
      { targetUserId: null, targetCountryId: "country_x" },
    ]);
    db.user.findMany.mockResolvedValue([
      { clerkUserId: "clerk_b" },
      { clerkUserId: "clerk_x" },
      { clerkUserId: "viewer" },
    ]);

    expect(await blockedUserClerkIds(db as never, "viewer")).toEqual([
      "db_b",
      "clerk_b",
      "clerk_x",
    ]);
    expect(db.userConnection.findMany.mock.calls[0]![0].where).toEqual({
      userId: "viewer",
      connectionType: "blocked",
    });
    expect(db.user.findMany.mock.calls[0]![0].where).toEqual({
      OR: [
        { id: { in: ["db_b"] } },
        { clerkUserId: { in: ["db_b"] } },
        { countryId: { in: ["country_x"] } },
      ],
    });
  });
});

describe("group conversations hide blocked accounts from the viewer", () => {
  function service(db: ReturnType<typeof createMockPrisma>) {
    const notifications = { create: jest.fn().mockResolvedValue("n1") };
    const websocket = { broadcastToUsers: jest.fn() };
    const svc = createMessagingService({
      db: db as never,
      notifications: notifications as never,
      websocket: websocket as never,
    });
    return { svc, notifications, websocket };
  }

  function readDb(type: string) {
    const db = createMockPrisma();
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type, source: "thinkshare" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1" });
    db.userConnection.findMany.mockResolvedValue([
      { targetUserId: "clerk_b", targetCountryId: null },
    ]);
    db.user.findMany.mockResolvedValue([{ clerkUserId: "clerk_b" }]);
    db.thinkshareMessage.findMany.mockResolvedValue([]);
    return db;
  }

  it("leaves blocked senders' messages out of a group conversation read", async () => {
    const db = readDb("group");
    await service(db).svc.getConversationMessages("viewer", { conversationId: "c1" } as never);
    expect(db.thinkshareMessage.findMany.mock.calls[0]![0].where).toEqual({
      conversationId: "c1",
      userId: { notIn: ["clerk_b"] },
    });
  });

  it("does not filter a direct conversation read", async () => {
    const db = readDb("direct");
    await service(db).svc.getConversationMessages("viewer", { conversationId: "c1" } as never);
    expect(db.thinkshareMessage.findMany.mock.calls[0]![0].where).toEqual({
      conversationId: "c1",
    });
    expect(db.userConnection.findMany).not.toHaveBeenCalled();
  });

  it("lets a blocked member post to the group but does not notify or push to the blocker", async () => {
    const db = createMockPrisma();
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type: "group" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1", conversation: {} });
    db.conversationParticipant.findMany.mockResolvedValue([{ userId: "r1" }, { userId: "r2" }]);
    db.userConnection.findMany.mockResolvedValue([{ userId: "r1" }]);
    db.thinkshareMessage.create.mockResolvedValue({ id: "m1" });
    const { svc, notifications, websocket } = service(db);

    await svc.sendMessage("sender", { conversationId: "c1", content: "hi" } as never);

    expect(db.thinkshareMessage.create).toHaveBeenCalled();
    expect(notifications.create.mock.calls.map((c: any[]) => c[0].userId)).toEqual(["r2"]);
    expect(websocket.broadcastToUsers.mock.calls[0]![0]).toEqual(["r2"]);
  });
});
