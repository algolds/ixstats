/** @jest-environment node */
/** A realm poll (the realm page's sidebar) takes votes only from owners of a nation in that realm. */
jest.mock("~/server/db", () => ({ db: {} }));

import { pollsRouter } from "~/server/api/routers/polls";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

function setup(ownsNation: boolean) {
  const db = createMockPrisma();
  db.poll.findUnique.mockResolvedValue({
    id: "p1",
    isActive: true,
    endDate: null,
    countryId: null,
    realmId: "eurth",
    pollType: "choice",
    multiple: false,
    options: [{ id: "o1" }, { id: "o2" }],
  });
  db.country.findFirst.mockResolvedValue(ownsNation ? { id: "c1" } : null);
  const caller = pollsRouter.createCaller(
    createMockRouterContext({
      db,
      auth: { userId: "clerk_voter" },
      user: { id: "db_voter", clerkUserId: "clerk_voter" },
      rateLimitIdentifier: `voter_${Math.random()}`,
    }) as never
  );
  return { db, caller };
}

describe("realm poll votes", () => {
  it("refuses a player with no nation in the realm", async () => {
    const { db, caller } = setup(false);
    await expect(caller.vote({ pollId: "p1", optionIds: ["o1"] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.country.findFirst).toHaveBeenCalledWith({
      where: { realmId: "eurth", ownerUserId: "db_voter" },
      select: { id: true },
    });
    expect(db.pollVote.createMany).not.toHaveBeenCalled();
  });

  it("counts a vote from a nation owner of the realm", async () => {
    const { db, caller } = setup(true);
    await caller.vote({ pollId: "p1", optionIds: ["o1"] });
    expect(db.pollVote.createMany).toHaveBeenCalledWith({
      data: [{ pollId: "p1", optionId: "o1", userId: "clerk_voter" }],
    });
  });
});
