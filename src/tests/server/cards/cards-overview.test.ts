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
        subject: null,
        detail: "0 new, 0 updated",
        actor: "System",
        ok: true,
      },
      {
        id: "audit-a1",
        at: new Date("2026-10-28T07:00:00Z"),
        kind: "audit",
        title: "Card designer mint",
        subject: null,
        detail: null,
        actor: "Unknown user",
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
      subject: null,
      detail: "1 staged, 2 skipped, 1 blocked, 1 failed of 5",
      actor: "System",
      ok: false,
    });
  });

  it("names every actor, player and card by name, never by id, in one batch of reads", async () => {
    const PLAYER = "cmuuth78o0001f9jiqi63dw14";
    const ADMIN = "cmadmin000000000000000001";
    const at = (hour: number) => new Date(`2026-10-28T${String(hour).padStart(2, "0")}:00:00Z`);
    const db = createMockPrisma();
    db.auditLog.findMany.mockResolvedValue([
      {
        id: "a1",
        action: "CARD_GRANT",
        target: "card_elm",
        details: `Granted Elm #3 to ${PLAYER}: a gift`,
        userId: "clerk_admin",
        success: true,
        timestamp: at(10),
      },
      {
        id: "a2",
        action: "CARD_RARITY_OVERRIDE",
        target: "card_ahk",
        details: "Rarity COMMON → RARE: a banner",
        userId: "clerk_gone",
        success: true,
        timestamp: at(9),
      },
      {
        id: "a3",
        action: "CARD_PACK_AWARD",
        target: PLAYER,
        details: "Awarded Season I Recruit Pack",
        userId: "clerk_admin",
        success: true,
        timestamp: at(8),
      },
      {
        id: "a4",
        action: "CARD_TAKEDOWN",
        target: "card_ahk",
        details: "The flag owner (Elm) hid the art: mine",
        userId: null,
        success: true,
        timestamp: at(7),
      },
    ]);
    db.cardImportJob.findMany.mockResolvedValue([
      {
        id: "j1",
        label: "Daily IxWiki import",
        status: "DONE",
        total: 1,
        staged: 1,
        skipped: 0,
        blocked: 0,
        failed: 0,
        requestedBy: ADMIN,
        createdAt: at(6),
        startedAt: null,
        finishedAt: null,
      },
    ]);
    db.syncLog.findMany.mockResolvedValue([
      {
        id: "s1",
        syncType: "NS_REGION_LAZARUS",
        status: "SUCCESS",
        cardsCreated: 1,
        cardsUpdated: 0,
        metadata: { regionNames: ["lazarus"], startedBy: ADMIN },
        startedAt: at(5),
        completedAt: null,
      },
    ]);
    db.user.findMany.mockImplementation(
      async ({ where }: { where: { id?: { in: string[] }; clerkUserId?: { in: string[] } } }) =>
        where.id
          ? [
              { id: PLAYER, clerkUserId: "clerk_player" },
              { id: ADMIN, clerkUserId: "clerk_admin" },
            ].filter((user) => where.id!.in.includes(user.id))
          : [
              { clerkUserId: "clerk_player", country: { name: "E2E Testland" } },
              { clerkUserId: "clerk_admin", country: { name: "Admin Isles" } },
            ].filter((user) => where.clerkUserId!.in.includes(user.clerkUserId))
    );
    db.card.findMany.mockResolvedValue([
      { id: "card_elm", title: "Elm" },
      { id: "card_ahk", title: "Ahkmala" },
    ]);

    const feed = await cardsActivity(db as never, 10);

    expect(feed.map(({ subject, detail, actor }) => ({ subject, detail, actor }))).toEqual([
      // The card is already named in the detail, so it is not named twice.
      { subject: null, detail: "Granted Elm #3 to E2E Testland: a gift", actor: "Admin Isles" },
      { subject: "Ahkmala", detail: "Rarity COMMON → RARE: a banner", actor: "Unknown user" },
      { subject: "E2E Testland", detail: "Awarded Season I Recruit Pack", actor: "Admin Isles" },
      { subject: "Ahkmala", detail: "The flag owner (Elm) hid the art: mine", actor: "System" },
      {
        subject: null,
        detail: "1 staged, 0 skipped, 0 blocked, 0 failed of 1",
        actor: "Admin Isles",
      },
      { subject: null, detail: "1 new, 0 updated", actor: "Admin Isles" },
    ]);
    expect(JSON.stringify(feed)).not.toMatch(/cm[a-z0-9]{23}|clerk_/);
    expect(db.card.findMany).toHaveBeenCalledTimes(1);
    expect(db.card.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["card_elm", "card_ahk", PLAYER] } },
      select: { id: true, title: true },
    });
    expect(db.user.findMany).toHaveBeenCalledTimes(2);
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
