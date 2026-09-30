/** @jest-environment node */
// CivCap: one shared used/available sum (MC-21), and executing directives consume it.
import { describe, it, expect } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";
import {
  loadCivCapState,
  sumCivCapUsed,
  DIRECTIVE_CIVCAP_WINDOW_MS,
  DELEGATION_WINDOW_MS,
  RECON_CAPACITY_COST,
  DELEGATED_ISSUE_CIVCAP,
} from "~/lib/government/civcap";
import { calculateCivilServiceCapacity } from "~/lib/government/atomic-utils";
import { IxTime } from "~/lib/ixtime";

function makeDb(
  opts: {
    policySum?: number | null;
    directiveSum?: number | null;
    pendingRecon?: number;
    dismissed?: number;
  } = {}
) {
  const count = jest.fn(async (args: { where: Record<string, unknown> }) =>
    "reconReadyIxTime" in args.where ? (opts.pendingRecon ?? 0) : (opts.dismissed ?? 0)
  );
  return {
    country: {
      findUnique: jest.fn(async () => ({
        currentPopulation: 10_000_000,
        governmentalEfficiency: 0,
      })),
    },
    governmentStructure: {
      findUnique: jest.fn(async () => ({
        governmentEffectiveness: 60,
        departments: [{ category: "finance" }],
      })),
    },
    governmentComponent: { findMany: jest.fn(async () => []) },
    nationalIssue: { count },
    budgetAllocation: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    policy: {
      aggregate: jest.fn(async () => ({ _sum: { civCapCost: opts.policySum ?? null } })),
    },
    intent: {
      aggregate: jest.fn(async () => ({ _sum: { civCapCost: opts.directiveSum ?? null } })),
    },
  };
}

describe("loadCivCapState", () => {
  it("counts executing directives' stored civCapCost toward CivCap used", async () => {
    const db = makeDb({ policySum: 15, directiveSum: 37, pendingRecon: 1, dismissed: 2 });
    const state = await loadCivCapState(db as unknown as PrismaClient, "c1");

    expect(state.breakdown).toEqual({
      governmentStaff: 0,
      recon: RECON_CAPACITY_COST,
      policies: 15,
      directives: 37,
      delegatedIssues: 2 * DELEGATED_ISSUE_CIVCAP,
    });
    expect(state.used).toBe(15 + 37 + RECON_CAPACITY_COST + 2 * DELEGATED_ISSUE_CIVCAP);
    expect(state.capacity).toBe(calculateCivilServiceCapacity(10_000_000, 60));
    expect(state.available).toBe(state.capacity - state.used);
    expect(state.departmentCategories).toEqual(["finance"]);
  });

  it("only sums active directives committed inside the execution window", async () => {
    const db = makeDb();
    const before = IxTime.getCurrentIxTime();
    await loadCivCapState(db as unknown as PrismaClient, "c1");
    const after = IxTime.getCurrentIxTime();

    const where = (db.intent.aggregate.mock.calls[0] as any[])[0].where;
    expect(where.countryId).toBe("c1");
    expect(where.status).toBe("active");
    expect(where.createdIxTime.gte).toBeGreaterThanOrEqual(before - DIRECTIVE_CIVCAP_WINDOW_MS);
    expect(where.createdIxTime.gte).toBeLessThanOrEqual(after - DIRECTIVE_CIVCAP_WINDOW_MS);
  });

  it("uses the delegation window in IxTime days for dismissed issues (not 5 ms)", async () => {
    const db = makeDb();
    const now = IxTime.getCurrentIxTime();
    await loadCivCapState(db as unknown as PrismaClient, "c1");

    const dismissedCall = db.nationalIssue.count.mock.calls.find(
      (c) => (c[0] as any).where.status === "dismissed"
    )!;
    const gte = (dismissedCall[0] as any).where.respondedIxTime.gte as number;
    expect(now - gte).toBeGreaterThanOrEqual(DELEGATION_WINDOW_MS - 1000);
  });

  it("treats legacy directives with no stored cost as zero and flags over-capacity", async () => {
    const db = makeDb({ directiveSum: null, policySum: 10_000 });
    const state = await loadCivCapState(db as unknown as PrismaClient, "c1");

    expect(state.breakdown.directives).toBe(0);
    expect(state.overCapacity).toBe(true);
    expect(state.available).toBe(0);
  });
});

describe("sumCivCapUsed", () => {
  it("adds every consumer", () => {
    expect(
      sumCivCapUsed({
        governmentStaff: 1,
        recon: 2,
        policies: 3,
        directives: 4,
        delegatedIssues: 5,
      })
    ).toBe(15);
  });
});
