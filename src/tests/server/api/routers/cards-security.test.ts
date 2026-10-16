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
    await createCallerFactory(cardsInventoryRouter)(player(db)).getUserCards({ userId: "db2" });
    expect(db.cardOwnership.findMany.mock.calls[0]![0].where).toEqual({
      ownerId: "db2",
      isLocked: false,
      cards: { isBound: false },
    });
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
