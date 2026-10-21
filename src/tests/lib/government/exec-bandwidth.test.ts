/** @jest-environment node */
// Executive bandwidth: one shared used/available sum (MC-21), and executing directives consume it.
import { describe, it, expect } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";
import {
  loadExecBandwidthState,
  DELEGATION_WINDOW_MS
} from "~/lib/government/exec-bandwidth";
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
      aggregate: jest.fn(async () => ({ _sum: { execBandwidthCost: opts.policySum ?? null } })),
    },
    intent: {
      aggregate: jest.fn(async () => ({ _sum: { execBandwidthCost: opts.directiveSum ?? null } })),
    },
  };
}

describe("loadExecBandwidthState", () => {
  it("uses the delegation window in IxTime days for dismissed issues (not 5 ms)", async () => {
    const db = makeDb();
    const now = IxTime.getCurrentIxTime();
    await loadExecBandwidthState(db as unknown as PrismaClient, "c1");

    const dismissedCall = db.nationalIssue.count.mock.calls.find(
      (c) => (c[0] as any).where.status === "dismissed"
    )!;
    const gte = (dismissedCall[0] as any).where.respondedIxTime.gte as number;
    expect(now - gte).toBeGreaterThanOrEqual(DELEGATION_WINDOW_MS - 1000);
  });

  it("treats legacy directives with no stored cost as zero and flags over-capacity", async () => {
    const db = makeDb({ directiveSum: null, policySum: 10_000 });
    const state = await loadExecBandwidthState(db as unknown as PrismaClient, "c1");

    expect(state.breakdown.directives).toBe(0);
    expect(state.overCapacity).toBe(true);
    expect(state.available).toBe(0);
  });
});
