/** @jest-environment node */
/** Which cards a viewer has collected, and the places that show a card (the sheet's showcase, offer and holder contexts). */
jest.mock("~/lib/cards/copy-value", () => ({ topCopiesByValue: jest.fn() }));

import { topCopiesByValue } from "~/lib/cards/copy-value";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { contextShowsCard } from "~/lib/cards/hub/art-visibility";
/** The passport chain reversed: "ann" (a stored handle) and "Takatta Loa" (a wiki name) name the holder. */
const holderOf = jest.fn(async (handle: string) =>
  handle === "ann" || handle === "Takatta Loa" ? "holder" : null
);
const visible = { vaultVisible: jest.fn(async () => true), holderOf };
const hidden = { vaultVisible: jest.fn(async () => false), holderOf };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(topCopiesByValue).mockResolvedValue([]);
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

describe("contextShowsCard", () => {
  it("shows an offer's cards to the party it waits on, whichever side they are, while it is live", async () => {
    const db = createMockPrisma();
    db.cardOwnership.count.mockResolvedValue(1);
    const shows = (viewer: string) =>
      contextShowsCard(db as never, viewer, "c1", { kind: "offer", id: "t1" }, visible);

    offersIn(db, [offerRow()]);
    await expect(shows("me")).resolves.toBe(true);
    // Not to the proposer: the table waits on the other party
    await expect(shows("them")).resolves.toBe(false);
    // A counter-offer from the recipient waits on the initiator
    offersIn(db, [offerRow({ proposerId: "me" })]);
    await expect(shows("them")).resolves.toBe(true);
    await expect(shows("me")).resolves.toBe(false);
    // Nobody outside the trade, and nothing once it ended or expired
    await expect(shows("carol")).resolves.toBe(false);
    offersIn(db, [offerRow({ status: "ACCEPTED" })]);
    await expect(shows("me")).resolves.toBe(false);
    offersIn(db, [offerRow({ expiresAt: new Date(Date.now() - 1) })]);
    await expect(shows("me")).resolves.toBe(false);
  });

  it("shows only the offer's own cards, and nothing for an unknown offer or a signed-out viewer", async () => {
    const db = createMockPrisma();
    db.tradeOffer.findFirst.mockResolvedValue({
      initiatorCardIds: ["o1", 5],
      recipientCardIds: [],
    });
    db.cardOwnership.count.mockResolvedValue(1);
    await expect(
      contextShowsCard(db as never, "me", "c1", { kind: "offer", id: "t1" }, visible)
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
      contextShowsCard(db as never, "me", "c2", { kind: "offer", id: "t1" }, visible)
    ).resolves.toBe(false);

    db.tradeOffer.findFirst.mockResolvedValue(null);
    await expect(
      contextShowsCard(db as never, "me", "c1", { kind: "offer", id: "t2" }, visible)
    ).resolves.toBe(false);
    await expect(
      contextShowsCard(db as never, null, "c1", { kind: "offer", id: "t1" }, visible)
    ).resolves.toBe(false);
    expect(db.tradeOffer.findFirst).toHaveBeenCalledTimes(3);
  });
  it("shows a card in another player's public showcase, unless they hide their Vault cards", async () => {
    const db = createMockPrisma();
    db.cardCollection.findFirst.mockResolvedValue({ userId: "owner", items: [{ id: "i1" }] });
    await expect(
      contextShowsCard(db as never, "me", "c1", { kind: "showcase", id: "s1" }, visible)
    ).resolves.toBe(true);
    expect(db.cardCollection.findFirst.mock.calls[0]![0].where).toEqual({
      id: "s1",
      isPublic: true,
      items: { some: { cardOwnership: { cardId: "c1" } } },
    });
    expect(visible.vaultVisible).toHaveBeenLastCalledWith("owner");
    await expect(
      contextShowsCard(db as never, "me", "c1", { kind: "showcase", id: "s1" }, hidden)
    ).resolves.toBe(false);
    db.cardCollection.findFirst.mockResolvedValue(null);
    await expect(
      contextShowsCard(db as never, "me", "c1", { kind: "showcase", id: "s2" }, visible)
    ).resolves.toBe(false);
  });

  it("shows a retired copy in a showcase to its owner only, as the showcase lists it", async () => {
    const db = createMockPrisma();
    // The showcase holds the card, but no copy of it that is not retired.
    db.cardCollection.findFirst.mockResolvedValue({ userId: "owner", items: [] });
    const from = { kind: "showcase" as const, id: "s1" };
    await expect(contextShowsCard(db as never, "me", "c1", from, visible)).resolves.toBe(false);
    await expect(contextShowsCard(db as never, null, "c1", from, visible)).resolves.toBe(false);
    expect(visible.vaultVisible).not.toHaveBeenCalled();
    await expect(contextShowsCard(db as never, "owner", "c1", from, visible)).resolves.toBe(true);
    expect(db.cardCollection.findFirst.mock.calls[0]![0].select.items).toEqual({
      where: { cardOwnership: { cardId: "c1", cards: { isRetired: false } } },
      take: 1,
      select: { id: true },
    });
  });
  it("shows nothing for a handle no player has", async () => {
    const db = createMockPrisma();
    await expect(
      contextShowsCard(db as never, "me", "c1", { kind: "holder", handle: "nobody" }, visible)
    ).resolves.toBe(false);
    expect(visible.vaultVisible).not.toHaveBeenCalled();
    expect(db.cardOwnership.findFirst).not.toHaveBeenCalled();
  });
});
