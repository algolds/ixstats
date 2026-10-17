/** @jest-environment node */
/**
 * One takedown queue for every card source: 14 days to answer, art hidden reversibly (a takedown never changes the
 * review state), restore really restores, NationStates self-service on top, and licence review.
 */
import {
  declineTakedown,
  fileLicenceTakedowns,
  fileTakedown,
  hideTakedownArt,
  listLicenceReview,
  listTakedowns,
  restoreTakedown,
  selfServiceTakedown,
  setCardLicence,
} from "~/server/modules/cards/cards.compliance";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
const RECEIVED = new Date("2026-10-01T09:00:00Z");
const ELM = "https://iiwiki.com/images/a/ab/Elm.png";
const FLAG = "https://www.nationstates.net/images/flags/x.png";

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

  it("refuses a card that does not exist", async () => {
    const db = mockDb();
    await expect(
      fileTakedown(db as never, actor, { cardId: "nope", origin: "ADMIN", reason: "Gone" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.cardTakedown.create).not.toHaveBeenCalled();
  });

  it("counts a received date still to come as now, so no deadline is pushed out", async () => {
    jest.useFakeTimers({
      now: new Date("2026-10-17T12:00:00Z"),
      doNotFake: ["nextTick", "setImmediate"],
    });
    try {
      const db = mockDb();
      db.card.findUnique.mockResolvedValue({ id: "card_1" });
      db.cardTakedown.create.mockResolvedValue({ id: "td_1" });
      await fileTakedown(db as never, actor, {
        cardId: "card_1",
        origin: "ADMIN",
        reason: "Author asked",
        receivedAt: new Date("2026-10-30T00:00:00Z"),
      });
      expect(db.cardTakedown.create.mock.calls[0]![0].data).toMatchObject({
        receivedAt: new Date("2026-10-17T12:00:00Z"),
        dueAt: new Date("2026-10-31T12:00:00Z"),
      });
    } finally {
      jest.useRealTimers();
    }
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

describe("hideTakedownArt", () => {
  it("keeps an already retired card's retirement, and restore will leave it retired", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue(takedownOf({ artwork: ELM, isRetired: true }));
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await hideTakedownArt(db as never, actor, "td_1");

    expect(db.cardTakedown.updateMany.mock.calls[0]![0].data).toMatchObject({
      retiredByTakedown: false,
    });
    expect(hideWrite(db)).toEqual({
      where: { id: "card_1", artwork: ELM, isRetired: true },
      data: { artwork: null, isRetired: true },
    });
    expect(audits(db)).toEqual([
      expect.objectContaining({
        action: "CARD_TAKEDOWN",
        target: "card_1",
        details: "Hid the art",
      }),
    ]);
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

  it("refuses a request that has been answered, touching no card", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue(takedownOf({ artwork: ELM, isRetired: false }));
    db.cardTakedown.updateMany.mockResolvedValue({ count: 0 });

    await expect(hideTakedownArt(db as never, actor, "td_1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a takedown that does not exist", async () => {
    const db = mockDb();
    await expect(hideTakedownArt(db as never, actor, "td_x")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("a card an old takedown hid, before the backfill", () => {
  it("files and hides, then restores to a live card with its flag and no marker", async () => {
    const legacy = { nsData: { flag: FLAG }, nsTakedown: { selfService: true, reason: "old" } };
    const db = mockDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1" });
    db.cardTakedown.create.mockResolvedValue({ id: "td_1" });
    db.cardTakedown.findUnique.mockResolvedValue(
      takedownOf({ artwork: null, isRetired: true, metadata: legacy })
    );
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await fileTakedown(db as never, actor, {
      cardId: "card_1",
      origin: "ADMIN",
      reason: "Bring it into the queue",
      hideNow: true,
    });

    // The old takedown retired the card, so this one owns the retirement
    const hidden = db.cardTakedown.updateMany.mock.calls[0]![0].data;
    expect(hidden).toMatchObject({ savedArtwork: null, retiredByTakedown: true });

    db.cardTakedown.findUnique.mockResolvedValue(
      hiddenTakedown({
        savedArtwork: hidden.savedArtwork,
        retiredByTakedown: hidden.retiredByTakedown,
        card: { artwork: null, metadata: legacy },
      })
    );
    await restoreTakedown(db as never, actor, "td_1");

    expect(db.card.update).toHaveBeenCalledWith({
      where: { id: "card_1" },
      data: {
        artwork: FLAG,
        isRetired: false,
        retiredAt: null,
        metadata: { nsData: { flag: FLAG }, nsTakedown: null },
      },
    });
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

  it("restores a takedown from before Phase 2 from the NationStates flag", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue(
      hiddenTakedown({
        savedArtwork: null,
        retiredByTakedown: true,
        card: { metadata: { nsData: { flag: FLAG }, nsTakedown: { reason: "old" } } },
      })
    );
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await restoreTakedown(db as never, actor, "td_1");

    expect(db.card.update).toHaveBeenCalledWith({
      where: { id: "card_1" },
      data: {
        artwork: FLAG,
        isRetired: false,
        retiredAt: null,
        metadata: { nsData: { flag: FLAG }, nsTakedown: null },
      },
    });
  });

  it("leaves a card with no saved art and no flag without art", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue(
      hiddenTakedown({ savedArtwork: null, retiredByTakedown: true })
    );
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await restoreTakedown(db as never, actor, "td_1");

    expect(db.card.update).toHaveBeenCalledWith({
      where: { id: "card_1" },
      data: { isRetired: false, retiredAt: null },
    });
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

  it("restores only hidden art", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue({
      ...hiddenTakedown({ savedArtwork: ELM, retiredByTakedown: true }),
      status: "OPEN",
    });
    await expect(restoreTakedown(db as never, actor, "td_1")).rejects.toMatchObject({
      code: "CONFLICT",
    });

    db.cardTakedown.findUnique.mockResolvedValue(
      hiddenTakedown({ savedArtwork: ELM, retiredByTakedown: true })
    );
    db.cardTakedown.updateMany.mockResolvedValue({ count: 0 });
    await expect(restoreTakedown(db as never, actor, "td_1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.card.update).not.toHaveBeenCalled();
  });

  it("refuses a takedown that does not exist", async () => {
    const db = mockDb();
    await expect(restoreTakedown(db as never, actor, "td_x")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("declineTakedown", () => {
  it("declines an open request with the explanation, auditing it against the card", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue({ cardId: "card_1" });
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await declineTakedown(db as never, actor, { takedownId: "td_1", note: "We hold a licence" });

    expect(db.cardTakedown.updateMany).toHaveBeenCalledWith({
      where: { id: "td_1", status: "OPEN" },
      data: {
        status: "DECLINED",
        resolutionNote: "We hold a licence",
        resolvedAt: expect.any(Date),
        resolvedBy: "db_admin",
      },
    });
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(audits(db)).toEqual([
      expect.objectContaining({
        action: "CARD_TAKEDOWN",
        target: "card_1",
        details: "Declined a takedown: We hold a licence",
      }),
    ]);
  });

  it("declines only an open request", async () => {
    const db = mockDb();
    db.cardTakedown.findUnique.mockResolvedValue({ cardId: "card_1" });
    db.cardTakedown.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      declineTakedown(db as never, actor, { takedownId: "td_1", note: "We hold a licence" })
    ).rejects.toThrow(/answered/);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a takedown that does not exist", async () => {
    const db = mockDb();
    await expect(
      declineTakedown(db as never, actor, { takedownId: "td_x", note: "No" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("listTakedowns", () => {
  it("lists waiting requests by deadline, and answered ones newest first", async () => {
    const db = mockDb();
    await listTakedowns(db as never, { status: "OPEN", limit: 50 });
    expect(db.cardTakedown.findMany.mock.calls[0]![0]).toMatchObject({
      where: { status: "OPEN" },
      orderBy: { dueAt: "asc" },
      take: 50,
    });

    await listTakedowns(db as never, { status: "ANSWERED", limit: 50 });
    expect(db.cardTakedown.findMany.mock.calls[1]![0]).toMatchObject({
      where: { status: { in: ["DECLINED", "RESTORED"] } },
      orderBy: { resolvedAt: "desc" },
    });
  });
});

describe("selfServiceTakedown", () => {
  it("files and hides in one step for a verified flag owner", async () => {
    const db = mockDb();
    db.cardTakedown.create.mockResolvedValue({ id: "td_ns" });
    db.cardTakedown.findUnique.mockResolvedValue({
      ...takedownOf({ artwork: "flag.png", isRetired: false }),
      id: "td_ns",
    });
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      selfServiceTakedown(db as never, {
        cardId: "card_1",
        verifiedNation: "Testlandia",
        requestedBy: null,
      })
    ).resolves.toEqual({ alreadyHidden: false });

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(lockedBefore(db, db.cardTakedown.findFirst)).toBe(true);
    expect(db.cardTakedown.create.mock.calls[0]![0].data).toMatchObject({
      origin: "NS_SELF_SERVICE",
      reason: "Flag owner takedown",
      contact: "NationStates: Testlandia",
      requestedBy: null,
    });
    expect(db.cardTakedown.updateMany.mock.calls[0]![0].where).toEqual({
      id: "td_ns",
      status: "OPEN",
    });
    expect(db.card.updateMany).toHaveBeenCalledTimes(1);
    expect(audits(db)).toEqual([
      expect.objectContaining({ action: "CARD_TAKEDOWN", userId: null, target: "card_1" }),
    ]);
  });

  it("does nothing when the art is already hidden", async () => {
    const db = mockDb();
    db.cardTakedown.findFirst.mockResolvedValue({ id: "td", status: "HIDDEN" });
    await expect(
      selfServiceTakedown(db as never, {
        cardId: "card_1",
        verifiedNation: "Testlandia",
        requestedBy: null,
      })
    ).resolves.toEqual({ alreadyHidden: true });
    expect(db.cardTakedown.create).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
  });

  it("hides through a request that is already waiting, filing no second one", async () => {
    const db = mockDb();
    db.cardTakedown.findFirst.mockResolvedValue({ id: "td_open", status: "OPEN" });
    db.cardTakedown.findUnique.mockResolvedValue({
      ...takedownOf({ artwork: "flag.png", isRetired: false }),
      id: "td_open",
    });
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await selfServiceTakedown(db as never, {
      cardId: "card_1",
      verifiedNation: "Testlandia",
      reason: "Please remove it",
      requestedBy: "db_user",
    });

    expect(db.cardTakedown.create).not.toHaveBeenCalled();
    expect(db.cardTakedown.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: "td_open", status: "OPEN" },
      data: { resolvedBy: "db_user" },
    });
  });
});

describe("licence review", () => {
  it("marks a licence open under the card's lock, recording who checked it, and files no takedown", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1", wikiSource: "althistory" });

    await setCardLicence(db as never, actor, {
      cardId: "card_1",
      status: "OPEN",
      licence: "CC BY-SA 3.0",
      note: "Uploader confirmed",
    });

    expect(lockedBefore(db, db.cardArtLicence.upsert)).toBe(true);
    expect(db.cardArtLicence.upsert).toHaveBeenCalledWith({
      where: { cardId: "card_1" },
      update: expect.objectContaining({
        status: "OPEN",
        licence: "CC BY-SA 3.0",
        note: "Uploader confirmed",
        reviewedBy: "db_admin",
      }),
      create: expect.objectContaining({ cardId: "card_1", wiki: "althistory", status: "OPEN" }),
    });
    expect(db.cardTakedown.create).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
    expect(audits(db)).toEqual([
      expect.objectContaining({ action: "CARD_LICENCE", target: "card_1" }),
    ]);
  });

  it("marks a licence restricted, filing a licence takedown and hiding the art at once", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1", wikiSource: "iiwiki" });
    db.cardTakedown.create.mockResolvedValue({ id: "td_lr" });
    db.cardTakedown.findUnique.mockResolvedValue({
      ...takedownOf({ artwork: ELM, isRetired: false }),
      id: "td_lr",
    });
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await setCardLicence(db as never, actor, {
      cardId: "card_1",
      status: "RESTRICTED",
      licence: "CC BY-NC 4.0",
    });

    expect(lockedBefore(db, db.cardArtLicence.upsert)).toBe(true);
    expect(db.cardTakedown.create.mock.calls[0]![0].data).toMatchObject({
      cardId: "card_1",
      origin: "LICENCE_REVIEW",
      reason: expect.stringContaining("CC BY-NC 4.0"),
    });
    expect(hideWrite(db).data).toMatchObject({ artwork: null, isRetired: true });
  });

  it("marks a licence restricted on a card with a waiting request by hiding that request's art", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1", wikiSource: "iiwiki" });
    db.cardTakedown.findFirst.mockResolvedValue({ id: "td_open", status: "OPEN" });
    db.cardTakedown.findUnique.mockResolvedValue({
      ...takedownOf({ artwork: ELM, isRetired: false }),
      id: "td_open",
    });
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await setCardLicence(db as never, actor, {
      cardId: "card_1",
      status: "RESTRICTED",
      licence: "CC BY-ND 4.0",
    });

    expect(db.cardTakedown.create).not.toHaveBeenCalled();
    expect(db.cardTakedown.updateMany.mock.calls[0]![0].where).toEqual({
      id: "td_open",
      status: "OPEN",
    });
    expect(db.card.updateMany).toHaveBeenCalledTimes(1);
  });

  it("marks a licence restricted on hidden art without touching the card again", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1", wikiSource: "iiwiki" });
    db.cardTakedown.findFirst.mockResolvedValue({ id: "td_h", status: "HIDDEN" });

    await setCardLicence(db as never, actor, {
      cardId: "card_1",
      status: "RESTRICTED",
      licence: "CC BY-NC 4.0",
    });

    expect(db.cardArtLicence.upsert).toHaveBeenCalledTimes(1);
    expect(db.cardTakedown.create).not.toHaveBeenCalled();
    expect(db.cardTakedown.updateMany).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a card that does not exist", async () => {
    const db = mockDb();
    await expect(
      setCardLicence(db as never, actor, { cardId: "nope", status: "OPEN", licence: "CC0" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.cardArtLicence.upsert).not.toHaveBeenCalled();
  });

  it("lists the records waiting at one status, oldest first, with their total", async () => {
    const db = mockDb();
    db.cardArtLicence.findMany.mockResolvedValue([{ cardId: "card_1" }]);
    db.cardArtLicence.count.mockResolvedValue(2400);

    await expect(
      listLicenceReview(db as never, { status: "UNKNOWN", limit: 100 })
    ).resolves.toEqual({ rows: [{ cardId: "card_1" }], total: 2400 });
    expect(db.cardArtLicence.findMany.mock.calls[0]![0]).toMatchObject({
      where: { status: "UNKNOWN" },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    expect(db.cardArtLicence.count).toHaveBeenCalledWith({ where: { status: "UNKNOWN" } });
  });
});

describe("fileLicenceTakedowns", () => {
  it("files a licence takedown that hides the art for each restricted card, skipping one with a request", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue({ id: "card_1" });
    db.cardTakedown.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "td_open", status: "OPEN" });
    db.cardTakedown.create.mockResolvedValue({ id: "td_lr" });
    db.cardTakedown.findUnique.mockResolvedValue({
      ...takedownOf({ artwork: ELM, isRetired: false }),
      id: "td_lr",
    });
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      fileLicenceTakedowns(db as never, [
        { cardId: "card_1", licence: "CC BY-NC 4.0" },
        { cardId: "card_2", licence: null },
      ])
    ).resolves.toEqual({ filed: 1, skipped: 1 });

    expect(db.$executeRaw).toHaveBeenCalledTimes(2);
    expect(db.cardTakedown.create).toHaveBeenCalledTimes(1);
    expect(db.cardTakedown.create.mock.calls[0]![0].data).toMatchObject({
      cardId: "card_1",
      origin: "LICENCE_REVIEW",
      reason: "Licensed CC BY-NC 4.0, which does not allow commercial use or changes",
      requestedBy: null,
    });
    expect(hideWrite(db).data).toMatchObject({ artwork: null, isRetired: true });
    expect(audits(db)).toEqual([
      expect.objectContaining({ action: "CARD_TAKEDOWN", userId: null }),
    ]);
  });

  it("stops on any other failure", async () => {
    const db = mockDb();
    await expect(
      fileLicenceTakedowns(db as never, [{ cardId: "gone", licence: "CC BY-NC 4.0" }])
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
