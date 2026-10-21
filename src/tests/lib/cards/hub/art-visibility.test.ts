/** @jest-environment node */
/** Who sees a card's art: holders, anyone looking at a live listing, and the showcase and offer contexts. */
jest.mock("~/lib/cards/copy-value", () => ({ topCopiesByValue: jest.fn() }));

import { topCopiesByValue } from "~/lib/cards/copy-value";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import {
  cardsWithVisibleArt,
  contextRevealsArt,
  copyIdsOf,
  facesFor,
} from "~/lib/cards/hub/art-visibility";
import { displayedCopies } from "~/lib/cards/hub/displayed";
import type { CardFaceRow } from "~/lib/cards/hub/faces";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
const card = (id: string, cardType: CardFaceRow["cardType"] = "LORE"): CardFaceRow => ({
  id,
  title: id,
  rarity: "RARE",
  cardType,
  artwork: `https://art/${id}.png`,
  isRetired: false,
  collectorNumber: 1,
  season: 1,
  nsSeason: null,
  realm,
});
const copyOf = (id: string) => ({
  id: `o-${id}`,
  finish: "STANDARD" as const,
  serialNumber: 1,
  level: 1,
});
/** The passport chain reversed: "ann" (a stored handle) and "Takatta Loa" (a wiki name) name the holder. */
const holderOf = jest.fn(async (handle: string) =>
  handle === "ann" || handle === "Takatta Loa" ? "holder" : null
);
const visible = { vaultVisible: jest.fn(async () => true), holderOf };
const hidden = { vaultVisible: jest.fn(async () => false), holderOf };
/** The shared copy value's ranking of a player's copies, best first. */
const ranked = (...ids: string[]) =>
  ids.map((id, i) => ({
    ownershipId: `o-${id}`,
    ownerId: "u1",
    cardId: id,
    cardType: "LORE" as const,
    finish: "STANDARD" as const,
    value: 100 - i,
  }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(topCopiesByValue).mockResolvedValue([]);
});

describe("cardsWithVisibleArt", () => {
  it("joins the viewer's copies with the cards on a live auction", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findMany.mockResolvedValue([{ cardId: "a" }]);
    db.cardAuction.findMany.mockResolvedValue([{ cardId: "b" }]);
    const set = await cardsWithVisibleArt(db as never, "me", ["a", "b", "c", "a"]);
    expect([...set].sort()).toEqual(["a", "b"]);
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { ownerId: "me", cardId: { in: ["a", "b", "c"] } },
      select: { cardId: true },
      distinct: ["cardId"],
    });
    // The auction's own card, not its copy's (an ended auction can outlive its copy)
    expect(db.cardAuction.findMany).toHaveBeenCalledWith({
      where: {
        status: "ACTIVE",
        endTime: { gt: expect.any(Date) },
        cardId: { in: ["a", "b", "c"] },
      },
      select: { cardId: true },
      distinct: ["cardId"],
    });
  });

  it("reveals only listed art to a signed-out viewer, and asks nothing for no cards", async () => {
    const db = createMockPrisma();
    db.cardAuction.findMany.mockResolvedValue([{ cardId: "a" }]);
    await expect(cardsWithVisibleArt(db as never, null, ["a"])).resolves.toEqual(new Set(["a"]));
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    const empty = createMockPrisma();
    await expect(cardsWithVisibleArt(empty as never, "me", [])).resolves.toEqual(new Set());
    expect(empty.cardAuction.findMany).not.toHaveBeenCalled();
    expect(empty.cardListing.findMany).not.toHaveBeenCalled();
  });

  it("shows the art of a card on a live fixed-price listing to someone who owns none", async () => {
    const db = createMockPrisma();
    db.cardListing.findMany.mockResolvedValue([{ cardId: "c2" }]);
    expect(await cardsWithVisibleArt(db as never, "viewer", ["c1", "c2"])).toEqual(new Set(["c2"]));
    // The listing's own card, which it keeps when a finished listing outlives its copy
    expect(db.cardListing.findMany).toHaveBeenCalledWith({
      where: {
        status: "ACTIVE",
        expiresAt: { gt: expect.any(Date) },
        cardId: { in: ["c1", "c2"] },
      },
      select: { cardId: true },
      distinct: ["cardId"],
    });
    const signedOut = createMockPrisma();
    signedOut.cardListing.findMany.mockResolvedValue([{ cardId: "c1" }]);
    await expect(cardsWithVisibleArt(signedOut as never, null, ["c1"])).resolves.toEqual(
      new Set(["c1"])
    );
  });

  it("reads the listings and auctions that are live now", async () => {
    const now = new Date("2026-11-02T12:00:00Z");
    jest.useFakeTimers({ now });
    const db = createMockPrisma();
    await cardsWithVisibleArt(db as never, "viewer", ["c1"]);
    jest.useRealTimers();
    expect(db.cardListing.findMany.mock.calls[0]![0].where.expiresAt).toEqual({ gt: now });
    expect(db.cardAuction.findMany.mock.calls[0]![0].where.endTime).toEqual({ gt: now });
  });
});

describe("facesFor", () => {
  it("strips the art of every card the viewer may not see", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findMany.mockResolvedValue([{ cardId: "mine" }]);
    const faces = await facesFor(db as never, "me", [
      { card: card("mine"), copy: copyOf("mine") },
      { card: card("theirs") },
      { card: card("flag", "NS") },
    ]);
    expect(faces.map((f) => [f.cardId, f.artwork !== null, f.silhouette])).toEqual([
      ["mine", true, false],
      ["theirs", false, true],
      ["flag", true, false],
    ]);
    expect(faces.map((f) => f.copy?.ownershipId ?? null)).toEqual(["o-mine", null, null]);
  });
});

describe("copyIdsOf", () => {
  it("keeps the string ids of a stored list, and reads anything else as none", () => {
    expect(copyIdsOf(["o1", 5, null, "o2"])).toEqual(["o1", "o2"]);
    expect(copyIdsOf({ ids: ["o1"] })).toEqual([]);
    expect(copyIdsOf(null)).toEqual([]);
  });
});

/** A stored trade, for a findFirst that applies the offer rule's `where` as the database would. */
interface OfferRow {
  id: string;
  initiatorId: string;
  recipientId: string;
  proposerId: string;
  status: string;
  expiresAt: Date;
  initiatorCardIds: string[];
  recipientCardIds: string[];
}
interface OfferWhere {
  id: string;
  status: string;
  expiresAt: { gt: Date };
  proposerId: { not: string };
  OR: Array<{ initiatorId?: string; recipientId?: string }>;
}
const matches = (row: OfferRow, where: OfferWhere) =>
  row.id === where.id &&
  row.status === where.status &&
  row.expiresAt > where.expiresAt.gt &&
  row.proposerId !== where.proposerId.not &&
  where.OR.some((or) => row.initiatorId === or.initiatorId || row.recipientId === or.recipientId);
function offersIn(db: ReturnType<typeof createMockPrisma>, rows: OfferRow[]) {
  db.tradeOffer.findFirst.mockImplementation(
    async ({ where }: { where: OfferWhere }) => rows.find((row) => matches(row, where)) ?? null
  );
}
const offerRow = (over: Partial<OfferRow> = {}): OfferRow => ({
  id: "t1",
  initiatorId: "them",
  recipientId: "me",
  proposerId: "them",
  status: "PENDING",
  expiresAt: new Date(Date.now() + 60_000),
  initiatorCardIds: ["o1"],
  recipientCardIds: [],
  ...over,
});

describe("contextRevealsArt", () => {
  it("reveals an offer's cards to the party it waits on, whichever side they are, while it is live", async () => {
    const db = createMockPrisma();
    db.cardOwnership.count.mockResolvedValue(1);
    const reveals = (viewer: string) =>
      contextRevealsArt(db as never, viewer, "c1", { kind: "offer", id: "t1" }, visible);

    offersIn(db, [offerRow()]);
    await expect(reveals("me")).resolves.toBe(true);
    // The proposer sees their own table by the silhouette rule
    await expect(reveals("them")).resolves.toBe(false);
    // A counter-offer from the recipient waits on the initiator
    offersIn(db, [offerRow({ proposerId: "me" })]);
    await expect(reveals("them")).resolves.toBe(true);
    await expect(reveals("me")).resolves.toBe(false);
    // Nobody outside the trade, and nothing once it ended or expired
    await expect(reveals("carol")).resolves.toBe(false);
    offersIn(db, [offerRow({ status: "ACCEPTED" })]);
    await expect(reveals("me")).resolves.toBe(false);
    offersIn(db, [offerRow({ expiresAt: new Date(Date.now() - 1) })]);
    await expect(reveals("me")).resolves.toBe(false);
  });

  it("reveals only the offer's own cards, and nothing for an unknown offer or a signed-out viewer", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findFirst.mockResolvedValue({
      initiatorCardIds: ["o1", 5],
      recipientCardIds: [],
    });
    db.cardOwnership.count.mockResolvedValue(1);
    await expect(
      contextRevealsArt(db as never, "me", "c1", { kind: "offer", id: "t1" }, visible)
    ).resolves.toBe(true);
    expect(db.tradeOffer.findFirst.mock.calls[0]![0].where).toEqual({
      id: "t1",
      status: "PENDING",
      expiresAt: { gt: expect.any(Date) },
      proposerId: { not: "me" },
      OR: [{ initiatorId: "me" }, { recipientId: "me" }],
    });
    expect(db.cardOwnership.count).toHaveBeenCalledWith({
      where: { id: { in: ["o1"] }, cardId: "c1" },
    });

    db.cardOwnership.count.mockResolvedValue(0);
    await expect(
      contextRevealsArt(db as never, "me", "c2", { kind: "offer", id: "t1" }, visible)
    ).resolves.toBe(false);

    db.tradeOffer.findFirst.mockResolvedValue(null);
    await expect(
      contextRevealsArt(db as never, "me", "c1", { kind: "offer", id: "t2" }, visible)
    ).resolves.toBe(false);
    await expect(
      contextRevealsArt(db as never, null, "c1", { kind: "offer", id: "t1" }, visible)
    ).resolves.toBe(false);
    expect(db.tradeOffer.findFirst).toHaveBeenCalledTimes(3);
  });

  it("counts nothing for an offer that lists no copies", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findFirst.mockResolvedValue({ initiatorCardIds: [], recipientCardIds: "o1" });
    await expect(
      contextRevealsArt(db as never, "me", "c1", { kind: "offer", id: "t1" }, visible)
    ).resolves.toBe(false);
    expect(db.cardOwnership.count).not.toHaveBeenCalled();
  });

  it("reveals a card in another player's public showcase, unless they hide their Vault cards", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue({ userId: "owner", items: [{ id: "i1" }] });
    await expect(
      contextRevealsArt(db as never, "me", "c1", { kind: "showcase", id: "s1" }, visible)
    ).resolves.toBe(true);
    expect(db.cardCollection.findFirst.mock.calls[0]![0].where).toEqual({
      id: "s1",
      isPublic: true,
      items: { some: { cardOwnership: { cardId: "c1" } } },
    });
    expect(visible.vaultVisible).toHaveBeenLastCalledWith("owner");
    await expect(
      contextRevealsArt(db as never, "me", "c1", { kind: "showcase", id: "s1" }, hidden)
    ).resolves.toBe(false);
    db.cardCollection.findFirst.mockResolvedValue(null);
    await expect(
      contextRevealsArt(db as never, "me", "c1", { kind: "showcase", id: "s2" }, visible)
    ).resolves.toBe(false);
  });

  it("reveals a retired copy in a showcase to its owner only, as the showcase lists it", async () => {
    const db = createMockPrisma();
    // The showcase holds the card, but no copy of it that is not retired.
    db.cardCollection.findFirst.mockResolvedValue({ userId: "owner", items: [] });
    const from = { kind: "showcase" as const, id: "s1" };
    await expect(contextRevealsArt(db as never, "me", "c1", from, visible)).resolves.toBe(false);
    await expect(contextRevealsArt(db as never, null, "c1", from, visible)).resolves.toBe(false);
    expect(visible.vaultVisible).not.toHaveBeenCalled();
    await expect(contextRevealsArt(db as never, "owner", "c1", from, visible)).resolves.toBe(true);
    expect(db.cardCollection.findFirst.mock.calls[0]![0].select.items).toEqual({
      where: { cardOwnership: { cardId: "c1", cards: { isRetired: false } } },
      take: 1,
      select: { id: true },
    });
  });

  it("reveals a holder's trophy, or a card they display, when they show their Vault cards", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findFirst.mockResolvedValue({ id: "trophy-copy" });
    await expect(
      contextRevealsArt(db as never, "me", "t1", { kind: "holder", handle: "ann" }, visible)
    ).resolves.toBe(true);
    expect(holderOf).toHaveBeenCalledWith("ann");
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.cardOwnership.findFirst.mock.calls[0]![0].where).toEqual({
      ownerId: "holder",
      cardId: "t1",
      cards: { cardType: "TROPHY" },
    });

    db.cardOwnership.findFirst.mockResolvedValue(null);
    db.cardCollection.findFirst.mockResolvedValue(null);
    jest.mocked(topCopiesByValue).mockResolvedValue(ranked("c9"));
    db.cardOwnership.findMany.mockResolvedValue([{ ...copyOf("c9"), cards: card("c9") }]);
    await expect(
      contextRevealsArt(db as never, "me", "c9", { kind: "holder", handle: "ann" }, visible)
    ).resolves.toBe(true);
    await expect(
      contextRevealsArt(db as never, "me", "c8", { kind: "holder", handle: "ann" }, visible)
    ).resolves.toBe(false);
    await expect(
      contextRevealsArt(db as never, "me", "c9", { kind: "holder", handle: "ann" }, hidden)
    ).resolves.toBe(false);
    expect(hidden.vaultVisible).toHaveBeenLastCalledWith("holder");
  });

  it("finds a holder with no stored handle by the passport handle they show", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findFirst.mockResolvedValue({ id: "trophy-copy" });
    await expect(
      contextRevealsArt(db as never, "me", "t1", { kind: "holder", handle: "Takatta Loa" }, visible)
    ).resolves.toBe(true);
    expect(holderOf).toHaveBeenCalledWith("Takatta Loa");
    expect(visible.vaultVisible).toHaveBeenCalledWith("holder");
    expect(db.cardOwnership.findFirst.mock.calls[0]![0].where).toMatchObject({ ownerId: "holder" });
  });

  it("reveals nothing for a handle no player has", async () => {
    const db = createMockPrisma();
    await expect(
      contextRevealsArt(db as never, "me", "c1", { kind: "holder", handle: "nobody" }, visible)
    ).resolves.toBe(false);
    expect(visible.vaultVisible).not.toHaveBeenCalled();
    expect(db.cardOwnership.findFirst).not.toHaveBeenCalled();
  });
});

describe("displayedCopies", () => {
  it("shows the latest public pinned showcase, in the order its cards were added, leaving hidden cards out", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue({
      id: "s1",
      name: "Best of Ixnay",
      items: [{ cardOwnership: { ...copyOf("c1"), cards: card("c1") } }],
    });
    const shown = await displayedCopies(db as never, "u1");
    expect(shown.showcase).toEqual({ id: "s1", name: "Best of Ixnay" });
    expect(shown.copies).toEqual([{ card: card("c1"), copy: copyOf("c1") }]);
    expect(db.cardCollection.findFirst.mock.calls[0]![0].where).toEqual({
      userId: "u1",
      isPublic: true,
      pinnedAt: { not: null },
    });
    expect(db.cardCollection.findFirst.mock.calls[0]![0]).toMatchObject({
      orderBy: { pinnedAt: "desc" },
      select: {
        items: {
          where: { cardOwnership: { cards: { isRetired: false } } },
          orderBy: { addedAt: "asc" },
          take: 6,
        },
      },
    });
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });

  it("falls back to the most valuable live copies by copy value, one per card, best first", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue({ id: "s1", name: "Empty", items: [] });
    jest.mocked(topCopiesByValue).mockResolvedValue(ranked("c3", "c2"));
    db.cardOwnership.findMany.mockResolvedValue([
      { ...copyOf("c2"), cards: card("c2") },
      { ...copyOf("c3"), cards: card("c3") },
    ]);
    const shown = await displayedCopies(db as never, "u1", 4);
    expect(shown).toEqual({
      showcase: null,
      copies: [
        { card: card("c3"), copy: copyOf("c3") },
        { card: card("c2"), copy: copyOf("c2") },
      ],
    });
    expect(db.cardCollection.findFirst.mock.calls[0]![0]).toMatchObject({
      select: { items: { take: 4 } },
    });
    expect(jest.mocked(topCopiesByValue)).toHaveBeenCalledWith(db, "u1", 4);
    expect(db.cardOwnership.findMany.mock.calls[0]![0]).toMatchObject({
      where: { id: { in: ["o-c3", "o-c2"] }, ownerId: "u1", cards: { isRetired: false } },
    });
  });

  it("leaves out a ranked copy that moved or was retired before its face was read", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue(null);
    jest.mocked(topCopiesByValue).mockResolvedValue(ranked("c3", "c2"));
    db.cardOwnership.findMany.mockResolvedValue([{ ...copyOf("c2"), cards: card("c2") }]);
    const shown = await displayedCopies(db as never, "u1");
    expect(shown.copies).toEqual([{ card: card("c2"), copy: copyOf("c2") }]);
  });

  it("reads no faces when the player holds no live copy", async () => {
    const unpinned = createMockPrisma();
    await expect(displayedCopies(unpinned as never, "u1")).resolves.toEqual({
      showcase: null,
      copies: [],
    });
    expect(jest.mocked(topCopiesByValue)).toHaveBeenCalledWith(unpinned, "u1", 6);
    expect(unpinned.cardOwnership.findMany).not.toHaveBeenCalled();
  });
});
