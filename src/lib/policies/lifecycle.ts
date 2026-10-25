/**
 * Policy lifecycle: repeal, expiry, and the once-per-budget-year maintenance debit.
 *
 * - Executive bandwidth: a policy holds `execBandwidthCost` only while `status === "active"` (the shared sum in
 *   lib/government/exec-bandwidth.ts), so moving it to `repealed` or `expired` releases it.
 * - Simulation: an active policy's growth effect is a StorytellerEffect tagged `POLICY:<id>`
 *   (./effects-sync); ending the policy clears it.
 * - Maintenance (PL-8): `maintenanceCost` is an annual figure (e.g. a stipend × population), and
 *   the `policy-maintenance` job runs every 6 h. Each charge is recorded as a PolicyEffectLog row
 *   (`effectType` MAINTENANCE_DEBIT, `notes` "FY<budget year>", `actualEffect` the amount), so a
 *   policy is charged at most once per budget year (its nation's realm clock) however often the job runs.
 *   Maintenance is spending within the year: it never debits `totalBudget` (a yearly flow), and
 *   a year's charges stop at that year's budget (`chargeMaintenance`).
 */
import type { PrismaClient } from "@prisma/client";
import { CountryEventSpine } from "~/lib/activity";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { clockForCountry } from "~/server/shared/realm-time";
import {
  chargeMaintenance,
  maintenanceCharge,
  maintenanceEffect,
} from "~/lib/government/budget-math";
import { clearPolicyEffect } from "./effects-sync";

/** Statuses in which a policy is enacted (and can be repealed or expire). */
export const ENACTED_POLICY_STATUSES = ["active", "suspended"] as const;

export const MAINTENANCE_DEBIT_EFFECT = "MAINTENANCE_DEBIT";
const POLICY_ENDED_EFFECT = "POLICY_ENDED";

/** The PolicyEffectLog `notes` key for a budget year's maintenance debit. */
export function maintenancePeriodKey(budgetYear: number): string {
  return `FY${budgetYear}`;
}

type PolicyEndStatus = "repealed" | "expired";

/**
 * End an enacted policy: set its status, clear its simulation effect and log it, at its nation's time now. Returns
 * false when the policy was not enacted (already ended, or never enacted), so nothing changed.
 */
export async function endPolicy(
  db: PrismaClient,
  policyId: string,
  status: PolicyEndStatus,
  note?: string
): Promise<boolean> {
  const { count } = await db.policy.updateMany({
    where: { id: policyId, status: { in: [...ENACTED_POLICY_STATUSES] } },
    data: { status },
  });
  if (count === 0) return false;

  const policy = await db.policy.findUnique({
    where: { id: policyId },
    select: { country: { select: { realmId: true } } },
  });
  const now = (await clockForCountry(db, policy?.country ?? { realmId: null })).now();
  await clearPolicyEffect(db, policyId, now);
  await db.policyEffectLog.create({
    data: {
      policyId,
      appliedIxTime: now,
      effectType: POLICY_ENDED_EFFECT,
      notes: note ? `${status}: ${note}` : status,
    },
  });
  return true;
}

/** Expire every enacted policy whose expiry date has passed. Returns how many expired. */
export async function expireLapsedPolicies(
  db: PrismaClient,
  now: Date = new Date()
): Promise<number> {
  const lapsed = await db.policy.findMany({
    where: { status: { in: [...ENACTED_POLICY_STATUSES] }, expiryDate: { lte: now } },
    select: { id: true },
  });
  let expired = 0;
  for (const { id } of lapsed) {
    try {
      if (await endPolicy(db, id, "expired", "expiry date passed")) expired++;
    } catch (err) {
      console.error(`[PolicyExpiry] Failed to expire policy ${id}:`, err);
    }
  }
  return expired;
}

interface MaintenancePolicy {
  id: string;
  name: string;
  maintenanceCost: number;
}

/**
 * Charge one country's active policies for the budget year at `now` (its nation's clock time), skipping any policy
 * already charged that year. Charges stop once the year's maintenance reaches `totalBudget`. The
 * PolicyEffectLog markers and the ledger entry are written in one transaction. Returns the
 * policies charged and the total.
 */
export async function debitCountryMaintenance(
  db: PrismaClient,
  countryId: string,
  policies: MaintenancePolicy[],
  totalBudget: number,
  now: number
): Promise<{ policiesDebited: number; totalDebited: number }> {
  const costed = policies.filter((p) => (p.maintenanceCost || 0) > 0);
  if (costed.length === 0) return { policiesDebited: 0, totalDebited: 0 };
  const periodKey = maintenancePeriodKey(currentBudgetYear(now));

  return db.$transaction(async (tx) => {
    const thisYear = await tx.policyEffectLog.findMany({
      where: {
        policy: { countryId },
        effectType: MAINTENANCE_DEBIT_EFFECT,
        notes: periodKey,
      },
      select: { policyId: true, actualEffect: true },
    });
    const charged = new Set(thisYear.map((d) => d.policyId));
    const due = costed.filter((p) => !charged.has(p.id));
    if (due.length === 0) return { policiesDebited: 0, totalDebited: 0 };

    const spent = thisYear.reduce((sum, row) => sum + maintenanceCharge(row.actualEffect), 0);
    const charges = chargeMaintenance(
      totalBudget,
      spent,
      due.map((p) => p.maintenanceCost)
    );
    await tx.policyEffectLog.createMany({
      data: due.map((p, i) => ({
        policyId: p.id,
        appliedIxTime: now,
        effectType: MAINTENANCE_DEBIT_EFFECT,
        notes: periodKey,
        actualEffect: maintenanceEffect(charges[i]!),
      })),
    });

    const total = charges.reduce((sum, charge) => sum + charge, 0);
    // A ledger entry only: maintenance is spending within the year, not a debit of the budget.
    await CountryEventSpine.recordCountryEvent({
      db: tx as PrismaClient,
      countryId,
      now,
      sourceType: "policy",
      description: `Policy maintenance (${periodKey}): ${total.toLocaleString()} spent on active policies: ${due
        .map((p, i) => `"${p.name}" (${charges[i]!.toLocaleString()})`)
        .join(", ")}`,
    });
    return { policiesDebited: due.length, totalDebited: total };
  });
}
