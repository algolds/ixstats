/**
 * Policy lifecycle: repeal, expiry, and the once-per-budget-year maintenance debit.
 *
 * - CivCap: a policy holds `civCapCost` only while `status === "active"` (the shared sum in
 *   lib/government/civcap.ts), so moving it to `repealed` or `expired` releases it.
 * - Simulation: an active policy's growth effect is a StorytellerEffect tagged `POLICY:<id>`
 *   (./effects-sync); ending the policy clears it.
 * - Maintenance (PL-8): `maintenanceCost` is an annual figure (e.g. a stipend × population), and
 *   the `policy-maintenance` job runs every 6 h. Each debit is recorded as a PolicyEffectLog row
 *   (`effectType` MAINTENANCE_DEBIT, `notes` "FY<budget year>"), so a policy is debited at most
 *   once per IxTime budget year however often the job runs.
 */
import type { PrismaClient } from "@prisma/client";
import { CountryEventSpine } from "~/lib/activity";
import { IxTime } from "~/lib/ixtime";
import { currentBudgetYear } from "~/lib/government/budget-year";
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
 * End an enacted policy: set its status, clear its simulation effect and log it. Returns false
 * when the policy was not enacted (already ended, or never enacted), so nothing changed.
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

  await clearPolicyEffect(db, policyId);
  await db.policyEffectLog.create({
    data: {
      policyId,
      appliedIxTime: IxTime.getCurrentIxTime(),
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
 * Debit one country's active policies for the current budget year, skipping any policy already
 * debited this year. The debit and its PolicyEffectLog markers are written in one transaction.
 * Returns the policies debited and the total.
 */
export async function debitCountryMaintenance(
  db: PrismaClient,
  countryId: string,
  policies: MaintenancePolicy[],
  budgetYear: number = currentBudgetYear()
): Promise<{ policiesDebited: number; totalDebited: number }> {
  const costed = policies.filter((p) => (p.maintenanceCost || 0) > 0);
  if (costed.length === 0) return { policiesDebited: 0, totalDebited: 0 };
  const periodKey = maintenancePeriodKey(budgetYear);

  return db.$transaction(async (tx) => {
    const done = await tx.policyEffectLog.findMany({
      where: {
        policyId: { in: costed.map((p) => p.id) },
        effectType: MAINTENANCE_DEBIT_EFFECT,
        notes: periodKey,
      },
      select: { policyId: true },
    });
    const debited = new Set(done.map((d) => d.policyId));
    const due = costed.filter((p) => !debited.has(p.id));
    if (due.length === 0) return { policiesDebited: 0, totalDebited: 0 };

    const appliedIxTime = IxTime.getCurrentIxTime();
    await tx.policyEffectLog.createMany({
      data: due.map((p) => ({
        policyId: p.id,
        appliedIxTime,
        effectType: MAINTENANCE_DEBIT_EFFECT,
        notes: periodKey,
        actualEffect: JSON.stringify({ totalBudget: -p.maintenanceCost }),
      })),
    });

    const total = due.reduce((sum, p) => sum + p.maintenanceCost, 0);
    const applied = await CountryEventSpine.recordCountryEvent({
      db: tx as PrismaClient,
      countryId,
      sourceType: "policy",
      description: `Policy Maintenance (${periodKey}): debited total cost of ${total.toLocaleString()} from budget for active policies: ${due
        .map((p) => `"${p.name}" (${p.maintenanceCost.toLocaleString()})`)
        .join(", ")}`,
      consequences: due.map((p) => ({
        targetModel: "GovernmentStructure",
        targetField: "totalBudget",
        operation: "subtract" as const,
        value: p.maintenanceCost,
        effectType: "POLICY_MAINTENANCE",
      })),
    });
    // The spine logs and skips a consequence it cannot apply (e.g. no budget yet); roll the
    // period markers back with it so the policy is debited on a later run instead of never.
    if (applied.length !== due.length) {
      throw new Error(`applied ${applied.length} of ${due.length} maintenance debits`);
    }
    return { policiesDebited: due.length, totalDebited: total };
  });
}
