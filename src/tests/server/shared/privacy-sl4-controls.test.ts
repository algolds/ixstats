/** @jest-environment node */
/**
 * SL-4 controls outside messaging: the privacy config keys, online heartbeat, Clear history,
 * wiki attribution on `users.resolveWikiAuthor`, and linked names in trading partner search.
 */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { usersPreferencesRouter } from "~/server/api/routers/users/preferences";
import { tradingSocialRouter } from "~/server/api/routers/trading/social";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import {
  hiddenLinkedNames,
  splitDirectMessageRefusals,
  usersWithSwitchOff,
} from "~/server/shared/privacy-permissions";
import {
  ONLINE_WINDOW_MS,
  recordHeartbeat,
  resetPresenceForTests,
  visibleOnlineUserIds,
} from "~/server/shared/presence";
import { clearOwnHistory } from "~/server/shared/clear-history";

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
    expect([...hidden.discord, ...hidden.wiki]).toEqual(["a", "a"]);
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

  it("getPrivacySettings drops removed keys (diagnostics, recommendations)", async () => {
    const db = createMockPrisma();
    db.userConnection.findFirst.mockResolvedValue({
      status: JSON.stringify({ showOnlineStatus: false, diagnosticTelemetry: false }),
    });
    const { config } = await caller(db).getPrivacySettings();
    expect(config.showOnlineStatus).toBe(false);
    expect(config).not.toHaveProperty("diagnosticTelemetry");
    expect(config).not.toHaveProperty("personalizedRecommendations");
  });

  it("heartbeat records presence", async () => {
    resetPresenceForTests();
    await caller(createMockPrisma(), "user_beat").heartbeat();
    expect([...(await visibleOnlineUserIds(dbWithConfigs({}) as never, ["user_beat"]))]).toEqual([
      "user_beat",
    ]);
  });

  it("resolveWikiAuthor drops the role and country when wiki attribution is off", async () => {
    const db = dbWithConfigs({ clerk_9: { showWikiAttribution: false } });
    db.user.findFirst.mockResolvedValue({
      wikiUsername: "Alex",
      clerkUserId: "clerk_9",
      role: { name: "admin", displayName: "Admin" },
      country: { id: "c", name: "Caphiria", slug: "caphiria" },
    });
    expect(await caller(db).resolveWikiAuthor({ wikiUsername: "Alex" })).toEqual({
      wikiUsername: "Alex",
      role: null,
      country: null,
    });
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
        forumUsername: null,
        wikiUsername: null,
        country: { name: "Nowhere", leader: "Someone" },
      },
      {
        id: "u_v",
        clerkUserId: "clerk_v",
        discordUsername: "rosegarden2",
        forumUsername: null,
        wikiUsername: null,
        country: { name: "Elsewhere", leader: "Other" },
      },
    ]);
    const ctx = createMockRouterContext({
      db,
      auth: { userId: "me" },
      user: { id: "db_me", clerkUserId: "me" },
    });
    const results = await createCallerFactory(tradingSocialRouter)(
      ctx as never
    ).searchTradingPartners({
      query: "rosegarden",
    });
    expect(results.map((r) => [r.id, r.username])).toEqual([["clerk_v", "rosegarden2"]]);
  });
});
