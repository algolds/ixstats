/** @jest-environment node */
/**
 * The forum and realm routers' gates, through the real app router: every procedure of thinkpagesForum,
 * thinkpagesForumMod, realms and thinkpages but the named public reads refuses a signed-out caller; the realm admin
 * procedures, Atlas, and the admin forum-link and Discord feed procedures refuse a member before reading anything;
 * the inputs a member could inflate or forge are refused before any module or table is read; the public reads and
 * the member lookup sit on their rate-limit buckets.
 *
 * Folds the gate and bound cases of the router tests of thinkpagesForum (posts, reports and appeals), its board,
 * engagement, integrations, reactions, stash and advert procedures, thinkpagesForumMod (bans, warnings, appeals,
 * content actions, the rate-limited member lookup), realms (admin create and update, nation search), Atlas (jobs,
 * health, realms, studio create), admin.linkUserForum and the ThinkPages Discord feed config.
 */
const mockCheck = jest.fn();
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: (...args: unknown[]) => mockCheck(...args) },
}));
jest.mock("~/server/db", () => ({ db: {}, isDatabaseReadOnly: false }));

import { appRouter } from "~/server/api/root";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(appRouter);

/** A founding clock (start date, era, speed) every new realm needs. */
const CLOCK = { startDate: "1203-03-14", era: "AE", multiplier: 2 };

const FAMILIES = ["thinkpagesForum", "thinkpagesForumMod", "realms", "thinkpages"] as const;

/** The procedures anyone may call signed out. A new public one fails the sweep below until it is named here. */
const PUBLIC = [
  "thinkpagesForum.categories",
  "thinkpagesForum.latestActivity",
  "thinkpagesForum.trending",
  "thinkpagesForum.boardTopPosters",
  "thinkpagesForum.navFlags",
  "thinkpagesForum.realms",
  "thinkpagesForum.realmSection",
  "thinkpagesForum.category",
  "thinkpagesForum.thread",
  "thinkpagesForum.resolvePost",
  "thinkpagesForum.getBoard",
  "thinkpagesForum.reactors",
  "thinkpagesForum.realmBoardPreview",
  "realms.getBySlug",
  "realms.inviter",
  "realms.region.overview",
  "realms.region.happenings",
  "realms.region.contextClock",
  "realms.sourceSync.mapAttribution",
  "realms.map.display",
  "realms.map.version",
  "realms.map.realmForWikiArticle",
  "realms.directory",
  "realms.mapFace",
  "realms.mapGeo",
  "realms.searchNations",
  "thinkpages.checkUsernameAvailability",
  "thinkpages.getAccountsByCountry",
  "thinkpages.getAccountLimit",
  "thinkpages.getAccountProfile",
  "thinkpages.getAccountCountsByType",
  "thinkpages.getPost",
  "thinkpages.getPostsByClerkUserId",
  "thinkpages.getPostReactions",
  "thinkpages.getDiscordChannelTopic",
  "thinkpages.getFeed",
  "thinkpages.getDiscordEmojis",
  "thinkpages.getThinktanks",
  "thinkpages.getThinktankById",
  "thinkpages.getGroupFeed",
  "thinkpages.getThinktankDocuments",
];

const PROCEDURES = Object.keys(
  (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def.procedures
);
const of = (family: string) => PROCEDURES.filter((path) => path.startsWith(`${family}.`));

/** The realm procedures for site admins only, founders included. */
const REALM_ADMIN = of("realms").filter((path) =>
  /^realms\.(admin[A-Z]|region\.(deleteRealm|adminTransferOwner)|nationDefaults\.)/.test(path)
);

type Procedure = (input?: unknown) => Promise<unknown>;
type Caller = ReturnType<typeof createCaller>;

function procedure(caller: Caller, path: string): Procedure {
  const found = path
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], caller);
  return found as Procedure;
}

/** What a call answered: "ok", or the error's message. */
async function outcome(call: Promise<unknown>): Promise<string> {
  try {
    await call;
    return "ok";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const signedOut = (db: MockPrismaProxy) =>
  createCaller(
    createMockRouterContext({
      db,
      auth: null,
      user: null,
      rateLimitIdentifier: "ip:203.0.113.7",
    }) as never
  );
const asUser = (db: MockPrismaProxy, level: number) =>
  createCaller(
    createMockRouterContext({
      db,
      auth: { userId: "clerk_u1" },
      user: {
        id: "u1",
        clerkUserId: "clerk_u1",
        countryId: "c1",
        role: { name: level === 10 ? "admin" : "user", level },
      },
      rateLimitIdentifier: "user:u1",
    }) as never
  );
const member = (db: MockPrismaProxy) => asUser(db, 100);
const admin = (db: MockPrismaProxy) => asUser(db, 10);

/** The tables a call read or wrote through the mock client. */
const touched = (db: MockPrismaProxy) =>
  Object.entries(db as unknown as Record<string, unknown>)
    .filter(([model]) => !model.startsWith("$"))
    .filter(([, methods]) =>
      Object.values(methods as Record<string, jest.Mock>).some((fn) => fn.mock.calls.length > 0)
    )
    .map(([model]) => model);

beforeEach(() => {
  mockCheck.mockReset().mockResolvedValue({ success: true, remaining: 99, resetAt: new Date() });
  for (const level of ["log", "info", "warn", "error"] as const)
    jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("signed out", () => {
  it.each(FAMILIES)(
    "every %s procedure but the public reads refuses a signed-out caller",
    async (family) => {
      const caller = signedOut(createMockPrisma());
      const answered: string[] = [];
      for (const path of of(family)) {
        const said = await outcome(procedure(caller, path)(undefined));
        if (!/Authentication required/.test(said)) answered.push(path);
      }
      expect(answered).toEqual(PUBLIC.filter((path) => path.startsWith(`${family}.`)));
    }
  );
});

describe("members", () => {
  it.each<[string, string[]]>([
    ["the realm admin procedures", REALM_ADMIN],
    ["every Atlas procedure", of("atlas")],
    [
      "the forum link and the Discord feed config",
      [
        "admin.linkUserForum",
        "admin.unlinkUserForum",
        "admin.getThinkpagesDiscordFeedConfig",
        "admin.saveThinkpagesDiscordFeedConfig",
      ],
    ],
  ])("%s refuse a member before reading anything", async (_label, paths) => {
    expect(paths.length).toBeGreaterThan(0);
    const db = createMockPrisma();
    const caller = member(db);
    const answered: string[] = [];
    for (const path of paths) {
      const said = await outcome(procedure(caller, path)(undefined));
      if (!/Admin privileges required/.test(said)) answered.push(path);
    }
    expect(answered).toEqual([]);
    expect(touched(db)).toEqual([]);
  });
});

const POST = { categoryKey: "general", title: "Fine title" };
const BAN = { userId: "u2", scope: { kind: "site" }, reason: "Abuse", days: null };
const WARN = { userId: "u2", points: 2, reason: "Rude", target: { type: "post", id: "p1" } };

describe("input bounds", () => {
  it.each<[string, "member" | "admin", string, unknown, string]>([
    [
      "a category key that is not one",
      "member",
      "thinkpagesForum.category",
      { key: "Bad Key", page: 1 },
      "key",
    ],
    [
      "a page past 1,000",
      "member",
      "thinkpagesForum.category",
      { key: "general", page: 1001 },
      "page",
    ],
    [
      "a thread id past 64 characters",
      "member",
      "thinkpagesForum.thread",
      { threadId: "x".repeat(65), page: 1 },
      "threadId",
    ],
    [
      "a two-letter title",
      "member",
      "thinkpagesForum.createThread",
      { ...POST, title: "ab", html: "<p>x</p>" },
      "title",
    ],
    [
      "a body past 50,000 characters",
      "member",
      "thinkpagesForum.createThread",
      { ...POST, html: "x".repeat(50_001) },
      "html",
    ],
    [
      "a body sent as html and as wikitext",
      "member",
      "thinkpagesForum.createThread",
      { ...POST, html: "<p>x</p>", wikitext: "x" },
      "",
    ],
    [
      "a report on a user",
      "member",
      "thinkpagesForum.report",
      { targetType: "user", targetId: "p1", reason: "Spam here" },
      "targetType",
    ],
    [
      "an appeal under 10 characters",
      "member",
      "thinkpagesForum.appeal",
      { subjectType: "warning", subjectId: "w1", body: "too short" },
      "body",
    ],
    ["a one-letter mention query", "member", "thinkpagesForum.mentionSuggestions", { q: "k" }, "q"],
    [
      "a reaction that is not one",
      "member",
      "thinkpagesForum.react",
      { postId: "p_hub", type: "sad" },
      "type",
    ],
    [
      "a board page past 100",
      "member",
      "thinkpagesForum.getBoard",
      { realm: "eurth", limit: 101 },
      "limit",
    ],
    [
      "an advert title past 200 characters",
      "member",
      "thinkpagesForum.createAdvert",
      { realm: "eurth", title: "x".repeat(201), wikitext: "Come and play." },
      "title",
    ],
    ["a ban of 0 days", "admin", "thinkpagesForumMod.ban", { ...BAN, days: 0 }, "days"],
    [
      "a ban in a place that is not one",
      "admin",
      "thinkpagesForumMod.ban",
      { ...BAN, scope: { kind: "nowhere" } },
      "scope.kind",
    ],
    ["a warning of 6 points", "admin", "thinkpagesForumMod.warn", { ...WARN, points: 6 }, "points"],
    [
      "an appeal response past 2,000 characters",
      "admin",
      "thinkpagesForumMod.reviewAppeal",
      { appealId: "a1", outcome: "upheld", response: "x".repeat(2001) },
      "response",
    ],
    [
      "a thread flag that is not one",
      "admin",
      "thinkpagesForumMod.setThreadFlag",
      { threadId: "t1", flag: "deleted", value: true },
      "flag",
    ],
    [
      "a realm slug with a space",
      "admin",
      "realms.adminCreateRealm",
      { slug: "eu rth", name: "Eurth", visibility: "public", clock: CLOCK },
      "slug",
    ],
    [
      "a realm founded without a start date",
      "admin",
      "realms.adminCreateRealm",
      { slug: "eurth", name: "Eurth", visibility: "public", clock: { era: "AE" } },
      "clock.startDate",
    ],
    [
      "a nation cap of 21",
      "admin",
      "realms.adminUpdateRealm",
      { id: "r_eurth", maxNationsPerUser: 21 },
      "maxNationsPerUser",
    ],
    ["a one-letter nation search", "member", "realms.searchNations", { query: " a " }, "query"],
    [
      "a studio realm on a reserved slug",
      "admin",
      "atlas.studio.createRealm",
      { name: "X", slug: "ixnay", clock: CLOCK },
      "slug",
    ],
    [
      "a studio realm founded without a clock",
      "admin",
      "atlas.studio.createRealm",
      { name: "X", slug: "new-world" },
      "clock",
    ],
    [
      "a XenForo id of 0",
      "admin",
      "admin.linkUserForum",
      { userId: "u1", xenforoUserId: 0 },
      "xenforoUserId",
    ],
    [
      "a Discord channel id that is no snowflake",
      "admin",
      "admin.saveThinkpagesDiscordFeedConfig",
      { channelId: "not-a-channel" },
      "channelId",
    ],
  ])("refuses %s before reading anything", async (_label, who, path, input, field) => {
    const db = createMockPrisma();
    const caller = who === "admin" ? admin(db) : member(db);
    const error = await procedure(
      caller,
      path
    )(input).then(
      () => null,
      (e: Error & { code?: string }) => e
    );
    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    // The one input issue is the field under test, so the row cannot pass on another missing field.
    const issues = JSON.parse(error!.message) as Array<{ path: Array<string | number> }>;
    expect(issues.map((issue) => issue.path.join("."))).toEqual([field]);
    // An admin's refused call is still written to the audit log; nothing else is read or written.
    expect(touched(db).filter((model) => model !== "auditLog")).toEqual([]);
  });
});

describe("rate limits", () => {
  it.each<[string, "signed out" | "member", unknown, string, number]>([
    ["thinkpagesForum.realmBoardPreview", "signed out", { slug: "eurth" }, "public", 100],
    ["realms.searchNations", "signed out", { query: "au" }, "public", 100],
    ["thinkpagesForum.realmPanel", "member", undefined, "queries", 120],
    ["thinkpagesForumMod.resolveMember", "member", { handle: "alice" }, "queries", 120],
  ])(
    "counts %s (%s) on its bucket and refuses a caller over the limit before reading anything",
    async (path, who, input, bucket, maxRequests) => {
      mockCheck.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });
      const db = createMockPrisma();
      const caller = who === "member" ? member(db) : signedOut(db);
      await expect(procedure(caller, path)(input)).rejects.toThrow(/Too many requests/);
      expect(mockCheck).toHaveBeenCalledWith(
        who === "member" ? "user:u1" : "ip:203.0.113.7",
        bucket,
        expect.objectContaining({ maxRequests })
      );
      expect(touched(db)).toEqual([]);
    }
  );
});
