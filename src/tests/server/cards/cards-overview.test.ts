/** @jest-environment node */
/** Overview (cards refresh spec §2.4): counts by type, realm and rarity; pending review; active jobs; card-only feed. */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsAdminRouter } from "~/server/api/routers/cards/admin";
import { findCards } from "~/server/modules/cards/cards.overview";
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
describe("realmOptions and findCards", () => {
  it("keeps only approved, unretired, non-trophy cards without restricted art for a grant picker", async () => {
    const db = createMockPrisma();
    await findCards(db as never, "elm", { grantable: true });
    expect(db.card.findMany.mock.calls[0]![0].where).toEqual({
      title: { contains: "elm", mode: "insensitive" },
      reviewState: "APPROVED",
      isRetired: false,
      cardType: { not: "TROPHY" },
      artLicence: { isNot: { status: "RESTRICTED" } },
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
