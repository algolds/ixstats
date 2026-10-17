/** @jest-environment node */
/**
 * The compliance backfill: old NationStates takedown markers come into the queue unless a request is active on the
 * card, and every restricted art that still shows is hidden, read from the database so a re-run finishes the rest.
 */
import {
  backfillTakedowns,
  hideRestrictedArt,
} from "../../../scripts/cards/backfill-card-compliance";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const ACTIVE_REQUEST = { status: { in: ["OPEN", "HIDDEN"] } };

/** A mock database whose transactions run on itself and whose locks resolve, ready to file and hide. */
function mockDb() {
  const db = createMockPrisma({ $executeRaw: jest.fn() });
  db.card.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve({ id: where.id })
  );
  db.cardTakedown.create.mockImplementation(({ data }: { data: { cardId: string } }) =>
    Promise.resolve({ id: `td_${data.cardId}` })
  );
  db.cardTakedown.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve({
      id: where.id,
      card: {
        id: where.id.replace(/^td_/, ""),
        artwork: "art.png",
        isRetired: false,
        metadata: {},
      },
    })
  );
  db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });
  db.card.updateMany.mockResolvedValue({ count: 1 });
  return db;
}

const filedCards = (db: ReturnType<typeof mockDb>) =>
  db.cardTakedown.create.mock.calls.map(([arg]: [{ data: { cardId: string } }]) => arg.data.cardId);

describe("backfillTakedowns", () => {
  const legacy = {
    id: "card_ns",
    retiredAt: new Date("2026-09-01T00:00:00Z"),
    metadata: { nsTakedown: { selfService: true, reason: "My flag" }, nsData: { flag: "f.png" } },
  };

  it("brings in a marked card whose only request was declined, and skips one a request is active on", async () => {
    const db = mockDb();
    db.card.findMany.mockResolvedValue([legacy]);

    await expect(backfillTakedowns(db as never, true)).resolves.toBe(1);

    expect(db.card.findMany).toHaveBeenCalledWith({
      where: { isRetired: true, takedowns: { none: ACTIVE_REQUEST } },
      select: { id: true, retiredAt: true, metadata: true },
    });
    expect(db.cardTakedown.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ cardId: "card_ns", status: "HIDDEN", savedArtwork: "f.png" }),
      ],
    });
  });

  it("writes nothing on a dry run", async () => {
    const db = mockDb();
    db.card.findMany.mockResolvedValue([legacy]);

    await expect(backfillTakedowns(db as never, false)).resolves.toBe(1);
    expect(db.cardTakedown.createMany).not.toHaveBeenCalled();
  });
});

describe("hideRestrictedArt", () => {
  const SHOWING = {
    status: "RESTRICTED",
    card: { artwork: { not: null }, takedowns: { none: ACTIVE_REQUEST } },
  };

  it("counts the restricted art that still shows on a dry run, writing nothing", async () => {
    const db = mockDb();
    db.cardArtLicence.count.mockResolvedValue(3);

    await expect(hideRestrictedArt(db as never, false)).resolves.toMatchObject({ pending: 3 });
    expect(db.cardArtLicence.count).toHaveBeenCalledWith({ where: SHOWING });
    expect(db.cardTakedown.create).not.toHaveBeenCalled();
  });

  it("pages the database by card id and hides each card's art", async () => {
    const db = mockDb();
    db.cardArtLicence.findMany
      .mockResolvedValueOnce([
        { cardId: "a", licence: "CC BY-NC 4.0" },
        { cardId: "b", licence: "CC BY-ND 4.0" },
      ])
      .mockResolvedValueOnce([{ cardId: "c", licence: null }]);

    await expect(hideRestrictedArt(db as never, true, 2)).resolves.toEqual({
      pending: 3,
      filed: 3,
      skipped: 0,
      failed: [],
    });

    const pages = db.cardArtLicence.findMany.mock.calls.map(([arg]: [object]) => arg);
    expect(pages).toEqual([
      {
        where: { ...SHOWING, cardId: { gt: "" } },
        orderBy: { cardId: "asc" },
        take: 2,
        select: { cardId: true, licence: true },
      },
      expect.objectContaining({ where: { ...SHOWING, cardId: { gt: "b" } } }),
    ]);
    expect(filedCards(db)).toEqual(["a", "b", "c"]);
  });

  it("carries on past a card that fails, and a re-run hides the rest", async () => {
    const db = mockDb();
    db.cardArtLicence.findMany.mockResolvedValueOnce([
      { cardId: "a", licence: "CC BY-NC 4.0" },
      { cardId: "b", licence: "CC BY-NC 4.0" },
    ]);
    // Card a's art changed while it was being hidden: its filing rolls back
    db.card.updateMany.mockResolvedValueOnce({ count: 0 });

    const first = await hideRestrictedArt(db as never, true, 5);

    expect(first).toMatchObject({ pending: 2, filed: 1 });
    expect(first.failed).toEqual([{ cardId: "a", reason: expect.stringMatching(/card changed/) }]);

    // The re-run reads what is still restricted and showing: card a
    db.cardArtLicence.findMany.mockResolvedValueOnce([{ cardId: "a", licence: "CC BY-NC 4.0" }]);
    const second = await hideRestrictedArt(db as never, true, 5);

    expect(second).toEqual({ pending: 1, filed: 1, skipped: 0, failed: [] });
    expect(filedCards(db)).toEqual(["a", "b", "a"]);
  });
});
