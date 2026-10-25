/** @jest-environment node */
/**
 * Realm time D3: losses land on the forces at Dupuy's equipment ratios; operations draw on the O&M line before
 * readiness and their overspend joins the burden; the NPC hook reads the stored Richardson adjustment.
 */
import type { BranchLoss } from "~/lib/military/combat";
import { deriveNation, fundingAt, threatBurdenAdjustment } from "~/lib/military/model";
import { assetLossShare, personnelAfterLoss } from "~/server/modules/combat/combat.losses";
import { T0, economy, starter } from "../../../lib/military/model/fixtures";

const loss = (overrides: Partial<BranchLoss>): BranchLoss => ({
  id: "b",
  domain: "land",
  personnel: 0,
  engagedShare: 0.5,
  lossRate: 0.04,
  capitalShare: 0,
  ...overrides,
});

describe("losses on the forces", () => {
  it("armor goes at 6×, self-propelled artillery 0.25×, towed artillery 0.1× the engaged personnel rate", () => {
    expect(assetLossShare(loss({}), "tank")).toBeCloseTo(0.5 * 0.04 * 6, 9);
    expect(assetLossShare(loss({}), "mlrs")).toBeCloseTo(0.5 * 0.04 * 0.25, 9);
    expect(assetLossShare(loss({}), "artillery")).toBeCloseTo(0.5 * 0.04 * 0.1, 9);
    expect(assetLossShare(loss({ domain: "air", capitalShare: 0.03 }), "fighter")).toBe(0.03);
    expect(assetLossShare(loss({ domain: "space" }), "satellite")).toBe(0);
  });

  it("casualties come off active duty, then off reservists who reported", () => {
    const branch = { ...starter().branches[0]!, active: 1_000, reserves: 5_000, mobilisationOrder: 2_000 };
    expect(personnelAfterLoss(branch, 400)).toEqual({ activeDuty: 600, reserves: 5_000, mobilisationOrder: 2_000 });
    expect(personnelAfterLoss(branch, 1_500)).toEqual({ activeDuty: 0, reserves: 4_500, mobilisationOrder: 1_500 });
  });
});

describe("operations on the O&M line", () => {
  it("are paid before maintenance and training, and their overspend joins the burden", () => {
    const state = starter();
    const calm = economy();
    const om = (calm.defenseBudget * state.policy.shares.om) / 12;
    const busy = economy({ operationsMonthly: om * 0.8 });
    expect(fundingAt(state, busy, T0).report.maintenanceFunding).toBeLessThan(
      fundingAt(state, calm, T0).report.maintenanceFunding
    );
    const over = economy({ operationsMonthly: om * 2 });
    const view = deriveNation(state, over, [], T0);
    expect(view.operationsOverspend).toBeCloseTo(12 * om, 3);
    expect(view.burden).toBeCloseTo((over.defenseBudget + 12 * om) / over.gdp, 9);
  });
});

it("an NPC's budget hook reads its stored Richardson adjustment; players carry none", () => {
  expect(threatBurdenAdjustment({ npcBurdenAdjustment: 0.012 })).toBe(0.012);
  expect(threatBurdenAdjustment(null)).toBe(0);
});
