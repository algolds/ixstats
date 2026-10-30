/**
 * reorderMyAccounts stores the owner's drag order as sortOrder 0..n-1 in one transaction, refuses
 * ids that are not all the caller's (writing nothing), and refuses duplicates; the order it stores
 * is the one getMyAccounts and the forum persona picker list first.
 */
import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesAccountsRouter } from "~/server/api/routers/thinkpages/accounts";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const ME = "user_me";
const createCaller = createCallerFactory(thinkpagesAccountsRouter);

function callerWithDb(ownedCount: number) {
  const db = createMockPrisma();
  db.thinkpagesAccount.count.mockResolvedValue(ownedCount);
  db.thinkpagesAccount.update.mockImplementation(((args: unknown) =>
    Promise.resolve(args)) as never);
  db.thinkpagesAccount.findMany.mockResolvedValue([]);
  const ctx = createMockRouterContext({
    auth: { userId: ME },
    user: { id: `db_${ME}`, clerkUserId: ME, countryId: null },
    db,
  }) as never;
  return { caller: createCaller(ctx), db };
}

describe("reorderMyAccounts", () => {
  it("writes sortOrder 0, 1, 2 in one transaction after counting the caller's accounts", async () => {
    const { caller, db } = callerWithDb(3);
    await expect(caller.reorderMyAccounts({ ids: ["b", "a", "c"] })).resolves.toEqual({
      success: true,
    });
    expect(db.thinkpagesAccount.count).toHaveBeenCalledWith({
      where: { id: { in: ["b", "a", "c"] }, clerkUserId: ME },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.thinkpagesAccount.update.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: "b" }, data: { sortOrder: 0 } },
      { where: { id: "a" }, data: { sortOrder: 1 } },
      { where: { id: "c" }, data: { sortOrder: 2 } },
    ]);
  });

  it("refuses an id that is not the caller's and writes nothing", async () => {
    const { caller, db } = callerWithDb(2);
    await expect(caller.reorderMyAccounts({ ids: ["b", "a", "theirs"] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.thinkpagesAccount.update).not.toHaveBeenCalled();
  });

  it("refuses duplicate ids", async () => {
    const { caller, db } = callerWithDb(2);
    await expect(caller.reorderMyAccounts({ ids: ["a", "b", "a"] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("getMyAccounts order", () => {
  it("puts the owner's order first, unordered accounts last, then the old order", async () => {
    const { caller, db } = callerWithDb(0);
    await caller.getMyAccounts();
    expect(db.thinkpagesAccount.findMany.mock.calls[0]![0]).toMatchObject({
      orderBy: [
        { sortOrder: { sort: "asc", nulls: "last" } },
        { verified: "desc" },
        { followerCount: "desc" },
        { createdAt: "asc" },
      ],
    });
  });
});
