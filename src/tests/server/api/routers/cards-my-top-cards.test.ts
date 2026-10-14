/** @jest-environment node */
/** cards.getMyTopCards: the Wallet showcase's few most valuable owned cards. */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsInventoryRouter } from "~/server/api/routers/cards/inventory";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(cardsInventoryRouter);

function setup() {
  const db = createMockPrisma();
  db.cardOwnership.findMany.mockResolvedValue([{ id: "o1", cards: { id: "c1" } }]);
  const caller = createCaller(
    createMockRouterContext({
      db,
      auth: { userId: "clerk_me" },
      user: { id: "db_me", clerkUserId: "clerk_me" },
    }) as never
  );
  return { db, caller };
}

describe("cards.getMyTopCards", () => {
  it("reads the caller's own unretired cards, most valuable first, one per card", async () => {
    const { db, caller } = setup();
    await expect(caller.getMyTopCards({ limit: 3 })).resolves.toEqual([
      { id: "o1", cards: { id: "c1" } },
    ]);

    expect(db.cardOwnership.findMany).toHaveBeenCalledTimes(1);
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { ownerId: "db_me", cards: { isRetired: false } },
      include: { cards: true },
      orderBy: { cards: { marketValue: "desc" } },
      distinct: ["cardId"],
      take: 3,
    });
  });

  it("leaves trophy cards in: nothing filters on the Loreward entry", async () => {
    const { db, caller } = setup();
    await caller.getMyTopCards({ limit: 3 });
    expect(JSON.stringify(db.cardOwnership.findMany.mock.calls[0]![0])).not.toMatch(/loreward/i);
  });

  it("defaults to three and refuses a limit above twelve", async () => {
    const { db, caller } = setup();
    await caller.getMyTopCards();
    expect(db.cardOwnership.findMany.mock.calls[0]![0]).toMatchObject({ take: 3 });
    await expect(caller.getMyTopCards({ limit: 13 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
