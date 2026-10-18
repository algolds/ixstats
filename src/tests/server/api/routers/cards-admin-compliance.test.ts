/** @jest-environment node */
/** cards.admin.compliance.takedowns: staff read who asked for a player's request, never the raw requester id. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/identity/identity.player-names", () => ({
  loadPlayerNames: jest.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsAdminRouter } from "~/server/api/routers/cards/admin";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const admin = (db: ReturnType<typeof createMockPrisma>) =>
  createCallerFactory(cardsAdminRouter)(
    createMockRouterContext({
      db,
      auth: { userId: "clerk_admin" },
      user: { id: "db_admin", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } },
    }) as never
  );

const row = (id: string, origin: string, requestedBy: string | null) => ({
  id,
  origin,
  status: "OPEN",
  reason: "Why",
  contact: null,
  requestedBy,
  card: { id: "card_1", title: "Elm", cardType: "LORE", wikiSource: "ixwiki" },
});

describe("cards.admin.compliance.takedowns", () => {
  it("names the player behind each player request, and no row carries a requester id", async () => {
    const db = createMockPrisma();
    db.cardTakedown.findMany.mockResolvedValue([
      row("td_ann", "PLAYER_REQUEST", "db_ann"),
      row("td_bob", "PLAYER_REQUEST", "db_bob"),
      row("td_gone", "PLAYER_REQUEST", "db_gone"),
      row("td_admin", "ADMIN", "db_ann"),
      row("td_flag", "NS_SELF_SERVICE", null),
    ]);
    jest.mocked(loadPlayerNames).mockResolvedValue(
      new Map([
        ["db_ann", { handle: "ann", displayName: "@ann" }],
        // No name other players read: staff still need to know who it is
        ["db_bob", { handle: "user_bob", displayName: null }],
      ])
    );

    const rows = await admin(db).compliance.takedowns({ status: "OPEN" });

    expect(db.cardTakedown.findMany.mock.calls[0]![0].select).toMatchObject({
      requestedBy: true,
    });
    // An admin-filed row's requestedBy is the filing admin, which the queue does not name
    expect(loadPlayerNames).toHaveBeenCalledWith(["db_ann", "db_bob", "db_gone"]);
    expect(rows.map((r) => [r.id, r.requester])).toEqual([
      ["td_ann", "@ann"],
      ["td_bob", "user_bob"],
      ["td_gone", null],
      ["td_admin", null],
      ["td_flag", null],
    ]);
    for (const r of rows) expect(r).not.toHaveProperty("requestedBy");
  });
});

describe("cards.admin.compliance inscription reports", () => {
  beforeEach(() => jest.clearAllMocks());

  const report = (id: string, reporterId: string, ownership: object) => ({
    id,
    ownershipId: `own_${id}`,
    text: "gg",
    reason: "a slur",
    reporterId,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    ownership: { cardId: "card_1", cards: { title: "Elm" }, ...ownership },
  });

  it("names the signer by the frozen name and each reporter for staff, with no Vault cards switch", async () => {
    const db = createMockPrisma();
    db.cardInscriptionReport.findMany.mockResolvedValue([
      report("r1", "db_ann", { inscribedById: "db_sig", inscribedName: "@sig" }),
      // An older signature with no frozen name; a reporter other players cannot name
      report("r2", "db_bob", { inscribedById: "db_sig", inscribedName: null }),
    ]);
    jest.mocked(loadPlayerNames).mockResolvedValue(
      new Map([
        ["db_ann", { handle: "ann", displayName: "@ann" }],
        ["db_bob", { handle: "user_bob", displayName: null }],
        ["db_sig", { handle: "sig_now", displayName: "@sig_now" }],
      ])
    );

    const rows = await admin(db).compliance.inscriptionReports();

    expect(loadPlayerNames).toHaveBeenCalledWith(["db_ann", "db_bob", "db_sig"]);
    expect(rows.map((r) => [r.id, r.signerName, r.reporterName])).toEqual([
      ["r1", "@sig", "@ann"],
      ["r2", "@sig_now", "user_bob"],
    ]);
  });

  it("resolves a report as the signed-in admin", async () => {
    const db = createMockPrisma();
    db.cardInscriptionReport.updateMany.mockResolvedValue({ count: 1 });
    db.cardInscriptionReport.findUniqueOrThrow.mockResolvedValue({
      id: "r1",
      ownershipId: "own_1",
      text: "gg",
      ownership: { cardId: "card_1", serialNumber: 3 },
    });

    await expect(
      admin(db).compliance.resolveInscriptionReport({ reportId: "r1", action: "clear" })
    ).resolves.toEqual({ status: "cleared" });

    expect(db.cardInscriptionReport.updateMany.mock.calls[0]![0]).toEqual({
      where: { id: "r1", status: "open" },
      data: { status: "cleared", handledBy: "db_admin", handledAt: expect.any(Date) },
    });
    const cardAudits = db.auditLog.create.mock.calls
      .map(([arg]: [{ data: { entityType: string } }]) => arg.data)
      .filter((data: { entityType: string }) => data.entityType === "CARD");
    expect(cardAudits).toEqual([
      expect.objectContaining({ userId: "clerk_admin", action: "CARD_INSCRIPTION_CLEAR" }),
    ]);
  });

  it.each([
    ["no report", { reportId: "", action: "clear" }],
    ["another action", { reportId: "r1", action: "delete" }],
  ])("refuses %s", async (_, input) => {
    const db = createMockPrisma();
    await expect(
      admin(db).compliance.resolveInscriptionReport(input as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.cardInscriptionReport.updateMany).not.toHaveBeenCalled();
  });
});
