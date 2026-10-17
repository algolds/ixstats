/** @jest-environment node */
/** cards.getNSLibraryStats counts the NationStates library as players see it: approved cards only. */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsInventoryRouter } from "~/server/api/routers/cards/inventory";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

it("leaves cards waiting in review, or rejected, out of every count", async () => {
  const queryRaw = jest.fn().mockResolvedValue([{ region: "Lazarus", count: 2 }]);
  const db = createMockPrisma({ $queryRaw: queryRaw });
  db.card.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4).mockResolvedValueOnce(1);
  const caller = createCallerFactory(cardsInventoryRouter)(
    createMockRouterContext({
      db,
      auth: { userId: "clerk_me" },
      user: { id: "db_me", clerkUserId: "clerk_me" },
    }) as never
  );

  await expect(caller.getNSLibraryStats()).resolves.toMatchObject({
    totalCards: 10,
    cteCardsCount: 4,
    retiredCardsCount: 1,
    activeCardsCount: 6,
    cardsByRegion: [{ region: "Lazarus", count: 2 }],
  });

  expect(db.card.count).toHaveBeenCalledTimes(3);
  for (const [call] of db.card.count.mock.calls) {
    expect(call.where).toMatchObject({ cardType: "NS", reviewState: "APPROVED" });
  }
  const sql = (queryRaw.mock.calls[0]![0] as readonly string[]).join("?");
  expect(sql).toMatch(/"reviewState" = 'APPROVED'/);
});
