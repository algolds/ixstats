import {
  createEconomicComponentTx,
  updateEconomicComponentTx,
  removeEconomicComponentTx,
  bulkUpdateEconomicComponentsTx,
  createTaxComponentTx,
  updateTaxComponentTx,
  removeTaxComponentTx,
  bulkUpdateTaxComponentsTx,
  createBudgetScenarioTx,
} from "~/server/modules/atomic/services/component-mutations";

class MockPrismaTxState {
  economicComponents: any[] = [];
  taxComponents: any[] = [];
  componentChangeLogs: any[] = [];
  budgetScenarios: any[] = [];
  budgetScenarioCategories: any[] = [];

  failOnLog = false;
  failOnCategory = false;

  getDb() {
    const self = this;
    const createTxClient = () => ({
      economicComponent: {
        create: async ({ data }: any) => {
          const comp = { id: `ec_${self.economicComponents.length + 1}`, ...data };
          self.economicComponents.push(comp);
          return comp;
        },
        update: async ({ where, data }: any) => {
          const idx = self.economicComponents.findIndex((c) => c.id === where.id);
          if (idx === -1) throw new Error("Not found");
          const updated = { ...self.economicComponents[idx], ...data };
          self.economicComponents[idx] = updated;
          return updated;
        },
        findMany: async ({ where }: any) => {
          return self.economicComponents.filter((c) => c.countryId === where.countryId);
        },
      },
      taxComponent: {
        create: async ({ data }: any) => {
          const comp = { id: `tc_${self.taxComponents.length + 1}`, ...data };
          self.taxComponents.push(comp);
          return comp;
        },
        update: async ({ where, data }: any) => {
          const idx = self.taxComponents.findIndex((c) => c.id === where.id);
          if (idx === -1) throw new Error("Not found");
          const updated = { ...self.taxComponents[idx], ...data };
          self.taxComponents[idx] = updated;
          return updated;
        },
        findMany: async ({ where }: any) => {
          return self.taxComponents.filter((c) => c.countryId === where.countryId);
        },
      },
      componentChangeLog: {
        create: async ({ data }: any) => {
          if (self.failOnLog) {
            throw new Error("Simulated componentChangeLog write failure");
          }
          const log = { id: `log_${self.componentChangeLogs.length + 1}`, ...data };
          self.componentChangeLogs.push(log);
          return log;
        },
      },
      budgetScenario: {
        create: async ({ data }: any) => {
          const scenario = { id: `sc_${self.budgetScenarios.length + 1}`, ...data };
          self.budgetScenarios.push(scenario);
          return scenario;
        },
      },
      budgetScenarioCategory: {
        createMany: async ({ data }: any) => {
          if (self.failOnCategory) {
            throw new Error("Simulated budgetScenarioCategory write failure");
          }
          for (const item of data) {
            self.budgetScenarioCategories.push({ id: `cat_${self.budgetScenarioCategories.length + 1}`, ...item });
          }
          return { count: data.length };
        },
      },
    });

    return {
      $transaction: async (cb: (tx: any) => Promise<any>) => {
        const snapshot = {
          economicComponents: JSON.parse(JSON.stringify(self.economicComponents)),
          taxComponents: JSON.parse(JSON.stringify(self.taxComponents)),
          componentChangeLogs: JSON.parse(JSON.stringify(self.componentChangeLogs)),
          budgetScenarios: JSON.parse(JSON.stringify(self.budgetScenarios)),
          budgetScenarioCategories: JSON.parse(JSON.stringify(self.budgetScenarioCategories)),
        };

        try {
          const txClient = createTxClient();
          return await cb(txClient);
        } catch (err) {
          self.economicComponents = snapshot.economicComponents;
          self.taxComponents = snapshot.taxComponents;
          self.componentChangeLogs = snapshot.componentChangeLogs;
          self.budgetScenarios = snapshot.budgetScenarios;
          self.budgetScenarioCategories = snapshot.budgetScenarioCategories;
          throw err;
        }
      },
    };
  }
}

describe("Plan 156: Atomic Component and Budget Scenario Mutations", () => {
  let harness: MockPrismaTxState;
  let db: any;

  beforeEach(() => {
    harness = new MockPrismaTxState();
    db = harness.getDb();
  });

  describe("Economic component compound writes", () => {
    it("commits economic component and audit log together on success", async () => {
      const res = await createEconomicComponentTx(
        db,
        {
          countryId: "country-1",
          componentType: "FREE_MARKET" as any,
          effectivenessScore: 80,
        },
        "user-1"
      );

      expect(res.id).toBe("ec_1");
      expect(res.componentType).toBe("FREE_MARKET");
      expect(harness.economicComponents).toHaveLength(1);
      expect(harness.componentChangeLogs).toHaveLength(1);
      expect(harness.componentChangeLogs[0].changeType).toBe("ADDED");
    });

    it("rolls back economic component creation when audit log creation fails", async () => {
      harness.failOnLog = true;

      await expect(
        createEconomicComponentTx(
          db,
          {
            countryId: "country-1",
            componentType: "FREE_MARKET" as any,
          },
          "user-1"
        )
      ).rejects.toThrow("Simulated componentChangeLog write failure");

      expect(harness.economicComponents).toHaveLength(0);
      expect(harness.componentChangeLogs).toHaveLength(0);
    });

    it("rolls back economic component update when audit log creation fails", async () => {
      harness.economicComponents.push({
        id: "ec_1",
        countryId: "country-1",
        componentType: "FREE_MARKET",
        effectivenessScore: 50,
        isActive: true,
      });

      harness.failOnLog = true;

      await expect(
        updateEconomicComponentTx(
          db,
          { id: "ec_1", effectivenessScore: 90 },
          harness.economicComponents[0],
          "user-1"
        )
      ).rejects.toThrow("Simulated componentChangeLog write failure");

      expect(harness.economicComponents[0].effectivenessScore).toBe(50);
      expect(harness.componentChangeLogs).toHaveLength(0);
    });

    it("handles bulk economic updates atomically", async () => {
      const res = await bulkUpdateEconomicComponentsTx(
        db,
        "country-1",
        [
          { componentType: "COMMAND" as any, effectivenessScore: 70, isActive: true },
          { componentType: "MIXED" as any, effectivenessScore: 60, isActive: true },
        ],
        "user-1"
      );

      expect(res).toHaveLength(2);
      expect(harness.economicComponents).toHaveLength(2);
      expect(harness.componentChangeLogs).toHaveLength(2);
    });
  });

  describe("Tax component compound writes", () => {
    it("commits tax component and audit log together on success", async () => {
      const res = await createTaxComponentTx(
        db,
        {
          countryId: "country-1",
          componentType: "INCOME_TAX" as any,
          effectivenessScore: 75,
        },
        "user-1"
      );

      expect(res.id).toBe("tc_1");
      expect(res.componentType).toBe("INCOME_TAX");
      expect(harness.taxComponents).toHaveLength(1);
      expect(harness.componentChangeLogs).toHaveLength(1);
      expect(harness.componentChangeLogs[0].changeType).toBe("ADDED");
    });

    it("rolls back tax component removal when audit log fails", async () => {
      harness.taxComponents.push({
        id: "tc_1",
        countryId: "country-1",
        componentType: "INCOME_TAX",
        isActive: true,
      });

      harness.failOnLog = true;

      await expect(
        removeTaxComponentTx(db, "tc_1", harness.taxComponents[0], "user-1")
      ).rejects.toThrow("Simulated componentChangeLog write failure");

      expect(harness.taxComponents[0].isActive).toBe(true);
      expect(harness.componentChangeLogs).toHaveLength(0);
    });
  });

  describe("Budget scenario compound writes", () => {
    it("commits budget scenario and categories atomically on success", async () => {
      const res = await createBudgetScenarioTx(db, {
        countryId: "country-1",
        name: "Fiscal 2027",
        totalBudget: 50000000,
        riskLevel: "medium",
        categories: [
          {
            categoryName: "Defense",
            allocatedAmount: 15000000,
            allocatedPercent: 30,
            priority: "high",
          },
          {
            categoryName: "Healthcare",
            allocatedAmount: 20000000,
            allocatedPercent: 40,
            priority: "critical",
          },
        ],
      });

      expect(res.id).toBe("sc_1");
      expect(res.name).toBe("Fiscal 2027");
      expect(harness.budgetScenarios).toHaveLength(1);
      expect(harness.budgetScenarioCategories).toHaveLength(2);
    });

    it("rolls back budget scenario when category insert fails", async () => {
      harness.failOnCategory = true;

      await expect(
        createBudgetScenarioTx(db, {
          countryId: "country-1",
          name: "Fiscal 2027",
          totalBudget: 50000000,
          riskLevel: "medium",
          categories: [
            {
              categoryName: "Defense",
              allocatedAmount: 15000000,
              allocatedPercent: 30,
              priority: "high",
            },
          ],
        })
      ).rejects.toThrow("Simulated budgetScenarioCategory write failure");

      expect(harness.budgetScenarios).toHaveLength(0);
      expect(harness.budgetScenarioCategories).toHaveLength(0);
    });
  });
});
