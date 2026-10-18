/** @jest-environment node */
/** Who sees a card's art: holders, anyone looking at a live listing, and the showcase and offer contexts. */
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

beforeEach(() => jest.clearAllMocks());

describe("cardsWithVisibleArt", () => {
  it("joins the viewer's copies with the cards on a live auction", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findMany.mockResolvedValue([{ cardId: "a" }]);
    // A live auction's copy is locked, so it is there; the link is nullable only for ended auctions
    db.cardAuction.findMany.mockResolvedValue([
      { CardOwnership: { cardId: "b" } },
      { CardOwnership: null },
    ]);
    const set = await cardsWithVisibleArt(db as never, "me", ["a", "b", "c", "a"]);
    expect([...set].sort()).toEqual(["a", "b"]);
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { ownerId: "me", cardId: { in: ["a", "b", "c"] } },
      select: { cardId: true },
      distinct: ["cardId"],
    });
    expect(db.cardAuction.findMany.mock.calls[0]![0]).toMatchObject({
      where: {
        status: "ACTIVE",
        endTime: { gt: expect.any(Date) },
        CardOwnership: { cardId: { in: ["a", "b", "c"] } },
      },
    });
  });

  it("reveals only listed art to a signed-out viewer, and asks nothing for no cards", async () => {
    const db = createMockPrisma();
    db.cardAuction.findMany.mockResolvedValue([{ CardOwnership: { cardId: "a" } }]);
    await expect(cardsWithVisibleArt(db as never, null, ["a"])).resolves.toEqual(new Set(["a"]));
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
    const empty = createMockPrisma();
    await expect(cardsWithVisibleArt(empty as never, "me", [])).resolves.toEqual(new Set());
    expect(empty.cardAuction.findMany).not.toHaveBeenCalled();
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

describe("contextRevealsArt", () => {
  it("reveals the cards of a pending, unexpired offer made to the viewer, and nothing for anyone else", async () => {
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
      recipientId: "me",
      status: "PENDING",
      expiresAt: { gt: expect.any(Date) },
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

  it("falls back to the most valuable live copies, one per card, when nothing is pinned or the pin is empty", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue({ id: "s1", name: "Empty", items: [] });
    db.cardOwnership.findMany.mockResolvedValue([{ ...copyOf("c2"), cards: card("c2") }]);
    const shown = await displayedCopies(db as never, "u1", 4);
    expect(shown).toEqual({ showcase: null, copies: [{ card: card("c2"), copy: copyOf("c2") }] });
    expect(db.cardCollection.findFirst.mock.calls[0]![0]).toMatchObject({
      select: { items: { take: 4 } },
    });
    expect(db.cardOwnership.findMany.mock.calls[0]![0]).toMatchObject({
      where: { ownerId: "u1", cards: { isRetired: false } },
      orderBy: [{ cards: { marketValue: "desc" } }, { cardId: "asc" }, { id: "asc" }],
      distinct: ["cardId"],
      take: 4,
    });

    const unpinned = createMockPrisma();
    await expect(displayedCopies(unpinned as never, "u1")).resolves.toEqual({
      showcase: null,
      copies: [],
    });
    expect(unpinned.cardOwnership.findMany).toHaveBeenCalledTimes(1);
  });
});
