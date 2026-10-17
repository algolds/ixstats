/** @jest-environment node */
/**
 * Cards refresh §2.1: NS facts live in metadata.nsData; the per-user value refresh is gone (§3). §2.4: the flag
 * owner's own takedown files and hides through the one takedown queue, which is also where a hidden card's date and
 * reason are read.
 */
jest.mock("~/lib/nationstates/api-client", () => ({ nsApiClient: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { nsImportCardsRouter } from "~/server/api/routers/ns-import/cards";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const caller = (db: ReturnType<typeof createMockPrisma>) =>
  createCallerFactory(nsImportCardsRouter)(createMockRouterContext({ db }) as never);

/** The fields a case changes on an owned NS card. */
interface OwnedCardFields {
  isRetired: boolean;
  retiredAt: Date | null;
  takedowns: Array<{ reason: string; resolvedAt: Date }>;
}

const ownedCard = (fields: Partial<OwnedCardFields> = {}) => ({
  cardId: "card_ns_7_s3",
  acquiredAt: new Date(),
  cards: {
    id: "card_ns_7_s3",
    title: "Heku",
    nsCardId: 7,
    nsSeason: 3,
    isRetired: false,
    retiredAt: null,
    artwork: null,
    metadata: { nsData: { name: "Heku of Ix", flag: "https://www.nationstates.net/f.png" } },
    takedowns: [],
    ...fields,
  },
});

describe("nsImport cards", () => {
  it("no longer offers the per-user value refresh", () => {
    expect(Object.keys(nsImportCardsRouter._def.procedures)).not.toContain("refreshCardValues");
  });

  it("lists the caller's NS cards with nation and flag from their facts", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findMany.mockResolvedValue([ownedCard()]);
    db.nSVerification.findMany.mockResolvedValue([{ nationName: "Heku of Ix" }]);

    const result = await caller(db).getMyNSCards();

    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({
      ownerId: "user_db_id_1",
      cards: { cardType: "NS" },
    });
    expect(result.cards[0]).toMatchObject({
      nation: "Heku of Ix",
      imageUrl: "https://www.nationstates.net/f.png",
      isHidden: false,
      hiddenAt: null,
      reason: null,
    });
    expect(result.cards[0]).not.toHaveProperty("stats");
    expect(result.cards[0]).not.toHaveProperty("takedowns");
  });

  it("dates each card by when its copy was acquired, so Settings can name the last import", async () => {
    const db = createMockPrisma();
    const acquiredAt = new Date("2026-10-03T00:00:00Z");
    db.cardOwnership.findMany.mockResolvedValue([{ ...ownedCard(), acquiredAt }]);
    db.nSVerification.findMany.mockResolvedValue([]);

    const result = await caller(db).getMyNSCards();

    expect(db.cardOwnership.findMany.mock.calls[0]![0].select.acquiredAt).toBe(true);
    expect(result.cards[0]).toMatchObject({ cardId: "card_ns_7_s3", title: "Heku", acquiredAt });
  });

  it("reads a hidden card's date and reason from its takedown", async () => {
    const db = createMockPrisma();
    const hiddenAt = new Date("2026-10-02T00:00:00Z");
    db.cardOwnership.findMany.mockResolvedValue([
      ownedCard({
        isRetired: true,
        retiredAt: new Date("2026-10-01T00:00:00Z"),
        takedowns: [{ reason: "My flag", resolvedAt: hiddenAt }],
      }),
    ]);
    db.nSVerification.findMany.mockResolvedValue([]);

    const result = await caller(db).getMyNSCards();

    expect(db.cardOwnership.findMany.mock.calls[0]![0].select.cards.select.takedowns).toEqual({
      where: { status: "HIDDEN" },
      orderBy: { resolvedAt: "desc" },
      take: 1,
      select: { reason: true, resolvedAt: true },
    });
    expect(result.cards[0]).toMatchObject({ isHidden: true, hiddenAt, reason: "My flag" });
  });
});

describe("nsImport hideMyCard", () => {
  function setup() {
    const db = createMockPrisma({ $executeRaw: jest.fn() });
    db.card.findFirst.mockResolvedValue({
      id: "card_ns_7_s3",
      title: "Heku",
      cardType: "NS",
      isRetired: false,
      metadata: { nsData: { name: "Heku of Ix" } },
    });
    db.cardOwnership.findFirst.mockResolvedValue({ id: "own_1" });
    db.nSVerification.findFirst.mockResolvedValue({ nationName: "Heku of Ix" });
    db.cardTakedown.create.mockResolvedValue({ id: "td_ns" });
    db.cardTakedown.findUnique.mockResolvedValue({
      id: "td_ns",
      card: { id: "card_ns_7_s3", artwork: "flag.png", isRetired: false, metadata: {} },
    });
    db.cardTakedown.updateMany.mockResolvedValue({ count: 1 });
    db.card.updateMany.mockResolvedValue({ count: 1 });
    return db;
  }

  /** Nothing was filed or hidden. */
  const expectUntouched = (db: ReturnType<typeof setup>) => {
    expect(db.cardTakedown.create).not.toHaveBeenCalled();
    expect(db.card.updateMany).not.toHaveBeenCalled();
  };

  it("files and hides through the takedown queue for an owner verified for the card's nation", async () => {
    const db = setup();

    await expect(
      caller(db).hideMyCard({ nsCardId: 7, nsSeason: 3, reason: "Not my flag any more" })
    ).resolves.toEqual({
      success: true,
      cardId: "card_ns_7_s3",
      title: "Heku",
      message: 'Hidden "Heku". Your flag is no longer shown on this card.',
    });
    expect(db.cardTakedown.create.mock.calls[0]![0].data).toMatchObject({
      cardId: "card_ns_7_s3",
      origin: "NS_SELF_SERVICE",
      reason: "Not my flag any more",
      contact: "NationStates: Heku of Ix",
      requestedBy: "user_db_id_1",
    });
    expect(db.card.updateMany.mock.calls[0]![0].data).toMatchObject({
      artwork: null,
      isRetired: true,
    });
  });

  it("says so when the art is already hidden", async () => {
    const db = setup();
    db.cardTakedown.findFirst.mockResolvedValue({ id: "td_ns", status: "HIDDEN" });

    await expect(caller(db).hideMyCard({ nsCardId: 7, nsSeason: 3 })).resolves.toMatchObject({
      message: '"Heku" is already hidden.',
    });
    expectUntouched(db);
  });

  it("refuses a player who does not own the card", async () => {
    const db = setup();
    db.cardOwnership.findFirst.mockResolvedValue(null);

    await expect(caller(db).hideMyCard({ nsCardId: 7, nsSeason: 3 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expectUntouched(db);
  });

  it("refuses an owner not verified for the card's nation", async () => {
    const db = setup();
    db.nSVerification.findFirst.mockResolvedValue(null);

    await expect(caller(db).hideMyCard({ nsCardId: 7, nsSeason: 3 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expectUntouched(db);
  });
});
