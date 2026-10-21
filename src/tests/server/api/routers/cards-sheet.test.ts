/** @jest-environment node */
/**
 * cards.getSheet: open to signed-out visitors on the read-only rate limit, parses `from`, ignores a malformed one,
 * checks showcases against the passport switch, finds a holder by the passport handle they show (`holderOf`, the real
 * handle chain over a mocked database), and names players by the identity rule in one batch (`playersOf`).
 */
const mockCheck = jest.fn();
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => true, check: (...args: unknown[]) => mockCheck(...args) },
}));
jest.mock("~/server/db", () => ({
  db: { user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(async () => []) } },
}));
jest.mock("~/lib/cards/hub/sheet", () => ({ loadCardSheet: jest.fn(async () => null) }));
jest.mock("~/server/modules/identity/identity.privacy", () => ({
  loadPassportSettings: jest.fn(async () => ({ visibility: { vaultCards: false } })),
  loadVaultCardsShown: jest.fn(async () => new Set(["u-shows"])),
}));
jest.mock("~/server/modules/identity/identity.player-names", () => ({
  loadPlayerNames: jest.fn(
    async () =>
      new Map([
        ["u-shows", { handle: "ann", displayName: "@ann" }],
        ["u-hides", { handle: "clerk-u-hides", displayName: "Caphiria" }],
      ])
  ),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getArticleWikitext: jest.fn(async () => null),
  getArticleIntro: jest.fn(async () => ({ text: "An intro." })),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsSheetRouter } from "~/server/api/routers/cards/sheet";
import { holderOf, playersOf, vaultVisible } from "~/server/api/routers/cards/_passport";
import { db as serverDb } from "~/server/db";
import { loadCardSheet } from "~/lib/cards/hub/sheet";
import {
  loadPassportSettings,
  loadVaultCardsShown,
} from "~/server/modules/identity/identity.privacy";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardsSheetRouter);
const signedOut = (db = createMockPrisma()) =>
  createCaller(
    createMockRouterContext({
      db,
      auth: null,
      user: null,
      rateLimitIdentifier: "ip:203.0.113.7",
    }) as never
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  mockCheck.mockResolvedValue({ success: true, remaining: 119, resetAt: new Date() });
});

describe("cards.getSheet", () => {
  it("passes the viewer, the card and where the sheet was opened from", async () => {
    const db = createMockPrisma();
    const caller = createCaller(
      createMockRouterContext({
        db,
        auth: { userId: "clerk_me" },
        user: { id: "db_me", clerkUserId: "clerk_me" },
      }) as never
    );
    await expect(caller.getSheet({ cardId: "c1", from: "showcase.s1" })).resolves.toBeNull();
    const [passedDb, viewer, card, options] = jest.mocked(loadCardSheet).mock.calls[0]!;
    expect(passedDb).toBe(db);
    expect([viewer, card, options.from]).toEqual(["db_me", "c1", { kind: "showcase", id: "s1" }]);
    expect(options.rules.vaultVisible).toBe(vaultVisible);
    expect(options.rules.holderOf).toBe(holderOf);
    expect(options.rules.playersOf).toBe(playersOf);
    await expect(options.rules.vaultVisible("owner")).resolves.toBe(false);
    expect(loadPassportSettings).toHaveBeenCalledWith("owner");
  });

  it("takes any passport handle as the holder, up to MediaWiki's 255 characters", async () => {
    const caller = createCaller(createMockRouterContext({ db: createMockPrisma() }) as never);
    await caller.getSheet({ cardId: "c1", from: "holder.Takatta Loa" });
    await caller.getSheet({ cardId: "c1", from: `holder.${"x".repeat(255)}` });
    expect(jest.mocked(loadCardSheet).mock.calls.map((call) => call[3].from)).toEqual([
      { kind: "holder", handle: "Takatta Loa" },
      { kind: "holder", handle: "x".repeat(255) },
    ]);
  });

  it("drops a malformed or missing from", async () => {
    const caller = createCaller(createMockRouterContext({ db: createMockPrisma() }) as never);
    await caller.getSheet({ cardId: "c1", from: "offer.<script>" });
    await caller.getSheet({ cardId: "c1" });
    expect(jest.mocked(loadCardSheet).mock.calls.map((call) => call[3].from)).toEqual([null, null]);
  });

  it("opens to a signed-out visitor as nobody, and hands back the sheet's answer", async () => {
    const db = createMockPrisma();
    jest.mocked(loadCardSheet).mockResolvedValueOnce({ signIn: true });
    await expect(
      signedOut(db).getSheet({ cardId: "c1", from: "holder.Takatta Loa" })
    ).resolves.toEqual({ signIn: true });
    const [passedDb, viewer, card, options] = jest.mocked(loadCardSheet).mock.calls[0]!;
    expect([passedDb, viewer, card, options.from]).toEqual([
      db,
      null,
      "c1",
      { kind: "holder", handle: "Takatta Loa" },
    ]);
  });

  it("counts every read against the read-only bucket, signed in by user and signed out by IP", async () => {
    await createCaller(
      createMockRouterContext({
        db: createMockPrisma(),
        rateLimitIdentifier: "user:clerk_me",
      }) as never
    ).getSheet({ cardId: "c1" });
    await signedOut().getSheet({ cardId: "c1" });
    const bucket = { maxRequests: 120, windowMs: 60_000 };
    expect(mockCheck.mock.calls).toEqual([
      ["user:clerk_me", "queries", bucket],
      ["ip:203.0.113.7", "queries", bucket],
    ]);
  });

  it("refuses a caller over the limit before reading the card", async () => {
    mockCheck.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });
    await expect(signedOut().getSheet({ cardId: "c1" })).rejects.toThrow(/Too many requests/);
    expect(loadCardSheet).not.toHaveBeenCalled();
  });

  it("refuses an oversized input", async () => {
    const caller = createCaller(createMockRouterContext({ db: createMockPrisma() }) as never);
    await expect(caller.getSheet({ cardId: "x".repeat(65) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.getSheet({ cardId: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.getSheet({ cardId: "c1", from: "x".repeat(263) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(loadCardSheet).not.toHaveBeenCalled();
  });
});
describe("playersOf", () => {
  it("names everyone by the identity rule, with one batched name read and one passport read", async () => {
    const ids = ["u-shows", "u-hides", "u-shows", "u-gone"];
    const players = await playersOf(ids);
    expect(loadPlayerNames).toHaveBeenCalledTimes(1);
    expect(loadPlayerNames).toHaveBeenCalledWith(ids);
    expect(loadVaultCardsShown).toHaveBeenCalledTimes(1);
    expect(loadVaultCardsShown).toHaveBeenCalledWith(ids);
    // A player who no longer exists is left out.
    expect([...players]).toEqual([
      ["u-shows", { name: "@ann", showsVault: true }],
      ["u-hides", { name: "Caphiria", showsVault: false }],
    ]);
  });
});

describe("holderOf", () => {
  const users = jest.mocked(serverDb.user);
  it("names nobody for a handle no player has, or when the lookup fails", async () => {
    users.findUnique.mockResolvedValue(null);
    users.findFirst.mockResolvedValueOnce(null);
    await expect(holderOf("Takatta Loa")).resolves.toBeNull();
    users.findFirst.mockRejectedValueOnce(new Error("database down"));
    await expect(holderOf("Takatta Loa")).resolves.toBeNull();
  });
});
