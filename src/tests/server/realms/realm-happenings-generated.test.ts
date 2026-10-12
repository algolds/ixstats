/** @jest-environment node */
/**
 * The realm's happenings and the nations a generated world makes: applying a world opens 130 to 300 nations at once,
 * and each regeneration another batch, so an unowned generated nation is no "was founded" event.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { realmsRouter } from "~/server/api/routers/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const PLAYER = "clerk_player";

function happeningsOf(db: ReturnType<typeof createMockPrisma>) {
  const realm = {
    id: "eurth",
    slug: "eurth",
    name: "Eurth",
    ownerId: "clerk_founder",
    status: "active",
    officers: [],
  };
  db.realm.findUnique.mockResolvedValue(realm);
  const caller = realmsRouter.createCaller(
    createMockRouterContext({
      db,
      auth: { userId: PLAYER },
      user: { id: `db_${PLAYER}`, clerkUserId: PLAYER, role: null },
      rateLimitIdentifier: `${PLAYER}_${Math.random()}`,
    }) as never
  );
  return caller.region.happenings({ slug: "eurth", kinds: ["nation"] });
}

describe("nation happenings", () => {
  it("founds no happening for a generated nation nobody owns, only for an open or owned one", async () => {
    const db = createMockPrisma();
    await happeningsOf(db);
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          realmId: "eurth",
          claimable: true,
          NOT: { worldgen: true, ownerUserId: null },
        }),
      })
    );
  });
});
