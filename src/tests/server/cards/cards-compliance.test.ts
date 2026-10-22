/** @jest-environment node */
/**
 * One takedown queue for every card source: 14 days to answer, art hidden reversibly (a takedown never changes the
 * review state), restore really restores, NationStates self-service on top, and licence review.
 */
import {
  fileTakedown,
  hideTakedownArt,
  requestTakedown,
  restoreTakedown
} from "~/server/modules/cards/cards.compliance";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
const RECEIVED = new Date("2026-10-01T09:00:00Z");
const ELM = "https://iiwiki.com/images/a/ab/Elm.png";

/** A mock database whose transactions run on itself, whose advisory locks resolve and whose card writes match. */
function mockDb() {
  const db = createMockPrisma({ $executeRaw: jest.fn() });
  db.card.updateMany.mockResolvedValue({ count: 1 });
  return db;
}
type MockDb = ReturnType<typeof mockDb>;

/** The takedown row hiding reads: the card's art, whether it is retired, and its metadata. */
const takedownOf = (card: { artwork: string | null; isRetired: boolean; metadata?: object }) => ({
  id: "td_1",
  cardId: "card_1",
  card: { id: "card_1", metadata: {}, ...card },
});

/** The takedown row restore reads. */
const hiddenTakedown = (fields: {
  savedArtwork: string | null;
  retiredByTakedown: boolean;
  card?: Partial<{ artwork: string | null; metadata: object; artLicence: { status: string } }>;
}) => ({
  id: "td_1",
  cardId: "card_1",
  status: "HIDDEN",
  savedArtwork: fields.savedArtwork,
  retiredByTakedown: fields.retiredByTakedown,
  card: { id: "card_1", artwork: null, metadata: {}, artLicence: null, ...fields.card },
});

const audits = (db: MockDb) =>
  db.auditLog.create.mock.calls.map(([arg]: [{ data: object }]) => arg.data);

/** The card write hiding made: `{ where, data }`. */
const hideWrite = (db: MockDb, call = 0) => db.card.updateMany.mock.calls[call]![0];

/** Whether the card's takedown lock was taken before `mock`'s first call. */
const lockedBefore = (db: MockDb, mock: jest.Mock, call = 0) =>
  db.$executeRaw.mock.invocationCallOrder[0]! < mock.mock.invocationCallOrder[call]!;

describe("fileTakedown", () => {
  it("files a request due 14 days after it arrived, under the card's lock, with an audit row", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1" });
    db.cardTakedown.create.mockResolvedValue({ id: "td_1" });

    await expect(
      fileTakedown(db as never, actor, {
        cardId: "card_1",
        origin: "AUTHOR_REQUEST",
        reason: "I made this map",
        contact: "a@b.c",
        receivedAt: RECEIVED,
      })
    ).resolves.toEqual({ takedownId: "td_1" });

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(lockedBefore(db, db.cardTakedown.findFirst)).toBe(true);
    expect(db.cardTakedown.create).toHaveBeenCalledWith({
      data: {
        cardId: "card_1",
        origin: "AUTHOR_REQUEST",
        reason: "I made this map",
        contact: "a@b.c",
        requestedBy: "db_admin",
        receivedAt: RECEIVED,
        dueAt: new Date("2026-10-15T09:00:00Z"),
      },
    });
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(audits(db)).toEqual([
      expect.objectContaining({ action: "CARD_TAKEDOWN", userId: "clerk_admin", target: "card_1" }),
    ]);
  });

  it("refuses a second request while one is active, so one request is active per card", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1" });
    db.cardTakedown.findFirst.mockResolvedValue({ id: "td_0", status: "HIDDEN" });

    await expect(
      fileTakedown(db as never, actor, { cardId: "card_1", origin: "ADMIN", reason: "again" })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/already has an open takedown/),
    });
    expect(db.cardTakedown.findFirst).toHaveBeenCalledWith({
      where: { cardId: "card_1", status: { in: ["OPEN", "HIDDEN"] } },
      select: { id: true, status: true },
    });
    expect(db.cardTakedown.create).not.toHaveBeenCalled();
  });
  it("hides the art reversibly: the art moves onto the takedown and the card leaves packs", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1" });
    db.cardTakedown.create.mockResolvedValue({ id: "td_1" });
    db.cardTakedown.findUnique.mockResolvedValue(takedownOf({ artwork: ELM, isRetired: false }));
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await fileTakedown(db as never, actor, {
      cardId: "card_1",
      origin: "ADMIN",
      reason: "Author asked",
      hideNow: true,
    });

    expect(db.cardTakedown.updateMany).toHaveBeenCalledWith({
      where: { id: "td_1", status: "OPEN" },
      data: expect.objectContaining({
        status: "HIDDEN",
        savedArtwork: ELM,
        retiredByTakedown: true,
        resolvedBy: "db_admin",
      }),
    });
    const { where, data } = hideWrite(db);
    expect(where).toEqual({ id: "card_1", artwork: ELM, isRetired: false });
    expect(data).toEqual({ artwork: null, isRetired: true, retiredAt: expect.any(Date) });
    expect(data).not.toHaveProperty("reviewState");
  });
});

describe("requestTakedown", () => {
  const request = {
    cardId: "card_1",
    requesterId: "db_player",
    reason: "It shows my house without asking",
    contact: "me@example.org",
  };
  /** A non-NationStates card, no active request for it, and `waiting` open player requests from the requester. */
  function playerDb(waiting = 0) {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1", cardType: "LORE" });
    db.cardTakedown.count.mockResolvedValue(waiting);
    db.cardTakedown.create.mockResolvedValue({ id: "td_1" });
    return db;
  }

  it("refuses a NationStates card, which keeps its verified takedown, touching nothing", async () => {
    const db = playerDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1", cardType: "NS" });

    await expect(requestTakedown(db as never, request)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/Verify & request takedown/),
    });
    expect(db.card.findUnique).toHaveBeenCalledWith({
      where: { id: "card_1" },
      select: { id: true, cardType: true },
    });
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(db.cardTakedown.create).not.toHaveBeenCalled();
  });
  it("files a player's fifth waiting request and refuses the sixth", async () => {
    const fifth = playerDb(4);
    await expect(requestTakedown(fifth as never, request)).resolves.toEqual({ status: "filed" });

    const sixth = playerDb(5);
    await expect(requestTakedown(sixth as never, request)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "You have 5 requests waiting. Staff will answer those first.",
    });
    expect(sixth.cardTakedown.create).not.toHaveBeenCalled();
    expect(sixth.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("hideTakedownArt", () => {
  it("hides under the card's lock, so a Library or Designer edit cannot write art over it", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue(takedownOf({ artwork: ELM, isRetired: false }));
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await hideTakedownArt(db as never, actor, "td_1");

    expect(db.cardTakedown.findUnique.mock.calls[0]![0]).toEqual({
      where: { id: "td_1" },
      select: { cardId: true },
    });
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.$executeRaw.mock.calls[0]).toContain("card_1");
    // The takedown and its card are read (second read) and written only once the lock is held
    expect(lockedBefore(db, db.cardTakedown.findUnique, 1)).toBe(true);
    expect(lockedBefore(db, db.cardTakedown.updateMany)).toBe(true);
  });
  it("refuses when the card's art changed after it was read, so no art is dropped unsaved", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue(takedownOf({ artwork: ELM, isRetired: false }));
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });
    db.card.updateMany.mockResolvedValue({ count: 0 });

    await expect(hideTakedownArt(db as never, actor, "td_1")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/card changed/),
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
describe("restoreTakedown", () => {
  it("restores the saved art and un-retires only a card the takedown retired, under the card's lock", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue(
      hiddenTakedown({ savedArtwork: ELM, retiredByTakedown: false })
    );
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await restoreTakedown(db as never, actor, "td_1");

    // The licence is read (second read) and the art written only once the lock is held
    expect(lockedBefore(db, db.cardTakedown.findUnique, 1)).toBe(true);
    expect(db.cardTakedown.updateMany).toHaveBeenCalledWith({
      where: { id: "td_1", status: "HIDDEN" },
      data: { status: "RESTORED", resolvedAt: expect.any(Date), resolvedBy: "db_admin" },
    });
    expect(db.card.update).toHaveBeenCalledWith({
      where: { id: "card_1" },
      data: { artwork: ELM },
    });
    expect(audits(db)).toEqual([
      expect.objectContaining({
        action: "CARD_TAKEDOWN",
        target: "card_1",
        details: "Restored the art",
      }),
    ]);
  });
  it("keeps art an admin has set since the art was hidden", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue(
      hiddenTakedown({ savedArtwork: ELM, retiredByTakedown: true, card: { artwork: "new.png" } })
    );
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await restoreTakedown(db as never, actor, "td_1");

    expect(db.card.update).toHaveBeenCalledWith({
      where: { id: "card_1" },
      data: { isRetired: false, retiredAt: null },
    });
  });

  it("refuses while the art's licence is restricted, so restricted art never shows", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue(
      hiddenTakedown({
        savedArtwork: ELM,
        retiredByTakedown: true,
        card: { artLicence: { status: "RESTRICTED" } },
      })
    );

    await expect(restoreTakedown(db as never, actor, "td_1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/Mark it open in Licence review/),
    });
    expect(db.cardTakedown.updateMany).not.toHaveBeenCalled();
    expect(db.card.update).not.toHaveBeenCalled();
  });
});
