/**
 * getMyAccounts lists active personas for posting; the account manager asks for inactive ones too,
 * so a persona deactivated from its card stays listed and can be activated again.
 */
import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesAccountsRouter } from "~/server/api/routers/thinkpages/accounts";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const ME = "user_me";
const createCaller = createCallerFactory(thinkpagesAccountsRouter);

function callerWithDb() {
  const db: any = createMockPrisma();
  db.thinkpagesAccount.findMany.mockResolvedValue([]);
  const ctx = createMockRouterContext({
    auth: { userId: ME },
    user: { id: `db_${ME}`, clerkUserId: ME, countryId: null },
    db,
  }) as never;
  return { caller: createCaller(ctx), findMany: db.thinkpagesAccount.findMany };
}

describe("getMyAccounts", () => {
  it("returns active personas only by default", async () => {
    const { caller, findMany } = callerWithDb();
    await caller.getMyAccounts();
    expect(findMany.mock.calls[0]![0]).toMatchObject({
      where: { clerkUserId: ME, isActive: true },
    });
  });

  it("includes inactive personas when the account manager asks", async () => {
    const { caller, findMany } = callerWithDb();
    await caller.getMyAccounts({ includeInactive: true });
    expect(findMany.mock.calls[0]![0]).toMatchObject({ where: { clerkUserId: ME } });
    expect((findMany.mock.calls[0]![0] as { where: object }).where).not.toHaveProperty("isActive");
  });
});
