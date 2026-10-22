/** @jest-environment node */
/**
 * The money routers' gates, one table per router family, through the real app router: every procedure but the public
 * reads refuses a signed-out caller, every admin procedure refuses a member, the inputs a player could inflate (prices,
 * credits, how many copies, how long a text) are refused before any module or table is read, and the public and
 * per-action procedures sit on their rate-limit buckets. A public read writes nothing.
 *
 * Folds the router tests of cardMarket (listings, auctions, wishlist), cards (mine, explore, sheet, showcases, mute,
 * inscriptions, takedowns, sheet economy), trading (builder, offers, the trade list), crafting, exchange, loreCards
 * (rate limit, security), lorewards (getTrophies rate limit), the vault statement and the cards admin tabs' gates
 * (economy, imports, overview).
 */
const mockCheck = jest.fn();
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: (...args: unknown[]) => mockCheck(...args) },
}));
jest.mock("~/server/db", () => ({ db: {}, isDatabaseReadOnly: false }));
jest.mock("~/lib/wiki-os/adapters/ixstates/lore-card-generator", () => ({
  __esModule: true,
  wikiLoreCardGenerator: { fetchArticleAuthorInfoBatch: jest.fn() },
}));

import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { appRouter } from "~/server/api/root";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(appRouter);
const authorInfo = jest.mocked(wikiLoreCardGenerator.fetchArticleAuthorInfoBatch);

const FAMILIES = [
  "cards",
  "cardMarket",
  "trading",
  "crafting",
  "cardPacks",
  "cardImages",
  "vault",
  "exchange",
  "lorewards",
  "loreCards",
  "nsImport",
] as const;

/** The money procedures anyone may call signed out. A new public one fails the sweep below until it is named here. */
const PUBLIC = [
  "cards.getSheet",
  "cards.getWikiArticleExcerpt",
  "crafting.getNumbers",
  "cardImages.getByCountryAndType",
  "cardImages.getAllByCountry",
  "vault.getEquippedCosmeticsFor",
  "lorewards.getRecentWinners",
  "lorewards.getArticleAwardsAndAchievements",
  "lorewards.getStandings",
  "lorewards.getUserStats",
  "lorewards.getUserAwardHistory",
  "lorewards.getStreakCalendar",
  "lorewards.getTodayRace",
  "lorewards.getTrophies",
  "loreCards.getCardAuthorInfo",
  "nsImport.getVerificationUrl",
  "nsImport.requestSelfServiceTakedown",
];

/** The Loreward admin procedures, which are not named admin. */
const LOREWARD_ADMIN = [
  "lorewards.triggerSync",
  "lorewards.crossValidate",
  "lorewards.getCrossValidationHistory",
  "lorewards.getBlacklist",
  "lorewards.updateBlacklist",
  "lorewards.overrideWinner",
];

const PROCEDURES = Object.keys(
  (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def.procedures
);
const of = (family: string) => PROCEDURES.filter((path) => path.startsWith(`${family}.`));
const isAdmin = (path: string) =>
  /^cards\.admin\./.test(path) || /\.admin[A-Z]/.test(path) || LOREWARD_ADMIN.includes(path);

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
const member = (db: MockPrismaProxy) =>
  createCaller(
    createMockRouterContext({
      db,
      auth: { userId: "clerk_u1" },
      user: { id: "u1", clerkUserId: "clerk_u1", role: { name: "user", level: 100 } },
      rateLimitIdentifier: "user:u1",
    }) as never
  );

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
  authorInfo
    .mockReset()
    .mockResolvedValue(new Map([["kiro", { creator: "Kir", displayAuthor: "Kir" }]]));
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
  it.each(["cards", "vault", "exchange", "lorewards"])(
    "every %s admin procedure refuses a member, before reading anything",
    async (family) => {
      const db = createMockPrisma();
      const caller = member(db);
      const admin = of(family).filter(isAdmin);
      expect(admin.length).toBeGreaterThan(0);
      const answered: string[] = [];
      for (const path of admin) {
        const said = await outcome(procedure(caller, path)(undefined));
        if (!/Admin privileges required/.test(said)) answered.push(path);
      }
      expect(answered).toEqual([]);
      expect(touched(db)).toEqual([]);
    }
  );
});

const many = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("input bounds", () => {
  it.each<[string, string, unknown]>([
    ["a listing at 0 IxC", "cardMarket.createListing", { ownershipId: "own_1", price: 0 }],
    [
      "a listing over 1,000,000 IxC",
      "cardMarket.createListing",
      { ownershipId: "own_1", price: 1_000_001 },
    ],
    [
      "21 listings at once",
      "cardMarket.createListings",
      { items: many(21, "o").map((ownershipId) => ({ ownershipId, price: 10 })) },
    ],
    ["a market page over 100", "cardMarket.browse", { limit: 101 }],
    [
      "an auction starting at a part IxC",
      "cardMarket.createAuction",
      { cardId: "own_1", startingPrice: 10.5, duration: "24h" },
    ],
    [
      "an auction of a day not offered",
      "cardMarket.createAuction",
      { cardId: "own_1", startingPrice: 10, duration: "1d" },
    ],
    ["a bid of 0", "cardMarket.placeBid", { auctionId: "a1", amount: 0 }],
    ["a wish past 64 characters", "cardMarket.addToWishlist", { cardId: "c".repeat(65) }],
    [
      "21 cards on one side of a trade",
      "trading.createtradeOffer",
      { partnerId: "them", initiatorCardIds: many(21, "c") },
    ],
    [
      "a trade over 1,000,000 IxC",
      "trading.createtradeOffer",
      { partnerId: "them", initiatorCardIds: ["c1"], initiatorCredits: 1_000_001 },
    ],
    [
      "a counter at a revision below 0",
      "trading.counterTrade",
      { tradeId: "t1", revision: -1, initiatorCardIds: ["c1"] },
    ],
    [
      "a counter-offer sent as an answer",
      "trading.respondToTrade",
      { tradeId: "t1", action: "COUNTER", revision: 1 },
    ],
    [
      "a tradeables search past 80 characters",
      "trading.getTradeables",
      { partnerId: "p1", side: "mine", filters: { search: "s".repeat(81) } },
    ],
    ["a break-down of no copies", "crafting.breakDown", { ownershipIds: [] }],
    ["a break-down of 101 copies", "crafting.breakDown", { ownershipIds: many(101, "o") }],
    ["Mine sorted by a column it has not", "cards.listMine", { sort: "price" }],
    ["a showcase add of no copies", "cards.addToShowcase", { showcaseId: "s1", ownershipIds: [] }],
    [
      "a showcase update that leaves out isPublic",
      "cards.updateShowcase",
      { showcaseId: "s1", name: "Best" },
    ],
    [
      "an inscription past 240 characters",
      "cards.inscribe",
      { ownershipId: "own_1", text: "t".repeat(241) },
    ],
    [
      "a takedown contact past 200 characters",
      "cards.requestTakedown",
      { cardId: "card_1", reason: "r".repeat(20), contact: "c".repeat(201) },
    ],
    [
      "a sheet opened from past 262 characters",
      "cards.getSheet",
      { cardId: "c1", from: "x".repeat(263) },
    ],
    ["a statement direction that is not one", "vault.getTransactions", { direction: "sideways" }],
  ])("refuses %s before reading anything", async (_label, path, input) => {
    const db = createMockPrisma();
    await expect(procedure(member(db), path)(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(touched(db)).toEqual([]);
  });
});

describe("rate limits", () => {
  it.each<[string, "signed out" | "member", unknown, string, number]>([
    ["cards.getSheet", "signed out", { cardId: "c1" }, "queries", 120],
    ["crafting.getNumbers", "signed out", undefined, "queries", 120],
    [
      "loreCards.getCardAuthorInfo",
      "signed out",
      { articleTitle: "Kiro", source: "iiwiki" },
      "public",
      100,
    ],
    ["lorewards.getTrophies", "signed out", { wikiUsername: "Kir" }, "public", 100],
    ["trading.findPartner", "member", { handle: "bob" }, "queries", 120],
    [
      "cardMarket.addToWishlist",
      "member",
      { cardId: "card_1" },
      "mutation:cardMarket.addToWishlist",
      60,
    ],
    [
      "cards.inscribe",
      "member",
      { ownershipId: "own_1", text: "gg" },
      "mutation:cards.inscribe",
      60,
    ],
    ["crafting.craft", "member", { cardId: "c1" }, "mutation:crafting.craft", 60],
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
      expect(authorInfo).not.toHaveBeenCalled();
    }
  );
});

describe("public reads", () => {
  it("answers an article's author without reading or writing any card", async () => {
    const db = createMockPrisma();
    await expect(
      procedure(
        signedOut(db),
        "loreCards.getCardAuthorInfo"
      )({
        articleTitle: "Kiro",
        source: "ixwiki",
      })
    ).resolves.toMatchObject({ authorInfo: { displayAuthor: "Kir" } });
    expect(touched(db)).toEqual([]);
  });

  it("asks the card's own article wiki, and no file host", async () => {
    const caller = signedOut(createMockPrisma());
    await procedure(
      caller,
      "loreCards.getCardAuthorInfo"
    )({
      articleTitle: "Kiro",
      source: "althistory",
    });
    expect(authorInfo).toHaveBeenLastCalledWith(["Kiro"], "althistory");
    await expect(
      procedure(
        caller,
        "loreCards.getCardAuthorInfo"
      )({
        articleTitle: "File:Kiro.png",
        source: "commons",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
