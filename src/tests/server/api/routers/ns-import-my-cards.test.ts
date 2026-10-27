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
