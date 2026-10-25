/**
 * Mobilisation (research §7.2): reservists report as M × (1 − e^(−t/τ)) on the realm clock. Adding to an order keeps
 * those already reported; demobilising sends everyone home at once (D3 carries the labour hit's slow reversal).
 */
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { DAY_MS, MOBILISATION_TAU_DAYS, mobilisedCount } from "~/lib/military/model";
import { syncDefense } from "./defense.sync";

function branchOf(snapshot: Awaited<ReturnType<typeof syncDefense>>, branchId: string) {
  const branch = snapshot.state.branches.find((b) => b.id === branchId);
  if (!branch) throw new TRPCError({ code: "NOT_FOUND", message: "Military branch not found" });
  return branch;
}

/**
 * Order `reservists` more of the branch's reserve to report. The order's start moves so the count already reported
 * is unchanged: M_new × (1 − e^(−t′/τ)) = reported now.
 */
export async function mobiliseReserves(
  db: PrismaClient,
  input: { countryId: string; branchId: string; reservists: number }
) {
  const snapshot = await syncDefense(db, input.countryId);
  const branch = branchOf(snapshot, input.branchId);
  const now = snapshot.nowClockMs;
  const doctrine = snapshot.state.policy.doctrine;
  const order = branch.mobilisationOrder + Math.floor(input.reservists);
  if (order > branch.reserves) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `The branch has ${Math.floor(branch.reserves).toLocaleString("en-US")} reservists to call up.`,
    });
  }
  const reported = mobilisedCount({
    order: branch.mobilisationOrder,
    orderedClockMs: branch.mobilisationOrderedClockMs,
    nowClockMs: now,
    doctrine,
  });
  const elapsedDays = -MOBILISATION_TAU_DAYS[doctrine] * Math.log(1 - reported / order);
  return db.militaryBranch.update({
    where: { id: branch.id },
    data: { mobilisationOrder: order, mobilisationOrderedClockMs: now - elapsedDays * DAY_MS },
  });
}

export async function demobiliseReserves(
  db: PrismaClient,
  input: { countryId: string; branchId: string }
) {
  const snapshot = await syncDefense(db, input.countryId);
  const branch = branchOf(snapshot, input.branchId);
  return db.militaryBranch.update({
    where: { id: branch.id },
    data: { mobilisationOrder: 0, mobilisationOrderedClockMs: null, mobilised: 0 },
  });
}
