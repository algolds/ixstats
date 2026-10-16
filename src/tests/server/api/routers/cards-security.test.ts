/** @jest-environment node */
/** Cards refresh §3 security: admin-only reads, tradeable-only partner cards, no retired cards for players. */
import { createCallerFactory } from "~/server/api/trpc";
import { cardsInventoryRouter } from "~/server/api/routers/cards/inventory";
import { cardsAdminRouter } from "~/server/api/routers/cards/admin";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const player = (db: ReturnType<typeof createMockPrisma>) =>
  createMockRouterContext({
    auth: { userId: "user_1" },
    user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
    db,
  }) as never;
const admin = (db: ReturnType<typeof createMockPrisma>) =>
  createMockRouterContext({
    auth: { userId: "admin_1" },
    user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
    db,
  }) as never;
/** The trade partner, found by Clerk or DB id. */
const partner = { id: "db2", clerkUserId: "user_2" };
/** The part of a `userConnection.findMany` query the SL-4 helpers branch on. */
type ConnectionQuery = { where: { connectionType: string } };

describe("cards router security", () => {
  it("serves the lore stats and the explorer read to admins only", async () => {
    const db = createMockPrisma();
    await expect(
      createCallerFactory(cardsInventoryRouter)(player(db)).getLoreStats()
    ).rejects.toThrow(/Admin privileges required/);
    await expect(
      createCallerFactory(cardsAdminRouter)(player(db)).adminCardExplorer({})
    ).rejects.toThrow(/Admin privileges required/);
    db.card.groupBy.mockResolvedValue([]);
    await expect(
      createCallerFactory(cardsInventoryRouter)(admin(db)).getLoreStats()
    ).resolves.toMatchObject({
      totalCards: null,
    });
  });

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

  it("never lists retired cards to players", async () => {
    const db = createMockPrisma();
    db.card.count.mockResolvedValue(0);
    await createCallerFactory(cardsInventoryRouter)(player(db)).getNSCards({ region: "Abydos" });
    const where = db.card.findMany.mock.calls[0]![0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { isRetired: false },
        { metadata: { path: ["nsData", "region"], string_contains: "Abydos" } },
      ])
    );
  });

  it("shows admins retired cards in the explorer only when asked", async () => {
    const db = createMockPrisma();
    db.card.count.mockResolvedValue(0);
    const explorer = createCallerFactory(cardsAdminRouter)(admin(db));
    await explorer.adminCardExplorer({});
    await explorer.adminCardExplorer({ includeRetired: true });
    await explorer.adminCardExplorer({ isRetired: true, includeRetired: false });
    await explorer.adminCardExplorer({ cardTypeFilter: "NS", categoryFilter: "MILITARY" });
    const terms = db.card.findMany.mock.calls.map((call) => call[0].where.AND);
    expect(terms).toEqual([
      [{ isRetired: false }],
      [],
      [{ isRetired: true }],
      [{ category: "MILITARY" }, { cardType: "NS" }, { isRetired: false }],
    ]);
  });

  it("no longer has a junk procedure", () => {
    expect(Object.keys(cardsInventoryRouter._def.procedures)).not.toContain("junkCards");
  });
});
