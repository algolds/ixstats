/** @jest-environment node */
/** Overview (cards refresh spec §2.4): counts by type, realm and rarity; pending review; active jobs; card-only feed. */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsAdminRouter } from "~/server/api/routers/cards/admin";
import {
  cardsActivity,
  cardsOverview,
  findCards,
  realmOptions,
} from "~/server/modules/cards/cards.overview";
import { CARD_AUDIT_ACTIONS } from "~/server/modules/cards/cards.audit";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

type Db = ReturnType<typeof createMockPrisma>;

const callerAs = (role: { name: string; level: number }, db: Db) =>
  createCallerFactory(cardsAdminRouter)(
    createMockRouterContext({
      db,
      auth: { userId: "clerk_x" },
      user: { id: "db_x", clerkUserId: "clerk_x", role },
    }) as never
  );

describe("cardsOverview", () => {
  it("counts by type, rarity and realm, and what waits on an admin", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockImplementation(async ({ by }: { by: string[] }) => {
      if (by[0] === "cardType")
        return [
          { cardType: "LORE", _count: { _all: 3 } },
          { cardType: "NS", _count: { _all: 7 } },
        ];
      if (by[0] === "rarity")
        return [
          { rarity: "RARE", _count: { _all: 4 } },
          { rarity: "COMMON", _count: { _all: 6 } },
        ];
      return [{ realmId: "iiwiki", _count: { _all: 10 } }];
    });
    db.card.count.mockResolvedValue(2);
    db.cardImportJob.count.mockResolvedValue(1);
    db.syncLog.count.mockResolvedValue(1);
    db.cardTakedown.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    db.realm.findMany.mockResolvedValue([{ id: "iiwiki", name: "IIWiki" }]);

    expect(await cardsOverview(db as never, new Date("2026-10-28T00:00:00Z"))).toEqual({
      total: 10,
      byType: [
        { key: "NS", count: 7 },
        { key: "LORE", count: 3 },
      ],
      byRarity: [
        { key: "COMMON", count: 6 },
        { key: "RARE", count: 4 },
      ],
      byRealm: [{ key: "iiwiki", label: "IIWiki", count: 10 }],
      pendingReview: 2,
      activeJobs: 2,
      openTakedowns: 3,
      overdueTakedowns: 1,
    });
  });

  it("counts pending review, running jobs and overdue takedowns with the right filters", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([]);
    db.card.count.mockResolvedValue(0);
    db.cardImportJob.count.mockResolvedValue(0);
    db.syncLog.count.mockResolvedValue(0);
    db.cardTakedown.count.mockResolvedValue(0);
    const now = new Date("2026-10-28T00:00:00Z");

    await cardsOverview(db as never, now);
    expect(db.card.count).toHaveBeenCalledWith({ where: { reviewState: "PENDING" } });
    expect(db.cardImportJob.count).toHaveBeenCalledWith({
      where: { status: { in: ["QUEUED", "RUNNING"] } },
    });
    expect(db.syncLog.count).toHaveBeenCalledWith({
      where: { syncType: { startsWith: "NS_REGION_" }, status: { in: ["IN_PROGRESS", "PAUSED"] } },
    });
    expect(db.cardTakedown.count).toHaveBeenNthCalledWith(1, { where: { status: "OPEN" } });
    expect(db.cardTakedown.count).toHaveBeenNthCalledWith(2, {
      where: { status: "OPEN", dueAt: { lt: now } },
    });
  });

  it("labels a realm it cannot find by its id", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockImplementation(async ({ by }: { by: string[] }) =>
      by[0] === "realmId" ? [{ realmId: "gone", _count: { _all: 1 } }] : []
    );
    db.card.count.mockResolvedValue(0);
    db.cardImportJob.count.mockResolvedValue(0);
    db.syncLog.count.mockResolvedValue(0);
    db.cardTakedown.count.mockResolvedValue(0);

    const overview = await cardsOverview(db as never);
    expect(overview.byRealm).toEqual([{ key: "gone", label: "gone", count: 1 }]);
    expect(db.realm.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["gone"] } },
      select: { id: true, name: true },
    });
  });
});

describe("cardsActivity", () => {
  it("feeds card audit rows, import jobs and NationStates syncs, newest first", async () => {
    const db = createMockPrisma();
    db.auditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        action: "CARD_GRANT",
        details: "Granted Elm #3",
        userId: "clerk_admin",
        success: true,
        timestamp: new Date("2026-10-28T10:00:00Z"),
      },
    ]);
    db.cardImportJob.findMany.mockResolvedValue([
      {
        id: "j1",
        label: "Category:Elm",
        status: "DONE",
        total: 3,
        staged: 2,
        skipped: 1,
        blocked: 0,
        failed: 0,
        requestedBy: "db_admin",
        createdAt: new Date("2026-10-28T09:00:00Z"),
        startedAt: null,
        finishedAt: new Date("2026-10-28T11:00:00Z"),
      },
    ]);
    db.syncLog.findMany.mockResolvedValue([
      {
        id: "s1",
        syncType: "NS_REGION_THE_NORTH_PACIFIC",
        status: "FAILED",
        cardsCreated: 4,
        cardsUpdated: 1,
        startedAt: new Date("2026-10-28T08:00:00Z"),
        completedAt: null,
      },
    ]);

    const feed = await cardsActivity(db as never, 10);
    expect(feed.map((item) => [item.kind, item.title, item.ok])).toEqual([
      ["import", "Category:Elm", true],
      ["audit", "Card granted", true],
      ["sync", "NationStates region sync: the north pacific", false],
    ]);
    expect(db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          action: {
            in: [
              ...CARD_AUDIT_ACTIONS,
              "CARD_DESIGNER_MINT",
              "CARD_AUTHORS_BACKFILLED",
              "LORE_CARD_MINT",
              "LORE_CARDS_RECLASSIFIED",
            ],
          },
        },
      })
    );
  });

  it("keeps the newest `limit` items, with each kind's detail, actor and id", async () => {
    const db = createMockPrisma();
    db.auditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        action: "CARD_DESIGNER_MINT",
        details: null,
        userId: "clerk_admin",
        success: false,
        timestamp: new Date("2026-10-28T07:00:00Z"),
      },
    ]);
    db.cardImportJob.findMany.mockResolvedValue([
      {
        id: "j1",
        label: "Category:Oak",
        status: "FAILED",
        total: 5,
        staged: 1,
        skipped: 2,
        blocked: 1,
        failed: 1,
        requestedBy: null,
        createdAt: new Date("2026-10-28T05:00:00Z"),
        startedAt: new Date("2026-10-28T06:00:00Z"),
        finishedAt: null,
      },
    ]);
    db.syncLog.findMany.mockResolvedValue([
      {
        id: "s1",
        syncType: "NS_CTE_FILTER",
        status: "COMPLETED",
        cardsCreated: null,
        cardsUpdated: null,
        startedAt: new Date("2026-10-28T08:00:00Z"),
        completedAt: new Date("2026-10-28T09:00:00Z"),
      },
    ]);

    const feed = await cardsActivity(db as never, 2);
    expect(feed).toEqual([
      {
        id: "sync-s1",
        at: new Date("2026-10-28T09:00:00Z"),
        kind: "sync",
        title: "NationStates CTE filter",
        detail: "0 new, 0 updated",
        actor: null,
        ok: true,
      },
      {
        id: "audit-a1",
        at: new Date("2026-10-28T07:00:00Z"),
        kind: "audit",
        title: "Card designer mint",
        detail: null,
        actor: "clerk_admin",
        ok: false,
      },
    ]);
    expect(db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { timestamp: "desc" }, take: 2 })
    );
    expect(db.cardImportJob.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    expect(db.syncLog.findMany).toHaveBeenCalledWith({
      where: { syncType: { startsWith: "NS_" } },
      orderBy: { startedAt: "desc" },
      take: 2,
    });

    const [job] = (await cardsActivity(db as never, 3)).filter((item) => item.kind === "import");
    expect(job).toEqual({
      id: "import-j1",
      at: new Date("2026-10-28T06:00:00Z"),
      kind: "import",
      title: "Category:Oak",
      detail: "1 staged, 2 skipped, 1 blocked, 1 failed of 5",
      actor: null,
      ok: false,
    });
  });
});

describe("realmOptions and findCards", () => {
  it("lists every realm, system realms first", async () => {
    const db = createMockPrisma();
    await realmOptions(db as never);
    expect(db.realm.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, isSystem: true },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      take: 500,
    });
  });

  it("finds up to 10 cards by a trimmed, case-insensitive title match", async () => {
    const db = createMockPrisma();
    await findCards(db as never, "  elm ");
    expect(db.card.findMany).toHaveBeenCalledWith({
      where: { title: { contains: "elm", mode: "insensitive" } },
      orderBy: { title: "asc" },
      take: 10,
      select: { id: true, title: true, cardType: true, rarity: true },
    });
  });

  it("keeps only approved, unretired, non-trophy cards for a grant picker", async () => {
    const db = createMockPrisma();
    await findCards(db as never, "elm", { grantable: true });
    expect(db.card.findMany.mock.calls[0]![0].where).toEqual({
      title: { contains: "elm", mode: "insensitive" },
      reviewState: "APPROVED",
      isRetired: false,
      cardType: { not: "TROPHY" },
    });
  });
});

describe("cards.admin gate", () => {
  it("refuses a signed-in player", async () => {
    await expect(
      callerAs({ name: "user", level: 100 }, createMockPrisma()).overview.summary()
    ).rejects.toThrow(/Admin privileges required/);
  });

  it("serves an admin, and validates the picker query", async () => {
    const db = createMockPrisma();
    db.card.findMany.mockResolvedValue([
      { id: "c1", title: "Elm", cardType: "LORE", rarity: "RARE" },
    ]);
    const caller = callerAs({ name: "admin", level: 10 }, db);
    await expect(caller.overview.findCards({ query: "el" })).resolves.toEqual([
      { id: "c1", title: "Elm", cardType: "LORE", rarity: "RARE" },
    ]);
    await expect(caller.overview.findCards({ query: "e" })).rejects.toThrow();
    await caller.overview.findCards({ query: "el", grantable: true });
    expect(db.card.findMany.mock.calls.at(-1)![0].where).toMatchObject({ reviewState: "APPROVED" });
    await expect(caller.overview.activity({ limit: 0 })).rejects.toThrow();
  });
});
