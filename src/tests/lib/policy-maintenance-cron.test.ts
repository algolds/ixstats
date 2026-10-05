/** @jest-environment node */
// `jest` is the ambient global on purpose: the hoisted jest.mock() factories rely on it.
//
// PL-8: the policy-maintenance job runs every 6 h but debits each policy's (annual)
// maintenance cost at most once per budget year. MC-5: lapsed policies expire first.
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));
jest.mock("~/lib/national-issues/engine", () => ({
  NationalIssuesEngine: { forceGenerate: jest.fn() },
}));
jest.mock("~/lib/national-issues/config", () => ({
  getNationalIssuesConfig: () => ({ spawnMode: "off" }),
}));
jest.mock("~/lib/intent/resistance", () => ({
  INTENT_CATEGORY_TO_TEMPLATE: {},
  spawnResistanceForIntent: jest.fn(),
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({ generateDiplomaticNews: jest.fn() }));
jest.mock("~/lib/activity/hooks", () => ({ ActivityHooks: {} }));
jest.mock("~/lib/activity", () => ({
  CountryEventSpine: jest.requireActual("~/lib/activity/event-spine").CountryEventSpine,
}));

import { describe, it, expect } from "@jest/globals";
import { runPolicyMaintenanceDebits } from "~/lib/policies/maintenance-cron";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { db as moduleDb } from "~/server/db";

interface PolicyRow {
  id: string;
  countryId: string;
  name: string;
  status: string;
  maintenanceCost: number;
  riskRating: string;
  expiryDate: Date | null;
}
interface LogRow {
  policyId: string;
  effectType: string;
  notes: string | null;
}

/** A small stateful db: policies, effect logs and one government budget per country. */
function makeDb(policies: PolicyRow[], budgets: Record<string, number | null>) {
  const state = { policies, logs: [] as LogRow[], budgets: { ...budgets } };
  const matchesStatus = (p: PolicyRow, status: unknown) =>
    typeof status === "string"
      ? p.status === status
      : (status as { in: string[] }).in.includes(p.status);
  const db: Record<string, any> = {
    state,
    policy: {
      findMany: jest.fn(async ({ where }: { where: Record<string, any> }) =>
        state.policies.filter(
          (p) =>
            matchesStatus(p, where.status) &&
            (!where.riskRating || where.riskRating.in.includes(p.riskRating)) &&
            (!where.expiryDate || (p.expiryDate !== null && p.expiryDate <= where.expiryDate.lte))
        )
      ),
      updateMany: jest.fn(async ({ where, data }: { where: any; data: any }) => {
        const p = state.policies.find((x) => x.id === where.id && matchesStatus(x, where.status));
        if (!p) return { count: 0 };
        Object.assign(p, data);
        return { count: 1 };
      }),
    },
    storytellerEffect: { updateMany: jest.fn(async () => ({ count: 0 })) },
    policyEffectLog: {
      create: jest.fn(async ({ data }: { data: LogRow }) => {
        state.logs.push(data);
        return data;
      }),
      createMany: jest.fn(async ({ data }: { data: LogRow[] }) => {
        state.logs.push(...data);
        return { count: data.length };
      }),
      findMany: jest.fn(async ({ where }: { where: any }) =>
        state.logs.filter(
          (l) =>
            where.policyId.in.includes(l.policyId) &&
            l.effectType === where.effectType &&
            l.notes === where.notes
        )
      ),
    },
    governmentStructure: {
      findUnique: jest.fn(async ({ where }: { where: { countryId: string } }) =>
        where.countryId in state.budgets
          ? { id: `gs_${where.countryId}`, totalBudget: state.budgets[where.countryId] }
          : null
      ),
      update: jest.fn(async ({ where, data }: { where: any; data: any }) => {
        state.budgets[where.countryId] = data.totalBudget;
        return {};
      }),
    },
    countryChangeLog: { create: jest.fn(async () => ({})) },
    nationalIssueTemplate: { findMany: jest.fn(async () => []) },
  };
  // Rolls back logs and budgets when the callback throws, like a real transaction.
  db.$transaction = jest.fn(async (cb: (tx: unknown) => unknown) => {
    const logs = [...state.logs];
    const savedBudgets = { ...state.budgets };
    try {
      return await cb(db);
    } catch (err) {
      state.logs = logs;
      state.budgets = savedBudgets;
      throw err;
    }
  });
  // The volatile-issue rolls read the module db.
  Object.assign(moduleDb, db);
  return db;
}

const policy = (id: string, extra: Partial<PolicyRow> = {}): PolicyRow => ({
  id,
  countryId: "c1",
  name: `Policy ${id}`,
  status: "active",
  maintenanceCost: 1000,
  riskRating: "stable",
  expiryDate: null,
  ...extra,
});

describe("policy-maintenance job", () => {
  it("debits once per budget year however often it runs", async () => {
    const db = makeDb([policy("p1"), policy("p2", { maintenanceCost: 500 })], { c1: 100_000 });

    const first = await runPolicyMaintenanceDebits(db as any);
    const second = await runPolicyMaintenanceDebits(db as any);

    expect(first.totalCostDebited).toBe(1500);
    expect(second.totalCostDebited).toBe(0);
    expect(db.state.budgets.c1).toBe(98_500);
    expect(db.state.logs.filter((l: LogRow) => l.effectType === "MAINTENANCE_DEBIT")).toEqual([
      expect.objectContaining({ policyId: "p1", notes: `FY${currentBudgetYear()}` }),
      expect.objectContaining({ policyId: "p2", notes: `FY${currentBudgetYear()}` }),
    ]);
  });

  it("debits a policy enacted later in the year once, without re-debiting the others", async () => {
    const db = makeDb([policy("p1")], { c1: 10_000 });
    await runPolicyMaintenanceDebits(db as any);

    db.state.policies.push(policy("p3", { maintenanceCost: 200 }));
    const later = await runPolicyMaintenanceDebits(db as any);

    expect(later.policiesProcessed).toBe(1);
    expect(later.totalCostDebited).toBe(200);
    expect(db.state.budgets.c1).toBe(8_800);
  });

  it("debits nothing and keeps no marker when the country has no budget yet", async () => {
    const db = makeDb([policy("p1")], { c1: null });

    const result = await runPolicyMaintenanceDebits(db as any);

    expect(result.totalCostDebited).toBe(0);
    expect(db.state.logs).toEqual([]);
  });

  it("expires lapsed policies before debiting them", async () => {
    const lapsed = policy("old", { expiryDate: new Date(Date.now() - 60_000) });
    const db = makeDb([lapsed, policy("p1")], { c1: 10_000 });

    const result = await runPolicyMaintenanceDebits(db as any);

    expect(result.policiesExpired).toBe(1);
    expect(lapsed.status).toBe("expired");
    expect(db.storytellerEffect.updateMany).toHaveBeenCalledWith({
      where: { createdBy: "POLICY:old", isActive: true },
      data: { isActive: false },
    });
    expect(result.totalCostDebited).toBe(1000);
    expect(db.state.budgets.c1).toBe(9_000);
  });
});
