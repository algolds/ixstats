/** @jest-environment node */
/**
 * Economics router: every write needs write access to the country; the economy configuration
 * read maps stored rows with defaults.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factory below calls jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: { onVitalityScoreChange: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { economicsRouter } from "~/server/api/routers/economics";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(economicsRouter);

function callerAs(db: MockPrismaProxy, id: string | null, countryId = "c_mine") {
  return createCaller(
    createMockRouterContext({
      db,
      auth: id ? { userId: `clerk_${id}` } : null,
      user: id
        ? { id, clerkUserId: `clerk_${id}`, countryId, role: { name: "user", level: 100 } }
        : null,
      rateLimitIdentifier: `${id}_${Math.random()}`,
    }) as never
  );
}

let db: MockPrismaProxy;

beforeEach(() => {
  jest.clearAllMocks();
  db = createMockPrisma();
  db.user.findUnique.mockResolvedValue(null);
  db.country.findUnique.mockResolvedValue({ id: "c_other", ownerUserId: "someone_else" });
  db.country.update.mockResolvedValue({});
});

describe("write access", () => {
  it("refuses every write to another player's country", async () => {
    const caller = callerAs(db, "u1");
    await expect(
      caller.updateFiscalSystem({ countryId: "c_other", salesTaxRate: 0 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.updateEconomicProfile({ countryId: "c_other", innovationIndex: 99 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(db.country.update).not.toHaveBeenCalled();
    expect(db.fiscalSystem.upsert).not.toHaveBeenCalled();
    expect(db.economicProfile.upsert).not.toHaveBeenCalled();
  });

  it("rejects signed-out callers", async () => {
    await expect(
      callerAs(db, null).updateFiscalSystem({ countryId: "c_mine", salesTaxRate: 5 })
    ).rejects.toThrow(/Authentication required/);
  });
});

describe("fiscal system and economic profile", () => {
  it("validates integer ranks", async () => {
    await expect(
      callerAs(db, "u1").updateEconomicProfile({ countryId: "c_mine", competitivenessRank: 1.5 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
