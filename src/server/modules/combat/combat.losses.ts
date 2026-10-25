/**
 * Applying an engagement's losses to the forces (research §7.5 step 4: losses subtract from N and from K_b, valued at
 * the replacement cost of the destroyed catalog items). Casualties come off active duty, then off mobilised
 * reservists; catalog assets lose quantity at their equipment ratio (armor 6×, self-propelled artillery 0.25×,
 * towed artillery 0.1× the personnel rate; aircraft by attrition; ships at the personnel rate); uncatalogued capital
 * loses the branch's generic share. The nation is brought up to date first, so losses land on the current state.
 */
import type { PrismaClient } from "@prisma/client";
import {
  ARMOR_LOSS_RATIO,
  ARTILLERY_LOSS_RATIO,
  MAX_CAPITAL_LOSS,
  SP_ARTILLERY_LOSS_RATIO,
  type BranchLoss,
  type SideLosses,
} from "~/lib/military/combat";
import type { BranchState } from "~/lib/military/model";
import { syncDefense } from "~/server/modules/defense";

const ARMOR = new Set(["tank", "ifv", "apc", "armored_vehicle"]);
const SP_ARTILLERY = new Set(["mlrs", "self_propelled_artillery"]);
const ARTILLERY = new Set(["artillery", "howitzer"]);

/** Share of a catalog asset row destroyed, from its branch's loss and its subcategory. */
export function assetLossShare(loss: BranchLoss, category: string): number {
  if (loss.domain === "air" || loss.domain === "sea") return Math.min(MAX_CAPITAL_LOSS, loss.capitalShare);
  if (loss.domain !== "land" && loss.domain !== "marines") return 0;
  const ratio = ARMOR.has(category)
    ? ARMOR_LOSS_RATIO
    : SP_ARTILLERY.has(category)
      ? SP_ARTILLERY_LOSS_RATIO
      : ARTILLERY.has(category)
        ? ARTILLERY_LOSS_RATIO
        : 1;
  return Math.min(MAX_CAPITAL_LOSS, loss.engagedShare * loss.lossRate * ratio);
}

/** Casualties off active duty first, then off reservists who reported (and their order and the reserve). */
export function personnelAfterLoss(branch: BranchState, casualties: number) {
  const fromActive = Math.min(branch.active, casualties);
  const fromMobilised = Math.min(branch.mobilisationOrder, casualties - fromActive);
  return {
    activeDuty: branch.active - fromActive,
    reserves: Math.max(0, branch.reserves - fromMobilised),
    mobilisationOrder: Math.max(0, Math.floor(branch.mobilisationOrder - fromMobilised)),
  };
}

interface AssetRow {
  id: string;
  branchId: string;
  quantity: number;
  operational: number;
  acquisitionCost: number;
  category: string;
}

/** Remove one side's losses from its branches and assets. Returns the capital destroyed (real). */
export async function applyForceLosses(db: PrismaClient, countryId: string, losses: SideLosses): Promise<number> {
  const hit = losses.branches.filter((b) => b.personnel > 0 || b.capitalShare > 0 || b.lossRate > 0);
  if (hit.length === 0) return 0;
  const snapshot = await syncDefense(db, countryId);
  const assets: AssetRow[] = await db.militaryAsset.findMany({
    where: { branchId: { in: hit.map((b) => b.id) } },
    select: { id: true, branchId: true, quantity: true, operational: true, acquisitionCost: true, category: true },
  });
  let destroyed = 0;
  for (const loss of hit) {
    const branch = snapshot.state.branches.find((b) => b.id === loss.id);
    if (!branch) continue;
    const own = assets.filter((a) => a.branchId === loss.id);
    const catalogValue = own.reduce((sum, a) => sum + a.quantity * a.acquisitionCost, 0);
    let removed = Math.max(0, branch.capital - catalogValue) * loss.capitalShare;
    for (const asset of own) {
      const lost = Math.min(asset.quantity, Math.round(asset.quantity * assetLossShare(loss, asset.category)));
      if (lost <= 0) continue;
      removed += lost * asset.acquisitionCost;
      await db.militaryAsset.update({
        where: { id: asset.id },
        data: { quantity: asset.quantity - lost, operational: Math.max(0, Math.min(asset.operational, asset.quantity - lost)) },
      });
    }
    removed = Math.min(branch.capital, removed);
    destroyed += removed;
    await db.militaryBranch.update({
      where: { id: branch.id },
      data: { ...personnelAfterLoss(branch, loss.personnel), capital: branch.capital - removed },
    });
  }
  return destroyed;
}
