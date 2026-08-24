import { atomicGovernmentRouter } from "~/server/api/routers/atomicGovernment";
import { atomicEconomicRouter } from "~/server/api/routers/atomicEconomic";
import { atomicTaxRouter } from "~/server/api/routers/atomicTax";
import { createMockRouterContext } from "~/tests/helpers/router-context";

describe("Plan 149: Atomic Routers Country Authorization", () => {
  const callerCountryId = "country_caller";
  const foreignCountryId = "country_foreign";

  function createTestCtx(overrides?: { userId?: string; countryId?: string; role?: string }): any {
    const userId = overrides?.userId ?? "user_caller";
    const countryId = overrides?.countryId ?? callerCountryId;
    const role = overrides?.role ?? "member";

    const governmentComponents = [
      { id: "gov_comp_1", countryId: callerCountryId, componentType: "CENTRAL_BANK" },
      { id: "gov_comp_2", countryId: callerCountryId, componentType: "TREASURY" },
      { id: "gov_comp_foreign", countryId: foreignCountryId, componentType: "SUPREME_COURT" },
    ];
    const economicComponents = [
      { id: "econ_comp_1", countryId: callerCountryId, componentType: "FREE_MARKET_SYSTEM" },
      { id: "econ_comp_foreign", countryId: foreignCountryId, componentType: "PLANNED_ECONOMY" },
    ];
    const taxComponents = [
      { id: "tax_comp_1", countryId: callerCountryId, componentType: "PROGRESSIVE_TAX" },
      { id: "tax_comp_foreign", countryId: foreignCountryId, componentType: "CORPORATE_TAX" },
    ];
    const fiscalPolicies = [
      { id: "policy_1", countryId: callerCountryId, name: "Stimulus" },
      { id: "policy_foreign", countryId: foreignCountryId, name: "Austerity" },
    ];

    const mockDb: any = {
      $transaction: jest.fn(async (cb: any) =>
        typeof cb === "function" ? cb(mockDb) : Promise.all(cb)
      ),
      user: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.clerkUserId === userId) {
            return {
              id: `db_${userId}`,
              clerkUserId: userId,
              countryId,
              role: { name: role },
            };
          }
          return null;
        }),
      },
      country: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === callerCountryId || where.id === foreignCountryId) {
            return { id: where.id, name: "Test Country" };
          }
          return null;
        }),
      },
      governmentComponent: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return governmentComponents.find((c) => c.id === where.id) ?? null;
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: "new_gov_id", ...data })),
        update: jest.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
      },
      componentSynergy: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: "new_syn_id", ...data })),
      },
      economicComponent: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return economicComponents.find((c) => c.id === where.id) ?? null;
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: "new_econ_id", ...data })),
        update: jest.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
      },
      componentChangeLog: {
        create: jest.fn().mockResolvedValue({ id: "log_1" }),
      },
      taxComponent: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return taxComponents.find((c) => c.id === where.id) ?? null;
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: "new_tax_id", ...data })),
        update: jest.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
      },
      fiscalPolicy: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return fiscalPolicies.find((p) => p.id === where.id) ?? null;
        }),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: "new_pol_id", ...data })),
        update: jest.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
      },
    };

    return createMockRouterContext({
      auth: { userId },
      user: {
        id: `db_${userId}`,
        clerkUserId: userId,
        countryId,
        role: { name: role },
      },
      db: mockDb,
    }) as any;
  }

  describe("atomicGovernmentRouter", () => {
    it("allows owner to create a government component for own country", async () => {
      const ctx = createTestCtx();
      const caller = atomicGovernmentRouter.createCaller(ctx);

      const result = await caller.createComponent({
        countryId: callerCountryId,
        componentType: "DEMOCRATIC_PROCESS" as any,
        effectivenessScore: 80,
      });

      expect(result.countryId).toBe(callerCountryId);
    });

    it("rejects unauthorized creation on foreign country", async () => {
      const ctx = createTestCtx();
      const caller = atomicGovernmentRouter.createCaller(ctx);

      await expect(
        caller.createComponent({
          countryId: foreignCountryId,
          componentType: "DEMOCRATIC_PROCESS" as any,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("allows owner to update component by ID", async () => {
      const ctx = createTestCtx();
      const caller = atomicGovernmentRouter.createCaller(ctx);

      const result = await caller.updateComponent({
        id: "gov_comp_1",
        effectivenessScore: 95,
      });

      expect(result.id).toBe("gov_comp_1");
    });

    it("rejects updating foreign government component by ID", async () => {
      const ctx = createTestCtx();
      const caller = atomicGovernmentRouter.createCaller(ctx);

      await expect(
        caller.updateComponent({
          id: "gov_comp_foreign",
          effectivenessScore: 10,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects removing foreign government component by ID", async () => {
      const ctx = createTestCtx();
      const caller = atomicGovernmentRouter.createCaller(ctx);

      await expect(
        caller.removeComponent({
          id: "gov_comp_foreign",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects createSynergy with cross-country component pair", async () => {
      const ctx = createTestCtx();
      const caller = atomicGovernmentRouter.createCaller(ctx);

      await expect(
        caller.createSynergy({
          countryId: callerCountryId,
          primaryComponentId: "gov_comp_1",
          secondaryComponentId: "gov_comp_foreign",
          synergyType: "MULTIPLICATIVE",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("allows createSynergy with both components belonging to own country", async () => {
      const ctx = createTestCtx();
      const caller = atomicGovernmentRouter.createCaller(ctx);

      const result = await caller.createSynergy({
        countryId: callerCountryId,
        primaryComponentId: "gov_comp_1",
        secondaryComponentId: "gov_comp_2",
        synergyType: "MULTIPLICATIVE",
      });

      expect(result.countryId).toBe(callerCountryId);
    });

    it("rejects applyFiscalPolicy on foreign country policy", async () => {
      const ctx = createTestCtx();
      const caller = atomicGovernmentRouter.createCaller(ctx);

      await expect(
        caller.applyFiscalPolicy({
          policyId: "policy_foreign",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("atomicEconomicRouter", () => {
    it("allows owner to create economic component", async () => {
      const ctx = createTestCtx();
      const caller = atomicEconomicRouter.createCaller(ctx);

      const result = await caller.createComponent({
        countryId: callerCountryId,
        componentType: "FREE_MARKET_SYSTEM" as any,
      });

      expect(result.countryId).toBe(callerCountryId);
    });

    it("rejects creating economic component on foreign country", async () => {
      const ctx = createTestCtx();
      const caller = atomicEconomicRouter.createCaller(ctx);

      await expect(
        caller.createComponent({
          countryId: foreignCountryId,
          componentType: "FREE_MARKET_SYSTEM" as any,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects updating foreign economic component by ID", async () => {
      const ctx = createTestCtx();
      const caller = atomicEconomicRouter.createCaller(ctx);

      await expect(
        caller.updateComponent({
          id: "econ_comp_foreign",
          effectivenessScore: 10,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects bulkUpdate on foreign country", async () => {
      const ctx = createTestCtx();
      const caller = atomicEconomicRouter.createCaller(ctx);

      await expect(
        caller.bulkUpdate({
          countryId: foreignCountryId,
          components: [{ componentType: "FREE_MARKET_SYSTEM" as any, effectivenessScore: 50, isActive: true, implementationCost: 0, maintenanceCost: 0, requiredCapacity: 50 }],
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("atomicTaxRouter", () => {
    it("allows owner to create tax component", async () => {
      const ctx = createTestCtx();
      const caller = atomicTaxRouter.createCaller(ctx);

      const result = await caller.createComponent({
        countryId: callerCountryId,
        componentType: "PROGRESSIVE_TAX" as any,
      });

      expect(result.countryId).toBe(callerCountryId);
    });

    it("rejects creating tax component on foreign country", async () => {
      const ctx = createTestCtx();
      const caller = atomicTaxRouter.createCaller(ctx);

      await expect(
        caller.createComponent({
          countryId: foreignCountryId,
          componentType: "PROGRESSIVE_TAX" as any,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects updating foreign tax component by ID", async () => {
      const ctx = createTestCtx();
      const caller = atomicTaxRouter.createCaller(ctx);

      await expect(
        caller.updateComponent({
          id: "tax_comp_foreign",
          effectivenessScore: 10,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects bulkUpdate on foreign country", async () => {
      const ctx = createTestCtx();
      const caller = atomicTaxRouter.createCaller(ctx);

      await expect(
        caller.bulkUpdate({
          countryId: foreignCountryId,
          components: [{ componentType: "PROGRESSIVE_TAX" as any, effectivenessScore: 50, isActive: true, implementationCost: 0, maintenanceCost: 0, requiredCapacity: 50 }],
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
