/** @jest-environment node */
/**
 * Economics router: every write needs write access to the country; the builder autosave writes
 * only the economy columns it is meant to (not ownership, realm or live GDP); reads map stored
 * rows to builder state with defaults.
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
import { notificationHooks } from "~/lib/notifications/hooks";
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
      caller.autoSaveEconomyBuilder({ countryId: "c_other", changes: { unemploymentRate: 1 } })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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

describe("autoSaveEconomyBuilder", () => {
  it("writes only the economy columns, never ownership, realm or live totals", async () => {
    await callerAs(db, "u1").autoSaveEconomyBuilder({
      countryId: "c_mine",
      changes: {
        unemploymentRate: 4.2,
        literacyRate: 98,
        ownerUserId: "attacker",
        realmId: "elsewhere",
        currentTotalGdp: 1e18,
        gdp: 5e12, // a builder key with no Country column
      },
    });

    const { data } = db.country.update.mock.calls[0]![0];
    expect(data).toEqual({ unemploymentRate: 4.2, literacyRate: 98, updatedAt: expect.any(Date) });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "autosave:economy",
        target: "c_mine",
        success: true,
        details: expect.stringContaining('"fields":["unemploymentRate","literacyRate"]'),
      }),
    });
  });

  it("records a failed save in the audit log and rethrows", async () => {
    db.country.update.mockRejectedValue(new Error("db down"));

    await expect(
      callerAs(db, "u1").autoSaveEconomyBuilder({
        countryId: "c_mine",
        changes: { inflationRate: 3 },
      })
    ).rejects.toThrow("db down");
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ success: false, error: "db down" }),
    });
  });
});

describe("fiscal system and economic profile", () => {
  it("upserts the player's fiscal system", async () => {
    await callerAs(db, "u1").updateFiscalSystem({ countryId: "c_mine", salesTaxRate: 7 });
    expect(db.fiscalSystem.upsert).toHaveBeenCalledWith({
      where: { countryId: "c_mine" },
      update: { salesTaxRate: 7 },
      create: { countryId: "c_mine", salesTaxRate: 7 },
    });
  });

  it("notifies when economic complexity moves by more than ten points", async () => {
    db.economicProfile.findUnique.mockResolvedValue({ economicComplexity: 40 });

    await callerAs(db, "u1").updateEconomicProfile({
      countryId: "c_mine",
      economicComplexity: 60,
    });

    expect(db.economicProfile.upsert).toHaveBeenCalled();
    expect(notificationHooks.onVitalityScoreChange).toHaveBeenCalledWith(
      expect.objectContaining({ countryId: "c_mine", currentScore: 60, previousScore: 40 })
    );
  });

  it("stays quiet for small changes", async () => {
    db.economicProfile.findUnique.mockResolvedValue({ economicComplexity: 40 });
    await callerAs(db, "u1").updateEconomicProfile({
      countryId: "c_mine",
      economicComplexity: 45,
    });
    expect(notificationHooks.onVitalityScoreChange).not.toHaveBeenCalled();
  });

  it("validates integer ranks", async () => {
    await expect(
      callerAs(db, "u1").updateEconomicProfile({ countryId: "c_mine", competitivenessRank: 1.5 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("builder reads", () => {
  it("returns null for an unknown country", async () => {
    db.country.findUnique.mockResolvedValue(null);
    await expect(
      callerAs(db, null).getEconomyBuilderState({ countryId: "nope" })
    ).resolves.toBeNull();
    await expect(
      callerAs(db, null).getEconomyConfiguration({ countryId: "nope" })
    ).resolves.toBeNull();
  });

  it("maps the stored sector breakdown and fills labour defaults", async () => {
    db.country.findUnique.mockResolvedValue({
      currentPopulation: 1000,
      currentTotalGdp: 5000,
      laborForceParticipationRate: null,
      unemploymentRate: 10,
      laborMarket: null,
      urbanPopulationPercent: 70,
      economicProfile: {
        sectorBreakdown: JSON.stringify([
          { name: "Heavy Industry", category: "Secondary", gdp: 30 },
          null,
        ]),
      },
      nationalIdentity: { currency: "Taler" },
      economicComponents: [],
    });

    const state = await callerAs(db, null).getEconomyBuilderState({ countryId: "c_mine" });

    expect(state?.structure).toMatchObject({
      secondarySectors: ["Heavy Industry"],
      totalGDP: 5000,
      gdpCurrency: "Taler",
    });
    expect(state?.sectors).toEqual([
      expect.objectContaining({ id: "heavy_industry", gdpContribution: 30 }),
    ]);
    expect(state?.laborMarket).toMatchObject({
      totalWorkforce: 650,
      employmentRate: 90,
    });
    expect(state?.demographics.urbanRuralSplit).toEqual({ urban: 70, rural: 30 });
  });

  it("treats an unparseable sector breakdown as empty", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    db.country.findUnique.mockResolvedValue({
      currentPopulation: 0,
      economicProfile: { sectorBreakdown: "{not json" },
      laborMarket: null,
    });

    const config = await callerAs(db, null).getEconomyConfiguration({ countryId: "c_mine" });

    expect(config?.sectors).toEqual([]);
    errorSpy.mockRestore();
  });
});
