/** @jest-environment node */
/** The Trades tab's list: each open offer says whether it waits on the viewer, so the client needs no user id. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/identity/identity.player-names", () => ({
  loadPlayerNames: jest.fn(async () => new Map()),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { tradingQueriesRouter } from "~/server/api/routers/trading/queries";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type MockDb = ReturnType<typeof createMockPrisma>;
const trading = (db: MockDb) =>
  createCallerFactory(tradingQueriesRouter)(
    createMockRouterContext({
      db,
      user: { id: "me", clerkUserId: "clerk_me" },
      auth: { userId: "clerk_me" },
    }) as never
  );

const party = (id: string) => ({ id, clerkUserId: `clerk_${id}`, country: null });
const offer = (id: string, proposerId: string) => ({
  id,
  initiatorId: "me",
  recipientId: "them",
  proposerId,
  initiator: party("me"),
  recipient: party("them"),
});

describe("getActiveTrades", () => {
  it("marks the offers whose current table the other party wrote as the viewer's turn", async () => {
    const db = createMockPrisma();
    // t1 is the viewer's own offer; t2 is the same pair after the other party countered it.
    db.tradeOffer.findMany.mockResolvedValue([offer("t1", "me"), offer("t2", "them")]);
    const open = await trading(db).getActiveTrades();
    expect(open.map((t) => [t.id, t.myTurn])).toEqual([
      ["t1", false],
      ["t2", true],
    ]);
    // Only open offers are listed, so a turn is never on an expired one.
    const where = db.tradeOffer.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ status: "PENDING", expiresAt: { gt: expect.any(Date) } });
  });
});
