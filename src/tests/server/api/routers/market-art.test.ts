/** @jest-environment node */
/** A trade's sides and the market's auctions show every card's art, each face marked by the viewer's own copies. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/identity/identity.player-names", () => ({
  loadPlayerNames: jest.fn(),
}));
jest.mock("~/lib/cards/copy-value", () => ({ loadCopyValues: jest.fn() }));

import { createCallerFactory } from "~/server/api/trpc";
import { tradingQueriesRouter } from "~/server/api/routers/trading/queries";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { loadCopyValues } from "~/lib/cards/copy-value";

type MockDb = ReturnType<typeof createMockPrisma>;
const contextFor = (db: MockDb, signedIn = true) =>
  createMockRouterContext(
    signedIn
      ? { db, user: { id: "me", clerkUserId: "clerk_me" }, auth: { userId: "clerk_me" } }
      : { db, user: null, auth: null }
  ) as never;
const trading = (db: MockDb, signedIn = true) =>
  createCallerFactory(tradingQueriesRouter)(contextFor(db, signedIn));

const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
const faceRow = (id: string, cardId: string, cardType = "LORE") => ({
  id,
  finish: "STANDARD",
  serialNumber: 1,
  level: 1,
  cards: {
    id: cardId,
    title: cardId,
    rarity: "RARE",
    cardType,
    artwork: `https://art/${cardId}.png`,
    isRetired: false,
    collectorNumber: 1,
    season: 1,
    nsSeason: null,
    realm,
  },
});
type OwnershipArgs = {
  where: { id?: { in: string[] } };
  select?: { cardId?: true };
};
/** The viewer holds `held` (card ids); every other ownership read is a face read over `faces`. */
function ownership(db: MockDb, held: string[], faces: ReturnType<typeof faceRow>[]) {
  db.cardOwnership.findMany.mockImplementation(async (args: OwnershipArgs) => {
    if (args.select?.cardId) return held.map((cardId) => ({ cardId }));
    const ids = args.where.id?.in;
    return ids ? faces.filter((r) => ids.includes(r.id)) : faces;
  });
}

beforeEach(() => {
  jest
    .mocked(loadPlayerNames)
    .mockClear()
    .mockResolvedValue(
      new Map([
        ["them", { handle: "clerk_them", displayName: "Caphiria" }],
        ["me", { handle: "max", displayName: "@max" }],
      ])
    );
});

describe("trade parties", () => {
  const party = (id: string) => ({ id, clerkUserId: `clerk_${id}`, country: null });
  const offer = (id: string, initiatorId: string, recipientId: string) => ({
    id,
    initiator: party(initiatorId),
    recipient: party(recipientId),
  });

  it("names both sides of every open and finished trade by the identity rule, one batched read a list", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findMany.mockResolvedValue([
      offer("t1", "them", "me"),
      offer("t2", "me", "them"),
    ]);
    db.tradeOffer.count.mockResolvedValue(2);

    const open = await trading(db).getActiveTrades();
    expect(open.map((t) => [t.initiator.displayName, t.recipient.displayName])).toEqual([
      ["Caphiria", "@max"],
      ["@max", "Caphiria"],
    ]);
    // The passport handle stays for the holder link, even a Clerk id, which resolves.
    expect(open.map((t) => t.initiator.passportHandle)).toEqual(["clerk_them", "max"]);
    expect(loadPlayerNames).toHaveBeenCalledTimes(1);
    expect(loadPlayerNames).toHaveBeenCalledWith(["them", "me", "me", "them"]);

    const history = await trading(db).getTradeHistory({});
    expect(history.trades.map((t) => t.recipient.displayName)).toEqual(["@max", "Caphiria"]);
    expect(loadPlayerNames).toHaveBeenCalledTimes(2);
    // The stored handle is only the first link of the chain, so it is not read for a trade.
    expect(db.tradeOffer.findMany.mock.calls[0]![0].include.initiator.select).not.toHaveProperty(
      "handle"
    );
  });

  it("links a player the names could not read by their Clerk id, and calls them a player", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findMany.mockResolvedValue([offer("t1", "gone", "me")]);
    const [trade] = await trading(db).getActiveTrades();
    expect(trade!.initiator).toMatchObject({ passportHandle: "clerk_gone", displayName: null });
  });
});

describe("trade details", () => {
  const pendingOffer = {
    id: "t1",
    initiatorId: "them",
    recipientId: "me",
    proposerId: "them",
    revision: 0,
    initiatorCardIds: ["o1", 3],
    recipientCardIds: ["o2"],
    initiatorCredits: 5,
    recipientCredits: 0,
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
    initiator: { id: "them", clerkUserId: "clerk_them" },
    recipient: { id: "me", clerkUserId: "clerk_me" },
  };
  const trade = (overrides: Partial<typeof pendingOffer> = {}) => ({
    ...pendingOffer,
    ...overrides,
  });
  const faces = [faceRow("o1", "c1"), faceRow("o2", "c2")];
  /** The shared copy value of the live copies asked for (a retired card's copy is left out). */
  const worth: Record<string, number> = { o1: 30, o2: 12 };
  beforeEach(() => {
    jest.mocked(loadCopyValues).mockImplementation(async (_db, filter) =>
      (filter.ownershipIds ?? [])
        .filter((id) => id in worth)
        .map((ownershipId) => ({
          ownershipId,
          ownerId: "x",
          cardId: "c",
          cardType: "LORE" as const,
          finish: "STANDARD" as const,
          value: worth[ownershipId]!,
        }))
    );
  });
  it("values a hidden (retired) copy at 0, as Mine and the sheet do", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findUnique.mockResolvedValue(trade({ initiatorCardIds: ["o1", "o3"] }));
    ownership(db, [], [...faces, faceRow("o3", "c3")]);
    const result = await trading(db).getTradeById({ tradeId: "t1" });
    expect(result).toMatchObject({ initiatorValue: 35, recipientValue: 12 });
  });

  it("refuses a signed-out caller and hides the trade from a player outside it", async () => {
    const db = createMockPrisma();
    await expect(trading(db, false).getTradeById({ tradeId: "t1" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    db.tradeOffer.findUnique.mockResolvedValue(trade({ initiatorId: "x", recipientId: "y" }));
    await expect(trading(db).getTradeById({ tradeId: "t1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });
});
