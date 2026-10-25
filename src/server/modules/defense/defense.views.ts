/**
 * What the Defense procedures return: the nation's derived defense for its owner, a redacted view for everyone else
 * (owner decision: other nations' strength reaches them as intelligence estimates, D3).
 */
import {
  alertEffectiveAt,
  shareWarnings,
  type BranchView,
  type BudgetWarning,
} from "~/lib/military/model";
import type { DefenseSnapshot } from "./defense.sync";

function warnings(snapshot: DefenseSnapshot): BudgetWarning[] {
  const { funding } = snapshot.view;
  const list = shareWarnings(snapshot.state.policy.shares);
  if (funding.maintenanceFunding < 1 || funding.trainingFunding < 1) list.push("readinessFalling");
  const active = snapshot.state.branches.reduce((sum, b) => sum + b.active, 0);
  if (active > funding.headcountAfford * 1.01) list.push("payArrears");
  return list;
}

function branchSummary(snapshot: DefenseSnapshot, view: BranchView) {
  const row = snapshot.branchRows.find((b) => b.id === view.id);
  const state = snapshot.state.branches.find((b) => b.id === view.id);
  return {
    ...view,
    name: row?.name ?? view.domain,
    motto: row?.motto ?? null,
    imageUrl: row?.imageUrl ?? null,
    effortShare: state?.effortShare ?? 0,
    targetActive: state?.targetActive ?? null,
    mobilisationOrder: state?.mobilisationOrder ?? 0,
    operationWear: state?.operationWear ?? 1,
    nominalCapital: view.capital * snapshot.state.policy.priceIndex,
  };
}

/** The owner's view: policy, budget, totals, every branch's derived state. */
export function defenseOverview(snapshot: DefenseSnapshot) {
  const { policy } = snapshot.state;
  const { view } = snapshot;
  return {
    countryId: snapshot.country.id,
    clockMs: snapshot.nowClockMs,
    budget: {
      annual: snapshot.econ.defenseBudget,
      source: snapshot.budgetSource,
      burden: view.burden,
    },
    policy: {
      ...policy,
      alertInEffect: view.alert,
      alertEffectiveAtClockMs: alertEffectiveAt(policy),
      surging: policy.surgeStartedClockMs !== null,
    },
    combatPower: view.combatPower,
    readiness: view.readiness,
    cLevel: view.cLevel,
    cev: view.cev,
    frontierLagYears: view.frontierLagYears,
    mobilisationSupplement: view.mobilisationSupplement,
    funding: view.funding,
    warnings: warnings(snapshot),
    branches: view.branches.map((b) => branchSummary(snapshot, b)),
  };
}

export type DefenseOverview = ReturnType<typeof defenseOverview>;

/** What another nation sees: the public order of battle and the visible posture, no internals. */
export function publicDefenseOverview(snapshot: DefenseSnapshot) {
  return {
    countryId: snapshot.country.id,
    redacted: true as const,
    doctrine: snapshot.state.policy.doctrine,
    alertInEffect: snapshot.view.alert,
    branches: snapshot.view.branches.map((b) => {
      const row = snapshot.branchRows.find((r) => r.id === b.id);
      return {
        id: b.id,
        domain: b.domain,
        name: row?.name ?? b.domain,
        active: Math.round(b.active),
        reserves: Math.round(b.reserves),
      };
    }),
  };
}

/** One branch in detail (owner). */
export function branchDetail(snapshot: DefenseSnapshot, branchId: string) {
  const view = snapshot.view.branches.find((b) => b.id === branchId);
  if (!view) return null;
  return {
    ...branchSummary(snapshot, view),
    assets: snapshot.assets.filter((a) => a.branchId === branchId),
    orders: snapshot.state.orders.filter((o) => o.branchId === branchId && o.status === "ordered"),
  };
}
