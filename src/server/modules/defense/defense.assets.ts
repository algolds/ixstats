/**
 * Assets in service. They arrive only by procurement deliveries (`defense.sync`); a player may rename, describe or
 * mark them, and scrap them. Scrapping removes the asset's share of the branch's capital, so dropping obsolete kit
 * never turns it into fresh uncatalogued capital.
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { syncDefense } from "./defense.sync";

/** Scrap an asset row: its replacement value leaves the branch's capital (scaled when K has depreciated below it). */
export async function scrapAsset(db: PrismaClient, input: { countryId: string; assetId: string }) {
  const snapshot = await syncDefense(db, input.countryId);
  const asset = await db.militaryAsset.findUnique({
    where: { id: input.assetId },
    select: { id: true, branchId: true, catalogKey: true, quantity: true, designYear: true },
  });
  const branch = snapshot.state.branches.find((b) => b.id === asset?.branchId);
  if (!asset || !branch) throw new TRPCError({ code: "NOT_FOUND", message: "Military asset not found" });
  const own = snapshot.assets.filter((a) => a.branchId === branch.id);
  const catalogValue = own.reduce((sum, a) => sum + a.quantity * a.unitRealValue, 0);
  const match = own.find((a) => a.catalogKey === asset.catalogKey && a.designYear === asset.designYear);
  const value = asset.quantity * (match?.unitRealValue ?? 0);
  const removed = catalogValue > 0 ? value * Math.min(1, branch.capital / catalogValue) : 0;
  await db.$transaction([
    db.militaryAsset.delete({ where: { id: asset.id } }),
    db.militaryBranch.update({
      where: { id: branch.id },
      data: { capital: Math.max(0, branch.capital - removed) },
    }),
  ]);
  return { id: asset.id, capitalRemoved: removed };
}
