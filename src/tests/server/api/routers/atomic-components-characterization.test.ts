import { TransactionalMockDatabase } from "~/tests/helpers/transactional-mock-db";
import { unifiedAtomicRouter } from "~/server/api/routers/unifiedAtomic";
import { createMockRouterContext } from "~/tests/helpers/router-context";

describe("atomic-components characterization contract", () => {
  const countryId = "test_country_atomic_123";

  describe("transactional mock db helper", () => {
    it("commits changes when transaction callback succeeds", async () => {
      const mockDb = new TransactionalMockDatabase();

      await mockDb.$transaction(async (tx) => {
        await tx.addComponent({ name: "Component A" });
        await tx.addAuditLog({ action: "CREATE_A" });
      });

      const state = mockDb.getState();
      expect(state.components).toHaveLength(1);
      expect(state.auditLogs).toHaveLength(1);
      expect(state.components[0].name).toBe("Component A");
    });

    it("rolls back all changes when transaction callback throws", async () => {
      const mockDb = new TransactionalMockDatabase();

      await expect(
        mockDb.$transaction(async (tx) => {
          await tx.addComponent({ name: "Component B" });
          await tx.addAuditLog({ action: "CREATE_B" });
          throw new Error("Simulated audit write failure");
        })
      ).rejects.toThrow("Simulated audit write failure");

      const state = mockDb.getState();
      expect(state.components).toHaveLength(0);
      expect(state.auditLogs).toHaveLength(0);
    });
  });

  describe("unifiedAtomic.getAll read contract", () => {
    it("returns government, economic, and tax arrays along with calculated totalCount", async () => {
      const mockGov = [{ id: "gov_1", name: "Gov Comp 1", countryId }];
      const mockEcon = [{ id: "econ_1", name: "Econ Comp 1", countryId }];
      const mockTax = [{ id: "tax_1", name: "Tax Comp 1", countryId }];

      const ctx = createMockRouterContext({
        user: { clerkUserId: "user_owner", countryId },
        db: {
          governmentComponent: { findMany: jest.fn().mockResolvedValue(mockGov) },
          economicComponent: { findMany: jest.fn().mockResolvedValue(mockEcon) },
          taxComponent: { findMany: jest.fn().mockResolvedValue(mockTax) },
        },
      });

      const caller = unifiedAtomicRouter.createCaller(ctx as any);
      const result = await caller.getAll({ countryId });

      expect(result).toHaveProperty("government");
      expect(result).toHaveProperty("economic");
      expect(result).toHaveProperty("tax");
      expect(result).toHaveProperty("totalCount");
      expect(result.government).toHaveLength(1);
      expect(result.economic).toHaveLength(1);
      expect(result.tax).toHaveLength(1);
      expect(result.totalCount).toBe(3);
    });
  });

  describe("atomic compound write behavior", () => {
    it("propagates error when audit logging rejects during sequential write", async () => {
      const mockCreateComponent = jest.fn().mockResolvedValue({
        id: "econ_created_1",
        name: "Trade Hub",
        countryId,
      });
      const mockCreateAudit = jest.fn().mockRejectedValue(new Error("Audit log disk error"));

      const ctx = createMockRouterContext({
        user: { clerkUserId: "user_owner", countryId },
        db: {
          atomicEconomicComponent: {
            create: mockCreateComponent,
          },
          atomicComponentChangeLog: {
            create: mockCreateAudit,
          },
        },
      });

      // Characterize sequential error propagation
      await expect(
        (async () => {
          await ctx.db.atomicEconomicComponent.create({ data: { name: "Trade Hub", countryId } });
          await ctx.db.atomicComponentChangeLog.create({ data: { action: "CREATE" } });
        })()
      ).rejects.toThrow("Audit log disk error");

      expect(mockCreateComponent).toHaveBeenCalledTimes(1);
      expect(mockCreateAudit).toHaveBeenCalledTimes(1);
    });

    // Exactly one planned TODO test for transactional rollback (Plan 156)
    it.todo("rolls back component creation when audit logging fails (Plan 156)");
  });
});
