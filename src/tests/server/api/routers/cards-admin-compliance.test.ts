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
