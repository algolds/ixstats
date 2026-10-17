/** @jest-environment node */
/** Cards refresh §3 security: tradeable-only partner cards. */
import { createCallerFactory } from "~/server/api/trpc";
import { cardsInventoryRouter } from "~/server/api/routers/cards/inventory";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const player = (db: ReturnType<typeof createMockPrisma>) =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
    db,
  }) as never;
/** The trade partner, found by Clerk or DB id. */
const partner = { id: "db2", clerkUserId: "user_2" };
/** The part of a `userConnection.findMany` query the SL-4 helpers branch on. */
type ConnectionQuery = { where: { connectionType: string } };

describe("cards router security", () => {
  it("shows a trade partner only their tradeable copies", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue(partner);
    await createCallerFactory(cardsInventoryRouter)(player(db)).getUserCards({ userId: "db2" });
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "db2" },
      select: { id: true, clerkUserId: true },
    });
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({
      ownerId: "db2",
      isLocked: false,
      inscription: null,
      cards: { isBound: false },
    });
  });

  it("lists nothing to a viewer the partner has blocked", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue(partner);
    db.userConnection.findMany.mockImplementation(({ where }: ConnectionQuery) =>
      Promise.resolve(where.connectionType === "blocked" ? [{ userId: "user_2" }] : [])
    );
    const caller = createCallerFactory(cardsInventoryRouter)(player(db));
    await expect(caller.getUserCards({ userId: "user_2" })).resolves.toEqual([]);
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: "user_2" },
      select: { id: true, clerkUserId: true },
    });
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });

  it("lists nothing to a viewer outside the partner's trade-offer audience", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue(partner);
    db.userConnection.findMany.mockImplementation(({ where }: ConnectionQuery) =>
      Promise.resolve(
        where.connectionType === "privacy_config"
          ? [{ userId: "user_2", status: JSON.stringify({ tradeOffers: "nobody" }) }]
          : []
      )
    );
    const caller = createCallerFactory(cardsInventoryRouter)(player(db));
    await expect(caller.getUserCards({ userId: "user_2" })).resolves.toEqual([]);
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });

  it("no longer has a junk procedure or the old card library", () => {
    // Explore's catalogue keeps the library's promise: never a retired or pending card (explore.test.ts).
    for (const gone of ["junkCards", "getNSCards", "getNSLibraryStats"]) {
      expect(Object.keys(cardsInventoryRouter._def.procedures)).not.toContain(gone);
    }
  });
});
