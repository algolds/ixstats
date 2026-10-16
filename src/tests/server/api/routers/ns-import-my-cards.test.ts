/** @jest-environment node */
/** Cards refresh §2.1: NS facts live in metadata.nsData; the per-user value refresh is gone (§3). */
jest.mock("~/lib/nationstates/api-client", () => ({ nsApiClient: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { nsImportCardsRouter } from "~/server/api/routers/ns-import/cards";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const caller = (db: ReturnType<typeof createMockPrisma>) =>
  createCallerFactory(nsImportCardsRouter)(createMockRouterContext({ db }) as never);

describe("nsImport cards", () => {
  it("no longer offers the per-user value refresh", () => {
    expect(Object.keys(nsImportCardsRouter._def.procedures)).not.toContain("refreshCardValues");
  });

  it("lists the caller's NS cards with nation and flag from their facts", async () => {
    const db = createMockPrisma();
    db.cardOwnership.findMany.mockResolvedValue([
      {
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
        },
      },
    ]);
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
    });
    expect(result.cards[0]).not.toHaveProperty("stats");
  });
});
