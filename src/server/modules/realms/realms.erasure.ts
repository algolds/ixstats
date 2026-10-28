/**
 * Account erasure's realm side (Privacy 5.2(3), Terms 2.7): every nation the user owns is released as abandoning it
 * would (`abandonNation`), its material held for purging at once (no reclaim window), and their pending claims are
 * withdrawn so none can later hand a nation to the erased account. Realms they found go back to staff through
 * `returnFoundedRealmsToStaff` (realms.transfer.ts). Called by server/orchestration/account-erasure.ts.
 */
import type { PrismaClient } from "@prisma/client";
import { invalidateCache } from "~/lib/cache";
import { holdNationMaterial } from "./realms.material";
import { dropOfficerPostWithoutNation, releaseNation } from "./realms.ownership";

type ErasureDb = Pick<
  PrismaClient,
  "country" | "user" | "nationMaterialHold" | "realmOfficer" | "realmClaim" | "$transaction"
>;

export interface ErasedRealmUser {
  id: string;
  clerkUserId: string;
}

/** Release every nation `user` owns and withdraw their pending claims; returns the nations released. */
export async function releaseNationsForErasure(
  db: ErasureDb,
  user: ErasedRealmUser,
  now: Date
): Promise<{ released: number; claimsWithdrawn: number }> {
  const nations = await db.country.findMany({
    where: { ownerUserId: user.id },
    select: { id: true, realmId: true },
  });
  for (const nation of nations) {
    await db.$transaction(async (tx) => {
      await holdNationMaterial(tx, {
        countryId: nation.id,
        formerOwnerUserId: user.id,
        reason: "released",
        now,
        purgeAfter: now,
      });
      await releaseNation(tx, nation.id);
      await dropOfficerPostWithoutNation(tx, nation.realmId, user);
    });
  }
  const { count: claimsWithdrawn } = await db.realmClaim.updateMany({
    where: { userId: user.id, status: "pending" },
    data: { status: "withdrawn" },
  });
  // Map summaries (cachedStaticProcedure, 1h) would keep showing the nations as claimed.
  if (nations.length > 0) await invalidateCache(["countries."]).catch(() => undefined);
  return { released: nations.length, claimsWithdrawn };
}
