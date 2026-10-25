/**
 * Operations' readiness writes on the derived sub-scores (replacing the old typed unit readiness ±10 / +20 / +5):
 * deploying wears equipment condition; a training exercise lifts training above what O&M sustains (it decays back
 * with the 9-month half-life); other operations leave a reset bill on condition. Wear while deployed comes from the
 * operation type in the monthly tick (`defense.sync`).
 */
import type { PrismaClient } from "@prisma/client";
import {
  DEPLOY_CONDITION_COST,
  OPERATION_RESET_COST,
  TRAINING_EXERCISE_GAIN,
  trainingMax,
} from "~/lib/military/model";
import { syncDefense } from "./defense.sync";

export type OperationReadinessChange = "deploy" | "trainingEnded" | "operationEnded";

/** The branches the given units and assets belong to. */
async function branchesOf(db: PrismaClient, unitIds: string[], assetIds: string[]) {
  const [units, assets] = await Promise.all([
    unitIds.length
      ? db.militaryUnit.findMany({ where: { id: { in: unitIds } }, select: { branchId: true } })
      : [],
    assetIds.length
      ? db.militaryAsset.findMany({ where: { id: { in: assetIds } }, select: { branchId: true } })
      : [],
  ]);
  return new Set([...units, ...assets].map((row) => row.branchId));
}

/** Apply an operation's readiness change to the branches whose units or assets it uses. */
export async function applyOperationReadiness(
  db: PrismaClient,
  input: {
    countryId: string;
    unitIds: string[];
    assetIds: string[];
    change: OperationReadinessChange;
    /** The Generals' "+10% military readiness" on recovery. */
    generalsMultiplier?: number;
  }
): Promise<number> {
  const branchIds = await branchesOf(db, input.unitIds, input.assetIds);
  if (branchIds.size === 0) return 0;
  const snapshot = await syncDefense(db, input.countryId);
  const ceiling = trainingMax(snapshot.state.policy.volunteerShare);
  const gain = TRAINING_EXERCISE_GAIN * (input.generalsMultiplier ?? 1);
  let changed = 0;
  for (const branch of snapshot.state.branches) {
    if (!branchIds.has(branch.id)) continue;
    const data =
      input.change === "trainingEnded"
        ? { readinessTraining: Math.min(Math.max(ceiling, branch.training), branch.training + gain) }
        : {
            readinessCondition: Math.max(
              0,
              branch.condition -
                (input.change === "deploy" ? DEPLOY_CONDITION_COST : OPERATION_RESET_COST)
            ),
          };
    await db.militaryBranch.update({ where: { id: branch.id }, data });
    changed += 1;
  }
  return changed;
}
